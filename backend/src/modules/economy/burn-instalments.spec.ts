import { buildInstalmentPlan, isBurnComplete, splitInstalments } from './burn-instalments';

describe('burn-instalments', () => {
  describe('splitInstalments', () => {
    it('splits evenly when the total divides cleanly', () => {
      expect(splitInstalments(100, 4)).toEqual([25, 25, 25, 25]);
    });

    it('puts the integer remainder on the FINAL instalment', () => {
      expect(splitInstalments(10, 4)).toEqual([2, 2, 2, 4]);
      expect(splitInstalments(101, 4)).toEqual([25, 25, 25, 26]);
      expect(splitInstalments(7, 3)).toEqual([2, 2, 3]);
    });

    it('handles a single instalment', () => {
      expect(splitInstalments(42, 1)).toEqual([42]);
    });

    it('the sum is always exactly the total', () => {
      for (const [total, count] of [
        [1, 4],
        [3, 2],
        [999, 7],
        [12345, 4],
      ] as Array<[number, number]>) {
        const amounts = splitInstalments(total, count);
        expect(amounts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(amounts.length).toBe(count);
        expect(amounts.every((a) => Number.isInteger(a))).toBe(true);
      }
    });

    it('rejects invalid inputs', () => {
      expect(() => splitInstalments(0, 4)).toThrow();
      expect(() => splitInstalments(10, 0)).toThrow();
      expect(() => splitInstalments(1.5, 4)).toThrow();
    });
  });

  describe('buildInstalmentPlan', () => {
    it('first instalment is due immediately, later ones on the interval', () => {
      const now = new Date('2026-08-06T00:00:00Z');
      const plan = buildInstalmentPlan(100, 4, 24, now);
      expect(plan.amounts).toEqual([25, 25, 25, 25]);
      expect(plan.dueAt[0].getTime()).toBe(now.getTime());
      expect(plan.dueAt[1].getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
      expect(plan.dueAt[3].getTime()).toBe(now.getTime() + 72 * 60 * 60 * 1000);
      expect(plan.total).toBe(100);
    });
  });

  describe('isBurnComplete', () => {
    const plan = buildInstalmentPlan(100, 4, 24);
    it('is complete only when every instalment is paid', () => {
      expect(isBurnComplete(plan, 0)).toBe(false);
      expect(isBurnComplete(plan, 3)).toBe(false);
      expect(isBurnComplete(plan, 4)).toBe(true);
    });
  });
});
