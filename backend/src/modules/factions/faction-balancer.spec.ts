import {
  factionColorFor,
  factionCountFor,
  pickFactionForUser,
  FactionBalanceCandidate,
} from './faction-balancer';

describe('faction-balancer', () => {
  describe('factionCountFor', () => {
    it('splits 28 students into 4 factions of 7', () => {
      expect(factionCountFor(28, 7)).toBe(4);
    });

    it('handles partial groups', () => {
      expect(factionCountFor(29, 7)).toBe(5);
      expect(factionCountFor(1, 7)).toBe(1);
    });

    it('guards degenerate inputs', () => {
      expect(factionCountFor(0, 7)).toBe(1);
      expect(factionCountFor(10, 0)).toBe(1);
    });
  });

  describe('pickFactionForUser', () => {
    const factions: FactionBalanceCandidate[] = [
      { id: 'a', name: 'A', color: 'indigo', memberCount: 7, targetSize: 7 },
      { id: 'b', name: 'B', color: 'emerald', memberCount: 5, targetSize: 7 },
      { id: 'c', name: 'C', color: 'rose', memberCount: 6, targetSize: 7 },
    ];

    it('picks the faction with the fewest members', () => {
      expect(pickFactionForUser(factions).id).toBe('b');
    });

    it('keeps factions balanced within ±1 over many assignments', () => {
      const counts = new Map<string, number>();
      for (const f of factions) counts.set(f.id, f.memberCount);

      // Assign 14 more users to the 3 factions — sizes stay within ±1.
      for (let i = 0; i < 14; i++) {
        const current: FactionBalanceCandidate[] = [...counts.entries()].map(
          ([id, memberCount]) => {
            const base = factions.find((f) => f.id === id)!;
            return { ...base, memberCount };
          },
        );
        const pick = pickFactionForUser(current);
        counts.set(pick.id, counts.get(pick.id)! + 1);
      }

      const sizes = [...counts.values()].sort((a, b) => a - b);
      expect(sizes[sizes.length - 1] - sizes[0]).toBeLessThanOrEqual(1);
    });

    it('throws when no factions exist', () => {
      expect(() => pickFactionForUser([])).toThrow();
    });
  });

  describe('factionColorFor', () => {
    it('cycles through the palette', () => {
      expect(factionColorFor(0)).toBe('indigo');
      expect(factionColorFor(3)).toBe('amber');
      expect(factionColorFor(8)).toBe('indigo'); // wraps
    });
  });
});
