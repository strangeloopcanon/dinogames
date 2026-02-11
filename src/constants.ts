import type { Rank, Suit } from "./types.js";

// Dinosaur names for each rank
export const DINO_RANKS: Record<Rank, string> = {
  14: "T. rex",         // Ace (Apex)
  13: "Spinosaurus",    // King
  12: "Giganotosaurus", // Queen
  11: "Allosaurus",     // Jack
  10: "Triceratops",
  9: "Stegosaurus",
  8: "Velociraptor",
  7: "Brachiosaurus",
  6: "Ankylosaurus",
  5: "Parasaurolophus",
  4: "Dilophosaurus",
  3: "Compsognathus",
  2: "Microraptor",
};

// Clan names for each suit
export const DINO_SUITS: Record<Suit, string> = {
  spades: "Claw",
  hearts: "Leaf",
  diamonds: "Bone",
  clubs: "Egg",
};

// Suit symbols for display
export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

// Dino labels for poker hands
export const DINO_HAND_NAMES: Record<string, string> = {
  "High Card": "Lone Fossil",
  "Pair": "Twin Eggs",
  "Two Pair": "Double Nest",
  "Three of a Kind": "Raptor Pack",
  "Straight": "Migration Line",
  "Flush": "Same Clan",
  "Full House": "Herd + Hunter",
  "Four of a Kind": "Stampede",
  "Straight Flush": "Perfect Hunt",
  "Royal Flush": "Meteor Prophecy",
};

// Action names (dino themed)
export const DINO_ACTIONS = {
  fold: "Fold",
  check: "Stalk",
  call: "Match the Roar",
  raise: "Pounce",
  "all-in": "Meteor Strike",
} as const;

// Game terminology
export const DINO_TERMS = {
  chips: "Amber Nuggets",
  pot: "Meat Pile",
  dealerButton: "The Nest",
  smallBlind: "Hatchling Blind",
  bigBlind: "Adult Blind",
  communityCards: "The Hunting Ground",
} as const;

// Default game settings
export const DEFAULT_SETTINGS = {
  startingChips: 20,
  smallBlind: 1,
  bigBlind: 2,
  maxRaisesPerStreet: 3,
  minPlayers: 2,
  maxPlayers: 6,
  // Fixed-limit betting sizes
  preflopFlopBetSize: 1,
  turnRiverBetSize: 2,
} as const;

// Card notation for pokersolver (e.g., "Ah" for Ace of hearts)
export const RANK_TO_NOTATION: Record<Rank, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "T",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};

export const SUIT_TO_NOTATION: Record<Suit, string> = {
  spades: "s",
  hearts: "h",
  diamonds: "d",
  clubs: "c",
};

// Human-readable rank names
export const RANK_NAMES: Record<Rank, string> = {
  14: "Ace",
  13: "King",
  12: "Queen",
  11: "Jack",
  10: "10",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};
