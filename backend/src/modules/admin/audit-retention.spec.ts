import {
  normalizeRetentionDays,
  retentionCutoff,
  isStale,
  purgeCondition,
} from './audit-retention';

describe('audit-retention (Phase 9)', () => {
  describe('normalizeRetentionDays', () => {
    it('accepts positive integers', () => {
      expect(normalizeRetentionDays(365)).toBe(365);
      expect(normalizeRetentionDays('90')).toBe(90);
    });

    it('disables on 0, negative, or missing', () => {
      expect(normalizeRetentionDays(0)).toBe(0);
      expect(normalizeRetentionDays(-5)).toBe(0);
      expect(normalizeRetentionDays(undefined)).toBe(0);
      expect(normalizeRetentionDays(null)).toBe(0);
      expect(normalizeRetentionDays('abc')).toBe(0);
    });

    it('floors fractional values', () => {
      expect(normalizeRetentionDays(30.9)).toBe(30);
    });
  });

  describe('retentionCutoff', () => {
    const now = new Date('2026-08-06T12:00:00Z');

    it('computes the cutoff for a window', () => {
      const cutoff = retentionCutoff(30, now);
      expect(cutoff.toISOString()).toBe('2026-07-07T12:00:00.000Z');
    });

    it('returns now when disabled', () => {
      expect(retentionCutoff(0, now).getTime()).toBe(now.getTime());
    });
  });

  describe('isStale', () => {
    const now = new Date('2026-08-06T12:00:00Z');

    it('flags entries older than the window', () => {
      expect(isStale(new Date('2025-01-01T00:00:00Z'), 365, now)).toBe(true);
    });

    it('keeps entries inside the window', () => {
      expect(isStale(new Date('2026-08-01T00:00:00Z'), 365, now)).toBe(false);
    });

    it('never flags when disabled', () => {
      expect(isStale(new Date('2020-01-01T00:00:00Z'), 0, now)).toBe(false);
    });
  });

  describe('purgeCondition', () => {
    it('builds a SQL fragment for a positive window', () => {
      expect(purgeCondition(365)).toBe("created_at < NOW() - INTERVAL '365 days'");
    });

    it('returns null when disabled (safety default)', () => {
      expect(purgeCondition(0)).toBeNull();
      expect(purgeCondition(-1)).toBeNull();
    });
  });
});
