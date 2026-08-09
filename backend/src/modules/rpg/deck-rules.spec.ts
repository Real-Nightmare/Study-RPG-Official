import { validateDeck } from './deck-rules';
import { Ability } from './card-definitions';

function ability(overrides: Partial<Ability>): Ability {
  return {
    key: overrides.key ?? 'test_ability',
    name: overrides.name ?? 'Test Ability',
    category: overrides.category ?? 'attack',
    description: 'test',
    manaCost: 20,
    target: 'enemy',
    stackPolicy: 'none',
    balanceVersion: '1.0',
    ...overrides,
  };
}

describe('validateDeck', () => {
  it('accepts a valid five-card deck', () => {
    const abilities = [
      ability({ key: 'a' }),
      ability({ key: 'b' }),
      ability({ key: 'c' }),
      ability({ key: 'd' }),
      ability({ key: 'e' }),
    ];
    const result = validateDeck(abilities);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a deck without exactly five cards', () => {
    const result = validateDeck([ability({ key: 'a' }), ability({ key: 'b' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exactly 5 cards');
  });

  it('allows one poison and one shield together', () => {
    const abilities = [
      ability({ key: 'poison', category: 'poison', restrictions: ['poison'] }),
      ability({ key: 'shield', category: 'shield', restrictions: ['shield'] }),
      ability({ key: 'c' }),
      ability({ key: 'd' }),
      ability({ key: 'e' }),
    ];
    const result = validateDeck(abilities);
    expect(result.valid).toBe(true);
  });

  it('rejects two poison cards in one deck', () => {
    const abilities = [
      ability({ key: 'poison1', category: 'poison', restrictions: ['poison'] }),
      ability({ key: 'poison2', category: 'poison', restrictions: ['poison'] }),
      ability({ key: 'c' }),
      ability({ key: 'd' }),
      ability({ key: 'e' }),
    ];
    const result = validateDeck(abilities);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('poison');
    expect(result.restrictedCounts['poison']).toBe(2);
  });

  it('treats cards without restrictions as unlimited', () => {
    const abilities = [
      ability({ key: 'a' }),
      ability({ key: 'a2' }),
      ability({ key: 'b' }),
      ability({ key: 'c' }),
      ability({ key: 'd' }),
    ];
    const result = validateDeck(abilities);
    expect(result.valid).toBe(true);
  });
});
