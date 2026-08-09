/**
 * Pure puzzle streak logic (master prompt §7.9), fully unit-testable.
 *
 * Rules:
 * - Correct ranked puzzle → streak increases.
 * - Incorrect ranked puzzle → streak resets unless a valid streak shield is used.
 * - Practice puzzles do not affect ranked streaks.
 * - Only a limited number of daily ranked puzzles produce game rewards.
 * - Never reuse the same ranked puzzle immediately.
 */

export interface PuzzleStreakState {
  streak: number;
  personalBest: number;
  dailyRankedCount: number;
  lastRankedDay: string | null; // YYYY-MM-DD
  lastRankedPuzzleId: string | null;
}

export interface ApplyAttemptInput {
  state: PuzzleStreakState;
  correct: boolean;
  mode: 'ranked' | 'practice';
  shielded: boolean;
  today: string; // YYYY-MM-DD
}

export interface ApplyAttemptResult {
  streak: number;
  personalBest: number;
  dailyRankedCount: number;
  lastRankedDay: string | null;
  reset: boolean;
}

export const DEFAULT_DAILY_RANKED_LIMIT = 10;

/** Applies a puzzle attempt to a streak state per the §7.9 rules. */
export function applyPuzzleAttempt(input: ApplyAttemptInput): ApplyAttemptResult {
  const { state, correct, mode, shielded, today } = input;

  // Practice puzzles never touch the ranked streak.
  if (mode === 'practice') {
    return {
      streak: state.streak,
      personalBest: state.personalBest,
      dailyRankedCount: state.dailyRankedCount,
      lastRankedDay: state.lastRankedDay,
      reset: false,
    };
  }

  const dayChanged = state.lastRankedDay !== today;
  const dailyRankedCount = dayChanged ? 1 : state.dailyRankedCount + 1;

  let streak = state.streak;
  let reset = false;

  if (correct) {
    streak += 1;
  } else if (!shielded) {
    streak = 0;
    reset = true;
  }
  // With a valid shield the streak is preserved on an incorrect answer.

  return {
    streak,
    personalBest: Math.max(state.personalBest, streak),
    dailyRankedCount,
    lastRankedDay: today,
    reset,
  };
}

/** True when the daily ranked reward limit has been reached for the given day. */
export function dailyRankedLimitReached(
  state: PuzzleStreakState,
  today: string,
  limit = DEFAULT_DAILY_RANKED_LIMIT,
): boolean {
  if (state.lastRankedDay !== today) {
    return false;
  }
  return state.dailyRankedCount >= limit;
}

/** Picks the next ranked puzzle id, never the most recent ranked puzzle. */
export function pickNextRankedPuzzle(
  candidates: Array<{ id: string }>,
  lastRankedPuzzleId: string | null,
): { id: string } | null {
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1 && candidates[0].id === lastRankedPuzzleId) {
    return null;
  }
  const pool = candidates.filter((c) => c.id !== lastRankedPuzzleId);
  const pick = pool.length > 0 ? pool : candidates;
  return pick[Math.floor(Math.random() * pick.length)];
}
