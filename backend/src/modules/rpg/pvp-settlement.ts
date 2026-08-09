/**
 * PvP duel settlement (Phase 5 — PvP). Pure decision logic.
 *
 * A duel has two independent battles (each side vs the other's ghost). When
 * both are terminal we decide the winner:
 *  1. A decisive win beats a loss.
 *  2. Both won or both lost -> higher remaining HP% wins.
 *  3. Equal HP% -> fewer turns wins.
 *  4. Still equal -> draw (no rating change).
 */
export interface DuelSideOutcome {
  /** Whether the side won their battle. */
  won: boolean;
  /** Remaining HP percentage (0..100) when the battle ended. */
  hpPct: number;
  /** Number of turns played when the battle ended. */
  turns: number;
  /** Whether this side ever played (false = abandoned/expired). */
  played: boolean;
}

export interface DuelMargins {
  challengerHpPct: number;
  defenderHpPct: number;
  challengerTurns: number;
  defenderTurns: number;
}

export type DuelWinner = 'challenger' | 'defender' | 'draw';

export interface SettlementResult {
  winner: DuelWinner;
  reason: 'decisive' | 'hp_percent' | 'turns' | 'forfeit' | 'draw' | 'no_contest';
  margins: DuelMargins;
}

/** Outcome of a finished battle expressed for settlement purposes. */
export function outcomeOf(
  phase: string,
  remainingHp: number,
  maxHp: number,
  turns: number,
  played = true,
): DuelSideOutcome {
  return {
    won: phase === 'player_won',
    hpPct: maxHp > 0 ? Math.round((remainingHp / maxHp) * 100) : 0,
    turns,
    played,
  };
}

/**
 * Decides the duel winner from both side outcomes. Pure, no I/O.
 */
export function settleDuel(
  challenger: DuelSideOutcome,
  defender: DuelSideOutcome,
): SettlementResult {
  const margins: DuelMargins = {
    challengerHpPct: challenger.hpPct,
    defenderHpPct: defender.hpPct,
    challengerTurns: challenger.turns,
    defenderTurns: defender.turns,
  };

  // No contest: neither side played (both expired without a battle).
  if (!challenger.played && !defender.played) {
    return { winner: 'draw', reason: 'no_contest', margins };
  }
  // Forfeit: one side never played -> the other side wins by default.
  if (!challenger.played) {
    return { winner: 'defender', reason: 'forfeit', margins };
  }
  if (!defender.played) {
    return { winner: 'challenger', reason: 'forfeit', margins };
  }

  // Decisive.
  if (challenger.won && !defender.won) {
    return { winner: 'challenger', reason: 'decisive', margins };
  }
  if (defender.won && !challenger.won) {
    return { winner: 'defender', reason: 'decisive', margins };
  }

  // Same outcome -> compare remaining HP%.
  if (challenger.hpPct !== defender.hpPct) {
    return {
      winner: challenger.hpPct > defender.hpPct ? 'challenger' : 'defender',
      reason: 'hp_percent',
      margins,
    };
  }

  // Same HP% -> fewer turns wins.
  if (challenger.turns !== defender.turns) {
    return {
      winner: challenger.turns < defender.turns ? 'challenger' : 'defender',
      reason: 'turns',
      margins,
    };
  }

  return { winner: 'draw', reason: 'draw', margins };
}
