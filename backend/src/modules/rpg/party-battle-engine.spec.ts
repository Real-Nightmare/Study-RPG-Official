import {
  applyPartyAction,
  createPartyBattleState,
  forfeitPartyBattle,
  PartyBattleState,
} from './party-battle-engine';
import { DEFAULT_BATTLE_DEFAULTS, getCardDefinition } from './card-definitions';
import { MonsterState } from './battle-engine';

function heroHand(...keys: string[]) {
  return keys.map((key) => {
    const def = getCardDefinition(key);
    return {
      instanceId: `inst-${key}`,
      cardKey: key,
      ability: def.ability,
    };
  });
}

function boss(overrides: Partial<MonsterState> = {}): MonsterState {
  return {
    key: 'exam_syllabus_sentinel',
    name: 'Syllabus Sentinel',
    hp: 200,
    maxHp: 200,
    attack: 12,
    ...overrides,
  };
}

describe('party-battle-engine', () => {
  it('creates a party battle with all heroes and a shared boss', () => {
    const state = createPartyBattleState({
      seed: 42,
      heroes: [
        { userId: 'a', name: 'Alice', hand: heroHand('mana_slash', 'blockbash') },
        { userId: 'b', name: 'Bob', hand: heroHand('study_burst', 'eraserblade') },
      ],
      boss: boss(),
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });

    expect(state.phase).toBe('active');
    expect(state.heroes).toHaveLength(2);
    expect(state.boss.hp).toBe(200);
    expect(state.log[0].eventType).toBe('start');
  });

  it('heroes act in rotation and the boss takes damage', () => {
    let state = createPartyBattleState({
      seed: 7,
      heroes: [
        { userId: 'a', name: 'Alice', hand: heroHand('mana_slash', 'mana_slash') },
        { userId: 'b', name: 'Bob', hand: heroHand('mana_slash', 'mana_slash') },
      ],
      boss: boss({ hp: 80, maxHp: 80 }),
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });

    const before = state.boss.hp;
    const result = applyPartyAction(state, 'a', 'inst-mana_slash', DEFAULT_BATTLE_DEFAULTS);
    expect(result.state.boss.hp).toBeLessThan(before);

    // Round 2: Bob's turn.
    state = result.state;
    const result2 = applyPartyAction(state, 'b', 'inst-mana_slash', DEFAULT_BATTLE_DEFAULTS);
    expect(result2.state.round).toBeGreaterThanOrEqual(1);
  });

  it('declares victory when the shared boss HP reaches zero', () => {
    let state = createPartyBattleState({
      seed: 3,
      heroes: [{ userId: 'a', name: 'Alice', hand: heroHand('abstracted_recall') }],
      boss: boss({ hp: 30, maxHp: 30 }),
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });

    state = applyPartyAction(state, 'a', 'inst-abstracted_recall', DEFAULT_BATTLE_DEFAULTS).state;
    expect(state.phase).toBe('won');
  });

  it('declares defeat when every hero is down', () => {
    let state = createPartyBattleState({
      seed: 99,
      heroes: [{ userId: 'a', name: 'Alice', hand: heroHand('focuscookie') }],
      boss: boss({ hp: 500, attack: 1000 }),
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });

    // A hero with only a mana cookie can deal no damage; boss HP stays > 0.
    state = applyPartyAction(state, 'a', 'inst-focuscookie', DEFAULT_BATTLE_DEFAULTS).state;
    expect(state.heroes[0].isDown).toBe(true);
    expect(state.phase).toBe('lost');
  });

  it('forfeit ends the battle', () => {
    const state = createPartyBattleState({
      seed: 5,
      heroes: [{ userId: 'a', name: 'Alice', hand: heroHand('mana_slash') }],
      boss: boss(),
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });
    const forfeited = forfeitPartyBattle(state);
    expect(forfeited.phase).toBe('forfeited');
  });

  it('rejects actions from non-members and downed heroes', () => {
    const state = createPartyBattleState({
      seed: 5,
      heroes: [{ userId: 'a', name: 'Alice', hand: heroHand('mana_slash') }],
      boss: boss(),
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });

    expect(() =>
      applyPartyAction(state, 'zombie', 'inst-mana_slash', DEFAULT_BATTLE_DEFAULTS),
    ).toThrow('Hero not in this party battle');

    state.heroes[0].isDown = true;
    expect(() => applyPartyAction(state, 'a', 'inst-mana_slash', DEFAULT_BATTLE_DEFAULTS)).toThrow(
      'Hero is down',
    );
  });
});
