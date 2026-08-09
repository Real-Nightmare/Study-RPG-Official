import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  Ability,
  CARD_DEFINITIONS,
  CardDefinition,
  getCardDefinition,
  getEventCardDefinition,
  ABSTRACTED_CARD_KEYS,
} from './card-definitions';
import { lootBoxOdds, pickRarity } from '../events/loot-boxes';
import { DeckValidation, validateDeck } from './deck-rules';
import { DEFAULT_BATTLE_DEFAULTS } from './card-definitions';

export interface CardInstanceView {
  id: string;
  cardKey: string;
  name: string;
  rarity: string;
  category: string;
  ability: Ability;
  lore: string;
  source: string;
  createdAt: Date;
}

export interface DeckCardView {
  slot: number;
  instanceId: string;
  cardKey: string;
  name: string;
  rarity: string;
  category: string;
  ability: Ability;
}

export interface DeckView {
  id: string;
  name: string;
  isActive: boolean;
  validated: boolean;
  invalidReason: string | null;
  validation: DeckValidation | null;
  cards: DeckCardView[];
  createdAt: Date;
  updatedAt: Date;
}

/** Starter card keys granted to a brand-new player (original set only). */
const STARTER_CARD_KEYS = [
  'mana_slash',
  'study_burst',
  'poison_vial',
  'focus_shield',
  'revival_note',
  'mana_battery',
];

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Idempotent upsert of the code-defined card set into `card_definitions`. */
  async syncDefinitions(): Promise<number> {
    for (const card of CARD_DEFINITIONS) {
      await this.db.query(
        `INSERT INTO card_definitions
           (key, name, rarity, category, ability, lore, balance_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name,
           rarity = EXCLUDED.rarity,
           category = EXCLUDED.category,
           ability = EXCLUDED.ability,
           lore = EXCLUDED.lore,
           balance_version = EXCLUDED.balance_version`,
        [
          card.key,
          card.name,
          card.rarity,
          card.category,
          JSON.stringify(card.ability),
          card.lore,
          card.balanceVersion,
        ],
      );
    }
    return CARD_DEFINITIONS.length;
  }

  async getDefinitions(): Promise<CardDefinition[]> {
    await this.syncDefinitions();
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT key, name, rarity, category, ability, lore, balance_version
       FROM card_definitions ORDER BY rarity, key`,
    );
    return rows.map((r) => ({
      key: r.key as string,
      name: r.name as string,
      rarity: r.rarity as CardDefinition['rarity'],
      category: r.category as CardDefinition['category'],
      ability: r.ability as Ability,
      lore: r.lore as string,
      balanceVersion: (r.balance_version ?? r.balanceVersion) as string,
    }));
  }

  /**
   * Grants the starter cards + a validated starter deck on first contact.
   * No-op when the player already owns cards.
   */
  async grantStarterSet(userId: string): Promise<{ granted: boolean }> {
    const owned = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM card_instances WHERE user_id = $1',
      [userId],
    );
    if (owned && Number(owned.count) > 0) {
      return { granted: false };
    }
    await this.syncDefinitions();

    return this.db.transaction(async (client) => {
      const instanceIds: string[] = [];
      for (const cardKey of STARTER_CARD_KEYS) {
        const id = uuidv4();
        await client.query(
          `INSERT INTO card_instances (id, user_id, card_key, source)
           VALUES ($1, $2, $3, 'starter')`,
          [id, userId, cardKey],
        );
        instanceIds.push(id);
      }
      // Starter deck: 5 cards respecting the one-poison / one-shield rule.
      const deckCards = instanceIds.slice(0, 5); // mana_slash, study_burst, poison_vial, focus_shield, revival_note
      const deck = await this.createDeckWithClient(client, userId, 'Starter Deck', deckCards, true);
      this.logger.log(`Granted starter set to ${userId} (deck ${deck.id})`);
      return { granted: true };
    });
  }

  async getCollection(userId: string): Promise<CardInstanceView[]> {
    await this.syncDefinitions();
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ci.id, ci.card_key, ci.source, ci.created_at,
              cd.name, cd.rarity, cd.category, cd.ability, cd.lore
       FROM card_instances ci
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE ci.user_id = $1
       ORDER BY ci.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      cardKey: (r.card_key ?? r.cardKey) as string,
      name: r.name as string,
      rarity: r.rarity as string,
      category: r.category as string,
      ability: r.ability as Ability,
      lore: r.lore as string,
      source: r.source as string,
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
    }));
  }

  /**
   * Grants an event-exclusive card (PDF Phase 7 §28–§29). The card definition
   * is inserted (once) with a full print run and the instance is minted in the
   * SAME transaction, so an unowned event card can never be auto-extinguished
   * by a supply reconcile. Abstracted cards additionally get an
   * `abstracted_instances` row with their configured Legendary result.
   */
  async grantEventCard(
    userId: string,
    cardKey: string,
    opts: {
      source?: string;
      abstracted?: { eventId: string; legendaryResultKey: string };
    } = {},
    client?: import('pg').PoolClient,
  ): Promise<{ instanceId: string; cardKey: string; name: string; rarity: string }> {
    const def = getEventCardDefinition(cardKey);
    if (!def) {
      throw new NotFoundException(`Unknown event card: ${cardKey}`);
    }
    const printSize = this.eventCardPrint[def.rarity] ?? 100;
    const baseValue = this.eventCardBaseValue[def.rarity] ?? 25;

    const run = async (c: { query: (...args: unknown[]) => Promise<{ rows: unknown[] }> }) => {
      await c.query(
        `INSERT INTO card_definitions
           (key, name, rarity, category, ability, lore, balance_version,
            original_supply, active_supply, official_value, tradable, burnable, scrapable, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, TRUE)
         ON CONFLICT (key) DO NOTHING`,
        [
          def.key,
          def.name,
          def.rarity,
          def.category,
          JSON.stringify(def.ability),
          def.lore,
          def.balanceVersion,
          printSize,
          baseValue,
          def.tradable,
          def.burnable,
          def.scrapable,
        ],
      );
      const instanceId = uuidv4();
      await c.query(
        `INSERT INTO card_instances (id, user_id, card_key, source)
         VALUES ($1, $2, $3, $4)`,
        [instanceId, userId, def.key, opts.source || 'event'],
      );
      await c.query(
        `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail)
         VALUES ($1, 'event_grant', 1, $2)`,
        [def.key, JSON.stringify({ instanceId, source: opts.source || 'event' })],
      );
      if (opts.abstracted || ABSTRACTED_CARD_KEYS.has(def.key)) {
        const eventId = opts.abstracted?.eventId ?? '00000000-0000-4000-8000-0000000000a1';
        const legendaryResultKey =
          opts.abstracted?.legendaryResultKey ?? 'awakened_guardian';
        await c.query(
          `INSERT INTO abstracted_instances (card_instance_id, event_id, legendary_result_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (card_instance_id) DO NOTHING`,
          [instanceId, eventId, legendaryResultKey],
        );
      }
      return { instanceId, cardKey: def.key, name: def.name, rarity: def.rarity };
    };

    if (client) {
      return run(client);
    }
    return this.db.transaction(run);
  }

  /**
   * Opens a loot box (§28 Free/Gold track rewards): a weighted random rarity
   * grant from the current live definitions. Published odds are returned in
   * the payload — "Legendary-Chance" never means guaranteed.
   */
  async openLootBox(
    userId: string,
    boxType: string,
    weights: Record<string, number>,
    opts: { rand?: () => number; source?: string } = {},
    client?: import('pg').PoolClient,
  ): Promise<{
    boxType: string;
    cardKey: string;
    name: string;
    rarity: string;
    odds: Record<string, number>;
  }> {
    await this.syncDefinitions();
    const odds = lootBoxOdds(weights);
    const rarity = pickRarity(weights, opts.rand ?? Math.random);
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT key, name, rarity FROM card_definitions
       WHERE active = TRUE AND rarity = $1 AND extinct = FALSE
       ORDER BY official_value DESC
       LIMIT 50`,
      [rarity],
    );
    if (rows.length === 0) {
      throw new BadRequestException(`No ${rarity} cards available for this loot box`);
    }
    const card = rows[Math.floor((opts.rand ?? Math.random)() * rows.length)];
    const run = async (c: { query: (...args: unknown[]) => Promise<{ rows: unknown[] }> }) => {
      const instanceId = uuidv4();
      await c.query(
        `INSERT INTO card_instances (id, user_id, card_key, source)
         VALUES ($1, $2, $3, $4)`,
        [instanceId, userId, card.key as string, opts.source || 'loot'],
      );
      await c.query(
        `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail)
         VALUES ($1, 'loot_grant', 1, $2)`,
        [card.key as string, JSON.stringify({ instanceId, boxType })],
      );
      await c.query(
        `UPDATE card_definitions SET active_supply = active_supply + 1 WHERE key = $1`,
        [card.key as string],
      );
      return { boxType, cardKey: card.key as string, name: card.name as string, rarity: card.rarity as string, odds };
    };
    if (client) {
      return run(client);
    }
    return this.db.transaction(run);
  }

  async createDeck(
    userId: string,
    name: string,
    cardInstanceIds: string[],
    makeActive = false,
  ): Promise<DeckView> {
    return this.db.transaction(async (client) => {
      return this.createDeckWithClient(client, userId, name, cardInstanceIds, makeActive);
    });
  }

  /**
   * Event cards are granted on demand, so a supply reconcile can never
   * auto-extinguish an unowned definition. Print sizes and base values mirror
   * the economy `rpg.economy` defaults for the same rarities.
   */
  private readonly eventCardPrint = { common: 1500, rare: 400, legendary: 100 } as const;
  private readonly eventCardBaseValue = { common: 25, rare: 120, legendary: 600 } as const;

  async listDecks(userId: string): Promise<DeckView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT d.id, d.name, d.is_active, d.validated, d.invalid_reason,
              d.created_at, d.updated_at
       FROM decks d WHERE d.user_id = $1
       ORDER BY d.created_at ASC`,
      [userId],
    );
    const decks: DeckView[] = [];
    for (const row of rows) {
      decks.push(await this.assembleDeck(userId, row.id as string, row));
    }
    return decks;
  }

  async getDeck(userId: string, deckId: string): Promise<DeckView> {
    const row = await this.findOwnedDeckRow(userId, deckId);
    return this.assembleDeck(userId, deckId, row);
  }

  async updateDeck(
    userId: string,
    deckId: string,
    name?: string,
    cardInstanceIds?: string[],
  ): Promise<DeckView> {
    await this.findOwnedDeckRow(userId, deckId);
    await this.db.transaction(async (client) => {
      if (name !== undefined) {
        await client.query(
          'UPDATE decks SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
          [name, deckId, userId],
        );
      }
      if (cardInstanceIds) {
        await client.query('DELETE FROM deck_cards WHERE deck_id = $1', [deckId]);
        await this.insertDeckCards(client, deckId, userId, cardInstanceIds);
      }
      await this.revalidateDeck(client, deckId, userId);
    });
    return this.getDeck(userId, deckId);
  }

  async deleteDeck(userId: string, deckId: string): Promise<void> {
    await this.findOwnedDeckRow(userId, deckId);
    await this.db.query('DELETE FROM decks WHERE id = $1 AND user_id = $2', [deckId, userId]);
  }

  async setActiveDeck(userId: string, deckId: string): Promise<DeckView> {
    const row = await this.findOwnedDeckRow(userId, deckId);
    if (!Boolean(row.validated)) {
      throw new BadRequestException('Cannot equip an invalid deck');
    }
    await this.db.transaction(async (client) => {
      await client.query('UPDATE decks SET is_active = false WHERE user_id = $1', [userId]);
      await client.query(
        'UPDATE decks SET is_active = true, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [deckId, userId],
      );
    });
    return this.getDeck(userId, deckId);
  }

  async getActiveDeck(userId: string): Promise<DeckView | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, name, is_active, validated, invalid_reason, created_at, updated_at
       FROM decks WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [userId],
    );
    if (!row) {
      return null;
    }
    return this.assembleDeck(userId, row.id as string, row);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async createDeckWithClient(
    client: import('pg').PoolClient,
    userId: string,
    name: string,
    cardInstanceIds: string[],
    makeActive: boolean,
  ): Promise<DeckView> {
    const abilities = await this.loadAbilitiesWithClient(client, userId, cardInstanceIds);
    const validation = validateDeck(abilities, DEFAULT_BATTLE_DEFAULTS.deckSize);
    const id = uuidv4();
    const existing = await client.query(
      'SELECT COUNT(*)::int AS count FROM decks WHERE user_id = $1',
      [userId],
    );
    const isActive = makeActive || Number(existing.rows[0]?.count ?? 0) === 0;
    await client.query(
      `INSERT INTO decks (id, user_id, name, is_active, validated, invalid_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        userId,
        name,
        isActive,
        validation.valid,
        validation.valid ? null : validation.errors.join('; '),
      ],
    );
    await this.insertDeckCards(client, id, userId, cardInstanceIds);
    return this.assembleDeckWithClient(client, userId, id);
  }

  private async insertDeckCards(
    client: import('pg').PoolClient,
    deckId: string,
    userId: string,
    cardInstanceIds: string[],
  ): Promise<void> {
    const owned = await this.ownedInstanceIds(client, userId);
    for (let slot = 0; slot < cardInstanceIds.length; slot++) {
      const instanceId = cardInstanceIds[slot];
      if (!owned.has(instanceId)) {
        throw new BadRequestException(`Card instance not owned: ${instanceId}`);
      }
      await client.query(
        `INSERT INTO deck_cards (deck_id, card_instance_id, slot) VALUES ($1, $2, $3)`,
        [deckId, instanceId, slot],
      );
    }
  }

  private async revalidateDeck(
    client: import('pg').PoolClient,
    deckId: string,
    userId: string,
  ): Promise<void> {
    const cards = await this.deckCardsWithClient(client, deckId);
    const abilities = cards.map((c) => c.ability);
    const validation = validateDeck(abilities, DEFAULT_BATTLE_DEFAULTS.deckSize);
    await client.query(
      `UPDATE decks SET validated = $1, invalid_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [validation.valid, validation.valid ? null : validation.errors.join('; '), deckId],
    );
  }

  private async ownedInstanceIds(
    client: import('pg').PoolClient,
    userId: string,
  ): Promise<Set<string>> {
    const result = await client.query<{ id: string }>(
      'SELECT id FROM card_instances WHERE user_id = $1',
      [userId],
    );
    return new Set(result.rows.map((r) => r.id));
  }

  private async loadAbilitiesWithClient(
    client: import('pg').PoolClient,
    userId: string,
    cardInstanceIds: string[],
  ): Promise<Ability[]> {
    const owned = await this.ownedInstanceIds(client, userId);
    const abilities: Ability[] = [];
    for (const instanceId of cardInstanceIds) {
      if (!owned.has(instanceId)) {
        throw new BadRequestException(`Card instance not owned: ${instanceId}`);
      }
      const row = await client.query<{ card_key: string }>(
        'SELECT card_key FROM card_instances WHERE id = $1',
        [instanceId],
      );
      const key = row.rows[0]?.card_key;
      if (!key) {
        throw new BadRequestException(`Unknown card instance: ${instanceId}`);
      }
      abilities.push(getCardDefinition(key).ability);
    }
    return abilities;
  }

  private async deckCardsWithClient(
    client: import('pg').PoolClient,
    deckId: string,
  ): Promise<DeckCardView[]> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT dc.slot, dc.card_instance_id, cd.key, cd.name, cd.rarity, cd.category, cd.ability
       FROM deck_cards dc
       JOIN card_instances ci ON ci.id = dc.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE dc.deck_id = $1
       ORDER BY dc.slot`,
      [deckId],
    );
    return result.rows.map((r) => ({
      slot: Number(r.slot),
      instanceId: (r.card_instance_id ?? r.instanceId) as string,
      cardKey: r.key as string,
      name: r.name as string,
      rarity: r.rarity as string,
      category: r.category as string,
      ability: r.ability as Ability,
    }));
  }

  private async assembleDeck(
    _userId: string,
    deckId: string,
    row: Record<string, unknown>,
  ): Promise<DeckView> {
    const cards = await this.db.queryMany<Record<string, unknown>>(
      `SELECT dc.slot, dc.card_instance_id, cd.key, cd.name, cd.rarity, cd.category, cd.ability
       FROM deck_cards dc
       JOIN card_instances ci ON ci.id = dc.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE dc.deck_id = $1
       ORDER BY dc.slot`,
      [deckId],
    );
    const cardViews: DeckCardView[] = cards.map((r) => ({
      slot: Number(r.slot),
      instanceId: (r.card_instance_id ?? r.instanceId) as string,
      cardKey: r.key as string,
      name: r.name as string,
      rarity: r.rarity as string,
      category: r.category as string,
      ability: r.ability as Ability,
    }));
    const abilities = cardViews.map((c) => c.ability);
    const validation = validateDeck(abilities, DEFAULT_BATTLE_DEFAULTS.deckSize);
    return {
      id: deckId,
      name: row.name as string,
      isActive: Boolean(row.is_active),
      validated: Boolean(row.validated),
      invalidReason: (row.invalid_reason ?? null) as string | null,
      validation,
      cards: cardViews,
      createdAt: new Date((row.created_at ?? row.createdAt) as string),
      updatedAt: new Date((row.updated_at ?? row.updatedAt) as string),
    };
  }

  private async assembleDeckWithClient(
    client: import('pg').PoolClient,
    userId: string,
    deckId: string,
  ): Promise<DeckView> {
    const rowResult = await client.query<Record<string, unknown>>(
      `SELECT id, name, is_active, validated, invalid_reason, created_at, updated_at
       FROM decks WHERE id = $1 AND user_id = $2`,
      [deckId, userId],
    );
    const row = rowResult.rows[0];
    if (!row) {
      throw new NotFoundException('Deck not found');
    }
    const cards = await this.deckCardsWithClient(client, deckId);
    const abilities = cards.map((c) => c.ability);
    const validation = validateDeck(abilities, DEFAULT_BATTLE_DEFAULTS.deckSize);
    return {
      id: deckId,
      name: row.name as string,
      isActive: Boolean(row.is_active),
      validated: Boolean(row.validated),
      invalidReason: (row.invalid_reason ?? null) as string | null,
      validation,
      cards,
      createdAt: new Date((row.created_at ?? row.createdAt) as string),
      updatedAt: new Date((row.updated_at ?? row.updatedAt) as string),
    };
  }

  private async findOwnedDeckRow(userId: string, deckId: string): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, name, is_active, validated, invalid_reason, created_at, updated_at
       FROM decks WHERE id = $1 AND user_id = $2`,
      [deckId, userId],
    );
    if (!row) {
      throw new NotFoundException('Deck not found');
    }
    return row;
  }
}
