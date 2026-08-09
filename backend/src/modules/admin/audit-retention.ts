/**
 * Audit-log retention (PDF Phase 9). Pure logic — no database access.
 * A retention window of 0 / missing / negative disables purging (safety
 * default so a misconfiguration can never wipe the anti-cheating evidence).
 */

/** Normalizes a raw retention value into a safe day count (0 disables). */
export function normalizeRetentionDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** The cut-off date: entries strictly older than this are stale. */
export function retentionCutoff(days: number, now: Date = new Date()): Date {
  if (days <= 0) return now; // disabled → nothing is stale at the boundary
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** True when an entry's createdAt is older than the retention window. */
export function isStale(createdAt: Date, days: number, now: Date = new Date()): boolean {
  if (days <= 0) return false;
  return createdAt.getTime() < retentionCutoff(days, now).getTime();
}

/** Builds the SQL fragment used by the purge (kept pure + testable). */
export function purgeCondition(days: number): string | null {
  if (days <= 0) return null;
  return `created_at < NOW() - INTERVAL '${Math.floor(days)} days'`;
}
