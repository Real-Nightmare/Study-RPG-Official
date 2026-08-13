import { aggregateSupply, replacementKey, shouldDeclareExtinction } from './supply';

describe('supply', () => {
  describe('aggregateSupply', () => {
    it('counts active, burned and scraped copies', () => {
      const rows = [
        { removed_at: null },
        { removed_at: null },
        { removed_at: new Date(), removed_reason: 'burn' },
        { removed_at: new Date(), removed_reason: 'scrape' },
        { removed_at: new Date(), removed_reason: 'burn' },
      ];
      const agg = aggregateSupply(rows);
      expect(agg).toEqual({ minted: 5, active: 2, burned: 2, scraped: 1 });
    });

    it('minted always equals the number of rows, including unknown removal reasons', () => {
      const agg = aggregateSupply([
        { removed_at: null },
        { removed_at: new Date(), removed_reason: 'unknown' },
      ]);
      expect(agg.minted).toBe(2);
      expect(agg.active).toBe(1);
      expect(agg.burned + agg.scraped).toBe(0);
    });

    it('handles an empty set', () => {
      expect(aggregateSupply([])).toEqual({ minted: 0, active: 0, burned: 0, scraped: 0 });
    });
  });

  describe('shouldDeclareExtinction', () => {
    it('declares extinction only when active supply is zero and not already extinct', () => {
      expect(shouldDeclareExtinction(0, false)).toBe(true);
      expect(shouldDeclareExtinction(0, true)).toBe(false);
      expect(shouldDeclareExtinction(1, false)).toBe(false);
      expect(shouldDeclareExtinction(-1, false)).toBe(true);
    });
  });

  describe('replacementKey', () => {
    it('produces a new identity for the replacement print run', () => {
      expect(replacementKey('mana_slash', 1)).toBe('mana_slash__echo_1');
      expect(replacementKey('mana_slash', 2)).toBe('mana_slash__echo_2');
    });
  });
});
