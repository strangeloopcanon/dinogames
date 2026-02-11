import type { GameState, GamePhase, Player, Card, Pot, PublicGameState, PublicPlayer, LegalActions, PlayerAction } from "./types.js";
import { createShuffledDeck, dealCards } from "./deck.js";
import { DEFAULT_SETTINGS } from "./constants.js";

/**
 * Create initial game state for a new room
 */
export function createInitialState(): GameState {
  return {
    phase: "lobby",
    players: [],
    communityCards: [],
    pots: [{ amount: 0, eligiblePlayerIds: [] }],
    currentBet: 0,
    dealerIndex: 0,
    activePlayerIndex: 0,
    lastRaiserIndex: -1,
    raisesThisStreet: 0,
    deck: [],
    smallBlind: DEFAULT_SETTINGS.smallBlind,
    bigBlind: DEFAULT_SETTINGS.bigBlind,
    streetBetSize: DEFAULT_SETTINGS.preflopFlopBetSize,
  };
}

/**
 * Get the index of the next active player (not folded, not all-in if betting)
 */
export function getNextActivePlayerIndex(state: GameState, fromIndex: number, includeAllIn: boolean = false): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const player = state.players[idx];
    if (!player.folded && (includeAllIn || !player.allIn)) {
      return idx;
    }
  }
  return -1; // No active players found
}

/**
 * Count players still in the hand (not folded)
 */
export function countActivePlayers(state: GameState): number {
  return state.players.filter(p => !p.folded).length;
}

/**
 * Count players who can still act (not folded, not all-in)
 */
export function countActingPlayers(state: GameState): number {
  return state.players.filter(p => !p.folded && !p.allIn).length;
}

/**
 * Check if betting round is complete
 * Complete when: all active players have acted and matched the current bet (or are all-in)
 */
export function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(p => !p.folded);
  
  // If only one player left, round is complete
  if (activePlayers.length <= 1) return true;
  
  // If everyone remaining is all-in, round is complete
  const actingPlayers = activePlayers.filter(p => !p.allIn);
  if (actingPlayers.length === 0) return true;
  
  // Check if everyone has matched the bet or is all-in
  for (const player of activePlayers) {
    if (!player.allIn && player.currentBet < state.currentBet) {
      return false; // Someone still needs to act
    }
  }
  
  // Betting round completes only after action returns to the player after the last aggressor.
  // When there is no aggressor (no bet/raise yet), dealer acts as the anchor.
  const actionAnchorIndex = state.lastRaiserIndex >= 0
    ? state.lastRaiserIndex
    : state.dealerIndex;
  const firstToActAfterAnchor = getNextActivePlayerIndex(state, actionAnchorIndex, false);
  if (firstToActAfterAnchor === -1) return true;

  return state.activePlayerIndex === firstToActAfterAnchor;
}

/**
 * Start a new hand
 */
export function startNewHand(state: GameState): GameState {
  if (state.players.length < DEFAULT_SETTINGS.minPlayers) {
    return state; // Not enough players
  }

  // Move dealer button
  const newDealerIndex = (state.dealerIndex + 1) % state.players.length;
  
  // Create fresh deck
  const deck = createShuffledDeck();
  
  // Reset player states
  const players: Player[] = state.players.map((p, idx) => ({
    ...p,
    holeCards: [] as Card[],
    currentBet: 0,
    totalBetThisHand: 0,
    folded: false,
    allIn: false,
    isDealer: idx === newDealerIndex,
  }));
  
  // Deal hole cards (2 to each player)
  for (const player of players) {
    player.holeCards = dealCards(deck, 2);
  }
  
  // Determine blind positions
  const sbIndex = state.players.length === 2 
    ? newDealerIndex  // Heads-up: dealer posts SB
    : (newDealerIndex + 1) % players.length;
  const bbIndex = state.players.length === 2
    ? (newDealerIndex + 1) % players.length
    : (newDealerIndex + 2) % players.length;
  
  // Post blinds
  const sbAmount = Math.min(state.smallBlind, players[sbIndex].chips);
  const bbAmount = Math.min(state.bigBlind, players[bbIndex].chips);
  
  players[sbIndex].chips -= sbAmount;
  players[sbIndex].currentBet = sbAmount;
  players[sbIndex].totalBetThisHand = sbAmount;
  if (players[sbIndex].chips === 0) players[sbIndex].allIn = true;
  
  players[bbIndex].chips -= bbAmount;
  players[bbIndex].currentBet = bbAmount;
  players[bbIndex].totalBetThisHand = bbAmount;
  if (players[bbIndex].chips === 0) players[bbIndex].allIn = true;
  
  // First to act preflop is after BB (or dealer in heads-up)
  const firstToAct = state.players.length === 2
    ? newDealerIndex  // Heads-up: dealer acts first preflop
    : (bbIndex + 1) % players.length;
  
  return {
    ...state,
    phase: "preflop",
    players,
    communityCards: [],
    pots: [{ amount: sbAmount + bbAmount, eligiblePlayerIds: players.map(p => p.id) }],
    currentBet: state.bigBlind,
    dealerIndex: newDealerIndex,
    activePlayerIndex: firstToAct,
    lastRaiserIndex: bbIndex, // BB is considered the "raiser" initially
    raisesThisStreet: 0,
    deck,
    streetBetSize: DEFAULT_SETTINGS.preflopFlopBetSize,
  };
}

/**
 * Advance to next street (flop, turn, river)
 */
export function advanceStreet(state: GameState): GameState {
  const nextPhase: Record<string, GamePhase> = {
    preflop: "flop",
    flop: "turn",
    turn: "river",
    river: "showdown",
  };
  
  const newPhase = nextPhase[state.phase];
  if (!newPhase) return state;
  
  // Deal community cards
  let communityCards = [...state.communityCards];
  const deck = [...state.deck];
  
  if (newPhase === "flop") {
    // Burn and deal 3
    dealCards(deck, 1); // Burn
    communityCards = dealCards(deck, 3);
  } else if (newPhase === "turn" || newPhase === "river") {
    // Burn and deal 1
    dealCards(deck, 1); // Burn
    communityCards.push(...dealCards(deck, 1));
  }
  
  // Reset betting for new street
  const players = state.players.map(p => ({
    ...p,
    currentBet: 0,
  }));
  
  // First to act postflop is first active player after dealer
  const firstToAct = getNextActivePlayerIndex(
    { ...state, players },
    state.dealerIndex,
    false // Exclude all-in players
  );
  
  // Update bet size for turn/river
  const streetBetSize = (newPhase === "turn" || newPhase === "river")
    ? DEFAULT_SETTINGS.turnRiverBetSize
    : DEFAULT_SETTINGS.preflopFlopBetSize;
  
  return {
    ...state,
    phase: newPhase,
    players,
    communityCards,
    currentBet: 0,
    activePlayerIndex: firstToAct >= 0 ? firstToAct : 0,
    // Dealer is the action anchor when no one has bet yet this street.
    lastRaiserIndex: state.dealerIndex,
    raisesThisStreet: 0,
    deck,
    streetBetSize,
  };
}

/**
 * Get legal actions for the current player
 */
export function getLegalActions(state: GameState): LegalActions {
  const player = state.players[state.activePlayerIndex];
  if (!player || player.folded || player.allIn) {
    return {
      canFold: false,
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canRaise: false,
      minRaise: 0,
      maxRaise: 0,
      canAllIn: false,
      allInAmount: 0,
    };
  }
  
  const toCall = Math.max(0, state.currentBet - player.currentBet);
  const canAffordFullRaise = player.chips >= (toCall + state.streetBetSize);
  const canRaise = state.raisesThisStreet < DEFAULT_SETTINGS.maxRaisesPerStreet 
    && canAffordFullRaise;
  
  return {
    canFold: true,
    canCheck: toCall === 0,
    canCall: toCall > 0 && player.chips >= toCall,
    callAmount: Math.min(toCall, player.chips),
    canRaise: canRaise,
    minRaise: state.streetBetSize,
    maxRaise: state.streetBetSize, // Fixed-limit
    canAllIn: player.chips > 0,
    allInAmount: player.chips,
  };
}

/**
 * Apply a player action to the game state
 */
export function applyAction(state: GameState, playerId: string, action: PlayerAction): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1 || playerIndex !== state.activePlayerIndex) {
    return state; // Not this player's turn
  }
  
  const player = state.players[playerIndex];
  const players = [...state.players];
  const pots = [...state.pots];
  
  switch (action.type) {
    case "fold":
      players[playerIndex] = { ...player, folded: true };
      break;
      
    case "check":
      // No change to chips
      break;
      
    case "call": {
      const callAmount = Math.min(Math.max(0, state.currentBet - player.currentBet), player.chips);
      players[playerIndex] = {
        ...player,
        chips: player.chips - callAmount,
        currentBet: player.currentBet + callAmount,
        totalBetThisHand: player.totalBetThisHand + callAmount,
        allIn: player.chips - callAmount === 0,
      };
      pots[0].amount += callAmount;
      break;
    }
    
    case "raise": {
      const callAmount = Math.max(0, state.currentBet - player.currentBet);
      const raiseAmount = state.streetBetSize; // Fixed-limit raise amount is server-defined
      const totalToAdd = callAmount + raiseAmount;
      if (player.chips < totalToAdd) {
        return state; // Must use all-in if player cannot cover a full raise
      }
      
      players[playerIndex] = {
        ...player,
        chips: player.chips - totalToAdd,
        currentBet: player.currentBet + totalToAdd,
        totalBetThisHand: player.totalBetThisHand + totalToAdd,
        allIn: player.chips - totalToAdd === 0,
      };
      pots[0].amount += totalToAdd;
      
      return {
        ...state,
        players,
        pots,
        currentBet: players[playerIndex].currentBet,
        raisesThisStreet: state.raisesThisStreet + 1,
        lastRaiserIndex: playerIndex,
        activePlayerIndex: getNextActivePlayerIndex({ ...state, players }, playerIndex, false),
      };
    }
    
    case "all-in": {
      const allInAmount = player.chips;
      players[playerIndex] = {
        ...player,
        chips: 0,
        currentBet: player.currentBet + allInAmount,
        totalBetThisHand: player.totalBetThisHand + allInAmount,
        allIn: true,
      };
      pots[0].amount += allInAmount;
      
      const newCurrentBet = Math.max(state.currentBet, players[playerIndex].currentBet);
      const isRaise = players[playerIndex].currentBet > state.currentBet;
      
      return {
        ...state,
        players,
        pots,
        currentBet: newCurrentBet,
        raisesThisStreet: isRaise ? state.raisesThisStreet + 1 : state.raisesThisStreet,
        lastRaiserIndex: isRaise ? playerIndex : state.lastRaiserIndex,
        activePlayerIndex: getNextActivePlayerIndex({ ...state, players }, playerIndex, false),
      };
    }
  }
  
  // Move to next player
  const nextPlayerIndex = getNextActivePlayerIndex({ ...state, players }, playerIndex, false);
  
  return {
    ...state,
    players,
    pots,
    activePlayerIndex: nextPlayerIndex >= 0 ? nextPlayerIndex : playerIndex,
  };
}

/**
 * Check if we should advance the game phase
 */
export function shouldAdvancePhase(state: GameState): boolean {
  // Only one player left = immediate win
  if (countActivePlayers(state) <= 1) return true;
  
  // Betting complete
  return isBettingRoundComplete(state);
}

/**
 * Convert game state to public state (hides hole cards and deck)
 */
export function toPublicState(state: GameState): PublicGameState {
  return {
    phase: state.phase,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      isDealer: p.isDealer,
      hasCards: p.holeCards.length > 0,
    })),
    communityCards: state.communityCards,
    pots: state.pots,
    currentBet: state.currentBet,
    dealerIndex: state.dealerIndex,
    activePlayerIndex: state.activePlayerIndex,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
  };
}
