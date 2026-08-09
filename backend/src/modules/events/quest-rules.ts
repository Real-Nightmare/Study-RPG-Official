/**
 * Quest rules (§30): period keys (IST day / ISO week) and progress math for
 * data-driven quest objectives. Pure functions — no database access.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar day in IST (UTC+05:30) as `YYYY-MM-DD`. */
export function istDayKey(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO-8601 week key `YYYY-Www` (Monday start). */
export function isoWeekKey(now: Date): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const date = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const isoYear = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(isoYear, 0, 4)) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Period key for a quest: '' (event-long), IST day, or ISO week. */
export function periodKeyFor(period: string, now: Date): string {
  if (period === 'daily') return istDayKey(now);
  if (period === 'weekly') return isoWeekKey(now);
  return '';
}

/**
 * How much progress an activity contributes to a quest objective.
 * Returns 0 when the objective does not match the activity.
 */
export function progressDelta(
  objective: Record<string, unknown>,
  activityType: string,
  amount: number,
): number {
  if (objective.type !== 'study_activity') return 0;
  if (objective.activityType !== activityType) return 0;
  return amount > 0 ? amount : 1;
}

/** Progress never exceeds the objective target. */
export function capProgress(progress: number, target: number): number {
  return Math.max(0, Math.min(progress, target));
}
