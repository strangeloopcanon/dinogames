import type { Card, HandEvaluation } from "./types.js";
import { cardsToNotation } from "./deck.js";
import { DINO_HAND_NAMES } from "./constants.js";

// pokersolver types (the package doesn't have TypeScript types)
interface PokerSolverHand {
  name: string;
  rank: number;
  cards: Array<{ value: string; suit: string }>;
}

interface PokerSolverStatic {
  solve(cards: string[]): PokerSolverHand;
  winners(hands: PokerSolverHand[]): PokerSolverHand[];
}

// Dynamic import for pokersolver (CommonJS module)
let Hand: PokerSolverStatic | null = null;

async function getPokerSolver(): Promise<PokerSolverStatic> {
  if (!Hand) {
    // @ts-expect-error - pokersolver is CommonJS without types
    const pokersolver = await import("pokersolver");
    Hand = pokersolver.Hand;
  }
  return Hand!;
}

/**
 * Evaluate a poker hand from 5-7 cards
 * Returns the best 5-card hand with dino naming
 */
export async function evaluateHand(cards: Card[]): Promise<HandEvaluation> {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`Invalid card count: ${cards.length}. Need 5-7 cards.`);
  }

  const solver = await getPokerSolver();
  const notation = cardsToNotation(cards);
  const result = solver.solve(notation);

  const dinoName = DINO_HAND_NAMES[result.name] || result.name;

  return {
    handName: result.name,
    dinoHandName: dinoName,
    rank: result.rank,
    cards: cards, // Simplified - return all cards, not just the 5-card hand
  };
}

/**
 * Compare two hands and determine the winner
 * Returns: positive if hand1 wins, negative if hand2 wins, 0 if tie
 */
export async function compareHands(cards1: Card[], cards2: Card[]): Promise<number> {
  const solver = await getPokerSolver();
  
  const hand1 = solver.solve(cardsToNotation(cards1));
  const hand2 = solver.solve(cardsToNotation(cards2));
  
  // Higher rank = better hand in pokersolver
  return hand1.rank - hand2.rank;
}

/**
 * Find the winner(s) from multiple hands
 * Returns indices of winning hands (can be multiple for ties)
 */
export async function findWinners(allCards: Card[][]): Promise<number[]> {
  if (allCards.length === 0) return [];
  if (allCards.length === 1) return [0];

  const solver = await getPokerSolver();
  
  const hands = allCards.map(cards => solver.solve(cardsToNotation(cards)));
  const winningHands = solver.winners(hands);
  
  // Find indices of winning hands
  const winnerIndices: number[] = [];
  for (let i = 0; i < hands.length; i++) {
    if (winningHands.includes(hands[i])) {
      winnerIndices.push(i);
    }
  }
  
  return winnerIndices;
}

/**
 * Evaluate multiple hands and return full results for showdown
 */
export async function evaluateShowdown(
  playerCards: Array<{ playerId: string; holeCards: Card[] }>,
  communityCards: Card[]
): Promise<Array<{
  playerId: string;
  evaluation: HandEvaluation;
}>> {
  const results = await Promise.all(
    playerCards.map(async ({ playerId, holeCards }) => {
      const allCards = [...holeCards, ...communityCards];
      const evaluation = await evaluateHand(allCards);
      return { playerId, evaluation };
    })
  );

  return results;
}

/**
 * Determine winners from showdown results
 * Returns playerIds of winners (can be multiple for split pot)
 */
export async function determineWinners(
  playerCards: Array<{ playerId: string; holeCards: Card[] }>,
  communityCards: Card[]
): Promise<string[]> {
  const allHands = playerCards.map(({ holeCards }) => [...holeCards, ...communityCards]);
  const winnerIndices = await findWinners(allHands);
  return winnerIndices.map(i => playerCards[i].playerId);
}
