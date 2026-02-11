// Game phases - state machine states
export type GamePhase = 
  | "lobby"      // Waiting for players, game not started
  | "preflop"    // Cards dealt, first betting round
  | "flop"       // 3 community cards revealed
  | "turn"       // 4th community card
  | "river"      // 5th community card
  | "showdown";  // Reveal hands, determine winner

// Card representation
export interface Card {
  rank: Rank;
  suit: Suit;
}

// Standard poker ranks (2-14, where 14 = Ace)
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

// Suits mapped to dino clans
export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

// Player actions
export type ActionType = "fold" | "check" | "call" | "raise" | "all-in";

export interface PlayerAction {
  type: ActionType;
  amount?: number; // For raise/call/all-in
}

// Player state
export interface Player {
  id: string;           // Connection ID
  name: string;
  chips: number;        // Current chip count (Amber Nuggets)
  holeCards: Card[];    // 2 private cards (only sent to this player)
  currentBet: number;   // Amount bet this street
  totalBetThisHand: number; // Total bet this hand (for side pots)
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  sessionToken: string; // For reconnection
}

// Public player info (sent to all players)
export interface PublicPlayer {
  id: string;
  name: string;
  chips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  hasCards: boolean;    // Whether they have hole cards (don't reveal which)
}

// Legal actions a player can take on their turn
export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  canAllIn: boolean;
  allInAmount: number;
}

// Pot structure (for side pots)
export interface Pot {
  amount: number;
  eligiblePlayerIds: string[]; // Players who can win this pot
}

// Full game state (server-side)
export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  pots: Pot[];             // Main pot + side pots
  currentBet: number;      // Current bet to match this street
  dealerIndex: number;     // Index of dealer in players array
  activePlayerIndex: number; // Whose turn it is
  lastRaiserIndex: number; // Who raised last (for round completion)
  raisesThisStreet: number; // Count raises (max 3 in fixed-limit)
  deck: Card[];            // Remaining cards in deck
  smallBlind: number;
  bigBlind: number;
  streetBetSize: number;   // 1 for preflop/flop, 2 for turn/river
}

// Public game state (sent to clients)
export interface PublicGameState {
  phase: GamePhase;
  players: PublicPlayer[];
  communityCards: Card[];
  pots: Pot[];
  currentBet: number;
  dealerIndex: number;
  activePlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
}

// Messages from client to server
export type ClientMessage =
  | { type: "join"; name: string; sessionToken?: string }
  | { type: "start-game" }
  | { type: "action"; action: PlayerAction }
  | { type: "new-hand" };

// Messages from server to client
export type ServerMessage =
  | { type: "welcome"; playerId: string; sessionToken: string }
  | { type: "error"; message: string }
  | { type: "game-state"; state: PublicGameState; yourCards?: Card[]; legalActions?: LegalActions }
  | { type: "player-joined"; player: PublicPlayer }
  | { type: "player-left"; playerId: string }
  | { type: "action-taken"; playerId: string; action: PlayerAction }
  | { type: "showdown"; results: ShowdownResult[] }
  | { type: "hand-complete"; winnerId: string; winnerName: string; handName: string; dinoHandName: string; potAmount: number };

// Showdown result for each player
export interface ShowdownResult {
  playerId: string;
  name: string;
  holeCards: Card[];
  handName: string;      // e.g., "Full House"
  dinoHandName: string;  // e.g., "Herd + Hunter"
  handRank: number;      // For comparison
  isWinner: boolean;
  potWon: number;
}

// Hand evaluation result
export interface HandEvaluation {
  handName: string;
  dinoHandName: string;
  rank: number;         // Higher is better
  cards: Card[];        // The 5 cards that make the hand
}
