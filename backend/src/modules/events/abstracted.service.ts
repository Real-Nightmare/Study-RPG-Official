import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { WalletService } from '../rpg/wallet.service';
import { CardService } from '../rpg/card.service';
import { AuditService } from '../admin/audit.service';
import { StudyEventsService } from './events.service';
import { EventItemsService } from './event-items.service';

export interface UnabstractResult {
  unabstracted: boolean;
  cardKey: string;
  name: string;
  resultCardKey: string;
  stpAwarded: number;
  abstractedErrors: number;
}

export interface LimboResult {
  redeemed: boolean;
  consumedErrors: number;
  rewardCardKey: string;
}

/**
 * Abstracted event (PDF Phase 7 §28): Abstracted cards carry an original
 * 40-Mana Abstracted ability; unabstracting is irreversible and produces a
 * configured Legendary result + 1 Abstracted Error + 500 STP with audited
 * economy/card entries; seven Errors redeem Limbo (once).
 */
@Injectable()
export class AbstractedService {
  private readonly logger = new Logger(AbstractedService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly cards: CardService,
    private readonly audit: AuditService,
    private readonly events: StudyEventsService,
    private readonly items: EventItemsService,
  ) {}

  /**
   * §28.1 Unabstract an eligible Abstracted card. Irreversible: the instance
   * is retired, the configured Legendary result is granted, 1 Abstracted
   * Error + 500 STP are awarded, supply is updated, and audited entries are
   * written (reason required).
   */
  async unabstract(
    userId: string,
    instanceId: string,
    dto: { confirm: boolean; reason?: string },
  ): Promise<UnabstractResult> {
    const config = await this.events.getConfig();
    if (!dto.confirm) {
      throw new BadRequestException('Confirmation required — unabstracting permanently converts the card');
    }

    const result = await this.db.transaction(async (client) => {
      const row = await client.query<Record<string, unknown>>(
        `SELECT ai.card_instance_id, ai.event_id, ai.legendary_result_key,
                ai.unabstracted_at, ci.user_id, ci.removed_at,
                cd.key AS card_key, cd.name, cd.rarity
         FROM abstracted_instances ai
         JOIN card_instances ci ON ci.id = ai.card_instance_id
         JOIN card_definitions cd ON cd.key = ci.card_key
         WHERE ai.card_instance_id = $1
         FOR UPDATE OF ai`,
        [instanceId],
      );
      const inst = row.rows[0];
      if (!inst || inst.user_id !== userId) {
        throw new NotFoundException('Abstracted card instance not found');
      }
      if (inst.removed_at) {
        throw new BadRequestException('Card has already been removed from circulation');
      }
      if (inst.unabstracted_at) {
        throw new BadRequestException('This card has already been unabstracted');
      }

      // Retire the Abstracted instance (irreversible).
      await client.query(
        `UPDATE card_instances SET removed_at = NOW(), removed_reason = 'unabstracted'
         WHERE id = $1`,
        [instanceId],
      );
      await client.query(
        `UPDATE card_definitions SET active_supply = GREATEST(0, active_supply - 1)
         WHERE key = $1`,
        [inst.card_key as string],
      );
      await client.query(
        `INSERT INTO card_supply_ledger (card_key, event_type, quantity, detail)
         VALUES ($1, 'unabstracted', 1, $2)`,
        [inst.card_key as string, JSON.stringify({ instanceId, userId })],
      );

      // Configured Legendary result.
      const resultKey =
        (inst.legendary_result_key as string) || config.abstracted.defaultLegendaryResultKey;
      const card = await this.cards.grantEventCard(
        userId,
        resultKey,
        {
          source: 'unabstract',
          abstracted: { eventId: inst.event_id as string, legendaryResultKey: resultKey },
        },
        client,
      );

      // 500 STP + 1 Abstracted Error.
      await this.wallet.applyChangeWithClient(client, userId, {
        amount: config.abstracted.unabstractStp,
        transactionType: 'abstracted_unabstract',
        reason: `Unabstracted ${inst.name as string}`,
        relatedEntityId: instanceId,
        idempotencyKey: `events:unabstract:${instanceId}`,
      });
      await this.items.grantItemWithClient(client, userId, 'abstracted_error', 1);

      await client.query(
        `UPDATE abstracted_instances SET unabstracted_at = NOW(), unabstracted_by = $2
         WHERE card_instance_id = $1`,
        [instanceId, userId],
      );

      return {
        cardKey: inst.card_key as string,
        name: inst.name as string,
        resultCardKey: card.cardKey,
      };
    });

    await this.audit.log({
      actorId: userId,
      action: 'events.abstracted.unabstract',
      targetType: 'card_instance',
      targetId: instanceId,
      reason: dto.reason || 'Unabstracted an Abstracted card',
      details: {
        cardKey: result.cardKey,
        resultCardKey: result.resultCardKey,
        stp: config.abstracted.unabstractStp,
      },
    });
    this.logger.log(
      `Unabstracted ${result.cardKey} for ${userId} → ${result.resultCardKey}`,
    );
    return {
      unabstracted: true,
      ...result,
      stpAwarded: config.abstracted.unabstractStp,
      abstractedErrors: await this.items.quantityOf(userId, 'abstracted_error'),
    };
  }

  /** Lists the user's still-abstracted card instances for the UI. */
  async myAbstracted(userId: string): Promise<
    Array<{ instanceId: string; cardKey: string; name: string; rarity: string; ability: unknown }>
  > {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ci.id AS instance_id, cd.key AS card_key, cd.name, cd.rarity, cd.ability
       FROM abstracted_instances ai
       JOIN card_instances ci ON ci.id = ai.card_instance_id
       JOIN card_definitions cd ON cd.key = ci.card_key
       WHERE ci.user_id = $1 AND ci.removed_at IS NULL AND ai.unabstracted_at IS NULL`,
      [userId],
    );
    return rows.map((r) => ({
      instanceId: r.instance_id as string,
      cardKey: r.card_key as string,
      name: r.name as string,
      rarity: r.rarity as string,
      ability: r.ability,
    }));
  }

  /**
   * §28.1 Limbo: seven Abstracted Errors redeem the untradeable Limbo
   * Legendary reward exactly once per player.
   */
  async limbo(userId: string, dto: { confirm: boolean }): Promise<LimboResult> {
    const config = await this.events.getConfig();
    if (!dto.confirm) {
      throw new BadRequestException('Confirmation required — Limbo consumes all seven errors');
    }
    const errors = await this.items.quantityOf(userId, 'abstracted_error');
    if (errors < config.abstracted.errorsForLimbo) {
      throw new BadRequestException(
        `Limbo requires ${config.abstracted.errorsForLimbo} Abstracted Errors (you have ${errors})`,
      );
    }

    await this.db.transaction(async (client) => {
      const owns = await client.query<{ id: string }>(
        `SELECT ci.id FROM card_instances ci
         WHERE ci.user_id = $1 AND ci.card_key = $2 AND ci.removed_at IS NULL
         LIMIT 1`,
        [userId, config.abstracted.limboRewardCard],
      );
      if (owns.rows[0]) {
        throw new BadRequestException('Limbo reward has already been claimed');
      }
      await this.items.consumeItemWithClient(
        client,
        userId,
        'abstracted_error',
        config.abstracted.errorsForLimbo,
      );
      await this.cards.grantEventCard(
        userId,
        config.abstracted.limboRewardCard,
        { source: 'limbo' },
        client,
      );
    });

    await this.audit.log({
      actorId: userId,
      action: 'events.abstracted.limbo',
      targetType: 'user',
      targetId: userId,
      reason: 'Redeemed seven Abstracted Errors for Limbo',
      details: { rewardCardKey: config.abstracted.limboRewardCard },
    });
    this.logger.log(`Limbo redeemed by ${userId}`);
    return {
      redeemed: true,
      consumedErrors: config.abstracted.errorsForLimbo,
      rewardCardKey: config.abstracted.limboRewardCard,
    };
  }
}
