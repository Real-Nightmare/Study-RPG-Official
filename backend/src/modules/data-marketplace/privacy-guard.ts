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

// ---------------------------------------------------------------------------
// Value-level PII scan (defense in depth)
// ---------------------------------------------------------------------------

/** Email address. */
const PII_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** IPv4 / IPv6-ish addresses. */
const PII_IP = /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/i;
/** Phone-like runs: 9+ digits possibly separated by spaces/dashes/parens. */
const PII_PHONE = /(?:^|[\s(])\+?\d[\d\s\-().]{8,}\d(?:$|[\s.).,;])/;
/** Long digit strings that could be national IDs / card numbers. */
const PII_LONG_DIGITS = /\d{9,}/;

/**
 * Scan the serialized payload VALUES for anything that looks like PII even
 * though field names passed the aggregate check (defense in depth). A strict
 * aggregate payload contains only numbers, so any stringy value is already
 * suspicious — this catches emails, phone numbers, IPs, long ID-like digits
 * and free-text smuggled into values.
 *
 * Returns a list of human-readable violations; empty list = clean.
 */
export function scanPayloadForPii(payload: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  const check = (field: string, raw: unknown): void => {
    if (raw === null || raw === undefined) return;
    // Numbers and booleans can never contain PII.
    if (typeof raw === 'number' && Number.isFinite(raw)) return;
    if (typeof raw === 'boolean') return;
    const value = String(raw);
    reasons.push(
      `Field "${field}" has a non-numeric aggregate value — only numeric aggregates may be published.`,
    );
    if (PII_EMAIL.test(value)) {
      reasons.push(`Field "${field}" contains something resembling an email address.`);
    }
    if (PII_IP.test(value)) {
      reasons.push(`Field "${field}" contains something resembling an IP address.`);
    }
    if (PII_PHONE.test(value)) {
      reasons.push(`Field "${field}" contains a phone-number-like sequence.`);
    }
    if (PII_LONG_DIGITS.test(value)) {
      reasons.push(`Field "${field}" contains a long digit run (possible identifier).`);
    }
  };
  for (const [field, value] of Object.entries(payload ?? {})) {
    if (Array.isArray(value)) {
      reasons.push(`Field "${field}" is an array — only scalar numeric aggregates are allowed.`);
      for (const item of value.slice(0, 5)) check(`${field}[]`, item);
    } else if (typeof value === 'object') {
      reasons.push(`Field "${field}" is an object — only scalar numeric aggregates are allowed.`);
    } else {
      check(field, value);
    }
  }
  return reasons;
}

/** Defaults mirrored in `marketplace-config.ts` / `.env.example`. */
export const PRIVACY_DEFAULTS = {
  minGroupSize: 10,
  consentThreshold: 0.8,
};
