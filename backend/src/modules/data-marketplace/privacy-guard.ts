/**
 * Data marketplace privacy guard (owner brief).
 *
 * Hard rules for anything that may be published to the Ocean Protocol
 * ecosystem — and, more importantly, for anything that must NEVER be:
 *
 *   1. AGGREGATES ONLY — every output field must be an aggregate
 *      (avg_/total_/count_/pct_/rate_/min_/max_/median_ prefixes or an
 *      _avg/_total/_count/_pct suffix). Raw rows and per-user values are
 *      rejected outright.
 *   2. NO PII / NO SENSITIVE TERMS — output field names containing identity or
 *      sensitive material (email, phone, tokens, passwords, names, free-text
 *      content, chat, answers, questions, notes, devices, locations, …) are
 *      rejected. Free text is never exported.
 *   3. MINIMUM GROUP SIZE — a published aggregate must cover at least
 *      `minGroupSize` distinct users.
 *   4. CONSENT COVERAGE — at least `consentThreshold` (default 80%) of the
 *      cohort must have explicitly opted in via `data_consent`, and ONLY
 *      consenting users are ever included in a published aggregate.
 *   5. No raw export flag can be set — every payload is sanitised before it
 *      leaves the module.
 */

export interface PrivacyInput {
  /** Output field names of the aggregate payload (snake_case). */
  fieldNames: string[];
  /** Number of distinct consenting users the aggregate covers. */
  cohortSize: number;
  /** Total users in the cohort (consenting + not). */
  totalCohortSize: number;
  /** Minimum cohort size required for publication. */
  minGroupSize: number;
  /** Minimum consent coverage (0–1). */
  consentThreshold: number;
}

export interface PrivacyVerdict {
  ok: boolean;
  reasons: string[];
  /** Final cohort size used for publication. */
  cohortSize: number;
  /** Consent coverage (0–1). */
  consentCoverage: number;
}

/** Terms that must never appear in an output field name (PII / sensitive). */
export const BLOCKED_FIELD_TERMS = [
  'email',
  'phone',
  'password',
  'passwd',
  'token',
  'secret',
  'cookie',
  'session_id',
  'auth',
  'credential',
  'ip',
  'address',
  'location',
  'gps',
  'device',
  'browser',
  'user_agent',
  'ua',
  'username',
  'name',
  'first',
  'last',
  'birth',
  'age',
  'gender',
  'avatar',
  'content',
  'answer',
  'question',
  'explanation',
  'note',
  'message',
  'chat',
  'conversation',
  'prompt',
  'query',
  'essay',
  'writing',
  'reflection',
  'social',
  'profile',
  'school',
  'board',
  'country',
  'grade',
  'id',
  'uuid',
  'key',
  'hash',
  'checksum',
] as const;

const AGGREGATE_PREFIX =
  /^(avg|total|count|sum|min|max|median|pct|rate|share|mean|per|weekly|daily)_/;
const AGGREGATE_SUFFIX = /_(avg|total|count|sum|min|max|median|pct|rate|share)$/;
const AGGREGATE_WHOLE = /^(total|count|avg|median|min|max)$/;

/** Is this field name an aggregate (and therefore publishable)? */
export function isAggregateField(field: string): boolean {
  const f = field.trim();
  if (!f) return false;
  return AGGREGATE_WHOLE.test(f) || AGGREGATE_PREFIX.test(f) || AGGREGATE_SUFFIX.test(f);
}

/** Does this field name carry PII or sensitive content? */
export function hasBlockedTerm(field: string): boolean {
  const f = field.toLowerCase();
  return BLOCKED_FIELD_TERMS.some(
    (term) => f === term || f.includes(`_${term}`) || f.startsWith(`${term}_`),
  );
}

/** Validate a payload is safe to publish. Returns verdict + reasons. */
export function assertPublishable(input: PrivacyInput): PrivacyVerdict {
  const reasons: string[] = [];
  const coverage = input.totalCohortSize > 0 ? input.cohortSize / input.totalCohortSize : 0;

  for (const field of input.fieldNames) {
    if (!isAggregateField(field)) {
      reasons.push(
        `Field "${field}" is not an aggregate (only aggregate fields may be published).`,
      );
    }
    if (hasBlockedTerm(field)) {
      reasons.push(`Field "${field}" contains a blocked/PII term and must never be published.`);
    }
  }

  if (input.cohortSize < input.minGroupSize) {
    reasons.push(
      `Cohort too small (${input.cohortSize} users < min ${input.minGroupSize}) — aggregates could deanonymise individuals.`,
    );
  }
  if (coverage < input.consentThreshold) {
    reasons.push(
      `Consent coverage ${(coverage * 100).toFixed(0)}% below the required ${(input.consentThreshold * 100).toFixed(0)}%.`,
    );
  }

  return {
    ok: reasons.length === 0,
    reasons,
    cohortSize: input.cohortSize,
    consentCoverage: coverage,
  };
}

/**
 * Strip everything that is not an allowed aggregate field from a row.
 * Keeps only numeric aggregate values; drops ids, keys, text and unknown
 * fields. Used as the final gate before a payload can leave the module.
 */
export function sanitizeAggregate(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!isAggregateField(key) || hasBlockedTerm(key)) continue;
    if (typeof value !== 'number') continue;
    out[key] = value;
  }
  return out;
}

/** Defaults mirrored in `marketplace-config.ts` / `.env.example`. */
export const PRIVACY_DEFAULTS = {
  minGroupSize: 10,
  consentThreshold: 0.8,
};
