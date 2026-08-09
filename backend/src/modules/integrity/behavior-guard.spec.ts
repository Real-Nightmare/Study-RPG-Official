import {
  answerTimeSanity,
  clampDailyFocus,
  rateLimited,
  remainingInWindow,
  verifyFocusSession,
} from './behavior-guard';

const MIN = 60_000;

describe('behavior-guard', () => {
  describe('rateLimited (sliding window)', () => {
    const now = 1_000_000;
    it('allows traffic under the cap', () => {
      const events = [{ at: now - 10_000 }, { at: now - 5_000 }];
      expect(rateLimited(events, 5, 60 * MIN, now)).toBe(false);
    });
    it('blocks at the cap within the window', () => {
      const events = Array.from({ length: 5 }, (_, i) => ({ at: now - i * 1000 }));
      expect(rateLimited(events, 5, 60 * MIN, now)).toBe(true);
    });
    it('ignores events outside the window', () => {
      const events = [{ at: now - 2 * 60 * MIN }];
      expect(rateLimited(events, 1, 60 * MIN, now)).toBe(false);
    });
    it('never blocks when max is non-positive', () => {
      expect(rateLimited([{ at: now }], 0, 60 * MIN, now)).toBe(false);
    });
  });

  describe('remainingInWindow', () => {
    it('reports remaining headroom', () => {
      const events = [{ at: Date.now() }];
      expect(remainingInWindow(events, 3, 60 * MIN)).toBe(2);
    });
  });

  describe('answerTimeSanity', () => {
    it('passes credible pacing', () => {
      expect(answerTimeSanity(10 * MIN, 10, 4000)).toBe(true); // 60s/q
    });
    it('rejects rapid-fire submissions', () => {
      expect(answerTimeSanity(5_000, 10, 4000)).toBe(false); // 0.5s/q
    });
    it('returns true when no minimum is configured', () => {
      expect(answerTimeSanity(1, 5, 0)).toBe(true);
    });
  });

  describe('verifyFocusSession', () => {
    it('verifies when server time supports the minutes and engagement exists', () => {
      expect(
        verifyFocusSession({ claimedMinutes: 25, serverElapsedMinutes: 25, engagementCount: 3 }),
      ).toBe('verified');
    });
    it('marks idle (passive timer) when there is no engagement', () => {
      expect(
        verifyFocusSession({ claimedMinutes: 120, serverElapsedMinutes: 120, engagementCount: 0 }),
      ).toBe('idle');
    });
    it('rejects inflated client claims above server elapsed', () => {
      expect(
        verifyFocusSession({ claimedMinutes: 300, serverElapsedMinutes: 30, engagementCount: 1 }),
      ).toBe('inflated');
    });
    it('allows a small grace for rounding', () => {
      expect(
        verifyFocusSession({ claimedMinutes: 32, serverElapsedMinutes: 30, engagementCount: 1 }),
      ).toBe('verified');
    });
  });

  describe('clampDailyFocus', () => {
    it('caps against the daily limit', () => {
      expect(clampDailyFocus(200, 60, 240)).toBe(40);
      expect(clampDailyFocus(240, 60, 240)).toBe(0);
    });
    it('passes through under the cap', () => {
      expect(clampDailyFocus(30, 25, 240)).toBe(25);
    });
  });
});
