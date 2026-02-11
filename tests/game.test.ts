import { describe, it, expect, beforeEach } from "vitest";
import { 
  createInitialState, 
  startNewHand, 
  applyAction, 
  getLegalActions,
  countActivePlayers,
  isBettingRoundComplete,
  advanceStreet,
  getNextActivePlayerIndex
} from "../src/game-state.js";
import { createDeck, shuffle } from "../src/deck.js";
import { calculateSidePots, awardPots } from "../src/side-pots.js";
import type { GameState, Player } from "../src/types.js";

describe("Deck", () => {
  it("creates 52 cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it("has 4 suits with 13 cards each", () => {
    const deck = createDeck();
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    
    for (const suit of suits) {
      const suitCards = deck.filter(c => c.suit === suit);
      expect(suitCards).toHaveLength(13);
    }
  });

  it("shuffles in place", () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck);
    
    // Very unlikely to be in same order
    const sameOrder = deck.every((card, i) => 
      card.rank === original[i].rank && card.suit === original[i].suit
    );
    expect(sameOrder).toBe(false);
  });
});

describe("Game State", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    // Add 2 players
    state.players = [
      createTestPlayer("p1", "Alice", 20),
      createTestPlayer("p2", "Bob", 20),
    ];
  });

  it("starts in lobby phase", () => {
    const fresh = createInitialState();
    expect(fresh.phase).toBe("lobby");
  });

  it("starts new hand with correct blinds", () => {
    state = startNewHand(state);
    
    expect(state.phase).toBe("preflop");
    expect(state.players[0].holeCards).toHaveLength(2);
    expect(state.players[1].holeCards).toHaveLength(2);
    
    // In heads-up, dealer posts SB
    const dealerIdx = state.dealerIndex;
    const bbIdx = (dealerIdx + 1) % 2;
    
    expect(state.players[dealerIdx].currentBet).toBe(1); // SB
    expect(state.players[bbIdx].currentBet).toBe(2); // BB
  });

  it("heads-up: dealer acts first preflop", () => {
    state = startNewHand(state);
    
    // In heads-up, dealer (SB) acts first preflop
    expect(state.activePlayerIndex).toBe(state.dealerIndex);
  });

  it("allows fold action", () => {
    state = startNewHand(state);
    const activeIdx = state.activePlayerIndex;
    const activePlayer = state.players[activeIdx];
    
    const legal = getLegalActions(state);
    expect(legal.canFold).toBe(true);
    
    state = applyAction(state, activePlayer.id, { type: "fold" });
    expect(state.players[activeIdx].folded).toBe(true);
  });

  it("allows call action", () => {
    state = startNewHand(state);
    const activeIdx = state.activePlayerIndex;
    const activePlayer = state.players[activeIdx];
    
    const legal = getLegalActions(state);
    expect(legal.canCall).toBe(true);
    expect(legal.callAmount).toBe(1); // Call 1 to match BB of 2
    
    state = applyAction(state, activePlayer.id, { type: "call" });
    expect(state.players[activeIdx].currentBet).toBe(2);
  });

  it("uses server-defined fixed-limit raise size", () => {
    state = startNewHand(state);
    const activeIdx = state.activePlayerIndex;
    const activePlayer = state.players[activeIdx];
    const startingChips = activePlayer.chips;
    const startingPot = state.pots[0].amount;

    state = applyAction(state, activePlayer.id, { type: "raise", amount: -999 });

    // Heads-up preflop: SB must call 1 and raise 1 in fixed-limit.
    expect(state.players[activeIdx].chips).toBe(startingChips - 2);
    expect(state.players[activeIdx].currentBet).toBe(3);
    expect(state.pots[0].amount).toBe(startingPot + 2);
  });
});

describe("Heads-Up Blind Order", () => {
  it("dealer posts small blind in 2-player game", () => {
    let state = createInitialState();
    state.players = [
      createTestPlayer("p1", "Alice", 20),
      createTestPlayer("p2", "Bob", 20),
    ];
    
    state = startNewHand(state);
    
    const dealerPlayer = state.players[state.dealerIndex];
    const otherPlayer = state.players[(state.dealerIndex + 1) % 2];
    
    // Dealer has SB (1), other has BB (2)
    expect(dealerPlayer.currentBet).toBe(1);
    expect(otherPlayer.currentBet).toBe(2);
  });
});

describe("Side Pots", () => {
  it("calculates single pot when no all-in", () => {
    const players: Player[] = [
      createTestPlayer("p1", "Alice", 50, 10),
      createTestPlayer("p2", "Bob", 50, 10),
    ];
    
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(20);
  });

  it("creates side pot for unequal all-in", () => {
    const players: Player[] = [
      { ...createTestPlayer("p1", "Alice", 0, 50), allIn: true },
      { ...createTestPlayer("p2", "Bob", 50, 100), allIn: false },
      { ...createTestPlayer("p3", "Charlie", 0, 100), allIn: true },
    ];
    
    const pots = calculateSidePots(players);
    
    // Main pot: 50*3 = 150 (all eligible)
    // Side pot: 50*2 = 100 (Bob and Charlie only)
    expect(pots).toHaveLength(2);
    expect(pots[0].eligiblePlayerIds).toContain("p1");
    expect(pots[1].eligiblePlayerIds).not.toContain("p1");
  });

  it("awards pot to single winner", () => {
    const pots = [
      { amount: 100, eligiblePlayerIds: ["p1", "p2"] },
    ];
    
    const winnersByPot = new Map<number, string[]>();
    winnersByPot.set(0, ["p1"]);
    
    const winnings = awardPots(pots, winnersByPot);
    expect(winnings.get("p1")).toBe(100);
    expect(winnings.get("p2")).toBeUndefined();
  });

  it("splits pot among multiple winners", () => {
    const pots = [
      { amount: 100, eligiblePlayerIds: ["p1", "p2"] },
    ];
    
    const winnersByPot = new Map<number, string[]>();
    winnersByPot.set(0, ["p1", "p2"]);
    
    const winnings = awardPots(pots, winnersByPot);
    expect(winnings.get("p1")).toBe(50);
    expect(winnings.get("p2")).toBe(50);
  });
});

describe("Betting Round Completion", () => {
  it("heads-up preflop is not complete when SB only calls", () => {
    let state = createInitialState();
    state.players = [
      createTestPlayer("p1", "Alice", 20),
      createTestPlayer("p2", "Bob", 20),
    ];
    state = startNewHand(state);

    const sb = state.players[state.activePlayerIndex];
    state = applyAction(state, sb.id, { type: "call" });

    expect(isBettingRoundComplete(state)).toBe(false);
  });

  it("heads-up preflop completes after BB checks option", () => {
    let state = createInitialState();
    state.players = [
      createTestPlayer("p1", "Alice", 20),
      createTestPlayer("p2", "Bob", 20),
    ];
    state = startNewHand(state);

    const sb = state.players[state.activePlayerIndex];
    state = applyAction(state, sb.id, { type: "call" });

    const bb = state.players[state.activePlayerIndex];
    state = applyAction(state, bb.id, { type: "check" });

    expect(isBettingRoundComplete(state)).toBe(true);
  });

  it("completes when all match bet", () => {
    let state = createInitialState();
    state.players = [
      createTestPlayer("p1", "Alice", 18, 2),
      createTestPlayer("p2", "Bob", 18, 2),
    ];
    state.phase = "flop";
    state.currentBet = 2;
    state.lastRaiserIndex = 0;
    state.activePlayerIndex = 1;
    
    expect(isBettingRoundComplete(state)).toBe(true);
  });

  it("not complete when player hasn't matched", () => {
    let state = createInitialState();
    state.players = [
      createTestPlayer("p1", "Alice", 18, 2),
      createTestPlayer("p2", "Bob", 20, 0),
    ];
    state.phase = "flop";
    state.currentBet = 2;
    
    expect(isBettingRoundComplete(state)).toBe(false);
  });
});

describe("Side Pot Accounting", () => {
  it("does not drop chips when a folded player has the largest contribution", () => {
    const players: Player[] = [
      createTestPlayer("p1", "Alice", 0, 50),
      createTestPlayer("p2", "Bob", 0, 50),
      { ...createTestPlayer("p3", "Charlie", 0, 100), folded: true },
    ];

    const pots = calculateSidePots(players);
    const totalContributed = players.reduce((sum, p) => sum + p.totalBetThisHand, 0);
    const totalPots = pots.reduce((sum, pot) => sum + pot.amount, 0);

    expect(totalPots).toBe(totalContributed);
    expect(pots[0].eligiblePlayerIds).toEqual(expect.arrayContaining(["p1", "p2"]));
  });
});

// Helper
function createTestPlayer(
  id: string, 
  name: string, 
  chips: number, 
  totalBet: number = 0
): Player {
  return {
    id,
    name,
    chips,
    holeCards: [],
    currentBet: totalBet,
    totalBetThisHand: totalBet,
    folded: false,
    allIn: false,
    isDealer: false,
    sessionToken: `token_${id}`,
  };
}
