import { lootBoxOdds, pickRarity } from './loot-boxes';

describe('loot-boxes (§28)', () => {
  it('publishes exact percentage odds', () => {
    const odds = lootBoxOdds({ common: 70, rare: 25, legendary: 5 });
    expect(odds).toEqual({ common: 70, rare: 25, legendary: 5 });
    const odds2 = lootBoxOdds({ common: 1, rare: 1 });
    expect(odds2).toEqual({ common: 50, rare: 50 });
  });

  it('rejects empty weight tables', () => {
    expect(() => lootBoxOdds({})).toThrow();
    expect(() => pickRarity({})).toThrow();
  });

  it('picks deterministically with an injected random source', () => {
    expect(pickRarity({ common: 70, rare: 25, legendary: 5 }, () => 0)).toBe('common');
    expect(pickRarity({ common: 70, rare: 25, legendary: 5 }, () => 0.999)).toBe('legendary');
    // 0.70 exactly lands on the boundary → rare (roll <= 0 after subtracting 70).
    expect(pickRarity({ common: 70, rare: 25, legendary: 5 }, () => 0.7)).toBe('rare');
  });

  it('ignores zero-weight rarities', () => {
    expect(pickRarity({ common: 0, rare: 45, legendary: 55 }, () => 0)).toBe('rare');
    expect(pickRarity({ common: 0, rare: 45, legendary: 55 }, () => 0.999)).toBe('legendary');
  });
});
