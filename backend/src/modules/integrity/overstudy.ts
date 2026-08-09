/**
 * Anti-overstudy / health-first rules for the Study RPG economy (spec 015).
 *
 * Pure functions — no database access, fully unit-testable. They encode the
 * owner mandate: *heavily dampen over-study and promote smarter studying*.
 * The economy deliberately becomes less rewarding the more a student exceeds
 * their healthy daily optimum, rests are encouraged between long blocks, and
 * late-night grinding is dampened — rest is never punished, it is rewarded.
 */

export interface OverStudyOptions {
  /** Focus minutes per day that earn full rewards. */
  optimalDailyMinutes?: number;
  /** After this many minutes, rewards start decaying linearly. */
  decayStartMinutes?: number;
  /** Absolute stop: no new focus sessions may start once reached. */
  hardDailyCapMinutes?: number;
  /** Reward floor factor at/over the hard cap. */
  minFactor?: number;
  /** Rest window (minutes) a student must observe after a long block. */
  sessionCooldownMinutes?: number;
  /** A completed session this long (minutes) triggers the cooldown. */
  cooldownAfterMinutes?: number;
  /** IST hour (0-23) at which night study begins. */
  nightStartHour?: number;
  /** IST hour (0-23) at which night study ends. */
  nightEndHour?: number;
  /** Reward multiplier applied to night-window study activity. */
  nightFactor?: number;
}

/**
 * Diminishing-returns factor for study rewards given the focus minutes already
 * accrued today:
 *   minutes <= decayStart      → 1.0  (full rewards — healthy optimum)
 *   decayStart < m < hardCap   → linear decay 1.0 → minFactor
 *   minutes >= hardCap         → minFactor (heavily dampened)
 * Over-study is never rewarded; it is tolerated but quietly dampened.
 */
export function overStudyFactor(minutesToday: number, opts: OverStudyOptions = {}): number {
  const decayStart = Math.max(0, opts.decayStartMinutes ?? 120);
  const hardCap = Math.max(decayStart, opts.hardDailyCapMinutes ?? 240);
  const minFactor = Math.min(1, Math.max(0, opts.minFactor ?? 0.1));
  const m = Math.max(0, minutesToday);
  if (m <= decayStart) return 1;
  if (m >= hardCap) return minFactor;
  const t = (m - decayStart) / (hardCap - decayStart);
  return Number((1 - t * (1 - minFactor)).toFixed(3));
}

export interface CompletedSession {
  endedAt: Date | null;
  minutes: number;
}

/**
 * Rest-required check: a long enough completed session (>= cooldownAfterMinutes)
 * that ended within the cooldown window means the student should take a real
 * break before starting another focus session. Short sessions never trigger it,
 * so quick recall checks are never blocked.
 */
export function restRequired(
  lastSession: CompletedSession | null,
  now: Date,
  opts: OverStudyOptions = {},
): boolean {
  if (!lastSession || !lastSession.endedAt) return false;
  if ((lastSession.minutes ?? 0) < (opts.cooldownAfterMinutes ?? 60)) return false;
  const elapsed = now.getTime() - new Date(lastSession.endedAt).getTime();
  if (elapsed < 0) return false;
  return elapsed < (opts.sessionCooldownMinutes ?? 20) * 60 * 1000;
}

/** Whole minutes until the cooldown window ends (0 when already allowed). */
export function minutesUntilRestAllowed(
  lastEndedAt: Date | null,
  now: Date,
  cooldownMinutes: number,
): number {
  if (!lastEndedAt) return 0;
  const remainingMs = cooldownMinutes * 60 * 1000 - (now.getTime() - new Date(lastEndedAt).getTime());
  return Math.max(0, Math.ceil(remainingMs / 60000));
}

/**
 * True when `hour` (0-23) falls inside the night window. Handles windows that
 * wrap past midnight (e.g. 22 → 6): hour >= 22 or hour < 6.
 */
export function isNightHour(
  hour: number,
  nightStartHour: number = 22,
  nightEndHour: number = 6,
): boolean {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (nightStartHour === nightEndHour) return false;
  if (nightStartHour < nightEndHour) return h >= nightStartHour && h < nightEndHour;
  return h >= nightStartHour || h < nightEndHour;
}

/** Hour (0-23) in IST (UTC+5:30) for the given instant — the platform's canonical day. */
export function istHour(date: Date): number {
  return new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000).getUTCHours();
}

export type StudyHealthBand = 'fresh' | 'focused' | 'draining' | 'depleted';

export interface StudyHealthView {
  /** 0-100, relative to the healthy daily optimum. */
  percent: number;
  band: StudyHealthBand;
}

/** Health meter for the UI: fresh → focused → draining → depleted. */
export function studyHealth(minutesToday: number, opts: OverStudyOptions = {}): StudyHealthView {
  const optimal = Math.max(1, opts.optimalDailyMinutes ?? 120);
  const hardCap = Math.max(optimal, opts.hardDailyCapMinutes ?? 240);
  const m = Math.max(0, minutesToday);
  let band: StudyHealthBand = 'fresh';
  if (m >= hardCap) band = 'depleted';
  else if (m >= optimal) band = 'draining';
  else if (m >= optimal * 0.6) band = 'focused';
  return {
    percent: Math.max(0, Math.min(100, Math.round((m / optimal) * 100))),
    band,
  };
}

/** Whole minutes of healthy study budget left before the hard cap. */
export function dailyBudgetRemaining(minutesToday: number, hardDailyCapMinutes: number): number {
  return Math.max(0, hardDailyCapMinutes - Math.max(0, minutesToday));
}
