import { describe, expect, it } from '@jest/globals';
import {
  assertPublishable,
  BLOCKED_FIELD_TERMS,
  hasBlockedTerm,
  isAggregateField,
  sanitizeAggregate,
  scanPayloadForPii,
} from './privacy-guard';

describe('privacy-guard', () => {
  describe('isAggregateField', () => {
    it('accepts aggregate prefixes and suffixes', () => {
      expect(isAggregateField('total_focus_minutes')).toBe(true);
      expect(isAggregateField('avg_quiz_accuracy_pct')).toBe(true);
      expect(isAggregateField('count_users')).toBe(true);
      expect(isAggregateField('battle_win_rate')).toBe(true);
      expect(isAggregateField('users_total')).toBe(true);
    });

    it('rejects raw / per-user fields', () => {
      expect(isAggregateField('user_id')).toBe(false);
      expect(isAggregateField('focus_minutes')).toBe(false);
      expect(isAggregateField('score')).toBe(false);
      expect(isAggregateField('')).toBe(false);
    });
  });

  describe('hasBlockedTerm', () => {
    it('blocks PII and sensitive terms', () => {
      expect(hasBlockedTerm('user_email')).toBe(true);
      expect(hasBlockedTerm('phone_number')).toBe(true);
      expect(hasBlockedTerm('access_token')).toBe(true);
      expect(hasBlockedTerm('message_content')).toBe(true);
      expect(hasBlockedTerm('reflection_answer')).toBe(true);
      expect(hasBlockedTerm('country')).toBe(true);
      expect(hasBlockedTerm('school')).toBe(true);
    });

    it('allows clean aggregate fields', () => {
      expect(hasBlockedTerm('total_focus_minutes')).toBe(false);
      expect(hasBlockedTerm('avg_quiz_accuracy_pct')).toBe(false);
      expect(hasBlockedTerm('battle_win_rate')).toBe(false);
    });

    it('blocklist is non-empty', () => {
      expect(BLOCKED_FIELD_TERMS.length).toBeGreaterThan(10);
    });
  });

  describe('assertPublishable', () => {
    const base = {
      fieldNames: ['total_focus_minutes', 'avg_session_minutes'],
      cohortSize: 50,
      totalCohortSize: 60,
      minGroupSize: 10,
      consentThreshold: 0.8,
    };

    it('passes a safe, well-covered aggregate', () => {
      const verdict = assertPublishable(base);
      expect(verdict.ok).toBe(true);
      expect(verdict.reasons).toEqual([]);
      expect(verdict.consentCoverage).toBeCloseTo(50 / 60);
    });

    it('fails when the cohort is below the minimum group size', () => {
      const verdict = assertPublishable({ ...base, cohortSize: 5, totalCohortSize: 60 });
      expect(verdict.ok).toBe(false);
      expect(verdict.reasons.some((r) => r.includes('Cohort too small'))).toBe(true);
    });

    it('fails when consent coverage is below the threshold', () => {
      const verdict = assertPublishable({ ...base, cohortSize: 40, totalCohortSize: 60 });
      expect(verdict.ok).toBe(false);
      expect(verdict.reasons.some((r) => r.includes('Consent coverage'))).toBe(true);
    });

    it('fails when a field is not an aggregate', () => {
      const verdict = assertPublishable({
        ...base,
        fieldNames: ['total_focus_minutes', 'user_id'],
      });
      expect(verdict.ok).toBe(false);
      expect(verdict.reasons.some((r) => r.includes('not an aggregate'))).toBe(true);
    });

    it('fails when a field carries a blocked term', () => {
      const verdict = assertPublishable({
        ...base,
        fieldNames: ['total_focus_minutes', 'avg_email_opens'],
      });
      expect(verdict.ok).toBe(false);
      expect(verdict.reasons.some((r) => r.includes('blocked/PII'))).toBe(true);
    });
  });

  describe('sanitizeAggregate', () => {
    it('keeps only numeric aggregate fields and drops everything else', () => {
      const row = {
        total_focus_minutes: 420,
        avg_session_minutes: 25,
        user_id: 'abc-123',
        user_email: 'x@y.z',
        focus_minutes: 30,
        subject: 'Maths',
      };
      const out = sanitizeAggregate(row);
      expect(out).toEqual({ total_focus_minutes: 420, avg_session_minutes: 25 });
    });
  });

  describe('scanPayloadForPii (value-level defense in depth)', () => {
    it('passes a clean numeric aggregate', () => {
      expect(scanPayloadForPii({ count_users: 50, avg_score_pct: 82.5 })).toEqual([]);
    });

    it('rejects non-numeric values outright', () => {
      const reasons = scanPayloadForPii({
        count_users: 10,
        avg_note: 'student said hello world this is free text',
      });
      expect(reasons.some((r) => r.includes('non-numeric aggregate value'))).toBe(true);
    });

    it('detects email addresses smuggled into values', () => {
      const reasons = scanPayloadForPii({ total_notes: 'contact me at a.b@school.edu' });
      expect(reasons.some((r) => r.includes('email address'))).toBe(true);
    });

    it('detects IP addresses and phone-like runs', () => {
      expect(
        scanPayloadForPii({ avg_metric: 'server 192.168.1.42 logged' }).some((r) =>
          r.includes('IP address'),
        ),
      ).toBe(true);
      expect(
        scanPayloadForPii({ avg_metric: 'call +91 98765 43210 now' }).some((r) =>
          r.includes('phone-number'),
        ),
      ).toBe(true);
    });

    it('detects long digit runs (possible identifiers)', () => {
      expect(
        scanPayloadForPii({ avg_metric: 'aadhaar 123456789012' }).some((r) =>
          r.includes('long digit run'),
        ),
      ).toBe(true);
    });

    it('rejects arrays and objects — scalars only', () => {
      const reasons = scanPayloadForPii({
        count_rows: [1, 2, 3],
        nested: { deep: true },
      });
      expect(reasons.some((r) => r.includes('"count_rows" is an array'))).toBe(true);
      expect(reasons.some((r) => r.includes('"nested" is an object'))).toBe(true);
    });
  });
});
