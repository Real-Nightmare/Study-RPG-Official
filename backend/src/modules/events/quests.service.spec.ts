import { BadRequestException } from '@nestjs/common';
import { QuestsService } from './quests.service';
import { EventItemsService } from './event-items.service';
import { WalletService, WalletChangeInput } from '../rpg/wallet.service';

const USER = 'user-1';
const EVENT = 'ev-1';

interface FakeQuest {
  id: string;
  event_id: string | null;
  slug: string;
  category: string;
  title: string;
  story: string | null;
  objective: string;
  rewards: string;
  period: string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  sort_order: number;
}

interface FakeUserQuest {
  user_id: string;
  quest_id: string;
  period_key: string;
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
}

const DAILY_QUEST: FakeQuest = {
  id: 'q-daily',
  event_id: EVENT,
  slug: 'daily-quota',
  category: 'daily',
  title: 'Clear the Daily Quota',
  story: null,
  objective: JSON.stringify({ type: 'study_activity', activityType: 'task_completed', target: 3, period: 'day' }),
  rewards: JSON.stringify({ stp: 50, eventExp: 40 }),
  period: 'daily',
  starts_at: null,
  ends_at: null,
  active: true,
  sort_order: 1,
};

const SIGIL_QUEST: FakeQuest = {
  id: 'q-sigil',
  event_id: EVENT,
  slug: 'preserve-a-favourite',
  category: 'study',
  title: 'Preserve a Favourite',
  story: null,
  objective: JSON.stringify({ type: 'consume_sigil', target: 1, period: 'event' }),
  rewards: JSON.stringify({ stp: 250, eventExp: 180 }),
  period: 'none',
  starts_at: null,
  ends_at: null,
  active: true,
  sort_order: 2,
};

function makeDb() {
  const state: {
    quests: FakeQuest[];
    userQuests: FakeUserQuest[];
    items: Array<{ id: string; slug: string }>;
    userItems: Map<string, number>;
    eventExp: Map<string, number>;
  } = {
    quests: [DAILY_QUEST, SIGIL_QUEST],
    userQuests: [],
    items: [
      { id: 'i-error', slug: 'abstracted_error' },
      { id: 'i-sigil', slug: 'extinction_sigil' },
    ],
    userItems: new Map(),
    eventExp: new Map(),
  };

  const handle = async (
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[]; rowCount?: number }> => {
    if (/SELECT \* FROM quests\s+WHERE event_id = \$1 AND active = TRUE/.test(text)) {
      return { rows: state.quests.filter((q) => q.event_id === params[0] && q.active) };
    }
    if (/SELECT \* FROM quests WHERE id = \$1/.test(text)) {
      return { rows: state.quests.filter((q) => q.id === params[0]) };
    }
    if (/SELECT progress, completed_at, claimed_at(, period_key)? FROM user_quests/.test(text)) {
      // listForEvent filters by period_key (3 params); claim resolves the
      // latest row across periods (2 params).
      const row = state.userQuests.find(
        (u) =>
          u.user_id === params[0] &&
          u.quest_id === params[1] &&
          (params[2] === undefined || u.period_key === params[2]),
      );
      return { rows: row ? [row] : [] };
    }
    if (/INSERT INTO user_quests \(user_id, quest_id, period_key, progress, completed_at, updated_at\)/.test(text)) {
      const delta = Number(params[3]);
      const target = Number(params[4]);
      const existing = state.userQuests.find(
        (u) => u.user_id === params[0] && u.quest_id === params[1] && u.period_key === params[2],
      );
      const progress = Math.min((existing?.progress ?? 0) + delta, target);
      if (existing) {
        existing.progress = progress;
        if (progress >= target && !existing.completed_at) existing.completed_at = new Date().toISOString();
      } else {
        state.userQuests.push({
          user_id: params[0] as string,
          quest_id: params[1] as string,
          period_key: params[2] as string,
          progress,
          completed_at: progress >= target ? new Date().toISOString() : null,
          claimed_at: null,
        });
      }
      return { rows: [] };
    }
    if (/UPDATE user_quests SET claimed_at = NOW()/.test(text)) {
      const row = state.userQuests.find(
        (u) => u.user_id === params[0] && u.quest_id === params[1] && u.period_key === params[2],
      );
      if (row) row.claimed_at = new Date().toISOString();
      return { rows: [] };
    }
    if (/SELECT id FROM event_items WHERE slug = \$1/.test(text)) {
      const item = state.items.find((i) => i.slug === params[0]);
      return { rows: item ? [{ id: item.id }] : [] };
    }
    if (/INSERT INTO user_event_items/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      state.userItems.set(key, (state.userItems.get(key) ?? 0) + Number(params[2]));
      return { rows: [] };
    }
    if (/UPDATE user_event_items SET quantity = quantity - \$3/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      const current = state.userItems.get(key) ?? 0;
      if (current < Number(params[2])) return { rows: [], rowCount: 0 };
      state.userItems.set(key, current - Number(params[2]));
      return { rows: [{ quantity: current - Number(params[2]) }], rowCount: 1 };
    }
    if (/SELECT COALESCE\(uei.quantity, 0\)::int AS quantity/.test(text)) {
      const item = state.items.find((i) => i.slug === params[0]);
      const key = `${params[1]}:${item?.id ?? ''}`;
      return { rows: [{ quantity: state.userItems.get(key) ?? 0 }] };
    }
    if (/INSERT INTO user_event_state \(user_id, event_id, event_exp\)/.test(text)) {
      const key = `${params[0]}:${params[1]}`;
      state.eventExp.set(key, (state.eventExp.get(key) ?? 0) + Number(params[2]));
      return { rows: [] };
    }
    return { rows: [] };
  };

  const client = { query: handle };
  const db = {
    query: handle,
    queryOne: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows[0],
    queryMany: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows,
    transaction: async <T>(fn: (c: { query: typeof handle }) => Promise<T>): Promise<T> => fn(client),
  };

  const wallet = {
    applyChangeWithClient: jest.fn(
      async (_client: unknown, userId: string, input: WalletChangeInput) => ({
        userId,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
      }),
    ),
  } as unknown as WalletService;

  return { db, wallet, state };
}

function makeService() {
  const fixture = makeDb();
  const items = new EventItemsService(fixture.db as never);
  const service = new QuestsService(fixture.db as never, fixture.wallet, items);
  return { service, items, ...fixture };
}

describe('QuestsService (PDF Phase 7 §30)', () => {
  it('progresses daily quests from study activity and completes them at the target', async () => {
    const fixture = makeService();
    const now = new Date('2026-08-10T12:00:00Z');
    await fixture.service.applyActivity(USER, EVENT, 'task_completed', 1, now);
    await fixture.service.applyActivity(USER, EVENT, 'task_completed', 1, now);
    await fixture.service.applyActivity(USER, EVENT, 'task_completed', 1, now);
    const quests = await fixture.service.listForEvent(USER, EVENT, now);
    const daily = quests.find((q) => q.slug === 'daily-quota')!;
    expect(daily.progress).toBe(3);
    expect(daily.completed).toBe(true);
    // Unrelated activity does not progress it.
    await fixture.service.applyActivity(USER, EVENT, 'quiz_attempt', 1, now);
    const after = await fixture.service.listForEvent(USER, EVENT, now);
    expect(after.find((q) => q.slug === 'daily-quota')!.progress).toBe(3);
  });

  it('claims rewards exactly once (STP + event EXP)', async () => {
    const fixture = makeService();
    const now = new Date('2026-08-10T12:00:00Z');
    await fixture.service.applyActivity(USER, EVENT, 'task_completed', 3, now);
    const result = await fixture.service.claim(USER, DAILY_QUEST.id);
    expect(result.granted).toEqual(['stp:50', 'eventExp:40']);
    expect(fixture.wallet.applyChangeWithClient).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      expect.objectContaining({ amount: 50, idempotencyKey: expect.stringContaining('events:quest:') }),
    );
    expect(fixture.state.eventExp.get(`${USER}:${EVENT}`)).toBe(40);
    await expect(fixture.service.claim(USER, DAILY_QUEST.id)).rejects.toThrow('already claimed');
  });

  it('rejects claiming an incomplete quest', async () => {
    const fixture = makeService();
    await expect(fixture.service.claim(USER, DAILY_QUEST.id)).rejects.toThrow('not completed');
  });

  it('lets a Sigil satisfy a preserve-a-card quest objective (§29.1)', async () => {
    const fixture = makeService();
    // Give the user a completed consume_sigil quest and one Sigil.
    fixture.state.userQuests.push({
      user_id: USER,
      quest_id: SIGIL_QUEST.id,
      period_key: '',
      progress: 1,
      completed_at: new Date().toISOString(),
      claimed_at: null,
    });
    const sigilItem = fixture.state.items.find((i) => i.slug === 'extinction_sigil')!;
    fixture.state.userItems.set(`${USER}:${sigilItem.id}`, 1);

    const result = await fixture.service.claim(USER, SIGIL_QUEST.id);
    expect(result.granted).toContain('stp:250');
    expect(fixture.state.userItems.get(`${USER}:${sigilItem.id}`)).toBe(0);
  });

  it('rejects a Sigil quest when the player has no Sigil', async () => {
    const fixture = makeService();
    fixture.state.userQuests.push({
      user_id: USER,
      quest_id: SIGIL_QUEST.id,
      period_key: '',
      progress: 1,
      completed_at: new Date().toISOString(),
      claimed_at: null,
    });
    await expect(fixture.service.claim(USER, SIGIL_QUEST.id)).rejects.toThrow(
      BadRequestException,
    );
  });
});
