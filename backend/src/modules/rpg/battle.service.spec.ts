import { BadRequestException } from '@nestjs/common';
import { BattleService } from './battle.service';
import { CardInHand, DEFAULT_BATTLE_DEFAULTS, getCardDefinition } from './card-definitions';
import { createBattleState, BattleState } from './battle-engine';
import { DEFAULT_LEVEL_CONFIG } from './rpg-config';

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

function deckViewOf(hand: CardInHand[]) {
  return {
    id: 'deck-1',
    name: 'Starter Deck',
    isActive: true,
    validated: true,
    invalidReason: null,
    cards: hand.map((c, slot) => ({
      slot,
      instanceId: c.instanceId,
      cardKey: c.cardKey,
      name: c.ability.name,
      rarity: 'common',
      category: c.ability.category,
      ability: c.ability,
    })),
  };
}

/**
 * In-memory fake of DatabaseService. Mirrors the SQL the battle service and
 * reward claim issue: profiles, battles, wallet ledger, xp events, battle log.
 * `overrides` let tests force the daily anti-farming counters.
 */
function makeDb(overrides: { winsToday?: number; stpToday?: number; xpToday?: number } = {}) {
  const state: {
    profiles: Map<string, { stp: number; xp: number; level: number }>;
    battles: Map<string, Record<string, unknown>>;
    ledger: unknown[];
    xpEvents: unknown[];
    battleLog: unknown[];
    winsToday: number;
    stpToday: number;
    xpToday: number;
  } = {
    profiles: new Map(),
    battles: new Map(),
    ledger: [],
    xpEvents: [],
    battleLog: [],
    winsToday: overrides.winsToday ?? 0,
    stpToday: overrides.stpToday ?? 0,
    xpToday: overrides.xpToday ?? 0,
  };

  const handle = async (text: string, params: unknown[] = []) => {
    // Config lookups fall back to code defaults.
    if (/SELECT value FROM game_config/.test(text)) return { rows: [] };

    if (/INSERT INTO player_profiles/.test(text)) {
      const userId = params[0] as string;
      if (!state.profiles.has(userId)) state.profiles.set(userId, { stp: 0, xp: 0, level: 1 });
      return { rows: [] };
    }
    if (/SELECT stp FROM player_profiles/.test(text)) {
      const p = state.profiles.get(params[0] as string) ?? { stp: 0, xp: 0, level: 1 };
      return { rows: [{ stp: p.stp }] };
    }
    if (/SELECT xp FROM player_profiles/.test(text)) {
      const p = state.profiles.get(params[0] as string) ?? { stp: 0, xp: 0, level: 1 };
      return { rows: [{ xp: p.xp }] };
    }
    if (/UPDATE player_profiles SET stp/.test(text)) {
      const p = state.profiles.get(params[1] as string) ?? { stp: 0, xp: 0, level: 1 };
      p.stp = params[0] as number;
      state.profiles.set(params[1] as string, p);
      return { rows: [] };
    }
    if (/UPDATE player_profiles SET xp = \$1, level = \$2/.test(text)) {
      const p = state.profiles.get(params[2] as string) ?? { stp: 0, xp: 0, level: 1 };
      p.xp = params[0] as number;
      p.level = params[1] as number;
      state.profiles.set(params[2] as string, p);
      return { rows: [] };
    }

    // Reward claim internals
    if (
      /reward_claimed, reward_idempotency_key FROM battles WHERE id = \$1 FOR UPDATE/.test(text)
    ) {
      const b = state.battles.get(params[0] as string);
      return {
        rows: b
          ? [{ reward_claimed: b.reward_claimed, reward_idempotency_key: b.reward_idempotency_key }]
          : [],
      };
    }
    if (/COUNT\(\*\)::int AS count FROM battles/.test(text)) {
      return { rows: [{ count: state.winsToday }] };
    }
    if (/SUM\(amount\)/.test(text)) return { rows: [{ total: state.stpToday }] };
    if (/SUM\(xp\)/.test(text)) return { rows: [{ total: state.xpToday }] };

    if (/INSERT INTO wallet_ledger/.test(text)) {
      const entry = {
        id: params[0],
        user_id: params[1],
        currency: 'STP',
        amount: params[2],
        balance_before: params[3],
        balance_after: params[4],
        transaction_type: params[5],
        reason: params[6],
        related_entity_id: params[7],
        idempotency_key: params[8],
        actor: params[9],
        created_at: new Date(),
      };
      state.ledger.push(entry);
      return { rows: [entry] };
    }
    if (/INSERT INTO user_xp_events/.test(text)) {
      state.xpEvents.push({
        id: params[0],
        user_id: params[1],
        type: params[2],
        xp: params[3],
      });
      return { rows: [] };
    }

    // Battle persistence
    if (/INSERT INTO battles/.test(text)) {
      const row: Record<string, unknown> = {
        id: params[0] as string,
        user_id: params[1],
        deck_id: params[2],
        seed: params[3],
        subject: params[4],
        world: params[5],
        monster_key: params[6],
        player_hp: params[7],
        player_mana: params[8],
        monster_hp: params[9],
        turn: params[10],
        shield_remaining: params[11],
        statuses: params[12],
        phase: params[13],
        state: params[14],
        hand: params[15],
        reward_claimed: false,
        reward_idempotency_key: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      state.battles.set(row.id as string, row);
      return { rows: [row] };
    }
    if (/FROM battles WHERE id = \$1 AND user_id = \$2/.test(text)) {
      const b = state.battles.get(params[0] as string);
      return { rows: b ? [b] : [] };
    }
    if (/UPDATE battles SET\s+player_hp/.test(text)) {
      const b = state.battles.get(params[9] as string);
      if (b) {
        b.player_hp = params[0];
        b.player_mana = params[1];
        b.monster_hp = params[2];
        b.turn = params[3];
        b.shield_remaining = params[4];
        b.statuses = params[5];
        b.phase = params[6];
        b.state = params[7];
        b.reward_claimed = params[8];
      }
      return { rows: [] };
    }
    if (/UPDATE battles SET reward_claimed = true/.test(text)) {
      const b = state.battles.get(params[1] as string);
      if (b) {
        b.reward_claimed = true;
        b.reward_idempotency_key = params[0];
      }
      return { rows: [] };
    }
    if (/INSERT INTO battle_log/.test(text)) {
      state.battleLog.push({
        id: params[0],
        battle_id: params[1],
        turn: params[2],
        sequence: params[3],
        event_type: params[4],
        payload: params[5],
      });
      return { rows: [] };
    }
    if (/FROM battles WHERE user_id = \$1 ORDER BY created_at DESC/.test(text)) {
      const rows = [...state.battles.values()].map((b) => ({
        id: b.id,
        phase: b.phase,
        monster_key: b.monster_key,
        world: b.world,
        reward_claimed: b.reward_claimed,
        created_at: b.created_at,
      }));
      return { rows };
    }

    return { rows: [] };
  };

  const client = { query: handle };
  const db = {
    transaction: async (cb: (c: typeof client) => Promise<unknown>) => cb(client),
    query: handle,
    queryOne: async (text: string, params?: unknown[]) => {
      const result = await handle(text, params);
      return result.rows[0] ?? null;
    },
    queryMany: async (text: string, params?: unknown[]) => {
      const result = await handle(text, params);
      return result.rows;
    },
  };
  return { state, db };
}

function makeService(db: ReturnType<typeof makeDb>['db']) {
  const cards = {
    getActiveDeck: jest.fn(),
    getDeck: jest.fn(),
  };
  const player = { getLevelConfig: jest.fn().mockResolvedValue(DEFAULT_LEVEL_CONFIG) };
  const service = new BattleService(db as any, cards as any, {} as any, player as any);
  return { service, cards };
}

function seedBattle(
  db: ReturnType<typeof makeDb>['db'],
  state: BattleState,
  id = 'b1',
  userId = 'u1',
) {
  const row = {
    id,
    user_id: userId,
    seed: state.seed,
    subject: null,
    world: 'overworld',
    monster_key: state.monster.key,
    player_hp: state.playerHp,
    player_mana: state.playerMana,
    monster_hp: state.monster.hp,
    turn: state.turn,
    shield_remaining: state.shieldRemaining,
    statuses: JSON.stringify(state.statuses),
    phase: state.phase,
    state: JSON.stringify(state),
    hand: JSON.stringify(state.hand),
    reward_claimed: false,
    reward_idempotency_key: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  return row;
}

describe('BattleService', () => {
  it('creates a battle from the active deck with a persisted log', async () => {
    const { state: fakeState, db } = makeDb();
    const { service, cards } = makeService(db);
    const hand = handOf('mana_slash', 'study_burst', 'poison_vial', 'focus_shield', 'revival_note');
    cards.getActiveDeck.mockResolvedValue(deckViewOf(hand));

    const battle = await service.create('u1', {});
    expect(battle.id).toBeDefined();
    expect(battle.phase).toBe('active');
    expect(battle.monster.hp).toBeGreaterThan(0);
    expect(battle.state.log.some((e) => e.eventType === 'start')).toBe(true);
    expect(fakeState.battles.size).toBe(1);
    expect(fakeState.battleLog.length).toBeGreaterThan(0);
  });

  it('rejects a battle with an invalid deck', async () => {
    const { db } = makeDb();
    const { service, cards } = makeService(db);
    cards.getActiveDeck.mockResolvedValue({
      ...deckViewOf(handOf('mana_slash')),
      validated: false,
      invalidReason: 'Deck must contain exactly 5 cards',
    });

    await expect(service.create('u1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a battle with no equipped deck', async () => {
    const { db } = makeDb();
    const { service, cards } = makeService(db);
    cards.getActiveDeck.mockResolvedValue(null);

    await expect(service.create('u1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grades a mana quiz and restores mana on the battle state', async () => {
    const { state: fakeState, db } = makeDb();
    const { service } = makeService(db);
    const hand = handOf('mana_slash');
    const state = createBattleState({
      seed: 42,
      hand,
      monster: { key: 'test_imp', name: 'Test Imp', hp: 100, maxHp: 100, attack: 8 },
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });
    state.playerMana = 40;
    const row = seedBattle(db, state);
    fakeState.battles.set(row.id, row);

    const battle = await service.manaQuiz('u1', 'b1', 3);
    // 3 * 4 = 12 restored, 40 → 52
    expect(battle.state.playerMana).toBe(52);
    expect(battle.state.log.some((e) => e.eventType === 'quiz')).toBe(true);
  });

  it('grants XP + STP on a win via the immutable ledger', async () => {
    const { state: fakeState, db } = makeDb();
    const { service } = makeService(db);
    const hand = handOf('mana_slash');
    const state = createBattleState({
      seed: 42,
      hand,
      monster: { key: 'weakling', name: 'Weakling', hp: 20, maxHp: 20, attack: 0 },
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });
    const row = seedBattle(db, state);
    fakeState.battles.set(row.id, row);

    const battle = await service.action('u1', 'b1', { cardInstanceId: 'inst-0' });
    expect(battle.phase).toBe('player_won');
    expect(battle.reward).toEqual({ xp: 50, stp: 40, limited: false });
    expect(battle.rewardClaimed).toBe(true);
    expect(fakeState.ledger).toHaveLength(1);
    expect(fakeState.profiles.get('u1')).toEqual({ stp: 40, xp: 50, level: 1 });
    expect(fakeState.xpEvents).toHaveLength(1);
  });

  it('enforces the anti-farming daily limit (no reward, battle still completes)', async () => {
    const { state: fakeState, db } = makeDb({ winsToday: 10 });
    const { service } = makeService(db);
    const hand = handOf('mana_slash');
    const state = createBattleState({
      seed: 7,
      hand,
      monster: { key: 'weakling', name: 'Weakling', hp: 20, maxHp: 20, attack: 0 },
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });
    const row = seedBattle(db, state, 'b-limit');
    fakeState.battles.set(row.id, row);

    const battle = await service.action('u1', 'b-limit', { cardInstanceId: 'inst-0' });
    expect(battle.phase).toBe('player_won');
    expect(battle.reward).toEqual({ xp: 0, stp: 0, limited: true });
    expect(fakeState.ledger).toHaveLength(0);
    expect(fakeState.profiles.get('u1')?.stp ?? 0).toBe(0);
  });

  it('marks the win reward claimed so it is never granted twice', async () => {
    const { state: fakeState, db } = makeDb();
    const { service } = makeService(db);
    const hand = handOf('mana_slash');
    const state = createBattleState({
      seed: 9,
      hand,
      monster: { key: 'weakling', name: 'Weakling', hp: 20, maxHp: 20, attack: 0 },
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });
    const row = seedBattle(db, state, 'b-dup');
    fakeState.battles.set(row.id, row);

    const first = await service.action('u1', 'b-dup', { cardInstanceId: 'inst-0' });
    expect(first.rewardClaimed).toBe(true);
    expect(fakeState.ledger).toHaveLength(1);

    // Second action on a finished battle is rejected outright.
    await expect(
      service.action('u1', 'b-dup', { cardInstanceId: 'inst-0' }),
    ).rejects.toBeInstanceOf(Error);
    expect(fakeState.ledger).toHaveLength(1);
  });

  it('forfeits an active battle without rewards', async () => {
    const { state: fakeState, db } = makeDb();
    const { service } = makeService(db);
    const hand = handOf('mana_slash');
    const state = createBattleState({
      seed: 3,
      hand,
      monster: { key: 'test_imp', name: 'Test Imp', hp: 100, maxHp: 100, attack: 8 },
      defaults: DEFAULT_BATTLE_DEFAULTS,
    });
    const row = seedBattle(db, state, 'b-forfeit');
    fakeState.battles.set(row.id, row);

    const battle = await service.forfeit('u1', 'b-forfeit');
    expect(battle.phase).toBe('forfeited');
    expect(fakeState.ledger).toHaveLength(0);
  });
});
