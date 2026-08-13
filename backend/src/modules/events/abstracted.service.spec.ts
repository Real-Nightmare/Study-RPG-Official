import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AbstractedService } from './abstracted.service';
import { EventItemsService } from './event-items.service';
import { WalletService, WalletChangeInput } from '../rpg/wallet.service';
import { StudyEventsService } from './events.service';
import { QuestsService } from './quests.service';
import { DEFAULT_EVENTS_CONFIG } from './events-config';

const USER = 'user-1';
const INSTANCE = 'inst-abstracted';

function makeDb() {
  const state: {
    abstracted: Array<{
      card_instance_id: string;
      event_id: string;
      legendary_result_key: string;
      unabstracted_at: string | null;
      user_id: string;
      removed_at: string | null;
      card_key: string;
      name: string;
      rarity: string;
    }>;
    userItems: Map<string, number>;
    items: Array<{ id: string; slug: string }>;
    instances: Map<string, { card_key: string; removed_at: string | null }>;
  } = {
    abstracted: [
      {
        card_instance_id: INSTANCE,
        event_id: 'ev-1',
        legendary_result_key: 'awakened_guardian',
        unabstracted_at: null,
        user_id: USER,
        removed_at: null,
        card_key: 'abstracted_recluse',
        name: 'Void Recluse',
        rarity: 'legendary',
      },
    ],
    userItems: new Map(),
    items: [
      { id: 'i-error', slug: 'abstracted_error' },
      { id: 'i-sigil', slug: 'extinction_sigil' },
    ],
    instances: new Map([[INSTANCE, { card_key: 'abstracted_recluse', removed_at: null }]]),
  };

  const handle = async (
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[]; rowCount?: number }> => {
    if (/FROM abstracted_instances ai\s+JOIN card_instances ci/.test(text)) {
      const inst = state.abstracted.find((a) => a.card_instance_id === params[0]);
      return { rows: inst ? [inst] : [] };
    }
    if (
      /UPDATE card_instances SET removed_at = NOW\(\), removed_reason = 'unabstracted'/.test(text)
    ) {
      const inst = state.instances.get(params[0] as string);
      if (inst) inst.removed_at = new Date().toISOString();
      return { rows: [] };
    }
    if (/UPDATE card_definitions SET active_supply = GREATEST/.test(text)) return { rows: [] };
    if (/INSERT INTO card_supply_ledger/.test(text)) return { rows: [] };
    if (/UPDATE abstracted_instances SET unabstracted_at/.test(text)) {
      const inst = state.abstracted.find((a) => a.card_instance_id === params[0]);
      if (inst) inst.unabstracted_at = new Date().toISOString();
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
    if (
      /SELECT ci.id FROM card_instances ci WHERE ci.user_id = \$1 AND ci.card_key = \$2/.test(text)
    ) {
      return { rows: [] }; // no limbo card owned yet
    }
    if (/SELECT value FROM game_config/.test(text)) return { rows: [] };
    if (/SELECT \* FROM events WHERE status = 'active'/.test(text)) return { rows: [] };
    if (/SELECT \* FROM events WHERE starts_at > \$1/.test(text)) return { rows: [] };
    if (/SELECT \* FROM quests WHERE event_id = \$1 AND active = TRUE/.test(text))
      return { rows: [] };
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
      async (_client: unknown, userId: string, input: WalletChangeInput) => ({
        userId,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
      }),
    ),
  } as unknown as WalletService;

  const cards = {
    grantEventCard: jest.fn(async (_u: string, key: string) => ({
      instanceId: 'result-inst',
      cardKey: key,
      name: key,
      rarity: 'legendary',
    })),
  };

  const audit = { log: jest.fn() };

  return { db, wallet, cards, audit, state };
}

function makeService() {
  const fixture = makeDb();
  const items = new EventItemsService(fixture.db as never);
  const quests = new QuestsService(fixture.db as never, fixture.wallet, items);
  const events = new StudyEventsService(
    fixture.db as never,
    fixture.wallet,
    fixture.cards as never,
    { create: jest.fn() } as never,
    fixture.audit as never,
    quests,
    items,
  );
  const service = new AbstractedService(
    fixture.db as never,
    fixture.wallet,
    fixture.cards as never,
    fixture.audit as never,
    events,
    items,
  );
  return { service, items, ...fixture };
}

describe('AbstractedService (PDF Phase 7 §28)', () => {
  it('requires explicit confirmation', async () => {
    const fixture = makeService();
    await expect(fixture.service.unabstract(USER, INSTANCE, { confirm: false })).rejects.toThrow(
      'Confirmation required',
    );
  });

  it('unabstracts: retires the card, grants the Legendary result + 500 STP + 1 Error, audits', async () => {
    const fixture = makeService();
    const result = await fixture.service.unabstract(USER, INSTANCE, {
      confirm: true,
      reason: 'Testing the seams',
    });
    expect(result.unabstracted).toBe(true);
    expect(result.resultCardKey).toBe('awakened_guardian');
    expect(result.stpAwarded).toBe(DEFAULT_EVENTS_CONFIG.abstracted.unabstractStp);
    expect(fixture.wallet.applyChangeWithClient).toHaveBeenCalledWith(
      expect.anything(),
      USER,
      expect.objectContaining({ amount: 500, transactionType: 'abstracted_unabstract' }),
    );
    expect(fixture.cards.grantEventCard).toHaveBeenCalledWith(
      USER,
      'awakened_guardian',
      expect.objectContaining({ source: 'unabstract' }),
      expect.anything(),
    );
    expect(fixture.state.abstracted[0].unabstracted_at).not.toBeNull();
    expect(fixture.state.instances.get(INSTANCE)?.removed_at).not.toBeNull();
    expect(fixture.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'events.abstracted.unabstract',
        reason: 'Testing the seams',
      }),
    );
    expect(result.abstractedErrors).toBe(1);
  });

  it('rejects unabstracting twice', async () => {
    const fixture = makeService();
    await fixture.service.unabstract(USER, INSTANCE, { confirm: true });
    await expect(fixture.service.unabstract(USER, INSTANCE, { confirm: true })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects unabstracting a card that is not yours', async () => {
    const fixture = makeService();
    await expect(
      fixture.service.unabstract('someone-else', INSTANCE, { confirm: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('redeems Limbo only with seven Abstracted Errors, and only once', async () => {
    const fixture = makeService();
    await expect(fixture.service.limbo(USER, { confirm: true })).rejects.toThrow('Limbo requires');
    const errorItem = fixture.state.items.find((i) => i.slug === 'abstracted_error')!;
    fixture.state.userItems.set(`${USER}:${errorItem.id}`, 7);
    const result = await fixture.service.limbo(USER, { confirm: true });
    expect(result.redeemed).toBe(true);
    expect(result.rewardCardKey).toBe(DEFAULT_EVENTS_CONFIG.abstracted.limboRewardCard);
    expect(fixture.state.userItems.get(`${USER}:${errorItem.id}`)).toBe(0);
  });

  it('requires confirmation for Limbo', async () => {
    const fixture = makeService();
    await expect(fixture.service.limbo(USER, { confirm: false })).rejects.toThrow(
      'Confirmation required',
    );
  });
});
