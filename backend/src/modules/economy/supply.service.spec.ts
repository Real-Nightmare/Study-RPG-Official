import { SupplyService } from './supply.service';
import { DEFAULT_ECONOMY_CONFIG } from './economy-config';

interface FakeInstance {
  id: string;
  card_key: string;
  removed_at: string | null;
  removed_reason: string | null;
}

interface FakeDefinition {
  key: string;
  name: string;
  rarity: string;
  category: string;
  ability: unknown;
  lore: string;
  original_supply: number;
  active_supply: number;
  burned_count: number;
  scraped_count: number;
  official_value: number;
  extinct: boolean;
  active: boolean;
  replacement_of: string | null;
  retired_at: string | null;
}

function makeDb() {
  const state: {
    instances: FakeInstance[];
    definitions: Map<string, FakeDefinition>;
    supplyLedger: Array<{ card_key: string; event_type: string; quantity: number }>;
    priceHistory: Array<{ card_key: string; value: number; reason: string }>;
    listings: Array<{ id: string; card_instance_id: string; status: string }>;
    configValue: Record<string, unknown> | null;
  } = {
    instances: [
      { id: 'i1', card_key: 'mana_slash', removed_at: null, removed_reason: null },
      { id: 'i2', card_key: 'mana_slash', removed_at: null, removed_reason: null },
      { id: 'i3', card_key: 'mana_slash', removed_at: '2026-01-01T00:00:00Z', removed_reason: 'burn' },
      { id: 'i4', card_key: 'decay_curse', removed_at: null, removed_reason: null },
    ],
    definitions: new Map([
      ['mana_slash', { key: 'mana_slash', name: 'Mana Slash', rarity: 'common', category: 'attack', ability: {}, lore: 'lore', original_supply: 3, active_supply: 2, burned_count: 1, scraped_count: 0, official_value: 0, extinct: false, active: true, replacement_of: null, retired_at: null }],
      ['decay_curse', { key: 'decay_curse', name: 'Decay Curse', rarity: 'rare', category: 'poison', ability: {}, lore: 'lore', original_supply: 1, active_supply: 1, burned_count: 0, scraped_count: 0, official_value: 0, extinct: false, active: true, replacement_of: null, retired_at: null }],
    ]),
    supplyLedger: [],
    priceHistory: [],
    listings: [],
    configValue: null,
  };

  const handle = async (text: string, params: unknown[] = []): Promise<{ rows: unknown[] }> => {
    if (/SELECT value FROM game_config/.test(text)) {
      return { rows: state.configValue ? [{ value: state.configValue }] : [] };
    }
    if (/GROUP BY card_key, removed_reason/.test(text)) {
      const rows: Array<{ card_key: string; removed_reason: string | null; count: number }> = [];
      for (const inst of state.instances) {
        const key = inst.card_key;
        const reason = inst.removed_reason ?? null;
        const existing = rows.find((r) => r.card_key === key && r.removed_reason === reason);
        if (existing) existing.count += 1;
        else rows.push({ card_key: key, removed_reason: reason, count: 1 });
      }
      return { rows };
    }
    if (/SELECT key, name, rarity, original_supply, active_supply, official_value, extinct/.test(text)) {
      // Return copies — the UPDATE handler mutates map rows, and reconcile
      // compares against the pre-update snapshot for its value-change check.
      return { rows: [...state.definitions.values()].map((d) => ({ ...d })) };
    }
    if (/UPDATE card_definitions\s+SET original_supply/.test(text)) {
      const def = state.definitions.get(params[5] as string);
      if (def) {
        def.original_supply = Number(params[0]);
        def.active_supply = Number(params[1]);
        def.burned_count = Number(params[2]);
        def.scraped_count = Number(params[3]);
        def.official_value = Number(params[4]);
      }
      return { rows: [] };
    }
    if (/INSERT INTO card_price_history/.test(text)) {
      const reason = /'([a-z ]+)'\)\s*$/.exec(text)?.[1] ?? 'supply change';
      state.priceHistory.push({ card_key: params[0] as string, value: Number(params[1]), reason });
      return { rows: [] };
    }
    if (/SELECT key, name, rarity, category, ability, lore, active_supply, extinct, active, official_value/.test(text)) {
      const def = state.definitions.get(params[0] as string);
      return { rows: def ? [def] : [] };
    }
    if (/UPDATE card_definitions\s+SET extinct = TRUE/.test(text)) {
      const def = state.definitions.get(params[1] as string);
      if (def) {
        def.extinct = true;
        def.active = false;
        def.retired_at = new Date().toISOString();
      }
      return { rows: [] };
    }
    if (/INSERT INTO card_supply_ledger/.test(text)) {
      const m = /VALUES \(\$1, '([a-z_]+)', (?:\$(\d+)|(\d+))/.exec(text);
      const quantity = m?.[2] ? Number(params[Number(m[2]) - 1]) : Number(m?.[3] ?? 0);
      state.supplyLedger.push({ card_key: params[0] as string, event_type: m?.[1] ?? 'unknown', quantity });
      return { rows: [] };
    }
    if (/COUNT\(\*\)::int AS count FROM card_definitions WHERE replacement_of/.test(text)) {
      const count = [...state.definitions.values()].filter((d) => d.replacement_of === params[0]).length;
      return { rows: [{ count }] };
    }
    if (/SELECT key FROM card_definitions WHERE key/.test(text)) {
      const def = state.definitions.get(params[0] as string);
      return { rows: def ? [{ key: def.key }] : [] };
    }
    if (/INSERT INTO card_definitions\s+\(key, name, rarity, category, ability, lore, balance_version/.test(text)) {
      state.definitions.set(params[0] as string, {
        key: params[0] as string,
        name: params[1] as string,
        rarity: params[2] as string,
        category: params[3] as string,
        ability: params[4],
        lore: params[5] as string,
        original_supply: Number(params[7]),
        active_supply: 0,
        burned_count: 0,
        scraped_count: 0,
        official_value: Number(params[8]),
        extinct: false,
        active: true,
        replacement_of: params[9] as string,
        retired_at: null,
      });
      return { rows: [] };
    }
    if (/SELECT key, name, rarity, original_supply, active_supply, burned_count, scraped_count,\n\s+official_value/.test(text)) {
      return { rows: [...state.definitions.values()].sort((a, b) => a.rarity.localeCompare(b.rarity)) };
    }
    if (/GROUP BY cd\.key/.test(text)) {
      const rows: Array<{ key: string; listed: number }> = [];
      for (const l of state.listings.filter((x) => x.status === 'active')) {
        const inst = state.instances.find((i) => i.id === l.card_instance_id);
        if (!inst) continue;
        const existing = rows.find((r) => r.key === inst.card_key);
        if (existing) existing.listed += 1;
        else rows.push({ key: inst.card_key, listed: 1 });
      }
      return { rows };
    }
    if (/FROM card_price_history/.test(text)) {
      return {
        rows: state.priceHistory
          .filter((p) => p.card_key === params[0])
          .slice(0, Number(params[1] ?? 50))
          .map((p) => ({ value: p.value, reason: p.reason, created_at: '2026-08-06T00:00:00Z' })),
      };
    }
    return { rows: [] };
  };

  const db = {
    query: handle,
    queryOne: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows[0],
    queryMany: async (text: string, params: unknown[] = []) => (await handle(text, params)).rows,
    transaction: async <T>(fn: unknown): Promise<T> => (fn as (c: never) => Promise<T>)(undefined as never),
  };

  const cards = { syncDefinitions: jest.fn().mockResolvedValue(2) };

  return { db, cards, state };
}

describe('SupplyService', () => {
  let fixture: ReturnType<typeof makeDb>;
  let service: SupplyService;

  beforeEach(() => {
    fixture = makeDb();
    service = new SupplyService(fixture.db as never, fixture.cards as never);
  });

  describe('reconcile', () => {
    it('computes counters from instances and seeds official values', async () => {
      const result = await service.reconcile();
      expect(result.cardsChecked).toBe(2);

      const mana = fixture.state.definitions.get('mana_slash')!;
      // 3 minted, 2 active, 1 burned
      expect(mana.original_supply).toBe(3);
      expect(mana.active_supply).toBe(2);
      expect(mana.burned_count).toBe(1);
      // common base 25, multiplier ~1.5 → 37
      expect(mana.official_value).toBe(37);
      expect(fixture.state.priceHistory).toEqual(
        expect.arrayContaining([expect.objectContaining({ card_key: 'mana_slash', value: 37, reason: 'supply change' })]),
      );
    });

    it('does not downgrade an existing print run', async () => {
      fixture.state.definitions.get('mana_slash')!.original_supply = 100;
      await service.reconcile();
      expect(fixture.state.definitions.get('mana_slash')!.original_supply).toBe(100);
    });
  });

  describe('checkExtinction', () => {
    it('declares extinction and activates a replacement when supply hits zero', async () => {
      fixture.state.definitions.get('decay_curse')!.active_supply = 0;
      fixture.state.instances = fixture.state.instances.filter((i) => i.card_key !== 'decay_curse');

      const result = await service.checkExtinction('decay_curse');
      expect(result).toMatchObject({ extinct: true, replacementKey: 'decay_curse__echo_1' });

      const original = fixture.state.definitions.get('decay_curse')!;
      expect(original.extinct).toBe(true);
      expect(original.active).toBe(false);
      expect(original.retired_at).not.toBeNull();

      const replacement = fixture.state.definitions.get('decay_curse__echo_1')!;
      expect(replacement).toMatchObject({ name: 'Echo of Decay Curse', rarity: 'rare', replacement_of: 'decay_curse' });
      expect(replacement.original_supply).toBe(DEFAULT_ECONOMY_CONFIG.supplyInitialPrint.rare);
      expect(replacement.official_value).toBe(DEFAULT_ECONOMY_CONFIG.rarityBaseValues.rare);

      expect(fixture.state.supplyLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ card_key: 'decay_curse', event_type: 'extinction' }),
          expect.objectContaining({ card_key: 'decay_curse__echo_1', event_type: 'replacement' }),
        ]),
      );
    });

    it('is a no-op while supply remains', async () => {
      await expect(service.checkExtinction('mana_slash')).resolves.toEqual({ extinct: false });
    });

    it('is a no-op for an already-extinct card', async () => {
      fixture.state.definitions.get('decay_curse')!.extinct = true;
      fixture.state.definitions.get('decay_curse')!.active_supply = 0;
      await expect(service.checkExtinction('decay_curse')).resolves.toEqual({ extinct: false });
    });
  });

  describe('getSupplyReport', () => {
    it('merges listed counts into the report', async () => {
      fixture.state.listings.push({ id: 'l1', card_instance_id: 'i1', status: 'active' });
      const report = await service.getSupplyReport();
      const mana = report.find((r) => r.key === 'mana_slash')!;
      expect(mana).toMatchObject({ activeSupply: 2, burnedCount: 1, listedCount: 1, extinct: false });
    });
  });
});
