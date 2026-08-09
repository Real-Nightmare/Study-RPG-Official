import { computeOfficialValue, scrapePayout, burnPayout } from './card-value';

describe('card-value', () => {
  describe('computeOfficialValue', () => {
    it('returns the base value at full supply (multiplier 1)', () => {
      expect(computeOfficialValue({ rarity: 'common', activeSupply: 1500, originalSupply: 1500 })).toBe(25);
      expect(computeOfficialValue({ rarity: 'rare', activeSupply: 400, originalSupply: 400 })).toBe(120);
      expect(computeOfficialValue({ rarity: 'legendary', activeSupply: 100, originalSupply: 100 })).toBe(600);
    });

    it('increases value as supply shrinks', () => {
      const full = computeOfficialValue({ rarity: 'rare', activeSupply: 400, originalSupply: 400 });
      const scarce = computeOfficialValue({ rarity: 'rare', activeSupply: 40, originalSupply: 400 });
      expect(scarce).toBeGreaterThan(full);
      // 1 + 0.9*1.5 = 2.35 → floor(120 * 2.35) = 282
      expect(scarce).toBe(282);
    });

    it('applies the scarcity multiplier below the cap', () => {
      const value = computeOfficialValue({ rarity: 'legendary', activeSupply: 1, originalSupply: 100 });
      // 1 + 0.99*1.5 = 2.485 (below the 3.0 cap) → floor(600 * 2.485) = 1491
      expect(value).toBe(1491);
    });

    it('clamps the multiplier to the configured floor', () => {
      const value = computeOfficialValue({ rarity: 'common', activeSupply: 99999, originalSupply: 1500 });
      // active capped at original → multiplier 1 → base 25
      expect(value).toBe(25);
    });

    it('never returns a value below 1 and uses integer math', () => {
      const value = computeOfficialValue({ rarity: 'unknown-rarity', activeSupply: 0, originalSupply: 10 });
      expect(value).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(value)).toBe(true);
    });
  });

  describe('payouts', () => {
    it('scraper payout is a floored percentage of the official value', () => {
      expect(scrapePayout(100, 80)).toBe(80);
      expect(scrapePayout(25, 80)).toBe(20);
      expect(scrapePayout(7, 80)).toBe(5);
    });

    it('burner payout defaults to 100% of the official value', () => {
      expect(burnPayout(120)).toBe(120);
      expect(burnPayout(120, 90)).toBe(108);
    });

    it('clamps percent into [0,100] and handles non-positive values', () => {
      expect(scrapePayout(100, 150)).toBe(100);
      expect(scrapePayout(100, -5)).toBe(0);
      expect(scrapePayout(0, 80)).toBe(0);
      expect(scrapePayout(-10, 80)).toBe(0);
    });
  });
});
