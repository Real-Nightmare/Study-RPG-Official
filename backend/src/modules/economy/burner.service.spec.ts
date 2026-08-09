import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BurnerService } from './burner.service';
import { DEFAULT_ECONOMY_CONFIG, EconomyConfig } from './economy-config';
import { WalletService, WalletChangeInput } from '../rpg/wallet.service';

const OWNER = 'owner-1';
const CARD = 'card-inst-1';

interface FakeInstance {
  id: string;
  user_id: string;
  card_key: string;
  removed_at: string | null;
  removed_reason: string | null;
}

interface FakeBurnRow {
  id: string;
  card_instance_id: string;
  user_id: string;
  card_key: string;
  total: number;
  instalments: number;
  paid_amount: number;
  paid_count: number;
  status: string;
  next_instalment_at: string | null;
  idempotency_prefix: string;
  created_at: string;
  completed_at: string | null;
}

function makeDb() {
  const state: {
    instances: Map<string, FakeInstance>;
    definitions: Map<string, { key: string; name: string; rarity: string; official_value: number; burnable: boolean; scrapable: boolean }>;
    listings: Array<{ id: string; card_instance_id: string; status: string }>;
    deckCards: Array<{ deck_id: string; card_instance_id: string }>;
    profiles: Map<string, { stp: number }>;
    ledger: Array<{ user_id: string; idempotency_key: string; amount: number; transaction_type: string }>;
    supplyLedger: Array<{ card_key: string; event_type: string; quantity: number }>;
    definitionsUpdated: Array<{ key: string; active_supply: number; burned_count: number; scraped_count: number }>;
    burns: Map<string, FakeBurnRow>;
    now: Date;
  } = {
    instances: new Map([
      [CARD, { id: CARD, user_id: OWNER, card_key: 'mana_slash', removed_at: null, removed_reason: null }],
    ]),
    definitions: new Map([
      ['mana_slash', { key: 'mana_slash', name: 'Mana Slash', rarity: 'common', official_value: 25, burnable: true, scrapable: true }],
    ]),
    listings: [],
    deckCards: [],
    profiles: new Map([[OWNER, { stp: 0 }]]),
    ledger: [],
    supplyLedger: [],
    definitionsUpdated: [],
    burns: new Map(),
    now: new Date('2026-08-06T12:00:00Z'),
  };

  const applyWallet = async (userId: string, input: WalletChangeInput) => {
    const replay = state.ledger.find((l) => l.user_id === userId && l.idempotency_key === input.idempotencyKey);
    if (replay) return replay;
    const profile = state.profiles.get(userId) ?? { stp: 0 };
    const after = profile.stp + input.amount;
    if (after < 0) throw new BadRequestException('Insufficient STP/SLC balance');
    profile.stp = after;
    const entry = { user_id: userId, idempotency_key: input.idempotencyKey, amount: input.amount, transaction_type: input.transactionType };
    state.ledger.push(entry);
    return entry;
  };

  const handle = async (text: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount?: number }> => {
    if (/SELECT value FROM game_config/.test(text)) return { rows: [] };
    if (/FROM card_instances ci\n\s+JOIN card_definitions cd/.test(text)) {
      const inst = state.instances.get(params[0] as string);
      if (!inst) return { rows: [] };
      const cd = state.definitions.get(inst.card_key);
      return {
        rows: [
          {
            id: inst.id,
            user_id: inst.user_id,
            card_key: inst.card_key,
            removed_at: inst.removed_at,
            name: cd?.name,
            rarity: cd?.rarity,
            official_value: cd?.official_value,
            burnable: cd?.burnable,
            scrapable: cd?.scrapable,
          },
        ],
      };
    }
    if (/SELECT id FROM marketplace_listings\n\s+WHERE card_instance_id/.test(text)) {
      const listed = state.listings.find((l) => l.card_instance_id === params[0] && l.status === 'active');
      return { rows: listed ? [{ id: listed.id }] : [] };
    }
    if (/FROM deck_cards dc WHERE dc\.card_instance_id/.test(text)) {
      const dc = state.deckCards.find((d) => d.card_instance_id === params[0]);
      return { rows: dc ? [{ deck_id: dc.deck_id }] : [] };
    }
    if (/UPDATE card_instances SET removed_at/.test(text)) {
      const inst = state.instances.get(params[0] as string);
      if (inst) {
        inst.removed_at = state.now.toISOString();
        inst.removed_reason = (/removed_reason = '(\w+)'/.exec(text)?.[1] ?? 'removed') as string;
      }
      return { rows: [] };
    }
    if (/INSERT INTO card_supply_ledger/.test(text)) {
      const m = /VALUES \(\$1, '([a-z_]+)', (?:\$(\d+)|(\d+))/.exec(text);
      const quantity = m?.[2] ? Number(params[Number(m[2]) - 1]) : Number(m?.[3] ?? 0);
      state.supplyLedger.push({ card_key: params[0] as string, event_type: m?.[1] ?? 'unknown', quantity });
      return { rows: [] };
    }
    if (/UPDATE card_definitions\s+SET active_supply/.test(text)) {
      state.definitionsUpdated.push({
        key: params[0] as string,
        active_supply: 0,
        burned_count: 0,
        scraped_count: 0,
      });
      return { rows: [] };
    }
    if (/INSERT INTO card_burn_instalments/.test(text)) {
      state.burns.set(params[0] as string, {
        id: params[0] as string,
        card_instance_id: params[1] as string,
        user_id: params[2] as string,
        card_key: params[3] as string,
        total: Number(params[4]),
        instalments: Number(params[5]),
        paid_amount: Number(params[6]),
        paid_count: 1,
        status: 'active',
        next_instalment_at: (params[7] as string | null) ?? null,
        idempotency_prefix: params[8] as string,
        created_at: state.now.toISOString(),
        completed_at: null,
      });
      return { rows: [] };
    }
    if (/SELECT id, card_key, total, instalments, paid_amount, paid_count, status/.test(text)) {
      const burn = [...state.burns.values()].find(
        (b) => b.card_instance_id === params[0] && b.user_id === params[1],
      );
      return { rows: burn ? [burn] : [] };
    }
    if (/WHERE status = 'active' AND next_instalment_at IS NOT NULL/.test(text)) {
      const due = [...state.burns.values()].filter(
        (b) => b.status === 'active' && b.next_instalment_at && new Date(b.next_instalment_at) <= (params[0] as Date),
      );
      return { rows: due };
    }
    if (/FOR UPDATE/.test(text)) {
      const burn = state.burns.get(params[0] as string);
      return {
        rows: burn
          ? [{ paid_count: burn.paid_count, instalments: burn.instalments, status: burn.status, created_at: burn.created_at }]
          : [],
      };
    }
    if (/UPDATE card_burn_instalments\s+SET paid_amount/.test(text)) {
      const burn = state.burns.get(params[5] as string);
      if (burn) {
        burn.paid_amount += Number(params[0]);
        burn.paid_count = Number(params[1]);
        burn.status = params[2] as string;
        burn.next_instalment_at = (params[3] as string | null) ?? null;
        burn.completed_at = params[4] ? (params[4] as Date).toISOString() : null;
      }
      return { rows: [] };
    }
    if (/SELECT stp FROM player_profiles/.test(text)) {
      return { rows: [{ stp: state.profiles.get(params[0] as string)?.stp ?? 0 }] };
    }
    if (/INSERT INTO player_profiles/.test(text)) {
      if (!state.profiles.has(params[0] as string)) state.profiles.set(params[0] as string, { stp: 0 });
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
    applyChange: jest.fn(),
    applyChangeWithClient: jest.fn(
      async (_client: unknown, userId: string, input: WalletChangeInput) => applyWallet(userId, input),
    ),
  } as unknown as WalletService;

  const supply = {
    getConfig: jest.fn().mockResolvedValue(DEFAULT_ECONOMY_CONFIG),
    checkExtinction: jest.fn().mockResolvedValue({ extinct: false, replacementKey: null }),
  };

  return { db, wallet, supply, state };
}

describe('BurnerService', () => {
  let fixture: ReturnType<typeof makeDb>;
  let service: BurnerService;

  beforeEach(() => {
    fixture = makeDb();
    service = new BurnerService(
      fixture.db as never,
      fixture.wallet,
      fixture.supply as never,
      // Deterministic clock: instalment scheduling follows the mock `now`.
      () => fixture.state.now,
    );
  });

  describe('scrapeCard (§22)', () => {
    it('requires explicit confirmation', async () => {
      await expect(service.scrapeCard(OWNER, CARD, false)).rejects.toThrow('Confirmation required');
    });

    it('pays the official liquidation value immediately and removes the card', async () => {
      const result = await service.scrapeCard(OWNER, CARD, true);
      // 80% of 25 = 20
      expect(result).toMatchObject({ removed: true, cardKey: 'mana_slash', payout: 20, extinct: false });
      expect(fixture.state.instances.get(CARD)?.removed_reason).toBe('scrape');
      expect(fixture.state.profiles.get(OWNER)?.stp).toBe(20);
      expect(fixture.state.supplyLedger).toEqual(
        expect.arrayContaining([expect.objectContaining({ event_type: 'scrape', quantity: 1 })]),
      );
      expect(fixture.state.definitionsUpdated).toHaveLength(1);
      expect(fixture.supply.checkExtinction).toHaveBeenCalledWith('mana_slash');
    });

    it('rejects a card the user does not own', async () => {
      await expect(service.scrapeCard('someone-else', CARD, true)).rejects.toThrow(NotFoundException);
    });

    it('rejects a card that is listed or equipped in a deck', async () => {
      fixture.state.listings.push({ id: 'l1', card_instance_id: CARD, status: 'active' });
      await expect(service.scrapeCard(OWNER, CARD, true)).rejects.toThrow('marketplace listing');

      fixture.state.listings = [];
      fixture.state.deckCards.push({ deck_id: 'd1', card_instance_id: CARD });
      await expect(service.scrapeCard(OWNER, CARD, true)).rejects.toThrow('deck');
    });

    it('rejects an already-removed card', async () => {
      await service.scrapeCard(OWNER, CARD, true);
      await expect(service.scrapeCard(OWNER, CARD, true)).rejects.toThrow('already been removed');
    });
  });

  describe('burnCard (§23)', () => {
    it('pays the first instalment immediately and schedules the rest', async () => {
      const result = await service.burnCard(OWNER, CARD, true);
      // 25 STP in 4 instalments → [6, 6, 6, 7]; first paid now
      expect(result).toMatchObject({
        burned: true,
        total: 25,
        instalments: 4,
        firstPayment: 6,
        paid: 6,
        remaining: 19,
        extinct: false,
      });
      expect(result.nextInstalmentAt).toBeInstanceOf(Date);
      expect(fixture.state.instances.get(CARD)?.removed_reason).toBe('burn');
      expect(fixture.state.profiles.get(OWNER)?.stp).toBe(6);
      expect(fixture.state.burns.size).toBe(1);
      const burn = [...fixture.state.burns.values()][0];
      expect(burn).toMatchObject({ total: 25, instalments: 4, paid_count: 1, status: 'active' });
      expect(fixture.state.supplyLedger).toEqual(
        expect.arrayContaining([expect.objectContaining({ event_type: 'burn' })]),
      );
    });

    it('requires confirmation and rejects non-burnable cards', async () => {
      await expect(service.burnCard(OWNER, CARD, false)).rejects.toThrow('Confirmation required');
      fixture.state.definitions.get('mana_slash')!.burnable = false;
      await expect(service.burnCard(OWNER, CARD, true)).rejects.toThrow('cannot be burned');
    });
  });

  describe('processDueInstalments', () => {
    it('pays due instalments idempotently and completes the burn', async () => {
      await service.burnCard(OWNER, CARD, true);
      const burn = [...fixture.state.burns.values()][0];
      // Advance time past the next instalment and process it repeatedly.
      const later = new Date(fixture.state.now.getTime() + 25 * 60 * 60 * 1000);
      fixture.state.now = later;

      const first = await service.processDueInstalments(later);
      expect(first.processed).toBe(1);
      expect(fixture.state.profiles.get(OWNER)?.stp).toBe(6 + 6);

      const secondRun = await service.processDueInstalments(new Date(later.getTime() + 1000));
      // Not due yet (next instalment is 24h after 'later'), so nothing processes.
      expect(secondRun.processed).toBe(0);

      // Skip ahead through all remaining instalments.
      fixture.state.now = new Date(later.getTime() + 48 * 60 * 60 * 1000);
      const finalRun = await service.processDueInstalments(fixture.state.now);
      expect(finalRun.processed).toBe(2);
      expect(fixture.state.burns.get(burn.id)?.status).toBe('completed');
      expect(fixture.state.profiles.get(OWNER)?.stp).toBe(25);
    });
  });

  describe('burnStatus', () => {
    it('reports the schedule and progress', async () => {
      await service.burnCard(OWNER, CARD, true);
      const status = await service.burnStatus(OWNER, CARD);
      expect(status).toMatchObject({ total: 25, instalments: 4, paidCount: 1, status: 'active' });
      expect(status.schedule).toEqual([6, 6, 6, 7]);
    });

    it('throws when no burn exists', async () => {
      await expect(service.burnStatus(OWNER, CARD)).rejects.toThrow(NotFoundException);
    });
  });
});
