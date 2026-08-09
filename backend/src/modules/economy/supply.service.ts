import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CardService } from '../rpg/card.service';
import { EconomyConfig, mergeEconomyConfig, DEFAULT_ECONOMY_CONFIG } from './economy-config';
import { replacementKey, shouldDeclareExtinction } from './supply';
import { computeOfficialValue } from './card-value';

export interface SupplyReportRow {
  key: string;
  name: string;
  rarity: string;
  originalSupply: number;
  activeSupply: number;
  burnedCount: number;
  scrapedCount: number;
  listedCount: number;
  officialValue: number;
  extinct: boolean;
  active: boolean;
  replacementOf: string | null;
  retiredAt: Date | null;
}

export interface ExtinctionResult {
  extinct: boolean;
  replacementKey?: string;
  replacementName?: string;
}

interface Aggregates {
  minted: number;
  active: number;
  burned: number;
  scraped: number;
}

/**
 * Supply ledger, official card value and extinction (§16.3, §21, §24).
 * PostgreSQL is the source of truth: counters on `card_definitions` are
 * maintained transactionally by burn/scrape flows and reconciled here from
 * `card_instances` + `card_supply_ledger` on demand.
 */
@Injectable()
export class SupplyService {
  private readonly logger = new Logger(SupplyService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cards: CardService,
  ) {}

  /** Reads `rpg.economy` from game_config, merged over code defaults. */
  async getConfig(): Promise<EconomyConfig> {
    const row = await this.db.queryOne<{ value: unknown }>(
      "SELECT value FROM game_config WHERE key = 'rpg.economy'",
    );
    return mergeEconomyConfig(row?.value ?? DEFAULT_ECONOMY_CONFIG);
  }

  /**
   * Recomputes every card's supply counters from the authoritative instances
   * table, seeds the official value (+ price history) and runs the extinction
   * check. Idempotent; safe to call on startup or from the admin panel.
   */
  async reconcile(): Promise<{
    cardsChecked: number;
    valueChanges: number;
    extinct: string[];
  }> {
    await this.cards.syncDefinitions();
    const config = await this.getConfig();
    const valueConfig = {
      baseValues: config.rarityBaseValues,
      supplyMultiplierFloor: config.supplyMultiplierFloor,
      supplyMultiplierCap: config.supplyMultiplierCap,
    };

    const grouped = await this.db.queryMany<{
      card_key: string;
      removed_reason: string | null;
      count: number;
    }>(
      `SELECT card_key, removed_reason, COUNT(*)::int AS count
       FROM card_instances
       GROUP BY card_key, removed_reason`,
    );

    const byKey = new Map<string, Aggregates>();
    for (const g of grouped) {
      const agg = byKey.get(g.card_key) ?? { minted: 0, active: 0, burned: 0, scraped: 0 };
      agg.minted += Number(g.count);
      if (!g.removed_reason) agg.active += Number(g.count);
      else if (g.removed_reason === 'burn') agg.burned += Number(g.count);
      else if (g.removed_reason === 'scrape') agg.scraped += Number(g.count);
      byKey.set(g.card_key, agg);
    }

    const defs = await this.db.queryMany<Record<string, unknown>>(
      `SELECT key, name, rarity, original_supply, active_supply, official_value, extinct
       FROM card_definitions`,
    );

    let valueChanges = 0;
    const extinct: string[] = [];
    for (const def of defs) {
      const key = def.key as string;
      const agg = byKey.get(key) ?? { minted: 0, active: 0, burned: 0, scraped: 0 };
      const original = Math.max(Number(def.original_supply ?? 0), agg.minted);
      const value = computeOfficialValue(
        { rarity: def.rarity as string, activeSupply: agg.active, originalSupply: original },
        valueConfig,
      );

      await this.db.query(
        `UPDATE card_definitions
         SET original_supply = $1, active_supply = $2, burned_count = $3, scraped_count = $4,
             official_value = $5
         WHERE key = $6`,
        [original, agg.active, agg.burned, agg.scraped, value, key],
      );

      if (value !== Number(def.official_value ?? 0)) {
        valueChanges += 1;
        await this.db.query(
          `INSERT INTO card_price_history (card_key, value, reason) VALUES ($1, $2, 'supply change')`,
          [key, value],
        );
      }

      const result = await this.checkExtinction(key);
      if (result.extinct) extinct.push(key);
    }

    this.logger.log(
      `Supply reconcile: ${defs.length} cards checked, ${valueChanges} value changes, ${extinct.length} extinct`,
    );
    return { cardsChecked: defs.length, valueChanges, extinct };
  }

  /**
   * §24: when a card's active supply reaches zero, lock the definition, mark
   * it extinct, retire its print run and activate a replacement with a new
   * identity (new key + fresh print). No-op unless both conditions hold.
   */
  async checkExtinction(cardKey: string): Promise<ExtinctionResult> {
    const def = await this.db.queryOne<Record<string, unknown>>(
      `SELECT key, name, rarity, category, ability, lore, active_supply, extinct, active, official_value
       FROM card_definitions WHERE key = $1`,
      [cardKey],
    );
    if (!def || !shouldDeclareExtinction(Number(def.active_supply ?? 0), Boolean(def.extinct))) {
      return { extinct: false };
    }

    const now = new Date();
    await this.db.query(
      `UPDATE card_definitions
       SET extinct = TRUE, extinct_at = $1, retired_at = $1, active = FALSE
       WHERE key = $2`,
      [now, cardKey],
    );
    await this.db.query(
      `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail)
       VALUES ($1, 'extinction', 0, $2)`,
      [cardKey, JSON.stringify({ declaredAt: now.toISOString() })],
    );

    const genRow = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM card_definitions WHERE replacement_of = $1',
      [cardKey],
    );
    const generation = Number(genRow?.count ?? 0) + 1;
    const newKey = replacementKey(cardKey, generation);
    const rarity = def.rarity as string;
    const config = await this.getConfig();
    const printSize = config.supplyInitialPrint[rarity] ?? 100;
    const baseValue = config.rarityBaseValues[rarity] ?? 25;

    const existing = await this.db.queryOne<{ key: string }>(
      'SELECT key FROM card_definitions WHERE key = $1',
      [newKey],
    );
    let replacementName = '';
    if (!existing) {
      const name = `Echo of ${def.name}`;
      replacementName = name;
      await this.db.query(
        `INSERT INTO card_definitions
           (key, name, rarity, category, ability, lore, balance_version,
            original_supply, active_supply, official_value, replacement_of, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, TRUE)`,
        [
          newKey,
          name,
          rarity,
          def.category,
          JSON.stringify(def.ability),
          `${def.lore ?? ''} An echo returned after the original print run went extinct.`,
          '1.0',
          printSize,
          baseValue,
          cardKey,
        ],
      );
      await this.db.query(
        `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail)
         VALUES ($1, 'replacement', $2, $3)`,
        [newKey, printSize, JSON.stringify({ replaces: cardKey })],
      );
      this.logger.log(`Card ${cardKey} went extinct — replacement ${newKey} activated`);
    }

    return { extinct: true, replacementKey: newKey, replacementName: replacementName || undefined };
  }

  /** Full supply view (§16.3): original/active/burned/scraped/listed + value + extinct state. */
  async getSupplyReport(): Promise<SupplyReportRow[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT key, name, rarity, original_supply, active_supply, burned_count, scraped_count,
              official_value, extinct, active, replacement_of, retired_at
       FROM card_definitions
       ORDER BY rarity, key`,
    );
    const listedRows = await this.db.queryMany<{ key: string; listed: number }>(
      `SELECT cd.key, COUNT(*)::int AS listed
       FROM marketplace_listings ml
       JOIN card_instances ci ON ci.id = ml.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE ml.status = 'active'
       GROUP BY cd.key`,
    );
    const listedByKey = new Map(listedRows.map((r) => [r.key, Number(r.listed)]));
    return rows.map((r) => ({
      key: r.key as string,
      name: r.name as string,
      rarity: r.rarity as string,
      originalSupply: Number(r.original_supply ?? 0),
      activeSupply: Number(r.active_supply ?? 0),
      burnedCount: Number(r.burned_count ?? 0),
      scrapedCount: Number(r.scraped_count ?? 0),
      listedCount: listedByKey.get(r.key as string) ?? 0,
      officialValue: Number(r.official_value ?? 0),
      extinct: Boolean(r.extinct),
      active: Boolean(r.active),
      replacementOf: (r.replacement_of ?? null) as string | null,
      retiredAt: r.retired_at ? new Date(r.retired_at as string) : null,
    }));
  }

  async getPriceHistory(cardKey: string, limit = 50): Promise<
    Array<{ value: number; reason: string | null; createdAt: Date }>
  > {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT value, reason, created_at
       FROM card_price_history
       WHERE card_key = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [cardKey, limit],
    );
    return rows.map((r) => ({
      value: Number(r.value),
      reason: (r.reason ?? null) as string | null,
      createdAt: new Date(r.created_at as string),
    }));
  }
}
