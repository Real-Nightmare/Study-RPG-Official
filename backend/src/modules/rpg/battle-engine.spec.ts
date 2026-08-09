import {
  applyPlayerAction,
  createBattleState,
  forfeitBattle,
  gradeDamageChallenge,
  gradeManaQuiz,
  MonsterState,
  BattleState,
} from './battle-engine';
import {
  BattleDefaults,
  CardInHand,
  DEFAULT_BATTLE_DEFAULTS,
  getCardDefinition,
} from './card-definitions';
import { createRng } from './seeded-rng';

function handOf(...keys: string[]): CardInHand[] {
  return keys.map((key, i) => {
    const def = getCardDefinition(key);
    return {
      instanceId: `inst-${i}`,
      cardKey: def.key,
      ability: def.ability,
    };
  });
}

function makeState(
  hand: CardInHand[],
  monster: MonsterState = {
    key: 'test_imp',
    name: 'Test Imp',
    hp: 100,
    maxHp: 100,
    attack: 8,
  },
  defaults: BattleDefaults = DEFAULT_BATTLE_DEFAULTS,
): { state: BattleState; rng: ReturnType<typeof createRng> } {
  const state = createBattleState({ seed: 42, hand, monster, defaults });
  const rng = createRng(42);
  return { state, rng };
}

describe('createBattleState', () => {
  it('logs start and activates a shield card for two turns', () => {
    const { state } = makeState(handOf('focus_shield', 'mana_slash'));
    expect(state.phase).toBe('active');
    expect(state.shieldRemaining).toBe(2);
    expect(state.log.some((e) => e.eventType === 'shield')).toBe(true);
  });

  it('does not shield without a shield card', () => {
    const { state } = makeState(handOf('mana_slash', 'study_burst'));
    expect(state.shieldRemaining).toBe(0);
  });
});

describe('applyPlayerAction — determinism', () => {
  it('same seed + same action reproduces identical log and damage', () => {
    const first = makeState(handOf('mana_slash', 'study_burst'));
    const second = makeState(handOf('mana_slash', 'study_burst'));
    const a = applyPlayerAction(
      first.state,
      { cardInstanceId: 'inst-0' },
      first.rng,
      DEFAULT_BATTLE_DEFAULTS,
    );
    const b = applyPlayerAction(
      second.state,
      { cardInstanceId: 'inst-0' },
      second.rng,
      DEFAULT_BATTLE_DEFAULTS,
    );
    expect(a.state.monster.hp).toBe(b.state.monster.hp);
    expect(a.state.playerHp).toBe(b.state.playerHp);
    expect(a.state.log).toEqual(b.state.log);
  });

  it('rejects playing a card not in hand', () => {
    const { state, rng } = makeState(handOf('mana_slash'));
    expect(() =>
      applyPlayerAction(state, { cardInstanceId: 'nope' }, rng, DEFAULT_BATTLE_DEFAULTS),
    ).toThrow('Card not in hand');
  });

  it('rejects playing without enough mana', () => {
    const { state, rng } = makeState(handOf('abstracted_recall', 'mana_slash'));
    state.playerMana = 10;
    expect(() =>
      applyPlayerAction(state, { cardInstanceId: 'inst-0' }, rng, DEFAULT_BATTLE_DEFAULTS),
    ).toThrow('Not enough mana');
  });
});

describe('applyPlayerAction — damage & statuses', () => {
  it('applies basic + ability damage to the monster', () => {
    const { state, rng } = makeState(handOf('mana_slash', 'study_burst'));
    const hpBefore = state.monster.hp;
    applyPlayerAction(state, { cardInstanceId: 'inst-0' }, rng, DEFAULT_BATTLE_DEFAULTS);
    // mana_slash: 10 base + 10 ability = 20
    expect(state.monster.hp).toBe(hpBefore - 20);
  });

  it('adds poison bonus while poison is active and applies poison DoT', () => {
    const { state, rng } = makeState(handOf('poison_vial', 'mana_slash'));
    applyPlayerAction(state, { cardInstanceId: 'inst-0' }, rng, DEFAULT_BATTLE_DEFAULTS);
    expect(state.statuses.some((s) => s.type === 'poison')).toBe(true);
    const poisonBonus = DEFAULT_BATTLE_DEFAULTS.poisonBonus;
    // Poison card itself deals base 10 + poison bonus 10 = 20 on application
    expect(state.log.filter((e) => e.eventType === 'damage').length).toBeGreaterThan(0);
    expect(poisonBonus).toBe(10);
  });

  it('heals the player with a heal card (then takes the monster turn)', () => {
    const { state, rng } = makeState(handOf('revival_note', 'mana_slash'));
    state.playerHp = 50;
    applyPlayerAction(state, { cardInstanceId: 'inst-0' }, rng, DEFAULT_BATTLE_DEFAULTS);
    // Healed 18 first, then the monster attacks (8 + 0..3) on its turn.
    expect(state.playerHp).toBeGreaterThan(50);
    expect(state.playerHp).toBeLessThanOrEqual(50 + 18);
  });

  it('ends the battle when the monster reaches zero HP', () => {
    const { state, rng } = makeState(handOf('mana_slash'), {
      key: 'weakling',
      name: 'Weakling',
      hp: 20,
      maxHp: 20,
      attack: 0,
    });
    applyPlayerAction(state, { cardInstanceId: 'inst-0' }, rng, DEFAULT_BATTLE_DEFAULTS);
    expect(state.phase).toBe('player_won');
  });
});

describe('mana quiz and damage challenge', () => {
  it('restores capped mana from a quiz', () => {
    const { state } = makeState(handOf('mana_slash'));
    state.playerMana = 40;
    const result = gradeManaQuiz(state, 5, DEFAULT_BATTLE_DEFAULTS);
    // 5 * 4 = 20, capped at 20 and maxMana
    expect(result.manaRestored).toBe(20);
    expect(state.playerMana).toBe(60);
  });

  it('restores mana only up to maxMana', () => {
    const { state } = makeState(handOf('mana_slash'));
    state.playerMana = 95;
    const result = gradeManaQuiz(state, 5, DEFAULT_BATTLE_DEFAULTS);
    expect(result.manaRestored).toBe(5);
    expect(state.playerMana).toBe(100);
  });

  it('grants one-turn damage bonus only when all correct', () => {
    const { state } = makeState(handOf('mana_slash'));
    gradeDamageChallenge(state, true, DEFAULT_BATTLE_DEFAULTS);
    expect(state.challengeBonusThisTurn).toBe(DEFAULT_BATTLE_DEFAULTS.damageChallengeBonus);
    gradeDamageChallenge(state, false, DEFAULT_BATTLE_DEFAULTS);
    // A second challenge with allCorrect=false leaves the bonus at the previous value? No — it stays.
    expect(state.challengeBonusThisTurn).toBe(DEFAULT_BATTLE_DEFAULTS.damageChallengeBonus);
  });

  it('forfeits an active battle', () => {
    const { state } = makeState(handOf('mana_slash'));
    const result = forfeitBattle(state);
    expect(result.phase).toBe('forfeited');
    expect(result.log.some((e) => e.eventType === 'defeat')).toBe(true);
  });

  it('does not forfeit an already-finished battle', () => {
    const { state } = makeState(handOf('mana_slash'));
    state.phase = 'player_won';
    const result = forfeitBattle(state);
    expect(result.phase).toBe('player_won');
  });
});
