import { ConflictException, NotFoundException } from '@nestjs/common';
import { PvpService } from './pvp.service';
import { DeckView } from './card.service';
import { DEFAULT_PVP_CONFIG } from './pvp-ghost';
import { DEFAULT_LEVEL_CONFIG } from './rpg-config';
import { getCardDefinition } from './card-definitions';

/** Card keys used by the DeckView stub (must exist in CARD_DEFINITIONS). */
const STUB_CARD_KEYS = ['mana_slash', 'study_burst', 'poison_vial', 'focus_shield', 'revival_note'];

/** In-memory fake of DatabaseService covering every query PvpService issues. */
function makeDb(overrides: { pvpWinsToday?: number } = {}) {
  const state: {
    users: Map<string, { id: string; name: string; email: string }>;
    profiles: Map<string, { stp: number; xp: number; level: number; battle_rating: number }>;
    decks: Map<
      string,
      { user_id: string; is_active: boolean; validated: boolean; cards: unknown[] }
    >;
    duels: Map<string, Record<string, unknown>>;
    battles: Map<string, Record<string, unknown>>;
    ledger: unknown[];
    xpEvents: unknown[];
    pvpWinsToday: number;
    nextDuelId: number;
  } = {
    users: new Map([
      ['u1', { id: 'u1', name: 'Alpha', email: 'alpha@test.dev' }],
      ['u2', { id: 'u2', name: 'Beta', email: 'beta@test.dev' }],
      ['u3', { id: 'u3', name: 'Gamma', email: 'gamma@test.dev' }],
    ]),
    profiles: new Map([
      ['u1', { stp: 0, xp: 0, level: 1, battle_rating: 1000 }],
      ['u2', { stp: 0, xp: 0, level: 1, battle_rating: 1200 }],
      ['u3', { stp: 0, xp: 0, level: 1, battle_rating: 980 }],
    ]),
    decks: new Map([
      ['d1', { user_id: 'u1', is_active: true, validated: true, cards: [] }],
      ['d2', { user_id: 'u2', is_active: true, validated: true, cards: [] }],
      ['d3', { user_id: 'u3', is_active: true, validated: true, cards: [] }],
    ]),
    duels: new Map(),
    battles: new Map(),
    ledger: [],
    xpEvents: [],
    pvpWinsToday: overrides.pvpWinsToday ?? 0,
    nextDuelId: 1,
  };

  const handle = async (text: string, params: unknown[] = []) => {
    // Config lookups fall back to code defaults.
    if (/SELECT value FROM game_config/.test(text)) return { rows: [] };

    // ---- Users ----
    if (/SELECT id, name FROM users WHERE LOWER\(email\)/.test(text)) {
      const email = params[0] as string;
      const user = [...state.users.values()].find((u) => u.email === email);
      return { rows: user ? [{ id: user.id, name: user.name }] : [] };
    }
    if (/SELECT name FROM users WHERE id = \$1/.test(text)) {
      const user = state.users.get(params[0] as string);
      return { rows: user ? [{ name: user.name }] : [] };
    }

    // ---- Profiles ----
    if (/INSERT INTO player_profiles/.test(text)) {
      const ids = params.filter((p): p is string => typeof p === 'string' && /^u\d+$/.test(p));
      for (const id of ids) {
        if (!state.profiles.has(id)) {
          state.profiles.set(id, { stp: 0, xp: 0, level: 1, battle_rating: 1000 });
        }
      }
      return { rows: [] };
    }
    if (/SELECT user_id, battle_rating, level FROM player_profiles/.test(text)) {
      const p = state.profiles.get(params[0] as string);
      return {
        rows: p ? [{ user_id: params[0], battle_rating: p.battle_rating, level: p.level }] : [],
      };
    }
    if (/SELECT stp FROM player_profiles/.test(text)) {
      const p = state.profiles.get(params[0] as string) ?? {
        stp: 0,
        xp: 0,
        level: 1,
        battle_rating: 1000,
      };
      return { rows: [{ stp: p.stp }] };
    }
    if (/SELECT xp FROM player_profiles/.test(text)) {
      const p = state.profiles.get(params[0] as string) ?? {
        stp: 0,
        xp: 0,
        level: 1,
        battle_rating: 1000,
      };
      return { rows: [{ xp: p.xp }] };
    }
    if (/UPDATE player_profiles SET battle_rating/.test(text)) {
      const p = state.profiles.get(params[1] as string);
      if (p) p.battle_rating = params[0] as number;
      return { rows: [] };
    }
    if (/UPDATE player_profiles SET stp/.test(text)) {
      const p = state.profiles.get(params[1] as string);
      if (p) p.stp = params[0] as number;
      return { rows: [] };
    }
    if (/UPDATE player_profiles SET xp = \$1, level = \$2/.test(text)) {
      const p = state.profiles.get(params[2] as string);
      if (p) {
        p.xp = params[0] as number;
        p.level = params[1] as number;
      }
      return { rows: [] };
    }

    // ---- Wallet + XP rewards ----
    if (/COUNT\(\*\)::int AS count FROM wallet_ledger/.test(text)) {
      return { rows: [{ count: state.pvpWinsToday }] };
    }
    if (/INSERT INTO wallet_ledger/.test(text)) {
      state.ledger.push({
        id: params[0],
        user_id: params[1],
        amount: params[2],
        transaction_type: params[5],
        idempotency_key: params[8],
      });
      return { rows: [] };
    }
    if (/INSERT INTO user_xp_events/.test(text)) {
      state.xpEvents.push({ id: params[0], user_id: params[1], type: params[2], xp: params[3] });
      return { rows: [] };
    }

    // ---- Matchmaking ----
    if (/JOIN decks d ON d.user_id = p.user_id/.test(text)) {
      const rating = params[1] as number;
      const window = params[2] as number;
      let best: { user_id: string; name: string; battle_rating: number; dist: number } | null =
        null;
      for (const [uid, u] of state.users) {
        if (uid === (params[0] as string)) continue;
        const p = state.profiles.get(uid);
        const deck = [...state.decks.values()].find(
          (d) => d.user_id === uid && d.is_active && d.validated,
        );
        if (!p || !deck) continue;
        const dist = Math.abs(p.battle_rating - rating);
        if (dist <= window && (!best || dist < best.dist)) {
          best = { user_id: uid, name: u.name, battle_rating: p.battle_rating, dist };
        }
      }
      return {
        rows: best
          ? [{ user_id: best.user_id, name: best.name, battle_rating: best.battle_rating }]
          : [],
      };
    }

    // ---- Battles ----
    if (/SELECT state, phase FROM battles WHERE id = \$1/.test(text)) {
      const b = state.battles.get(params[0] as string);
      return { rows: b ? [{ state: b.state, phase: b.phase }] : [] };
    }
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
        pvp_duel_id: params[16] ?? null,
      };
      state.battles.set(row.id as string, row);
      return { rows: [row] };
    }

    // ---- Duels ----
    if (/INSERT INTO pvp_duels/.test(text)) {
      const id = params[0] as string;
      const row: Record<string, unknown> = {
        id,
        challenger_id: params[1],
        defender_id: params[2],
        status: 'challenged',
        challenger_deck: params[3],
        defender_deck: params[4],
        challenger_rating_before: params[5],
        defender_rating_before: params[6],
        expires_at: params[7],
        challenger_battle_id: null,
        defender_battle_id: null,
        challenger_rating_after: null,
        defender_rating_after: null,
        winner_id: null,
        margins: null,
        rewards: null,
        settled_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      state.duels.set(id, row);
      return { rows: [row] };
    }
    if (/SELECT \* FROM pvp_duels WHERE id = \$1 FOR UPDATE/.test(text)) {
      const d = state.duels.get(params[0] as string);
      return { rows: d ? [d] : [] };
    }
    if (/SELECT \* FROM pvp_duels WHERE id = \$1/.test(text)) {
      const d = state.duels.get(params[0] as string);
      return { rows: d ? [d] : [] };
    }
    if (/SELECT d\.\* FROM pvp_duels d WHERE/.test(text)) {
      const uid = params[0] as string;
      const rows = [...state.duels.values()].filter(
        (d) => d.challenger_id === uid || d.defender_id === uid,
      );
      return { rows };
    }
    if (/SELECT id FROM pvp_duels WHERE \(challenger_id = \$1/.test(text)) {
      const uid = params[0] as string;
      const rows = [...state.duels.values()].filter(
        (d) =>
          (d.challenger_id === uid || d.defender_id === uid) &&
          (d.status === 'challenged' || d.status === 'in_progress'),
      );
      return { rows };
    }
    if (/UPDATE pvp_duels SET challenger_battle_id/.test(text)) {
      const d = state.duels.get(params[1] as string);
      if (d) {
        d.challenger_battle_id = params[0];
        d.status = 'in_progress';
      }
      return { rows: [] };
    }
    if (/UPDATE pvp_duels SET defender_battle_id/.test(text)) {
      const d = state.duels.get(params[1] as string);
      if (d) {
        d.defender_battle_id = params[0];
        d.status = 'in_progress';
      }
      return { rows: [] };
    }
    if (/UPDATE pvp_duels SET\s+status = 'settled'/.test(text)) {
      const d = state.duels.get(params[5] as string);
      if (d) {
        d.status = 'settled';
        d.winner_id = params[0];
        d.challenger_rating_after = params[1];
        d.defender_rating_after = params[2];
        d.margins = params[3];
        d.rewards = params[4];
        d.settled_at = new Date();
      }
      return { rows: [] };
    }

    // ---- Leaderboard ----
    if (/ORDER BY p.battle_rating DESC/.test(text)) {
      const rows = [...state.profiles.entries()]
        .map(([uid, p]) => ({
          user_id: uid,
          name: state.users.get(uid)?.name ?? '?',
          battle_rating: p.battle_rating,
          level: p.level,
        }))
        .sort((a, b) => b.battle_rating - a.battle_rating);
      return { rows };
    }

    return { rows: [] };
  };

  const client = { query: handle };
  const db = {
    transaction: async (cb: (c: typeof client) => Promise<unknown>) => cb(client),
    query: handle,
    queryOne: async (text: string, params?: unknown[]) => {
      const r = await handle(text, params);
      return r.rows[0] ?? null;
    },
    queryMany: async (text: string, params?: unknown[]) => {
      const r = await handle(text, params);
      return r.rows;
    },
  };
  return { state, db };
}

/** Deck view returned by the CardService stub. */
function deckView(userId: string, overrides: Partial<{ validated: boolean }> = {}) {
  return {
    id: `deck-${userId}`,
    name: 'Deck',
    isActive: true,
    validated: overrides.validated ?? true,
    invalidReason: null,
    validation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: STUB_CARD_KEYS.map((key, slot) => {
      const def = getCardDefinition(key);
      return {
        slot,
        instanceId: `i-${userId}-${slot}`,
        cardKey: key,
        name: def.name,
        rarity: def.rarity,
        category: def.category,
        ability: def.ability,
      };
    }),
  };
}

function makeService(db: ReturnType<typeof makeDb>['db'], deps: Record<string, unknown> = {}) {
  const cards = {
    getActiveDeck: jest.fn(async (userId: string): Promise<DeckView | null> => deckView(userId)),
    getDeck: jest.fn(),
    grantStarterSet: jest.fn().mockResolvedValue({ granted: false }),
  } as {
    getActiveDeck: jest.Mock<Promise<DeckView | null>, [string]>;
    getDeck: jest.Mock;
    grantStarterSet: jest.Mock;
  };
  const battles = {
    create: jest.fn(),
    get: jest.fn().mockResolvedValue({ id: 'b1', monster: { name: 'Ghost' } }),
  };
  const player = {
    getLevelConfig: jest.fn().mockResolvedValue(DEFAULT_LEVEL_CONFIG),
    addXp: jest.fn().mockResolvedValue({}),
  };
  const wallet = { applyChange: jest.fn() };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const service = new PvpService(
    db as any,
    battles as any,
    cards as any,
    player as any,
    wallet as any,
    notifications as any,
  );
  return { service, cards, battles, player, wallet, notifications };
}

/** Seeds a terminal battle row for the fake DB. */
function seedBattle(
  state: ReturnType<typeof makeDb>['state'],
  battleId: string,
  userId: string,
  duelId: string,
  phase: string,
  playerHp: number,
  turn: number,
) {
  state.battles.set(battleId, {
    id: battleId,
    user_id: userId,
    pvp_duel_id: duelId,
    phase,
    state: JSON.stringify({ phase, playerHp, maxHp: 100, turn }),
  });
}

describe('PvpService', () => {
  it('creates a duel by opponent email and snapshots decks', async () => {
    const { state, db } = makeDb();
    const { service, notifications } = makeService(db);

    const view = await service.create('u1', { opponentEmail: 'beta@test.dev' });
    expect(view.status).toBe('challenged');
    expect(view.challenger.id).toBe('u1');
    expect(view.defender.id).toBe('u2');
    expect(view.mySide).toBe('challenger');
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
    expect(state.duels.size).toBe(1);
  });

  it('rejects an unknown or self email', async () => {
    const { db } = makeDb();
    const { service } = makeService(db);
    await expect(service.create('u1', { opponentEmail: 'nobody@test.dev' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.create('u1', { opponentEmail: 'alpha@test.dev' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('matchmakes the nearest eligible opponent by rating', async () => {
    const { state, db } = makeDb();
    const { service } = makeService(db);

    // u1 (1000) should match u3 (980) within the ±150 window before u2 (1200).
    const view = await service.create('u1', {});
    expect(view.defender.id).toBe('u3');
    expect(state.duels.size).toBe(1);
  });

  it('rejects when no eligible opponent exists', async () => {
    const { state, db } = makeDb();
    const { service, cards } = makeService(db);
    // Remove all other eligible decks.
    cards.getActiveDeck.mockImplementation(async (userId: string) =>
      userId === 'u1' ? deckView(userId) : null,
    );
    state.decks.clear();
    state.decks.set('d1', { user_id: 'u1', is_active: true, validated: true, cards: [] });

    await expect(service.create('u1', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a validated active deck', async () => {
    const { db } = makeDb();
    const { service, cards } = makeService(db);
    cards.getActiveDeck.mockResolvedValue({
      ...deckView('u1'),
      validated: false,
      invalidReason: 'nope',
    });
    await expect(service.create('u1', {})).rejects.toBeInstanceOf(Error);
  });

  it('starts a battle vs the opponent ghost and links the duel', async () => {
    const { state, db } = makeDb();
    const { service, battles } = makeService(db);

    const created = await service.create('u1', { opponentEmail: 'beta@test.dev' });
    battles.create.mockResolvedValue({ id: 'b1', monster: { name: 'Beta' } });

    const battle = await service.startBattle('u1', created.id);
    expect(battle.id).toBe('b1');
    expect(battles.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ pvpDuelId: created.id, world: 'pvp', monster: expect.any(Object) }),
    );
    const duel = state.duels.get(created.id)!;
    expect(duel.status).toBe('in_progress');
    expect(duel.challenger_battle_id).toBe('b1');
  });

  it('settles a decisive duel: rating + rewards applied once', async () => {
    const { state, db } = makeDb();
    const { service, battles } = makeService(db);

    const created = await service.create('u1', { opponentEmail: 'beta@test.dev' });
    battles.create.mockResolvedValue({ id: 'b1', monster: {} });
    await service.startBattle('u1', created.id);

    // Challenger won decisively; defender battle never started (simulate terminal via seeds).
    seedBattle(state, 'b1', 'u1', created.id, 'player_won', 80, 6);
    seedBattle(state, 'b2', 'u2', created.id, 'monster_won', 10, 9);
    // Mark both battle ids on the duel.
    const duel = state.duels.get(created.id)!;
    duel.defender_battle_id = 'b2';

    const view = await service.get('u1', created.id);
    expect(view.status).toBe('settled');
    expect(view.winner).toBe('challenger');
    expect(view.rewards).toEqual({
      xp: DEFAULT_PVP_CONFIG.winXp,
      stp: DEFAULT_PVP_CONFIG.winStp,
      limited: false,
    });
    // u1 1000 beats u2 1200 -> winner gains, loser loses.
    expect(view.ratingChange!.challenger).toBeGreaterThan(1000);
    expect(view.ratingChange!.defender).toBeLessThan(1200);
    expect(state.profiles.get('u1')!.battle_rating).toBe(view.ratingChange!.challenger);
    expect(state.ledger).toHaveLength(1);
    expect(state.xpEvents).toHaveLength(2); // winner + loser XP

    // Idempotent: second read does not re-apply.
    const ledgerCount = state.ledger.length;
    await service.get('u1', created.id);
    expect(state.ledger).toHaveLength(ledgerCount);
  });

  it('enforces the daily PvP win limit (no rewards, duel still settles)', async () => {
    const { state, db } = makeDb({ pvpWinsToday: 10 });
    const { service, battles } = makeService(db);

    const created = await service.create('u1', { opponentEmail: 'beta@test.dev' });
    battles.create.mockResolvedValue({ id: 'b1', monster: {} });
    await service.startBattle('u1', created.id);
    const duel = state.duels.get(created.id)!;
    seedBattle(state, 'b1', 'u1', created.id, 'player_won', 80, 6);
    seedBattle(state, 'b2', 'u2', created.id, 'monster_won', 10, 9);
    duel.defender_battle_id = 'b2';

    const view = await service.get('u1', created.id);
    expect(view.status).toBe('settled');
    expect(view.winner).toBe('challenger');
    expect(view.rewards).toEqual({ xp: 0, stp: 0, limited: true });
    expect(state.ledger).toHaveLength(0);
    expect(state.profiles.get('u1')!.stp).toBe(0);
  });

  it('expired duel with only one side played defaults to the played side', async () => {
    const { state, db } = makeDb();
    const { service, battles } = makeService(db);

    const created = await service.create('u1', { opponentEmail: 'beta@test.dev' });
    battles.create.mockResolvedValue({ id: 'b1', monster: {} });
    await service.startBattle('u1', created.id);

    const duel = state.duels.get(created.id)!;
    seedBattle(state, 'b1', 'u1', created.id, 'player_won', 70, 5);
    duel.expires_at = new Date(Date.now() - 1000); // expired
    duel.defender_battle_id = null; // defender never played

    const view = await service.get('u1', created.id);
    expect(view.status).toBe('settled');
    expect(view.winner).toBe('challenger');
  });

  it('lists the leaderboard by battle rating', async () => {
    const { db } = makeDb();
    const { service } = makeService(db);
    const board = await service.leaderboard(10);
    expect(board[0].name).toBe('Beta'); // 1200
    expect(board[0].rating).toBe(1200);
    expect(board[1].name).toBe('Alpha'); // 1000
  });
});
