/**
 * Pure monthly faction settlement (Phase 6). Periods are calendar months in
 * IST (Asia/Kolkata): period_key 'YYYY-MM'. Ranking + reward computation is
 * pure so it can be unit tested without a database.
 */

/** Current month as 'YYYY-MM' in IST. */
export function currentPeriodKeyIST(now: Date = new Date()): string {
  return periodKeyIST(now);
}

export function periodKeyIST(date: Date): string {
  const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}`;
}

/** Previous month period key in IST. */
export function previousPeriodKeyIST(now: Date = new Date()): string {
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  ist.setDate(1);
  ist.setMonth(ist.getMonth() - 1);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}`;
}

export interface FactionSettlementInput {
  factionId: string;
  name: string;
  score: number;
  previousScore: number | null;
}

export interface FactionSettlementResult {
  rank: number;
  factionId: string;
  name: string;
  score: number;
  previousScore: number | null;
  /** true when the faction improved vs its previous period score */
  improved: boolean;
  /** reward tier granted by the settlement */
  tier: 'gold' | 'silver' | 'bronze' | 'improved' | 'none';
  /** STP amount for this tier */
  stpReward: number;
  /** For the winning faction: id of the weakest faction it must help. */
  helpPledgeToward: string | null;
}

export interface SettlementRewardConfig {
  topCount: number; // # of factions that get tiered rewards
  goldStp: number;
  silverStp: number;
  bronzeStp: number;
  improvementStp: number;
}

export const DEFAULT_SETTLEMENT_REWARD: SettlementRewardConfig = {
  topCount: 3,
  goldStp: 300,
  silverStp: 200,
  bronzeStp: 100,
  improvementStp: 50,
};

/**
 * Rank factions by score and assign rewards. The weakest faction always
 * receives a help pledge from the strongest (leader-faction responsibility).
 * Factions whose score improved vs the previous month get an improvement
 * reward — this is the "weaker factions improve → rewarded" mechanic.
 */
export function settleFactions(
  inputs: FactionSettlementInput[],
  config: SettlementRewardConfig = DEFAULT_SETTLEMENT_REWARD,
): FactionSettlementResult[] {
  if (inputs.length === 0) {
    return [];
  }

  const sorted = [...inputs].sort((a, b) => b.score - a.score);
  const weakest = sorted[sorted.length - 1];

  return sorted.map((input, index) => {
    const rank = index + 1;
    let tier: FactionSettlementResult['tier'] = 'none';
    let stpReward = 0;

    if (rank === 1) {
      tier = 'gold';
      stpReward = config.goldStp;
    } else if (rank === 2) {
      tier = 'silver';
      stpReward = config.silverStp;
    } else if (rank === 3 && config.topCount >= 3) {
      tier = 'bronze';
      stpReward = config.bronzeStp;
    }

    const improved =
      input.previousScore !== null && input.previousScore !== undefined && input.previousScore > 0
        ? input.score > input.previousScore
        : false;

    if (improved && tier === 'none') {
      tier = 'improved';
      stpReward = config.improvementStp;
    } else if (improved) {
      stpReward += config.improvementStp;
    }

    return {
      rank,
      factionId: input.factionId,
      name: input.name,
      score: input.score,
      previousScore: input.previousScore,
      improved,
      tier,
      stpReward,
      // The winning faction must help the weakest (or forfeit the bonus).
      helpPledgeToward: rank === 1 ? weakest.factionId : null,
    };
  });
}
