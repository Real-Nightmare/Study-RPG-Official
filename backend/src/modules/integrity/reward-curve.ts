/**
 * Reward math for the Study RPG integrity economy (spec 014, US1/FR-002).
 *
 * Pure functions — no database access, fully unit-testable. The reward
 * algorithm scales *exponentially* with accuracy so that slop-farming (rapid
 * wrong answers, passive timers) collapses toward zero while genuine mastery
 * is amplified.
 */

export type MaterialDifficulty = 'easy' | 'medium' | 'hard';

export interface RewardInput {
  /** Fraction of questions correct, 0..1. */
  accuracy: number;
  /** Focus consistency, 0..1 (e.g. rolling 7-day session adherence). */
  focusConsistency?: number;
  /** Difficulty of the study material. */
  difficulty?: MaterialDifficulty;
  /** Campfire multiplier already granted (1.0..1.5). */
  campfireMultiplier?: number;
}

/**
 * Exponential accuracy factor:
 *   accuracy < 0.6            → 0        (no premium reward — anti-farm floor)
 *   accuracy in [0.6, 1]      → 1 + ((a - 0.6) / 0.4)^2 * 2.5
 * At 60% → 1.0; at 100% → 3.5 (quadratic/exponential tail: mastery is rewarded
 * disproportionately more than bare passing).
 */
export function accuracyFactor(accuracy: number): number {
  const a = Math.max(0, Math.min(1, accuracy));
  if (a < 0.6) return 0;
  const t = (a - 0.6) / 0.4;
  return 1 + t * t * 2.5;
}

/**
 * Focus-consistency factor: linear boost up to +50% when the student's
 * behaviour is consistent (streaks, no flaky patterns).
 */
export function focusFactor(consistency: number): number {
  const c = Math.max(0, Math.min(1, consistency));
  return 1 + c * 0.5;
}

/** Material difficulty factor: easy 1.0, medium 1.5, hard 2.0. */
export function difficultyFactor(difficulty: MaterialDifficulty): number {
  switch (difficulty) {
    case 'hard':
      return 2.0;
    case 'medium':
      return 1.5;
    case 'easy':
    default:
      return 1.0;
  }
}

/**
 * Campfire multiplier from the metacognitive reflection depth score (0..100).
 * depth >= threshold → maxMultiplier (default 1.5); below → interpolated
 * between base (1.0) and max; no answer / depth 0 → 1.0.
 */
export function campfireMultiplier(
  depth: number,
  opts: { depthForFullMultiplier?: number; maxMultiplier?: number; baseMultiplier?: number } = {},
): number {
  const fullAt = opts.depthForFullMultiplier ?? 80;
  const max = opts.maxMultiplier ?? 1.5;
  const base = opts.baseMultiplier ?? 1.0;
  const d = Math.max(0, Math.min(100, depth));
  if (d <= 0) return base;
  if (d >= fullAt) return max;
  const spread = max - base;
  return base + (d / fullAt) * spread;
}

/**
 * Total reward for an activity: integer XP/STP scaled by the product of the
 * exponential accuracy factor, focus consistency, material difficulty and the
 * campfire multiplier. Always ≥ 0; 0 when the accuracy floor is not met.
 */
export function computeReward(base: number, input: RewardInput): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const acc = accuracyFactor(input.accuracy);
  if (acc <= 0) return 0;
  const mult =
    acc *
    focusFactor(input.focusConsistency ?? 0) *
    difficultyFactor(input.difficulty ?? 'easy') *
    (input.campfireMultiplier ?? 1.0);
  return Math.max(0, Math.floor(base * mult));
}

/** Convenience: does this accuracy clear the premium (STP-eligible) bar? */
export function passesPremiumThreshold(accuracy: number, thresholdPct: number): boolean {
  return accuracy * 100 >= thresholdPct;
}
