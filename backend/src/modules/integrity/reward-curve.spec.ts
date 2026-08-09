import {
  accuracyFactor,
  campfireMultiplier,
  computeReward,
  difficultyFactor,
  focusFactor,
  passesPremiumThreshold,
} from './reward-curve';

describe('reward-curve', () => {
  describe('accuracyFactor (exponential)', () => {
    it('returns 0 below the 60% anti-farm floor', () => {
      expect(accuracyFactor(0)).toBe(0);
      expect(accuracyFactor(0.59)).toBe(0);
    });
    it('is 1.0 exactly at the floor', () => {
      expect(accuracyFactor(0.6)).toBeCloseTo(1.0, 5);
    });
    it('scales superlinearly toward mastery (100% = 3.5x)', () => {
      expect(accuracyFactor(1)).toBeCloseTo(3.5, 5);
      // mid gains are less than the ratio of the endpoints (exponential tail)
      const mid = accuracyFactor(0.8);
      expect(mid).toBeGreaterThan(1.0);
      expect(mid).toBeLessThan(2.0);
    });
    it('clamps out-of-range inputs', () => {
      expect(accuracyFactor(-5)).toBe(0);
      expect(accuracyFactor(1.5)).toBeCloseTo(3.5, 5);
    });
  });

  describe('focusFactor', () => {
    it('ranges 1.0 (no consistency) to 1.5 (perfect consistency)', () => {
      expect(focusFactor(0)).toBe(1);
      expect(focusFactor(1)).toBeCloseTo(1.5, 5);
    });
  });

  describe('difficultyFactor', () => {
    it('maps easy/medium/hard to 1.0/1.5/2.0', () => {
      expect(difficultyFactor('easy')).toBe(1);
      expect(difficultyFactor('medium')).toBe(1.5);
      expect(difficultyFactor('hard')).toBe(2);
    });
  });

  describe('campfireMultiplier', () => {
    it('returns base multiplier for depth 0', () => {
      expect(campfireMultiplier(0)).toBe(1.0);
    });
    it('returns max multiplier (1.5x) at/above depth 80', () => {
      expect(campfireMultiplier(80)).toBe(1.5);
      expect(campfireMultiplier(95)).toBe(1.5);
    });
    it('interpolates between base and max below the threshold', () => {
      expect(campfireMultiplier(40)).toBeCloseTo(1.25, 5);
    });
    it('honours custom thresholds', () => {
      expect(
        campfireMultiplier(50, {
          depthForFullMultiplier: 100,
          maxMultiplier: 1.5,
          baseMultiplier: 1.0,
        }),
      ).toBeCloseTo(1.25, 5);
    });
  });

  describe('computeReward', () => {
    it('zeroes out when the accuracy floor is not met (anti-farm)', () => {
      expect(computeReward(100, { accuracy: 0.5 })).toBe(0);
    });
    it('scales with accuracy, focus, difficulty and campfire', () => {
      const base = computeReward(100, { accuracy: 1 });
      const boosted = computeReward(100, {
        accuracy: 1,
        focusConsistency: 1,
        difficulty: 'hard',
        campfireMultiplier: 1.5,
      });
      // 3.5 * 1.5 * 2 * 1.5 = 15.75x
      expect(boosted).toBe(Math.floor(100 * 3.5 * 1.5 * 2 * 1.5));
      expect(boosted).toBeGreaterThan(base);
    });
    it('returns integer rewards', () => {
      const r = computeReward(17, { accuracy: 0.93, difficulty: 'medium' });
      expect(Number.isInteger(r)).toBe(true);
    });
    it('rejects non-positive bases', () => {
      expect(computeReward(0, { accuracy: 1 })).toBe(0);
      expect(computeReward(-5, { accuracy: 1 })).toBe(0);
    });
  });

  describe('passesPremiumThreshold', () => {
    it('checks accuracy percent against a threshold', () => {
      expect(passesPremiumThreshold(0.9, 90)).toBe(true);
      expect(passesPremiumThreshold(0.89, 90)).toBe(false);
    });
  });
});
