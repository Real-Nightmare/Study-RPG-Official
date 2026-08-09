import {
  applyRatingChange,
  computeRatings,
  expectedScore,
  loserDelta,
  winnerDelta,
} from './pvp-rating';

describe('pvp-rating (Elo)', () => {
  it('computes a symmetric expected score', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 2); // strong favourite
    expect(expectedScore(1000, 1400)).toBeCloseTo(0.091, 2);
  });

  it('equal ratings give a symmetric K/2 delta', () => {
    const d = winnerDelta(1000, 1000, 32);
    expect(d).toBe(16);
    expect(loserDelta(1000, 1000, 32)).toBe(-16);
  });

  it('favourite gains less than the underdog', () => {
    const fav = winnerDelta(1400, 1000, 32);
    const dog = winnerDelta(1000, 1400, 32);
    expect(fav).toBeLessThan(dog);
  });

  it('computeRatings applies deltas and floors at zero', () => {
    const r = computeRatings(1000, 1000, 32);
    expect(r.winnerRatingAfter).toBe(1016);
    expect(r.loserRatingAfter).toBe(984);
    expect(r.winnerDelta).toBe(16);
    expect(r.loserDelta).toBe(-16);
  });

  it('applyRatingChange never goes below zero', () => {
    expect(applyRatingChange(10, -50)).toBe(0);
    expect(applyRatingChange(10, 5)).toBe(15);
  });
});
