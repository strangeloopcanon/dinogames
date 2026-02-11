import type { Card, Rank, Suit } from "./types.js";
import { DINO_RANKS, DINO_SUITS, RANK_TO_NOTATION, SUIT_TO_NOTATION, SUIT_SYMBOLS } from "./constants.js";

// All ranks and suits
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

/**
 * Create a fresh 52-card deck
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle - cryptographically unbiased
 * Mutates the array in place and returns it
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Create a shuffled deck ready for dealing
 */
export function createShuffledDeck(): Card[] {
  return shuffle(createDeck());
}

/**
 * Deal cards from the deck
 * Mutates the deck array (removes cards from the top)
 */
export function dealCards(deck: Card[], count: number): Card[] {
  if (deck.length < count) {
    throw new Error(`Not enough cards in deck: need ${count}, have ${deck.length}`);
  }
  return deck.splice(0, count);
}

/**
 * Get the dinosaur name for a card
 * e.g., "T. rex of Claw Clan"
 */
export function getCardDinoName(card: Card): string {
  return `${DINO_RANKS[card.rank]} of ${DINO_SUITS[card.suit]} Clan`;
}

/**
 * Get short dinosaur name (just the dino)
 * e.g., "T. rex"
 */
export function getCardDinoShort(card: Card): string {
  return DINO_RANKS[card.rank];
}

/**
 * Get card notation for pokersolver
 * e.g., "Ah" for Ace of hearts
 */
export function cardToNotation(card: Card): string {
  return RANK_TO_NOTATION[card.rank] + SUIT_TO_NOTATION[card.suit];
}

/**
 * Convert multiple cards to pokersolver notation
 */
export function cardsToNotation(cards: Card[]): string[] {
  return cards.map(cardToNotation);
}

/**
 * Get display string for a card (e.g., "A♠" or "10♥")
 */
export function cardToDisplayString(card: Card): string {
  const rankStr = card.rank === 14 ? "A" 
    : card.rank === 13 ? "K"
    : card.rank === 12 ? "Q"
    : card.rank === 11 ? "J"
    : card.rank.toString();
  return rankStr + SUIT_SYMBOLS[card.suit];
}

/**
 * Get display string with dino name
 * e.g., "T. rex ♠" 
 */
export function cardToDinoDisplayString(card: Card): string {
  return `${DINO_RANKS[card.rank]} ${SUIT_SYMBOLS[card.suit]}`;
}

/**
 * Compare two cards by rank (for sorting)
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
export function compareCards(a: Card, b: Card): number {
  return a.rank - b.rank;
}

/**
 * Sort cards by rank (highest first)
 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.rank - a.rank);
}
