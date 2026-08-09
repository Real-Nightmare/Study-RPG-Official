/**
 * Behavioural guards for the Study RPG integrity economy (spec 014, US2/FR-003).
 *
 * Pure functions — no database access, fully unit-testable. They encode the
 * anti-cheese / anti-slop policy: passive timers, rapid-fire wrong answers and
 * bot-spam all collapse toward zero reward.
 */

export interface RateWindowEvent {
  at: number;
}

/**
 * Sliding-window rate limit. Returns true when the caller is over the limit
 * given the window of past events (ms timestamps, ascending or unsorted).
 */
export function rateLimited(
  windowEvents: RateWindowEvent[],
  max: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  if (!Number.isFinite(max) || max <= 0) return false;
  const from = now - windowMs;
  const count = windowEvents.filter((e) => Number(e.at) >= from).length;
  return count >= max;
}

/** Remaining attempts before the cap within the window (for hint messages). */
export function remainingInWindow(
  windowEvents: RateWindowEvent[],
  max: number,
  windowMs: number,
  now: number = Date.now(),
): number {
  const from = now - windowMs;
  const count = windowEvents.filter((e) => Number(e.at) >= from).length;
  return Math.max(0, max - count);
}

/**
 * Answer-time sanity: a credible attempt must spend at least
 * `minMsPerQuestion` per question on average. Rapid submissions are the
 * classic "spam wrong answers to farm gold" pattern.
 */
export function answerTimeSanity(
  totalMs: number,
  questionCount: number,
  minMsPerQuestion: number,
): boolean {
  if (!Number.isFinite(questionCount) || questionCount <= 0) return false;
  if (!Number.isFinite(minMsPerQuestion) || minMsPerQuestion <= 0) return true;
  return totalMs >= questionCount * minMsPerQuestion;
}

/**
 * Focus-session verification (US2 / FR-004).
 *
 * `claimedMinutes`  — minutes the session should count.
 * `serverElapsedMinutes` — server-clock elapsed time.
 * `engagementCount` — verified study signals inside the session window
 *   (quiz/exam attempts, flashcard reviews, teach-back submissions).
 *
 * Returns a verdict:
 *  - verified: server elapsed supports the minutes AND ≥1 engagement signal
 *    (real studying happened, not a passive tab left open).
 *  - idle:     time accrued but zero engagement → not credible; reward at a
 *    reduced factor (the caller applies `focusUnverifiedExpFactor`).
 *  - inflated: client-claimed minutes exceed server elapsed → reject override
 *    outright (this path is the old client-supplied `focusMinutes` cheese).
 */
export function verifyFocusSession(input: {
  claimedMinutes: number;
  serverElapsedMinutes: number;
  engagementCount: number;
  idleGraceMinutes?: number;
}): 'verified' | 'idle' | 'inflated' {
  const claimed = Math.max(0, input.claimedMinutes);
  const elapsed = Math.max(0, input.serverElapsedMinutes);
  const grace = input.idleGraceMinutes ?? 5;

  // Server clock is the source of truth; a client claim above server elapsed
  // (plus a small grace for rounding) is impossible → reject.
  if (claimed > elapsed + grace) return 'inflated';
  // At least one verified study signal inside the window proves engagement.
  if (input.engagementCount > 0) return 'verified';
  return 'idle';
}

/** Clamps focus minutes against the daily cap (returns the capped total). */
export function clampDailyFocus(
  todayMinutes: number,
  newMinutes: number,
  dailyCapMinutes: number,
): number {
  return Math.max(0, Math.min(newMinutes, Math.max(0, dailyCapMinutes - todayMinutes)));
}
