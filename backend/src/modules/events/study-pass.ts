/**
 * StudyPass (§26–§27). 14 levels with cumulative EXP thresholds
 * 0/100/200/300/400/550/700/900/1100/1300/1450/1550/1650/1750. Event EXP is
 * entirely separate from player XP. Pure math — no database access.
 */

export interface StudyPassState {
  level: number;
  exp: number;
  currentThreshold: number;
  nextThreshold: number | null;
  levelProgressPct: number;
  maxed: boolean;
  claimedLevels: number[];
  claimableLevels: number[];
}

/** Highest level index whose threshold is satisfied by `exp`. */
export function levelForExp(exp: number, thresholds: number[]): number {
  let level = 0;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (exp >= thresholds[i]) level = i;
  }
  return level;
}

/** Level indexes the player may still claim (reached and not yet claimed). */
export function claimableLevels(exp: number, thresholds: number[], claimed: number[]): number[] {
  const maxLevel = levelForExp(exp, thresholds);
  const claimedSet = new Set(claimed);
  const out: number[] = [];
  for (let i = 0; i < thresholds.length; i += 1) {
    if (i <= maxLevel && !claimedSet.has(i)) out.push(i);
  }
  return out;
}

/** Builds the full user-facing StudyPass view. */
export function buildStudyPassView(
  exp: number,
  thresholds: number[],
  claimed: number[],
): StudyPassState {
  const level = levelForExp(exp, thresholds);
  const currentThreshold = thresholds[level] ?? 0;
  const nextThreshold = level + 1 < thresholds.length ? thresholds[level + 1] : null;
  const maxed = nextThreshold === null;
  const levelProgressPct =
    nextThreshold === null
      ? 100
      : Math.min(
          100,
          Math.round(((exp - currentThreshold) / (nextThreshold - currentThreshold)) * 100),
        );
  return {
    level,
    exp,
    currentThreshold,
    nextThreshold,
    levelProgressPct,
    maxed,
    claimedLevels: [...claimed].sort((a, b) => a - b),
    claimableLevels: claimableLevels(exp, thresholds, claimed),
  };
}
