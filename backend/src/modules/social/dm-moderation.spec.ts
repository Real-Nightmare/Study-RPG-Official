import { blockedWordHits, countBareLinks, moderationVerdict, isRateLimited } from './dm-moderation';

describe('dm-moderation (Phase 9)', () => {
  describe('blockedWordHits', () => {
    it('detects a blocked phrase case-insensitively', () => {
      expect(blockedWordHits('Let me send NUDES')).toContain('send nudes');
      expect(blockedWordHits('kys')).toContain('kys');
    });

    it('returns an empty list for clean study chat', () => {
      expect(blockedWordHits('Hey, did you finish the quadratic equations quiz?')).toEqual([]);
    });
  });

  describe('countBareLinks', () => {
    it('counts bare links', () => {
      expect(countBareLinks('see https://example.com/a and https://example.com/b now')).toBe(2);
    });

    it('ignores non-link text', () => {
      expect(countBareLinks('no links here, just notes')).toBe(0);
    });
  });

  describe('moderationVerdict', () => {
    it('flags blocked words with severity 2', () => {
      const verdict = moderationVerdict('my address is 12 Elm St');
      expect(verdict.severity).toBe(2);
      expect(verdict.blockedWords).toContain('my address is');
      expect(verdict.reason).toContain('blocked content');
    });

    it('flags link spam (>=4 bare links) with severity 1', () => {
      const body = [1, 2, 3, 4].map((i) => `https://example.com/${i}`).join(' ');
      const verdict = moderationVerdict(body);
      expect(verdict.severity).toBe(1);
      expect(verdict.linkCount).toBe(4);
      expect(verdict.reason).toContain('too many links');
    });

    it('allows a study link or two', () => {
      const verdict = moderationVerdict('Check this: https://ncert.nic.in textbook page');
      expect(verdict.severity).toBe(0);
      expect(verdict.reason).toBeNull();
    });

    it('allows clean messages', () => {
      const verdict = moderationVerdict('Great job on the faction quest today!');
      expect(verdict.severity).toBe(0);
      expect(verdict.blockedWords).toEqual([]);
    });
  });

  describe('isRateLimited', () => {
    it('limits when at the cap', () => {
      expect(isRateLimited(20, 20)).toBe(true);
      expect(isRateLimited(21, 20)).toBe(true);
    });

    it('allows below the cap', () => {
      expect(isRateLimited(19, 20)).toBe(false);
      expect(isRateLimited(0, 20)).toBe(false);
    });

    it('disables limiting for a non-positive cap', () => {
      expect(isRateLimited(100, 0)).toBe(false);
      expect(isRateLimited(100, Number.NaN)).toBe(false);
    });
  });
});
