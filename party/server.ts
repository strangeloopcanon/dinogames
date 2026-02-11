import type * as Party from "partykit/server";
import type { 
  GameState, 
  ClientMessage, 
  ServerMessage, 
  Player, 
  PlayerAction,
  Card
} from "../src/types.js";
import { 
  createInitialState, 
  startNewHand, 
  applyAction, 
  advanceStreet,
  shouldAdvancePhase,
  getLegalActions,
  toPublicState,
  countActivePlayers
} from "../src/game-state.js";
import { runShowdown, shouldAutoShowdown, runOutBoard } from "../src/showdown.js";
import { generateSessionToken } from "../src/session.js";
import { DEFAULT_SETTINGS } from "../src/constants.js";

// Map connection ID to session token for reconnection
type ConnectionMap = Map<string, { sessionToken: string; playerId: string }>;

export default class DinoPokerServer implements Party.Server {
  state: GameState;
  connections: ConnectionMap;

  constructor(readonly room: Party.Room) {
    this.state = createInitialState();
    this.connections = new Map();
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Connection opened: ${conn.id}`);
    // Don't add to game yet - wait for join message
  }

  async onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      this.sendToConnection(sender, { type: "error", message: "Invalid message format" });
      return;
    }

    console.log(`Message from ${sender.id}:`, msg.type);

    switch (msg.type) {
      case "join":
        await this.handleJoin(sender, msg.name, msg.sessionToken);
        break;
      case "start-game":
        await this.handleStartGame(sender);
        break;
      case "action":
        await this.handleAction(sender, msg.action);
        break;
      case "new-hand":
        await this.handleNewHand(sender);
        break;
    }
  }

  onClose(conn: Party.Connection) {
    console.log(`Connection closed: ${conn.id}`);
    void this.handleDisconnect(conn);
  }

  // --- Message Handlers ---

  private async handleJoin(conn: Party.Connection, name: string, sessionToken?: string) {
    const trimmedName = name.trim();

    // Check for reconnection
    if (sessionToken) {
      const existingPlayer = this.state.players.find(p => p.sessionToken === sessionToken);
      if (existingPlayer) {
        // Reconnecting player
        this.connections.set(conn.id, { sessionToken, playerId: existingPlayer.id });
        
        // Update player's connection
        existingPlayer.id = conn.id;
        
        this.sendToConnection(conn, { 
          type: "welcome", 
          playerId: conn.id,
          sessionToken 
        });
        
        await this.broadcastState();
        return;
      }
    }

    // New player
    if (this.state.phase !== "lobby") {
      this.sendToConnection(conn, { 
        type: "error", 
        message: "Game already in progress" 
      });
      return;
    }

    if (this.state.players.length >= DEFAULT_SETTINGS.maxPlayers) {
      this.sendToConnection(conn, { 
        type: "error", 
        message: "Game is full" 
      });
      return;
    }

    // Check for duplicate name
    if (trimmedName && this.state.players.some(p => p.name === trimmedName)) {
      this.sendToConnection(conn, { 
        type: "error", 
        message: "Name already taken" 
      });
      return;
    }

    const newSessionToken = generateSessionToken();
    const newPlayer: Player = {
      id: conn.id,
      name: trimmedName || `Dino${this.state.players.length + 1}`,
      chips: DEFAULT_SETTINGS.startingChips,
      holeCards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      folded: false,
      allIn: false,
      isDealer: this.state.players.length === 0, // First player is dealer
      sessionToken: newSessionToken,
    };

    this.state.players.push(newPlayer);
    this.connections.set(conn.id, { sessionToken: newSessionToken, playerId: conn.id });

    this.sendToConnection(conn, { 
      type: "welcome", 
      playerId: conn.id,
      sessionToken: newSessionToken 
    });

    // Notify all players
    this.room.broadcast(JSON.stringify({
      type: "player-joined",
      player: {
        id: newPlayer.id,
        name: newPlayer.name,
        chips: newPlayer.chips,
        currentBet: 0,
        folded: false,
        allIn: false,
        isDealer: newPlayer.isDealer,
        hasCards: false,
      }
    }));

    await this.broadcastState();
  }

  private async handleStartGame(sender: Party.Connection) {
    this.pruneDisconnectedSeats();

    if (this.state.phase !== "lobby") {
      this.sendToConnection(sender, { 
        type: "error", 
        message: "Game already started" 
      });
      return;
    }

    if (this.state.players.length < DEFAULT_SETTINGS.minPlayers) {
      this.sendToConnection(sender, { 
        type: "error", 
        message: `Need at least ${DEFAULT_SETTINGS.minPlayers} players` 
      });
      return;
    }

    this.state = startNewHand(this.state);
    await this.broadcastState();
  }

  private async handleAction(sender: Party.Connection, action: PlayerAction) {
    const player = this.state.players.find(p => p.id === sender.id);
    if (!player) {
      this.sendToConnection(sender, { type: "error", message: "Not in game" });
      return;
    }

    if (this.state.players[this.state.activePlayerIndex]?.id !== sender.id) {
      this.sendToConnection(sender, { type: "error", message: "Not your turn" });
      return;
    }

    if (this.state.phase === "lobby" || this.state.phase === "showdown") {
      this.sendToConnection(sender, { type: "error", message: "Cannot act now" });
      return;
    }

    // Validate action
    const legalActions = getLegalActions(this.state);
    if (!this.isLegalAction(action, legalActions)) {
      this.sendToConnection(sender, { type: "error", message: "Illegal action" });
      return;
    }

    // Apply action
    this.state = applyAction(this.state, sender.id, action);

    // Broadcast action taken
    this.room.broadcast(JSON.stringify({
      type: "action-taken",
      playerId: sender.id,
      action,
    }));

    // Check for phase advancement
    await this.checkPhaseAdvancement();

    await this.broadcastState();
  }

  private async handleNewHand(sender: Party.Connection) {
    if (this.state.phase !== "showdown") {
      this.sendToConnection(sender, { type: "error", message: "Hand not complete" });
      return;
    }

    this.pruneDisconnectedSeats();

    // Remove busted players
    this.state.players = this.state.players.filter(p => p.chips > 0);

    if (this.state.players.length < DEFAULT_SETTINGS.minPlayers) {
      // Game over - not enough players
      this.state = {
        ...createInitialState(),
        players: this.state.players,
      };
    } else {
      this.state = startNewHand(this.state);
    }

    await this.broadcastState();
  }

  // --- Helper Methods ---

  private isLegalAction(action: PlayerAction, legal: ReturnType<typeof getLegalActions>): boolean {
    switch (action.type) {
      case "fold": return legal.canFold;
      case "check": return legal.canCheck;
      case "call": return legal.canCall;
      case "raise":
        if (!legal.canRaise) return false;
        if (action.amount === undefined) return true;
        return Number.isFinite(action.amount) && action.amount === legal.minRaise;
      case "all-in": return legal.canAllIn;
      default: return false;
    }
  }

  private async handleDisconnect(conn: Party.Connection) {
    this.connections.delete(conn.id);

    const playerIndex = this.state.players.findIndex(p => p.id === conn.id);
    if (playerIndex === -1) return;
    if (this.state.phase === "lobby" || this.state.phase === "showdown") {
      this.removePlayerSeat(conn.id);
      this.room.broadcast(JSON.stringify({ type: "player-left", playerId: conn.id }));
      await this.broadcastState();
      return;
    }

    const disconnectedPlayer = this.state.players[playerIndex];
    if (disconnectedPlayer.folded || disconnectedPlayer.allIn) return;

    if (playerIndex === this.state.activePlayerIndex) {
      this.state = applyAction(this.state, disconnectedPlayer.id, { type: "fold" });
    } else {
      const players = [...this.state.players];
      players[playerIndex] = { ...players[playerIndex], folded: true };
      this.state = { ...this.state, players };
    }

    await this.checkPhaseAdvancement();
    await this.broadcastState();
  }

  private pruneDisconnectedSeats() {
    const connectedIds = new Set(Array.from(this.room.getConnections(), conn => conn.id));
    const disconnectedPlayerIds = this.state.players
      .filter(player => !connectedIds.has(player.id))
      .map(player => player.id);

    for (const playerId of disconnectedPlayerIds) {
      this.removePlayerSeat(playerId);
    }
  }

  private removePlayerSeat(playerId: string) {
    const removedIndex = this.state.players.findIndex(player => player.id === playerId);
    if (removedIndex === -1) return;

    const players = [...this.state.players];
    players.splice(removedIndex, 1);

    let dealerIndex = this.state.dealerIndex;
    if (players.length === 0) {
      dealerIndex = 0;
    } else if (removedIndex < dealerIndex) {
      dealerIndex -= 1;
    } else if (removedIndex === dealerIndex) {
      dealerIndex = dealerIndex % players.length;
    }

    let activePlayerIndex = this.state.activePlayerIndex;
    if (players.length === 0) {
      activePlayerIndex = 0;
    } else if (removedIndex < activePlayerIndex) {
      activePlayerIndex -= 1;
    } else if (removedIndex === activePlayerIndex) {
      activePlayerIndex = activePlayerIndex % players.length;
    }

    let lastRaiserIndex = this.state.lastRaiserIndex;
    if (players.length === 0) {
      lastRaiserIndex = -1;
    } else if (lastRaiserIndex >= 0) {
      if (removedIndex < lastRaiserIndex) {
        lastRaiserIndex -= 1;
      } else if (removedIndex === lastRaiserIndex) {
        lastRaiserIndex = -1;
      }
    }

    const normalizedPlayers = players.map((player, index) => ({
      ...player,
      isDealer: players.length > 0 && index === dealerIndex,
    }));

    this.state = {
      ...this.state,
      players: normalizedPlayers,
      dealerIndex,
      activePlayerIndex,
      lastRaiserIndex,
    };
  }

  private async checkPhaseAdvancement() {
    // Check if only one player left (everyone else folded)
    if (countActivePlayers(this.state) <= 1) {
      await this.runShowdownAndBroadcast();
      return;
    }

    // Check if betting round is complete
    if (shouldAdvancePhase(this.state)) {
      // Check for all-in showdown
      if (shouldAutoShowdown(this.state)) {
        this.state = runOutBoard(this.state);
        await this.runShowdownAndBroadcast();
        return;
      }

      // Advance to next street
      if (this.state.phase === "river") {
        await this.runShowdownAndBroadcast();
      } else {
        this.state = advanceStreet(this.state);
      }
    }
  }

  private async runShowdownAndBroadcast() {
    const { results, winnings, updatedPlayers } = await runShowdown(this.state);
    
    this.state = {
      ...this.state,
      phase: "showdown",
      players: updatedPlayers,
    };

    // Broadcast showdown results
    this.room.broadcast(JSON.stringify({
      type: "showdown",
      results,
    }));

    // Also send hand-complete for simple display
    const winners = results.filter(r => r.isWinner);
    if (winners.length > 0) {
      const mainWinner = winners[0];
      this.room.broadcast(JSON.stringify({
        type: "hand-complete",
        winnerId: mainWinner.playerId,
        winnerName: mainWinner.name,
        handName: mainWinner.handName,
        dinoHandName: mainWinner.dinoHandName,
        potAmount: mainWinner.potWon,
      }));
    }
  }

  private async broadcastState() {
    const publicState = toPublicState(this.state);

    // Send state to each player with their private cards
    for (const conn of this.room.getConnections()) {
      const player = this.state.players.find(p => p.id === conn.id);
      const legalActions = player && this.state.players[this.state.activePlayerIndex]?.id === conn.id
        ? getLegalActions(this.state)
        : undefined;

      const message: ServerMessage = {
        type: "game-state",
        state: publicState,
        yourCards: player?.holeCards,
        legalActions,
      };

      conn.send(JSON.stringify(message));
    }
  }

  private sendToConnection(conn: Party.Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }
}

DinoPokerServer satisfies Party.Worker;
