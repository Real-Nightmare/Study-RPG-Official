import { BadRequestException } from '@nestjs/common';
import { ExtinctionService } from './extinction.service';
import { EventItemsService } from './event-items.service';
import { QuestsService } from './quests.service';
import { WalletService } from '../rpg/wallet.service';
import { StudyEventsService } from './events.service';

const USER = 'user-1';
const FRIEND = 'user-2';
const EVENT_ID = 'ev-extinction';

function makeDb() {
  const state: {
    targets: Array<{ event_id: string; card_key: string; target_order: number; reason: string }>;
    defs: Array<{ key: string; name: string; rarity: string; official_value: number }>;
    milestone: {
      id: string;
      event_id: string;
      slug: string;
      title: string;
      objective: string;
      progress: number;
      completed_at: string | null;
      reward: string;
    } | null;
    milestoneClaims: Set<string>;
    userItems: Map<string, number>;
    items: Array<{ id: string; slug: string }>;
    events: Array<{ id: string; slug: string; status: string }>;
    friendships: Array<{ requester_id: string; addressee_id: string; status: string }>;
  } = {
    targets: [],
    defs: [
      { key: 'mana_slash', name: 'Mana Slash', rarity: 'common', official_value: 25 },
      { key: 'study_burst', name: 'Study Burst', rarity: 'common', official_value: 25 },
      { key: 'poison_vial', name: 'Poison Vial', rarity: 'common', official_value: 25 },
      { key: 'focus_shield', name: 'Focus Shield', rarity: 'common', official_value: 25 },
      { key: 'revival_note', name: 'Revival Note', rarity: 'common', official_value: 25 },
      { key: 'rare_a', name: 'Rare A', rarity: 'rare', official_value: 120 },
      { key: 'rare_b', name: 'Rare B', rarity: 'rare', official_value: 120 },
      { key: 'leg_a', name: 'Legendary A', rarity: 'legendary', official_value: 600 },
      { key: 'leg_b', name: 'Legendary B', rarity: 'legendary', official_value: 600 },
      { key: 'leg_c', name: 'Legendary C', rarity: 'legendary', official_value: 600 },
      { key: 'leg_d', name: 'Legendary D', rarity: 'legendary', official_value: 600 },
      { key: 'leg_e', name: 'Legendary E', rarity: 'legendary', official_value: 600 },
    ],
    milestone: {
      id: 'm-1',
      event_id: EVENT_ID,
      slug: 'burn-milestone',
      title: 'The Great Pyre',
      objective: JSON.stringify({ type: 'targeted_burns', target: 250 }),
      progress: 0,
      completed_at: null,
      reward: JSON.stringify({ items: [{ slug: 'extinction_sigil', quantity: 1 }] }),
    },
    milestoneClaims: new Set(),
    userItems: new Map(),
    items: [
      { id: 'i-error', slug: 'abstracted_error' },
      { id: 'i-sigil', slug: 'extinction_sigil' },
    ],
    events: [{ id: EVENT_ID, slug: 'great-extinction', status: 'active' }],
    friendships: [{ requester_id: USER, addressee_id: FRIEND, status: 'accepted' }],
  };

  const handle = async (
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: unknown[]; rowCount?: number }> => {
    if (/SELECT value FROM game_config/.test(text)) return { rows: [] };
    if (/SELECT \* FROM events WHERE slug = \$1 LIMIT 1/.test(text)) {
      return { rows: state.events.filter((e) => e.slug === params[0]) };
    }
    if (/SELECT COUNT\(\*\)::int AS count FROM event_extinction_targets/.test(text)) {
      return { rows: [{ count: state.targets.length }] };
    }
    if (
      /SELECT key, name, rarity, official_value FROM card_definitions\s+WHERE active = TRUE/.test(
        text,
      )
    ) {
      return { rows: state.defs };
    }
    if (/INSERT INTO event_extinction_targets/.test(text)) {
      state.targets.push({
        event_id: params[0] as string,
        card_key: params[1] as string,
        target_order: params[2] as number,
        reason: params[3] as string,
      });
      return { rows: [] };
    }
    if (/SELECT t.card_key, t.reason, cd.name, cd.rarity, cd.official_value/.test(text)) {
      return {
        rows: state.targets
          .filter((t) => t.event_id === params[0])
          .sort((a, b) => a.target_order - b.target_order)
          .map((t) => {
            const def = state.defs.find((d) => d.key === t.card_key);
            return {
              card_key: t.card_key,
              reason: t.reason,
              name: def?.name ?? t.card_key,
              rarity: def?.rarity ?? 'common',
              official_value: def?.official_value ?? 0,
            };
          }),
      };
    }
    if (/INSERT INTO event_global_milestones/.test(text)) {
      if (!state.milestone) {
        state.milestone = {
          id: params[0] as string,
          event_id: params[1] as string,
          slug: 'burn-milestone',
          title: 'The Great Pyre',
          objective: JSON.stringify({ type: 'targeted_burns', target: 250 }),
          progress: 0,
          completed_at: null,
          reward: JSON.stringify({ items: [{ slug: 'extinction_sigil', quantity: 1 }] }),
        };
      }
      return { rows: [] };
    }
    if (
      /SELECT card_key FROM event_extinction_targets\s+WHERE event_id = \$1 AND card_key = \$2/.test(
        text,
      )
    ) {
      const target = state.targets.find(
        (t) => t.event_id === params[0] && t.card_key === params[1],
      );
      return { rows: target ? [{ card_key: target.card_key }] : [] };
    }
    if (/UPDATE event_global_milestones\s+SET progress = progress \+ 1/.test(text)) {
      if (state.milestone && !state.milestone.completed_at) {
        state.milestone.progress += 1;
        if (
          state.milestone.progress >=
          (JSON.parse(state.milestone.objective) as { target: number }).target
        ) {
          state.milestone.completed_at = new Date().toISOString();
        }
      }
      return { rows: [] };
    }
    if (/SELECT \* FROM quests WHERE event_id = \$1 AND active = TRUE/.test(text))
      return { rows: [] };
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
    if (/SELECT \* FROM event_global_milestones WHERE id = \$1 FOR UPDATE/.test(text)) {
      return { rows: state.milestone && state.milestone.id === params[0] ? [state.milestone] : [] };
    }
    if (
      /SELECT id FROM user_milestone_claims WHERE user_id = \$1 AND milestone_id = \$2/.test(text)
    ) {
      const key = `${params[0]}:${params[1]}`;
      return { rows: state.milestoneClaims.has(key) ? [{ id: key }] : [] };
    }
    if (/INSERT INTO user_milestone_claims/.test(text)) {
      state.milestoneClaims.add(`${params[0]}:${params[1]}`);
      return { rows: [] };
    }
    if (/SELECT m\.\*, \(u\.claimed_at IS NOT NULL\) AS claimed/.test(text)) {
      if (!state.milestone || state.milestone.event_id !== params[0]) return { rows: [] };
      const key = `${params[1]}:${state.milestone.id}`;
      return { rows: [{ ...state.milestone, claimed: state.milestoneClaims.has(key) }] };
    }
    if (/SELECT id FROM friendships/.test(text)) {
      const friend = state.friendships.find(
        (f) =>
          f.status === 'accepted' &&
          ((f.requester_id === params[0] && f.addressee_id === params[1]) ||
            (f.requester_id === params[1] && f.addressee_id === params[0])),
      );
      return { rows: friend ? [{ id: friend.requester_id }] : [] };
    }
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

  const wallet = {} as unknown as WalletService;
  const cards = { syncDefinitions: jest.fn() };

  return { db, wallet, cards, state };
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
    { log: jest.fn() } as never,
    quests,
    items,
  );
  const service = new ExtinctionService(
    fixture.db as never,
    fixture.cards as never,
    events,
    items,
    quests,
    { log: jest.fn() } as never,
  );
  return { service, items, ...fixture };
}

describe('ExtinctionService (PDF Phase 7 §29)', () => {
  it('seeds exactly 10 targets with the 5 Common-to-Rare + 5 Legendary split', async () => {
    const fixture = makeService();
    const targets = await fixture.service.ensureTargets(EVENT_ID);
    expect(targets).toHaveLength(10);
    const legendaries = targets.filter((t) => t.rarity === 'legendary');
    const commonRare = targets.filter((t) => t.rarity !== 'legendary');
    expect(legendaries).toHaveLength(5);
    expect(commonRare).toHaveLength(5);
    expect(targets[0].cardKey).toBe('mana_slash'); // weakest first
  });

  it('is idempotent — does not reseed existing targets', async () => {
    const fixture = makeService();
    await fixture.service.ensureTargets(EVENT_ID);
    await fixture.service.ensureTargets(EVENT_ID);
    expect(fixture.state.targets).toHaveLength(10);
  });

  it('awards an Extinction Sigil and advances the pyre when a target is burned', async () => {
    const fixture = makeService();
    await fixture.service.ensureTargets(EVENT_ID);
    const sigilItem = fixture.state.items.find((i) => i.slug === 'extinction_sigil')!;
    await fixture.service.onCardBurned(USER, 'mana_slash');
    expect(fixture.state.userItems.get(`${USER}:${sigilItem.id}`)).toBe(1);
    expect(fixture.state.milestone?.progress).toBe(1);
    // Burning a non-target does nothing.
    await fixture.service.onCardBurned(USER, 'unknown_card');
    expect(fixture.state.userItems.get(`${USER}:${sigilItem.id}`)).toBe(1);
  });

  it('claims the milestone Sigil exactly once when the pyre completes', async () => {
    const fixture = makeService();
    fixture.state.milestone!.progress = 250;
    fixture.state.milestone!.completed_at = new Date().toISOString();
    const sigilItem = fixture.state.items.find((i) => i.slug === 'extinction_sigil')!;
    await fixture.service.claimMilestone(USER, 'm-1');
    expect(fixture.state.userItems.get(`${USER}:${sigilItem.id}`)).toBe(1);
    await expect(fixture.service.claimMilestone(USER, 'm-1')).rejects.toThrow('already claimed');
  });

  it('rejects claiming an incomplete milestone', async () => {
    const fixture = makeService();
    await expect(fixture.service.claimMilestone(USER, 'm-1')).rejects.toThrow('not been completed');
  });

  it('transfers Sigils between friends', async () => {
    const fixture = makeService();
    const sigilItem = fixture.state.items.find((i) => i.slug === 'extinction_sigil')!;
    fixture.state.userItems.set(`${USER}:${sigilItem.id}`, 3);
    await fixture.service.transferSigil(USER, FRIEND, 2);
    expect(fixture.state.userItems.get(`${USER}:${sigilItem.id}`)).toBe(1);
    expect(fixture.state.userItems.get(`${FRIEND}:${sigilItem.id}`)).toBe(2);
  });

  it('rejects transfers to non-friends', async () => {
    const fixture = makeService();
    await expect(fixture.service.transferSigil(USER, 'stranger', 1)).rejects.toThrow(
      BadRequestException,
    );
  });
});
