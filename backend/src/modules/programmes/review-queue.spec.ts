import { needsReview, reviewHistoryAppend, isSettled, isLive, ReviewEvent } from './review-queue';

describe('review-queue (Phase 8)', () => {
  describe('needsReview', () => {
    it('returns true when there is no review at all', () => {
      expect(needsReview(null)).toBe(true);
      expect(needsReview(undefined)).toBe(true);
      expect(needsReview({})).toBe(true);
    });

    it('returns true when the verdict is missing', () => {
      expect(needsReview({ score: 80 })).toBe(true);
    });

    it('returns true when the score is missing or NaN', () => {
      expect(needsReview({ verdict: 'accepted' })).toBe(true);
      expect(needsReview({ verdict: 'accepted', score: Number.NaN })).toBe(true);
    });

    it('returns true when the score is below the threshold (50)', () => {
      expect(needsReview({ verdict: 'accepted', score: 49 })).toBe(true);
      expect(needsReview({ verdict: 'rejected', score: 10 })).toBe(true);
    });

    it('returns false for a healthy reviewed programme', () => {
      expect(needsReview({ verdict: 'accepted', score: 50 })).toBe(false);
      expect(needsReview({ verdict: 'accepted', score: 92 })).toBe(false);
    });
  });

  describe('reviewHistoryAppend', () => {
    it('appends a new event to an empty history', () => {
      const history = reviewHistoryAppend([], {
        verdict: 'accepted',
        score: 90,
        reasons: ['Solid'],
        reviewer: 'ai',
        reviewedAt: '2026-08-06T00:00:00Z',
      });
      expect(history).toHaveLength(1);
      expect(history[0].reviewer).toBe('ai');
    });

    it('appends to existing history', () => {
      const first: ReviewEvent = {
        verdict: 'accepted',
        score: 70,
        reasons: [],
        reviewer: 'ai',
        reviewedAt: '2026-08-01T00:00:00Z',
      };
      const second: ReviewEvent = {
        verdict: 'rejected',
        score: 20,
        reasons: ['Vague'],
        reviewer: 'user-1',
        reviewedAt: '2026-08-02T00:00:00Z',
      };
      const history = reviewHistoryAppend([first], second);
      expect(history).toHaveLength(2);
      expect(history[1].reviewer).toBe('user-1');
    });

    it('caps the history at 50 events', () => {
      let history: ReviewEvent[] = [];
      for (let i = 0; i < 60; i++) {
        history = reviewHistoryAppend(history, {
          verdict: 'accepted',
          score: i,
          reasons: [],
          reviewer: 'ai',
          reviewedAt: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        });
      }
      expect(history).toHaveLength(50);
      // The oldest (score 0) is dropped, the newest (score 59) is kept.
      expect(history[0].score).toBe(10);
      expect(history[49].score).toBe(59);
    });

    it('handles a null history by starting fresh', () => {
      const history = reviewHistoryAppend(null, {
        verdict: 'rejected',
        score: 5,
        reasons: [],
        reviewer: null,
        reviewedAt: '2026-08-06T00:00:00Z',
      });
      expect(history).toHaveLength(1);
      expect(history[0].verdict).toBe('rejected');
    });
  });

  describe('isSettled / isLive', () => {
    it('detects settled states', () => {
      expect(isSettled('rejected')).toBe(true);
      expect(isSettled('archived')).toBe(true);
      expect(isSettled('active')).toBe(false);
      expect(isSettled(null)).toBe(false);
    });

    it('detects live states', () => {
      expect(isLive('active')).toBe(true);
      expect(isLive('rejected')).toBe(false);
      expect(isLive(undefined)).toBe(false);
    });
  });
});
