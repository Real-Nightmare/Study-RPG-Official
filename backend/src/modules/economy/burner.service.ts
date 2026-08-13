import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { WalletService } from '../rpg/wallet.service';
import { ExtinctionService } from '../events/extinction.service';
import { SupplyService } from './supply.service';
import { burnPayout, scrapePayout } from './card-value';
import { buildInstalmentPlan, splitInstalments } from './burn-instalments';

export interface RemovableCardView {
  id: string;
  cardKey: string;
  name: string;
  rarity: string;
  officialValue: number;
  burnable: boolean;
  scrapable: boolean;
}

export interface ScrapeResult {
  removed: boolean;
  cardKey: string;
  name: string;
  payout: number;
  extinct: boolean;
  replacementKey: string | null;
}

export interface BurnResult {
  burned: boolean;
  burnId: string;
  cardKey: string;
  name: string;
  total: number;
  instalments: number;
  firstPayment: number;
  paid: number;
  remaining: number;
  nextInstalmentAt: Date | null;
  extinct: boolean;
  replacementKey: string | null;
}

/**
 * Card Scraper (§22) and Card Burner (§23).
 *
 * Scraping permanently removes a card and pays its official liquidation value
 * immediately. Burning permanently removes a card and pays the burn value in
 * instalments (default: 4 — first immediately, then daily), idempotently.
 * Both update the supply ledger and decrement the active supply; the
 * extinction check (§24) runs after every removal.
 */
@Injectable()
export class BurnerService {
  private readonly logger = new Logger(BurnerService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly supply: SupplyService,
    /** Injectable clock so instalment scheduling is deterministic in tests. */
    private readonly clock: () => Date = () => new Date(),
    @Optional() private readonly extinction?: ExtinctionService,
  ) {}

  /**
   * §22: permanently remove a card instance, paying its official liquidation
   * value immediately. Requires explicit confirmation; irreversible.
   */
  async scrapeCard(userId: string, instanceId: string, confirm: boolean): Promise<ScrapeResult> {
    if (!confirm) {
      throw new BadRequestException(
        'Confirmation required — scraping permanently removes the card',
      );
    }
    const card = await this.assertRemovable(userId, instanceId, 'scrapable');
    const config = await this.supply.getConfig();
    const payout = scrapePayout(card.officialValue, config.scrapePayoutPercent);

    await this.db.transaction(async (client) => {
      if (payout > 0) {
        await this.wallet.applyChangeWithClient(client, userId, {
          amount: payout,
          transactionType: 'card_scrape',
          reason: `Scrapped ${card.name}`,
          relatedEntityId: instanceId,
          idempotencyKey: `economy:scrape:${instanceId}`,
        });
      }
      await client.query(
        `UPDATE card_instances SET removed_at = NOW(), removed_reason = 'scrape' WHERE id = $1 AND user_id = $2`,
        [instanceId, userId],
      );
      await client.query(
        `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail) VALUES ($1, 'scrape', 1, $2)`,
        [card.cardKey, JSON.stringify({ instanceId })],
      );
      await client.query(
        `UPDATE card_definitions
         SET active_supply = GREATEST(0, active_supply - 1), scraped_count = scraped_count + 1
         WHERE key = $1`,
        [card.cardKey],
      );
    });

    const extinction = await this.supply.checkExtinction(card.cardKey);
    this.logger.log(`Card ${instanceId} scrapped by ${userId} for ${payout} STP`);
    return {
      removed: true,
      cardKey: card.cardKey,
      name: card.name,
      payout,
      extinct: extinction.extinct,
      replacementKey: extinction.replacementKey ?? null,
    };
  }

  /**
   * §23: permanently remove a card, paying the burn value in instalments
   * (first payment immediately). The total is fixed at confirmation using the
   * card's official value — never a listing price.
   */
  async burnCard(userId: string, instanceId: string, confirm: boolean): Promise<BurnResult> {
    if (!confirm) {
      throw new BadRequestException('Confirmation required — burning permanently removes the card');
    }
    const card = await this.assertRemovable(userId, instanceId, 'burnable');
    const config = await this.supply.getConfig();
    const total = burnPayout(card.officialValue, config.burnPayoutPercent);
    const plan = buildInstalmentPlan(
      total,
      config.burnInstalments,
      config.burnInstalmentIntervalHours,
      this.clock(),
    );
    const burnId = uuidv4();
    const prefix = `economy:burn:${instanceId}`;

    await this.db.transaction(async (client) => {
      if (plan.amounts[0] > 0) {
        await this.wallet.applyChangeWithClient(client, userId, {
          amount: plan.amounts[0],
          transactionType: 'card_burn_instalment',
          reason: `Burn ${card.name} — instalment 1/${plan.amounts.length}`,
          relatedEntityId: instanceId,
          idempotencyKey: `${prefix}:instalment:0`,
        });
      }
      await client.query(
        `INSERT INTO card_burn_instalments
           (id, card_instance_id, user_id, card_key, total, instalments,
            paid_amount, paid_count, status, next_instalment_at, idempotency_prefix)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'active', $8, $9)`,
        [
          burnId,
          instanceId,
          userId,
          card.cardKey,
          total,
          plan.amounts.length,
          plan.amounts[0],
          plan.amounts.length > 1 ? plan.dueAt[1] : null,
          prefix,
        ],
      );
      await client.query(
        `UPDATE card_instances SET removed_at = NOW(), removed_reason = 'burn' WHERE id = $1 AND user_id = $2`,
        [instanceId, userId],
      );
      await client.query(
        `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail) VALUES ($1, 'burn', 1, $2)`,
        [card.cardKey, JSON.stringify({ instanceId })],
      );
      await client.query(
        `UPDATE card_definitions
         SET active_supply = GREATEST(0, active_supply - 1), burned_count = burned_count + 1
         WHERE key = $1`,
        [card.cardKey],
      );
    });

    const extinction = await this.supply.checkExtinction(card.cardKey);
    if (this.extinction) {
      await this.extinction.onCardBurned(userId, card.cardKey).catch(() => undefined);
    }
    this.logger.log(
      `Card ${instanceId} burned by ${userId}: ${total} STP in ${plan.amounts.length} instalments`,
    );
    return {
      burned: true,
      burnId,
      cardKey: card.cardKey,
      name: card.name,
      total,
      instalments: plan.amounts.length,
      firstPayment: plan.amounts[0],
      paid: plan.amounts[0],
      remaining: total - plan.amounts[0],
      nextInstalmentAt: plan.amounts.length > 1 ? plan.dueAt[1] : null,
      extinct: extinction.extinct,
      replacementKey: extinction.replacementKey ?? null,
    };
  }

  /** Burn progress for a card the user burned (instance still exists, soft-removed). */
  async burnStatus(userId: string, instanceId: string) {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, card_key, total, instalments, paid_amount, paid_count, status,
              next_instalment_at, created_at, completed_at
       FROM card_burn_instalments
       WHERE card_instance_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [instanceId, userId],
    );
    if (!row) {
      throw new NotFoundException('No burn found for this card');
    }
    const total = Number(row.total);
    const count = Number(row.instalments);
    const amounts = splitInstalments(total, count);
    return {
      burnId: row.id as string,
      cardKey: row.card_key as string,
      total,
      instalments: count,
      schedule: amounts,
      paidAmount: Number(row.paid_amount ?? 0),
      paidCount: Number(row.paid_count ?? 0),
      status: row.status as string,
      nextInstalmentAt: row.next_instalment_at ? new Date(row.next_instalment_at as string) : null,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    };
  }

  /**
   * Pays every burn instalment that is due. Idempotent per instalment
   * (wallet idempotency key = `<burn prefix>:instalment:<index>`). A single
   * run pays ALL instalments whose original schedule (created_at + index ×
   * interval) has passed, so a long outage settles in one pass. Safe to call
   * lazily on reads, from the admin endpoint, or from a scheduled job.
   */
  async processDueInstalments(now: Date = this.clock()): Promise<{
    processed: number;
    completed: number;
    failures: string[];
  }> {
    const config = await this.supply.getConfig();
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT id, user_id, card_instance_id, card_key, total, instalments,
              paid_count, status, idempotency_prefix
       FROM card_burn_instalments
       WHERE status = 'active' AND next_instalment_at IS NOT NULL AND next_instalment_at <= $1
       ORDER BY next_instalment_at
       LIMIT 100`,
      [now],
    );

    let processed = 0;
    let completed = 0;
    const failures: string[] = [];
    for (const row of rows) {
      const id = row.id as string;
      const userId = row.user_id as string;
      const instanceId = row.card_instance_id as string;
      const total = Number(row.total);
      const count = Number(row.instalments);
      const prefix = row.idempotency_prefix as string;
      try {
        const done = await this.db.transaction<number>(async (client) => {
          const locked = await client.query<Record<string, unknown>>(
            `SELECT paid_count, instalments, status, created_at
             FROM card_burn_instalments WHERE id = $1 FOR UPDATE`,
            [id],
          );
          const current = locked.rows[0];
          if (!current || current.status !== 'active') return 0;

          const created = current.created_at ? new Date(current.created_at as string) : now;
          const intervalMs = config.burnInstalmentIntervalHours * 60 * 60 * 1000;
          let paidIndex = Number(current.paid_count ?? 0);
          let runAmount = 0;
          let runCount = 0;
          while (paidIndex < count) {
            // Original schedule: instalment i is due at creation + i × interval.
            const due = new Date(created.getTime() + paidIndex * intervalMs);
            if (due.getTime() > now.getTime()) break;
            const amount = splitInstalments(total, count)[paidIndex];
            if (amount > 0) {
              await this.wallet.applyChangeWithClient(client, userId, {
                amount,
                transactionType: 'card_burn_instalment',
                reason: `Burn instalment ${paidIndex + 1}/${count}`,
                relatedEntityId: instanceId,
                idempotencyKey: `${prefix}:instalment:${paidIndex}`,
              });
            }
            runAmount += amount;
            runCount += 1;
            paidIndex += 1;
          }
          if (runCount === 0) return 0;

          const complete = paidIndex >= count;
          await client.query(
            `UPDATE card_burn_instalments
             SET paid_amount = paid_amount + $1, paid_count = $2, status = $3,
                 next_instalment_at = $4, completed_at = $5
             WHERE id = $6`,
            [
              runAmount,
              paidIndex,
              complete ? 'completed' : 'active',
              complete ? null : new Date(created.getTime() + paidIndex * intervalMs),
              complete ? now : null,
              id,
            ],
          );
          return runCount;
        });
        if (done > 0) {
          processed += done;
          if (Number(row.paid_count ?? 0) + done >= count) completed += 1;
        }
      } catch (error) {
        this.logger.warn(`Burn instalment ${id} failed: ${(error as Error).message}`);
        failures.push(id);
      }
    }
    return { processed, completed, failures };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates that a card instance can be removed from circulation:
   * owned by the user, not already removed, not listed on the marketplace,
   * not equipped in a deck, and removable by the requested mechanism.
   */
  private async assertRemovable(
    userId: string,
    instanceId: string,
    mechanism: 'burnable' | 'scrapable',
  ): Promise<RemovableCardView> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT ci.id, ci.user_id, ci.card_key, ci.removed_at, cd.name, cd.rarity,
              cd.official_value, cd.burnable, cd.scrapable
       FROM card_instances ci
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE ci.id = $1`,
      [instanceId],
    );
    if (!row || row.user_id !== userId) {
      throw new NotFoundException('Card instance not found');
    }
    if (row.removed_at) {
      throw new BadRequestException('Card has already been removed from circulation');
    }
    if (mechanism === 'scrapable' && !Boolean(row.scrapable)) {
      throw new BadRequestException('This card cannot be scrapped');
    }
    if (mechanism === 'burnable' && !Boolean(row.burnable)) {
      throw new BadRequestException('This card cannot be burned');
    }
    const listed = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM marketplace_listings
       WHERE card_instance_id = $1 AND status = 'active'`,
      [instanceId],
    );
    if (listed) {
      throw new BadRequestException('Cancel the marketplace listing before removing this card');
    }
    const inDeck = await this.db.queryOne<{ deck_id: string }>(
      `SELECT dc.deck_id FROM deck_cards dc WHERE dc.card_instance_id = $1 LIMIT 1`,
      [instanceId],
    );
    if (inDeck) {
      throw new BadRequestException('Remove this card from its deck first');
    }
    return {
      id: row.id as string,
      cardKey: (row.card_key ?? row.cardKey) as string,
      name: row.name as string,
      rarity: row.rarity as string,
      officialValue: Number(row.official_value ?? 0),
      burnable: Boolean(row.burnable),
      scrapable: Boolean(row.scrapable),
    };
  }
}
