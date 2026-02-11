import type { Player, Pot } from "./types.js";

/**
 * Calculate side pots for situations where players are all-in with different amounts
 * 
 * Example: Player A bets 100, Player B all-in for 50, Player C calls 100
 * Main pot: 150 (50 from each, all 3 eligible)
 * Side pot: 100 (50 from A and C, only A and C eligible)
 */
export function calculateSidePots(players: Player[]): Pot[] {
  // Get all non-folded players with their total bets this hand
  const activePlayers = players
    .filter(p => !p.folded)
    .map(p => ({
      id: p.id,
      totalBet: p.totalBetThisHand,
    }))
    .sort((a, b) => a.totalBet - b.totalBet);

  if (activePlayers.length === 0) {
    return [{ amount: 0, eligiblePlayerIds: [] }];
  }

  const pots: Pot[] = [];
  let previousBetLevel = 0;

  // Build pots across all contribution levels so committed chips are fully represented.
  const betLevels = [...new Set(players.map(p => p.totalBetThisHand).filter(bet => bet > 0))]
    .sort((a, b) => a - b);

  for (const betLevel of betLevels) {
    const contribution = betLevel - previousBetLevel;
    if (contribution <= 0) continue;

    // Players eligible for this pot are those who bet at least this level
    const eligiblePlayers = activePlayers
      .filter(p => p.totalBet >= betLevel)
      .map(p => p.id);

    // Calculate pot amount: contribution from all players (capped at their total bet)
    let potAmount = 0;
    for (const player of players) {
      const playerContribution = Math.min(
        Math.max(0, player.totalBetThisHand - previousBetLevel),
        contribution
      );
      potAmount += playerContribution;
    }

    if (potAmount > 0 && eligiblePlayers.length === 0 && pots.length > 0) {
      // Folded-only overbets should not disappear from accounting.
      pots[pots.length - 1].amount += potAmount;
    } else if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligiblePlayers,
      });
    }

    previousBetLevel = betLevel;
  }

  // If no pots created (everyone folded?), return empty main pot
  if (pots.length === 0) {
    return [{ amount: 0, eligiblePlayerIds: players.filter(p => !p.folded).map(p => p.id) }];
  }

  return pots;
}

/**
 * Award pots to winners
 * Returns a map of playerId -> amount won
 */
export function awardPots(
  pots: Pot[],
  winnersByPot: Map<number, string[]> // potIndex -> winner playerIds
): Map<string, number> {
  const winnings = new Map<string, number>();

  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i];
    const winners = winnersByPot.get(i) || [];
    
    if (winners.length === 0) {
      // No winner for this pot (shouldn't happen in normal play)
      continue;
    }

    // Split pot among winners
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    for (let j = 0; j < winners.length; j++) {
      const winnerId = winners[j];
      const amount = share + (j < remainder ? 1 : 0); // First winner(s) get remainder
      winnings.set(winnerId, (winnings.get(winnerId) || 0) + amount);
    }
  }

  return winnings;
}

/**
 * Merge all pots into a single main pot (for simple cases without side pots)
 */
export function mergePots(pots: Pot[]): Pot {
  const totalAmount = pots.reduce((sum, pot) => sum + pot.amount, 0);
  const allEligible = [...new Set(pots.flatMap(pot => pot.eligiblePlayerIds))];
  
  return {
    amount: totalAmount,
    eligiblePlayerIds: allEligible,
  };
}

/**
 * Check if side pots are needed (any player all-in with less than max bet)
 */
export function needsSidePots(players: Player[]): boolean {
  const activePlayers = players.filter(p => !p.folded);
  if (activePlayers.length <= 1) return false;
  
  const allInPlayers = activePlayers.filter(p => p.allIn);
  if (allInPlayers.length === 0) return false;
  
  const maxBet = Math.max(...activePlayers.map(p => p.totalBetThisHand));
  
  // Side pots needed if any all-in player bet less than max
  return allInPlayers.some(p => p.totalBetThisHand < maxBet);
}
