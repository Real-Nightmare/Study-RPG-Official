import { buildGhostAvatar, DEFAULT_PVP_CONFIG, DeckSnapshotCard } from './pvp-ghost';

function card(cardKey: string, rarity: string, damage = 0): DeckSnapshotCard {
  return { cardKey, rarity, ability: { damage } };
}

describe('buildGhostAvatar', () => {
  it('derives base stats for an all-common deck', () => {
    const deck = [
      card('mana_slash', 'common', 10),
      card('study_burst', 'common', 14),
      card('revival_note', 'common'),
      card('focus_shield', 'common'),
      card('mana_battery', 'common'),
    ];
    const { monster, totalDamage } = buildGhostAvatar(deck, DEFAULT_PVP_CONFIG, 'Rival');
    expect(monster.key).toBe('pvp_ghost');
    expect(monster.name).toBe('Rival');
    expect(monster.maxHp).toBe(DEFAULT_PVP_CONFIG.ghostHpBase); // no rares/legendaries
    // attack = base + floor(24 / 5) = 6 + 4
    expect(monster.attack).toBe(DEFAULT_PVP_CONFIG.ghostAttackBase + Math.floor(24 / 5));
    expect(totalDamage).toBe(24);
  });

  it('adds HP per rare and legendary card', () => {
    const deck = [
      card('decay_curse', 'rare', 5),
      card('abstracted_recall', 'legendary', 30),
      card('mana_slash', 'common', 10),
      card('poison_vial', 'common'),
      card('focus_shield', 'common'),
    ];
    const { monster, rareCount, legendaryCount } = buildGhostAvatar(
      deck,
      DEFAULT_PVP_CONFIG,
      'Boss',
    );
    expect(rareCount).toBe(1);
    expect(legendaryCount).toBe(1);
    expect(monster.maxHp).toBe(
      DEFAULT_PVP_CONFIG.ghostHpBase +
        DEFAULT_PVP_CONFIG.ghostHpPerRare +
        DEFAULT_PVP_CONFIG.ghostHpPerLegendary,
    );
    // attack = 6 + floor(45 / 5) = 6 + 9
    expect(monster.attack).toBe(DEFAULT_PVP_CONFIG.ghostAttackBase + 9);
  });

  it('floors attack at 1 for a zero-damage deck', () => {
    const deck = [
      card('revival_note', 'common'),
      card('mana_battery', 'common'),
      card('focus_shield', 'common'),
      card('silence_pact', 'common'),
      card('poison_vial', 'common'),
    ];
    const { monster } = buildGhostAvatar(deck, DEFAULT_PVP_CONFIG, 'Healer');
    expect(monster.attack).toBeGreaterThanOrEqual(1);
    expect(monster.attack).toBe(DEFAULT_PVP_CONFIG.ghostAttackBase);
  });

  it('caps the deck at five cards', () => {
    const deck = Array.from({ length: 8 }, (_, i) => card(`c${i}`, 'common', 10));
    const { monster, totalDamage } = buildGhostAvatar(deck, DEFAULT_PVP_CONFIG, 'Many');
    expect(monster.maxHp).toBe(DEFAULT_PVP_CONFIG.ghostHpBase);
    expect(totalDamage).toBe(50);
  });
});
