import { BadRequestException } from '@nestjs/common';
import { StudyEventsService, EventView } from './events.service';
import { QuestsService } from './quests.service';
import { EventItemsService } from './event-items.service';
import { WalletService, WalletChangeInput } from '../rpg/wallet.service';
import { DEFAULT_EVENTS_CONFIG } from './events-config';

const USER = 'user-1';
const ADMIN = 'admin-1';

interface FakeEventRow {
  id: string;
  slug: string;
  name: string;
  story: string | null;
  kind: string;
  starts_at: string;
  ends_at: string;
  grace_hours: number;
  claim_deadline: string;
  config: unknown;
  status: string;
}

function activeEventRow(overrides: Partial<FakeEventRow> = {}): FakeEventRow {
  return {
    id: 'ev-abstracted',
    slug: 'abstracted',
    name: 'Abstracted',
    story: 'The first event.',
    kind: 'normal',
    starts_at: '2026-08-01T00:00:00.000Z',
    ends_at: '2026-08-30T00:00:00.000Z',
    grace_hours: 48,
    claim_deadline: '2026-09-01T00:00:00.000Z',
    config: {},
    status: 'active',
    ...overrides,
  };
}

function makeDb() {
  const state: {
    events: FakeEventRow[];
    userEventState: Map<string, Record<string, unknown>>;
    eventItems: Array<{ id: string; slug: string }>;
    userItems: Map<string, number>;
    insertedFallbacks: Array<{ id: string; slug: string; status: string }>;
  } = {
    events: [activeEventRow()],
    userEventState: new Map(),
    eventItems: [
      { id: 'item-1', slug: 'abstracted_error' },
      { id: 'item-2', slug: 'extinction_sigil' },
    ],
    userItems: new Map(),
    insertedFallbacks: [],
  };

  const now = new Date('2026-08-10T12:00:00Z');

  const handle = async (
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[]; rowCount?: number }> => {
    if (/SELECT value FROM game_config/.test(text)) return { rows: [] };
    if (/UPDATE events SET status = 'ended'/.test(text)) return { rows: [] };
    if (/UPDATE events SET status = 'active'/.test(text)) return { rows: [] };
    if (/status = 'active' AND claim_deadline >/.test(text)) {
      const row = state.events.find(
        (e) => e.status === 'active' && new Date(e.claim_deadline) > (params[0] as Date),
      );
      return { rows: row ? [row] : [] };
    }
    if (/starts_at > \$1 AND status <> 'ended'/.test(text)) {
      const row = state.events.find(
        (e) => new Date(e.starts_at) > (params[0] as Date) && e.status !== 'ended',
      );
      return { rows: row ? [row] : [] };
    }
    if (/pg_advisory_xact_lock/.test(text)) return { rows: [] };
    if (/SELECT id FROM users WHERE role = 'admin'/.test(text)) {
      return { rows: [{ id: ADMIN }] };
    }
    if (/INSERT INTO events\s+\(id, slug, name/.test(text)) {
      const row: FakeEventRow = {
        id: params[0] as string,
        slug: params[1] as string,
        name: params[2] as string,
        story: params[3] as string,
        kind: 'fallback',
        starts_at: (params[4] as Date).toISOString(),
        ends_at: (params[5] as Date).toISOString(),
        grace_hours: params[6] as number,
        claim_deadline: (params[7] as Date).toISOString(),
        config: {},
        status: 'active',
      };
      state.events.push(row);
      state.insertedFallbacks.push({ id: row.id, slug: row.slug, status: 'active' });
      return { rows: [] };
    }
    if (/SELECT (track|\*) FROM user_event_state/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      const row = state.userEventState.get(key);
      return { rows: row ? [row] : [] };
    }
    if (/INSERT INTO user_event_state \(user_id, event_id, event_exp\)/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      const existing = state.userEventState.get(key);
      state.userEventState.set(key, {
        user_id: params[0],
        event_id: params[1],
        event_exp: Number(existing?.event_exp ?? 0) + Number(params[2]),
        track: existing?.track ?? null,
        track_locked: Boolean(existing?.track_locked),
        claimed_levels: existing?.claimed_levels ?? '[]',
        gold_paid_at: existing?.gold_paid_at ?? null,
      });
      return { rows: [] };
    }
    if (
      /INSERT INTO user_event_state \(user_id, event_id, track, track_locked, gold_paid_at\)/.test(
        text,
      )
    ) {
      const key = `${params[0]}:${params[1]}`;
      state.userEventState.set(key, {
        user_id: params[0],
        event_id: params[1],
        track: 'gold',
        track_locked: true,
        event_exp: 0,
        claimed_levels: '[]',
        gold_paid_at: now.toISOString(),
      });
      return { rows: [] };
    }
    if (/INSERT INTO user_event_state \(user_id, event_id, track, track_locked\)/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      state.userEventState.set(key, {
        user_id: params[0],
        event_id: params[1],
        track: 'free',
        track_locked: true,
        event_exp: 0,
        claimed_levels: '[]',
        gold_paid_at: null,
      });
      return { rows: [] };
    }
    if (/UPDATE user_event_state\s+SET claimed_levels/.test(text)) {
      const key = `${params[1]}:${params[2]}`;
      const existing = state.userEventState.get(key) ?? {};
      state.userEventState.set(key, { ...existing, claimed_levels: params[0], track_locked: true });
      return { rows: [] };
    }
    if (/SELECT id FROM event_items WHERE slug = \$1/.test(text)) {
      const item = state.eventItems.find((i) => i.slug === params[0]);
      return { rows: item ? [{ id: item.id }] : [] };
    }
    if (/INSERT INTO user_event_items/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      state.userItems.set(key, (state.userItems.get(key) ?? 0) + Number(params[2]));
      return { rows: [] };
    }
    if (/SELECT \* FROM quests WHERE event_id = \$1 AND active = TRUE/.test(text)) {
      return { rows: [] };
    }
    if (/INSERT INTO user_quests/.test(text)) return { rows: [] };
    return { rows: [] };
  };

  const client = { query: handle };
  const db = {
    query: handle,
    queryOne: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows[0],
    queryMany: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows,
    transaction: async <T>(fn: (c: { query: typeof handle }) => Promise<T>): Promise<T> =>
      fn(client),
  };

  const wallet = {
    applyChangeWithClient: jest.fn(
      async (_client: unknown, userId: string, input: WalletChangeInput) => {
        return { userId, amount: input.amount, idempotencyKey: input.idempotencyKey };
      },
    ),
  } as unknown as WalletService;

  const cards = {
    openLootBox: jest.fn(async () => ({
      boxType: 'normal',
      cardKey: 'mana_slash',
      name: 'Mana Slash',
      rarity: 'common',
      odds: { common: 100 },
    })),
    grantEventCard: jest.fn(async (_u: string, key: string) => ({
      instanceId: 'inst-1',
      cardKey: key,
      name: key,
      rarity: 'rare',
    })),
  };

  const notifications = { create: jest.fn() };
  const audit = { log: jest.fn() };

  return { db, wallet, cards, notifications, audit, state };
}

function makeService() {
  const fixture = makeDb();
  const items = new EventItemsService(fixture.db as never);
  const quests = new QuestsService(fixture.db as never, fixture.wallet, items);
  const service = new StudyEventsService(
    fixture.db as never,
    fixture.wallet,
    fixture.cards as never,
    fixture.notifications as never,
    fixture.audit as never,
    quests,
    items,
  );
  return { service, ...fixture };
}

describe('StudyEventsService (PDF Phase 7 §25–§27)', () => {
  describe('ensureActiveEvent (§25)', () => {
    it('returns the currently active event', async () => {
      const { service } = makeService();
      const event = await service.ensureActiveEvent(new Date('2026-08-10T12:00:00Z'));
      expect(event?.slug).toBe('abstracted');
      expect(event?.status).toBe('active');
    });

    it('creates the Study Sprint fallback when nothing is live and nothing is scheduled', async () => {
      const fixture = makeDb();
      fixture.state.events = [
        {
          ...activeEventRow({ id: 'ev-old', slug: 'old', status: 'ended' }),
          claim_deadline: '2026-07-01T00:00:00.000Z',
        },
      ];
      const items = new EventItemsService(fixture.db as never);
      const quests = new QuestsService(fixture.db as never, fixture.wallet, items);
      const service = new StudyEventsService(
        fixture.db as never,
        fixture.wallet,
        fixture.cards as never,
        fixture.notifications as never,
        fixture.audit as never,
        quests,
        items,
      );
      const now = new Date('2026-08-10T12:00:00Z');
      const event = await service.ensureActiveEvent(now);
      expect(event?.slug).toBe(DEFAULT_EVENTS_CONFIG.fallback.slug);
      expect(event?.kind).toBe('fallback');
      expect(fixture.state.insertedFallbacks).toHaveLength(1);
      // Admins were warned BEFORE activation.
      expect(fixture.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ADMIN, type: 'warning' }),
      );
    });

    it('is idempotent: a second resolution never double-creates the fallback', async () => {
      const fixture = makeDb();
      fixture.state.events = [];
      const items = new EventItemsService(fixture.db as never);
      const quests = new QuestsService(fixture.db as never, fixture.wallet, items);
      const service = new StudyEventsService(
        fixture.db as never,
        fixture.wallet,
        fixture.cards as never,
        fixture.notifications as never,
        fixture.audit as never,
        quests,
        items,
      );
      const now = new Date('2026-08-10T12:00:00Z');
      await service.ensureActiveEvent(now);
      await service.ensureActiveEvent(now);
      expect(fixture.state.insertedFallbacks).toHaveLength(1);
      expect(fixture.state.events).toHaveLength(1);
    });
  });

  describe('recordStudyActivity (§25)', () => {
    it('accrues event EXP from study activity during an active event', async () => {
      const fixture = makeService();
      await fixture.service.recordStudyActivity(USER, { type: 'task_completed' });
      await fixture.service.recordStudyActivity(USER, { type: 'study_session', amount: 60 });
      const state = await fixture.service.studyPassState(USER, 'ev-abstracted');
      expect(state.exp).toBe(25 + 10 * 60);
    });

    it('is a no-op with no active event or unknown activity type', async () => {
      const fixture = makeService();
      fixture.state.events = [];
      await fixture.service.recordStudyActivity(USER, { type: 'task_completed' });
      expect(fixture.state.userEventState.size).toBe(0);
    });
  });

  describe('Free & Gold tracks (§27)', () => {
    it('locks the free track at no cost', async () => {
      const fixture = makeService();
      const state = await fixture.service.chooseTrack(USER, 'ev-abstracted', 'free');
      expect(state.track).toBe('free');
      expect(state.trackLocked).toBe(true);
      expect(fixture.wallet.applyChangeWithClient).not.toHaveBeenCalled();
    });

    it('purchases the Gold Pass for 1500 SLC and locks it', async () => {
      const fixture = makeService();
      const state = await fixture.service.chooseTrack(USER, 'ev-abstracted', 'gold');
      expect(state.track).toBe('gold');
      expect(state.trackLocked).toBe(true);
      expect(state.goldPaidAt).toBeInstanceOf(Date);
      expect(fixture.wallet.applyChangeWithClient).toHaveBeenCalledWith(
        expect.anything(),
        USER,
        expect.objectContaining({
          amount: -DEFAULT_EVENTS_CONFIG.goldCost,
          transactionType: 'event_gold_pass',
        }),
      );
    });

    it('rejects switching tracks after the choice is locked', async () => {
      const fixture = makeService();
      await fixture.service.chooseTrack(USER, 'ev-abstracted', 'free');
      await expect(fixture.service.chooseTrack(USER, 'ev-abstracted', 'gold')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('claimLevel (§26, §27)', () => {
    it('grants track rewards once and rejects double claims', async () => {
      const fixture = makeService();
      await fixture.service.chooseTrack(USER, 'ev-abstracted', 'free');
      // Reach level 2 (250 EXP).
      await fixture.db.query(
        `INSERT INTO user_event_state (user_id, event_id, event_exp) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, event_id) DO UPDATE SET event_exp = user_event_state.event_exp + EXCLUDED.event_exp`,
        [USER, 'ev-abstracted', 250],
      );
      const claim = await fixture.service.claimLevel(USER, 'ev-abstracted', 0);
      expect(claim.granted).toContain('stp:100');
      await expect(fixture.service.claimLevel(USER, 'ev-abstracted', 0)).rejects.toThrow(
        'already claimed',
      );
      // Level 1 grants a loot box.
      const loot = await fixture.service.claimLevel(USER, 'ev-abstracted', 1);
      expect(loot.granted.some((g) => g.startsWith('loot:'))).toBe(true);
    });

    it('rejects claiming an unreached level', async () => {
      const fixture = makeService();
      await fixture.service.chooseTrack(USER, 'ev-abstracted', 'free');
      await expect(fixture.service.claimLevel(USER, 'ev-abstracted', 5)).rejects.toThrow(
        'not reached',
      );
    });

    it('rejects claiming before choosing a track', async () => {
      const fixture = makeService();
      await expect(fixture.service.claimLevel(USER, 'ev-abstracted', 0)).rejects.toThrow('track');
    });
  });
});
