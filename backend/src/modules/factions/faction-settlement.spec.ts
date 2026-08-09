import {
  currentPeriodKeyIST,
  periodKeyIST,
  previousPeriodKeyIST,
  settleFactions,
  FactionSettlementInput,
} from './faction-settlement';

describe('faction-settlement', () => {
  describe('IST period keys', () => {
    it('formats YYYY-MM', () => {
      const d = new Date('2026-08-06T12:00:00Z');
      // In IST (UTC+5:30) this is 2026-08-06 17:30 — still August.
      expect(periodKeyIST(d)).toBe('2026-08');
    });

    it('previous period rolls back across a year boundary', () => {
      const jan = new Date('2026-01-15T12:00:00Z');
      expect(previousPeriodKeyIST(jan)).toBe('2025-12');
    });

    it('current period key matches periodKeyIST', () => {
      expect(currentPeriodKeyIST()).toBe(periodKeyIST(new Date()));
    });
  });

  describe('settleFactions', () => {
    const inputs: FactionSettlementInput[] = [
      { factionId: 'top', name: 'Top', score: 500, previousScore: 500 },
      { factionId: 'mid', name: 'Mid', score: 300, previousScore: 350 },
      { factionId: 'bot', name: 'Bottom', score: 150, previousScore: 80 },
    ];

    it('ranks by score and grants gold/silver/bronze', () => {
      const results = settleFactions(inputs);
      expect(results[0].factionId).toBe('top');
      expect(results[0].tier).toBe('gold');
      expect(results[0].stpReward).toBe(300);
      expect(results[1].tier).toBe('silver');
      expect(results[2].tier).toBe('bronze');
    });

    it('gives improvement rewards to weaker factions that improved', () => {
      const results = settleFactions(inputs);
      const bottom = results.find((r) => r.factionId === 'bot')!;
      // bottom improved 80 → 150, but also bronze tier → bonus added.
      expect(bottom.improved).toBe(true);
      expect(bottom.stpReward).toBeGreaterThan(100);
    });

    it('does not reward stagnation (no tier, no improvement)', () => {
      const results = settleFactions([
        { factionId: 'a', name: 'A', score: 200, previousScore: 200 },
        { factionId: 'b', name: 'B', score: 180, previousScore: 180 },
        { factionId: 'c', name: 'C', score: 90, previousScore: 90 },
        { factionId: 'd', name: 'D', score: 40, previousScore: 40 },
      ]);
      const d = results.find((r) => r.factionId === 'd')!;
      expect(d.improved).toBe(false);
      expect(d.tier).toBe('none');
      expect(d.stpReward).toBe(0);
    });

    it('assigns the winning faction a help pledge toward the weakest', () => {
      const results = settleFactions(inputs);
      const winner = results.find((r) => r.rank === 1)!;
      expect(winner.helpPledgeToward).toBe('bot');
    });

    it('returns empty for no factions', () => {
      expect(settleFactions([])).toEqual([]);
    });

    it('keeps gold reward even when the winner also improved', () => {
      const results = settleFactions([
        { factionId: 'a', name: 'A', score: 500, previousScore: 100 },
        { factionId: 'b', name: 'B', score: 100, previousScore: 100 },
      ]);
      const a = results.find((r) => r.factionId === 'a')!;
      expect(a.tier).toBe('gold');
      expect(a.stpReward).toBeGreaterThanOrEqual(300);
    });
  });
});
