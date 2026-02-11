import type { GameState, Player, ShowdownResult, Card } from "./types.js";
import { evaluateHand, determineWinners } from "./evaluator.js";
import { calculateSidePots, awardPots } from "./side-pots.js";

/**
 * Run the showdown and determine winners for all pots
 */
export async function runShowdown(state: GameState): Promise<{
  results: ShowdownResult[];
  winnings: Map<string, number>;
  updatedPlayers: Player[];
}> {
  const activePlayers = state.players.filter(p => !p.folded);
  
  // If only one player left, they win by default
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const totalPot = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
    
    const results: ShowdownResult[] = [{
      playerId: winner.id,
      name: winner.name,
      holeCards: winner.holeCards,
      handName: "Winner by fold",
      dinoHandName: "Last Dino Standing",
      handRank: 0,
      isWinner: true,
      potWon: totalPot,
    }];
    
    const winnings = new Map<string, number>();
    winnings.set(winner.id, totalPot);
    
    const updatedPlayers = state.players.map(p => 
      p.id === winner.id 
        ? { ...p, chips: p.chips + totalPot }
        : p
    );
    
    return { results, winnings, updatedPlayers };
  }
  
  // Calculate side pots
  const pots = calculateSidePots(state.players);
  
  // Evaluate all hands
  const handEvaluations = await Promise.all(
    activePlayers.map(async (player) => {
      const allCards = [...player.holeCards, ...state.communityCards];
      const evaluation = await evaluateHand(allCards);
      return {
        player,
        evaluation,
      };
    })
  );
  
  // Determine winners for each pot
  const winnersByPot = new Map<number, string[]>();
  
  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];
    const eligibleHands = handEvaluations.filter(h => 
      pot.eligiblePlayerIds.includes(h.player.id)
    );
    
    if (eligibleHands.length === 0) continue;
    
    // Find the best hand(s) among eligible players
    const playerCards = eligibleHands.map(h => ({
      playerId: h.player.id,
      holeCards: h.player.holeCards,
    }));
    
    const winnerIds = await determineWinners(playerCards, state.communityCards);
    winnersByPot.set(potIndex, winnerIds);
  }
  
  // Award pots
  const winnings = awardPots(pots, winnersByPot);
  
  // Build showdown results
  const results: ShowdownResult[] = handEvaluations.map(({ player, evaluation }) => ({
    playerId: player.id,
    name: player.name,
    holeCards: player.holeCards,
    handName: evaluation.handName,
    dinoHandName: evaluation.dinoHandName,
    handRank: evaluation.rank,
    isWinner: winnings.has(player.id) && (winnings.get(player.id) || 0) > 0,
    potWon: winnings.get(player.id) || 0,
  }));
  
  // Sort by hand rank (best first)
  results.sort((a, b) => b.handRank - a.handRank);
  
  // Update player chips
  const updatedPlayers = state.players.map(p => ({
    ...p,
    chips: p.chips + (winnings.get(p.id) || 0),
  }));
  
  return { results, winnings, updatedPlayers };
}

/**
 * Check if showdown should happen immediately (all players all-in or only one can act)
 */
export function shouldAutoShowdown(state: GameState): boolean {
  const activePlayers = state.players.filter(p => !p.folded);
  if (activePlayers.length <= 1) return false; // Will be handled as fold-win
  
  const actingPlayers = activePlayers.filter(p => !p.allIn);
  
  // If 0 or 1 players can act, run out the board
  return actingPlayers.length <= 1;
}

/**
 * Run out remaining community cards for all-in showdown
 */
export function runOutBoard(state: GameState): GameState {
  const deck = [...state.deck];
  const communityCards = [...state.communityCards];
  
  // Deal remaining community cards
  while (communityCards.length < 5 && deck.length > 0) {
    // Burn
    if (deck.length > 0) deck.shift();
    // Deal
    if (deck.length > 0) {
      const card = deck.shift();
      if (card) communityCards.push(card);
    }
  }
  
  return {
    ...state,
    phase: "showdown",
    communityCards,
    deck,
  };
}
