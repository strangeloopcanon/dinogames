// Cretaceous Hold'em - Client

// Dino constants (duplicated from server for client use)
const DINO_RANKS = {
  14: "T. rex",
  13: "Spinosaurus",
  12: "Giganotosaurus",
  11: "Allosaurus",
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

const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const SUIT_COLORS = {
  spades: "#1a1a2e",
  hearts: "#e94560",
  diamonds: "#0f3460",
  clubs: "#4ade80",
};

const DINO_SUITS = {
  spades: "Claw",
  hearts: "Leaf",
  diamonds: "Bone",
  clubs: "Egg",
};

// State
let ws = null;
let playerId = null;
let sessionToken = localStorage.getItem("dinopoker_session");
let roomCode = null;
let gameState = null;
let myCards = [];
let legalActions = null;

// DOM Elements
const screens = {
  join: document.getElementById("join-screen"),
  lobby: document.getElementById("lobby-screen"),
  game: document.getElementById("game-screen"),
  showdown: document.getElementById("showdown-screen"),
};

const elements = {
  playerName: document.getElementById("player-name"),
  roomCode: document.getElementById("room-code"),
  joinBtn: document.getElementById("join-btn"),
  connectionStatus: document.getElementById("connection-status"),
  roomCodeDisplay: document.getElementById("room-code-display"),
  lobbyPlayers: document.getElementById("lobby-players"),
  startGameBtn: document.getElementById("start-game-btn"),
  communityCards: document.getElementById("community-cards"),
  potAmount: document.getElementById("pot-amount"),
  phaseIndicator: document.getElementById("phase-indicator"),
  otherPlayers: document.getElementById("other-players"),
  yourCards: document.getElementById("your-cards"),
  yourName: document.getElementById("your-name"),
  yourChips: document.getElementById("your-chips"),
  actions: document.getElementById("actions"),
  gameStatus: document.getElementById("game-status"),
  showdownTitle: document.getElementById("showdown-title"),
  showdownResults: document.getElementById("showdown-results"),
  nextHandBtn: document.getElementById("next-hand-btn"),
  btnFold: document.getElementById("btn-fold"),
  btnCheck: document.getElementById("btn-check"),
  btnCall: document.getElementById("btn-call"),
  btnRaise: document.getElementById("btn-raise"),
  btnAllin: document.getElementById("btn-allin"),
};

// Phase display names
const PHASE_NAMES = {
  preflop: "Pre-Flop",
  flop: "The Flop",
  turn: "The Turn",
  river: "The River",
};

// Screen Management
function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[screenName]?.classList.add("active");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

// Card Rendering
function renderCard(card, faceDown = false) {
  const div = document.createElement("div");
  div.className = `card ${card.suit}`;
  
  if (faceDown) {
    div.classList.add("face-down");
    div.innerHTML = `<span class="card-back">🦖</span>`;
  } else {
    const dinoName = DINO_RANKS[card.rank] || card.rank;
    const suitSymbol = SUIT_SYMBOLS[card.suit];
    div.innerHTML = `
      <span class="card-rank">${dinoName}</span>
      <span class="card-suit">${suitSymbol}</span>
    `;
  }
  
  return div;
}

function renderCards(container, cards, faceDown = false) {
  container.innerHTML = "";
  cards.forEach(card => {
    container.appendChild(renderCard(card, faceDown));
  });
}

// Player Rendering
function renderOtherPlayers(players) {
  elements.otherPlayers.innerHTML = "";
  
  players.forEach(player => {
    if (player.id === playerId) return; // Skip self
    
    const div = document.createElement("div");
    div.className = `other-player ${player.folded ? "folded" : ""} ${player.id === gameState?.players[gameState?.activePlayerIndex]?.id ? "active" : ""}`;
    
    const safeName = escapeHtml(player.name);
    const dealerBadge = player.isDealer ? ' <span class="dealer-badge">(D)</span>' : "";
    const statusText = player.folded ? "Folded" : player.allIn ? "All In" : "";
    
    div.innerHTML = `
      <div class="player-info">
        <span class="player-name">${safeName}${dealerBadge}</span>
        <span class="player-chips">${player.chips}</span>
        ${statusText ? `<span class="player-status">${statusText}</span>` : ""}
        ${player.currentBet > 0 ? `<span class="player-bet">Bet ${player.currentBet}</span>` : ""}
      </div>
      <div class="player-cards">
        ${player.hasCards && !player.folded ? '<div class="card face-down small"><span class="card-back"></span></div><div class="card face-down small"><span class="card-back"></span></div>' : ""}
      </div>
    `;
    
    elements.otherPlayers.appendChild(div);
  });
}

function renderLobbyPlayers(players) {
  elements.lobbyPlayers.innerHTML = "";
  
  players.forEach((player, idx) => {
    const div = document.createElement("div");
    div.className = "lobby-player";
    const safeName = escapeHtml(player.name);
    div.innerHTML = `
      <span class="player-number">${idx + 1}</span>
      <span class="player-name">${safeName}</span>
      ${player.isDealer ? '<span class="dealer-tag">Dealer</span>' : ""}
    `;
    elements.lobbyPlayers.appendChild(div);
  });
  
  // Update start button
  const canStart = players.length >= 2;
  elements.startGameBtn.disabled = !canStart;
  elements.startGameBtn.textContent = canStart 
    ? "Start the Hunt!" 
    : `Need ${2 - players.length} more player(s)`;
}

// Action Buttons
function updateActions(legal) {
  if (!legal) {
    elements.actions.classList.add("hidden");
    return;
  }
  
  elements.actions.classList.remove("hidden");
  
  elements.btnFold.style.display = legal.canFold ? "" : "none";
  elements.btnCheck.style.display = legal.canCheck ? "" : "none";
  elements.btnCall.style.display = legal.canCall ? "" : "none";
  elements.btnRaise.style.display = legal.canRaise ? "" : "none";
  elements.btnAllin.style.display = legal.canAllIn ? "" : "none";
  
  if (legal.canCall) {
    elements.btnCall.textContent = `Call ${legal.callAmount}`;
  }
  if (legal.canRaise) {
    elements.btnRaise.textContent = `Raise ${legal.minRaise}`;
  }
  if (legal.canAllIn) {
    elements.btnAllin.textContent = `All In ${legal.allInAmount}`;
  }
}

// Game State Update
function updateGameUI(state, yourCards, legal) {
  gameState = state;
  myCards = yourCards || [];
  legalActions = legal;
  
  // Find self
  const me = state.players.find(p => p.id === playerId);
  
  // Update pot
  const totalPot = state.pots.reduce((sum, pot) => sum + pot.amount, 0);
  elements.potAmount.textContent = totalPot;
  
  // Update phase indicator
  elements.phaseIndicator.textContent = PHASE_NAMES[state.phase] || "";
  
  // Update community cards
  renderCards(elements.communityCards, state.communityCards);
  
  // Update other players
  renderOtherPlayers(state.players);
  
  // Update your cards
  if (myCards.length > 0) {
    renderCards(elements.yourCards, myCards);
  } else {
    elements.yourCards.innerHTML = "";
  }
  
  // Update your info
  if (me) {
    elements.yourName.textContent = me.name + (me.isDealer ? " (D)" : "");
    elements.yourChips.textContent = me.chips;
  }
  
  // Update actions
  updateActions(legal);
  
  // Update status
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer) {
    const isYourTurn = activePlayer.id === playerId;
    elements.gameStatus.textContent = isYourTurn 
      ? "Your turn!" 
      : `${activePlayer.name}'s turn...`;
    elements.gameStatus.className = isYourTurn ? "your-turn" : "";
  }
}

// Showdown Rendering
function renderShowdown(results) {
  elements.showdownResults.innerHTML = "";
  
  results.forEach(result => {
    const div = document.createElement("div");
    div.className = `showdown-player ${result.isWinner ? "winner" : ""}`;
    const safeName = escapeHtml(result.name);
    
    const cardsHtml = result.holeCards
      .map(card => {
        const dinoName = DINO_RANKS[card.rank];
        const suitSymbol = SUIT_SYMBOLS[card.suit];
        return `<span class="mini-card ${card.suit}">${dinoName} ${suitSymbol}</span>`;
      })
      .join(" ");
    
    div.innerHTML = `
      <div class="showdown-player-name">${safeName}</div>
      <div class="showdown-cards">${cardsHtml}</div>
      <div class="showdown-hand">${result.dinoHandName}</div>
      ${result.isWinner ? `<div class="showdown-pot">+${result.potWon} Amber!</div>` : ""}
    `;
    
    elements.showdownResults.appendChild(div);
  });
}

function renderShowdownFromState(state) {
  elements.showdownResults.innerHTML = "";

  state.players.forEach(player => {
    const div = document.createElement("div");
    div.className = "showdown-player";
    const safeName = escapeHtml(player.name);
    const status = player.folded ? "Folded" : player.allIn ? "All In" : "Still in hand";

    div.innerHTML = `
      <div class="showdown-player-name">${safeName}</div>
      <div class="showdown-hand">${status}</div>
      <div class="showdown-pot">${player.chips} chips</div>
    `;

    elements.showdownResults.appendChild(div);
  });
}

// WebSocket Connection
function connect(room) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  
  ws = new WebSocket(`${protocol}//${host}/party/${room}`);
  
  ws.onopen = () => {
    console.log("Connected to room:", room);
    elements.connectionStatus.textContent = "Connected!";
    roomCode = room;
    
    // Send join message
    const name = elements.playerName.value.trim() || "Dino";
    ws.send(JSON.stringify({
      type: "join",
      name,
      sessionToken,
    }));
  };
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };
  
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    elements.connectionStatus.textContent = "Connection error!";
  };
  
  ws.onclose = () => {
    console.log("Disconnected");
    elements.connectionStatus.textContent = "Disconnected. Refresh to reconnect.";
  };
}

function handleMessage(msg) {
  console.log("Received:", msg.type, msg);
  
  switch (msg.type) {
    case "welcome":
      playerId = msg.playerId;
      sessionToken = msg.sessionToken;
      localStorage.setItem("dinopoker_session", sessionToken);
      elements.roomCodeDisplay.textContent = roomCode.toUpperCase();
      showScreen("lobby");
      break;
      
    case "error":
      elements.connectionStatus.textContent = msg.message;
      alert(msg.message);
      break;
      
    case "player-joined":
      // Will be followed by game-state
      break;
      
    case "game-state":
      if (msg.state.phase === "lobby") {
        showScreen("lobby");
        renderLobbyPlayers(msg.state.players);
      } else if (msg.state.phase === "showdown") {
        showScreen("showdown");
        elements.showdownTitle.textContent = "Hand complete";
        if (elements.showdownResults.childElementCount === 0) {
          renderShowdownFromState(msg.state);
        }
      } else {
        showScreen("game");
        updateGameUI(msg.state, msg.yourCards, msg.legalActions);
      }
      break;
      
    case "action-taken":
      // Visual feedback could be added here
      break;
      
    case "showdown":
      showScreen("showdown");
      renderShowdown(msg.results);
      break;
      
    case "hand-complete":
      elements.showdownTitle.textContent = 
        `${msg.winnerName} wins with ${msg.dinoHandName}`;
      break;
  }
}

function sendAction(type, amount) {
  if (!ws) return;
  ws.send(JSON.stringify({
    type: "action",
    action: { type, amount },
  }));
}

// Event Listeners
elements.joinBtn.addEventListener("click", () => {
  const room = elements.roomCode.value.trim().toUpperCase() || generateRoomCode();
  elements.connectionStatus.textContent = "Connecting...";
  connect(room);
});

elements.playerName.addEventListener("keypress", (e) => {
  if (e.key === "Enter") elements.joinBtn.click();
});

elements.roomCode.addEventListener("keypress", (e) => {
  if (e.key === "Enter") elements.joinBtn.click();
});

elements.startGameBtn.addEventListener("click", () => {
  if (!ws) return;
  ws.send(JSON.stringify({ type: "start-game" }));
});

elements.nextHandBtn.addEventListener("click", () => {
  if (!ws) return;
  ws.send(JSON.stringify({ type: "new-hand" }));
});

elements.btnFold.addEventListener("click", () => sendAction("fold"));
elements.btnCheck.addEventListener("click", () => sendAction("check"));
elements.btnCall.addEventListener("click", () => sendAction("call"));
elements.btnRaise.addEventListener("click", () => sendAction("raise", legalActions?.minRaise));
elements.btnAllin.addEventListener("click", () => sendAction("all-in"));

// Utility
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Initialize
console.log("Cretaceous Hold'em loaded!");
