import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { CardService } from '../rpg/card.service';
import { AuditService } from '../admin/audit.service';
import { StudyEventsService } from './events.service';
import { EventItemsService } from './event-items.service';
import { QuestsService } from './quests.service';

export interface ExtinctionTargetView {
  cardKey: string;
  name: string;
  rarity: string;
  officialValue: number;
  reason: string;
}

export interface MilestoneView {
  id: string;
  slug: string;
  title: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

/**
 * Great Extinction event (PDF Phase 7 §29): targets exactly ten active card
 * definitions (default 5 Common-to-Rare + 5 underused Legendaries). Burning a
 * targeted card earns a tradeable Extinction Sigil and advances a global
 * milestone; a Sigil can satisfy a preserve-a-card quest objective, so burning
 * is strongly encouraged but never literally unavoidable.
 */
@Injectable()
export class ExtinctionService {
  private readonly logger = new Logger(ExtinctionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cards: CardService,
    private readonly events: StudyEventsService,
    private readonly items: EventItemsService,
    private readonly quests: QuestsService,
    private readonly audit: AuditService,
  ) {}

  /** The extinction event row (active or scheduled) or null. */
  async extinctionEvent(now: Date = new Date()): Promise<Record<string, unknown> | null> {
    const config = await this.events.getConfig();
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM events WHERE slug = $1 LIMIT 1`,
      [config.extinction.slug],
    );
    return row ?? null;
  }

  /**
   * Seeds the ten targets when empty: 5 weakest Common-to-Rare by official
   * value + 5 weakest/underused Legendaries, filled from Rare if the
   * legendary pool is thin. Idempotent; admin overrides accepted.
   */
  async ensureTargets(eventId: string): Promise<ExtinctionTargetView[]> {
    await this.cards.syncDefinitions();
    const config = await this.events.getConfig();
    const existing = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM event_extinction_targets WHERE event_id = $1`,
      [eventId],
    );
    if (existing && Number(existing.count) > 0) {
      return this.listTargets(eventId);
    }

    const defs = await this.db.queryMany<Record<string, unknown>>(
      `SELECT key, name, rarity, official_value FROM card_definitions
       WHERE active = TRUE AND extinct = FALSE AND tradable = TRUE
       ORDER BY official_value ASC`,
    );
    const commonRare = defs.filter((d) => d.rarity === 'common' || d.rarity === 'rare');
    const legendaries = defs.filter((d) => d.rarity === 'legendary');
    const picked = [
      ...commonRare.slice(0, config.extinction.commonRareTargets),
      ...legendaries.slice(0, config.extinction.legendaryTargets),
    ];
    if (picked.length < config.extinction.targetCount) {
      const rest = commonRare
        .slice(config.extinction.commonRareTargets)
        .filter((d) => !picked.includes(d));
      picked.push(...rest.slice(0, config.extinction.targetCount - picked.length));
    }

    let order = 0;
    for (const def of picked.slice(0, config.extinction.targetCount)) {
      await this.db.query(
        `INSERT INTO event_extinction_targets (event_id, card_key, target_order, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, card_key) DO NOTHING`,
        [eventId, def.key, order, `Auto-selected: weakest ${def.rarity} by official value`],
      );
      order += 1;
    }
    await this.ensureMilestone(eventId);
    this.logger.log(`Seeded ${order} extinction targets for event ${eventId}`);
    return this.listTargets(eventId);
  }

  /** Admin override: replace the target list with explicit card keys. */
  async overrideTargets(
    actorId: string,
    eventId: string,
    cardKeys: string[],
    reason: string,
  ): Promise<ExtinctionTargetView[]> {
    const config = await this.events.getConfig();
    if (cardKeys.length > config.extinction.targetCount) {
      throw new BadRequestException(
        `A maximum of ${config.extinction.targetCount} targets is allowed`,
      );
    }
    const defs = await this.db.queryMany<{ key: string }>(
      `SELECT key FROM card_definitions WHERE key = ANY($1)`,
      [cardKeys],
    );
    if (defs.length !== cardKeys.length) {
      throw new BadRequestException('One or more card keys do not exist');
    }
    await this.db.query('DELETE FROM event_extinction_targets WHERE event_id = $1', [eventId]);
    let order = 0;
    for (const key of cardKeys) {
      await this.db.query(
        `INSERT INTO event_extinction_targets (event_id, card_key, target_order, reason)
         VALUES ($1, $2, $3, $4)`,
        [eventId, key, order, 'Admin override'],
      );
      order += 1;
    }
    await this.audit.log({
      actorId,
      action: 'events.extinction.targets_override',
      targetType: 'event',
      targetId: eventId,
      reason,
      details: { cardKeys },
    });
    return this.listTargets(eventId);
  }

  async listTargets(eventId: string): Promise<ExtinctionTargetView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT t.card_key, t.reason, cd.name, cd.rarity, cd.official_value
       FROM event_extinction_targets t
       JOIN card_definitions cd ON cd.key = t.card_key
       ORDER BY t.target_order ASC`,
      [eventId],
    );
    return rows.map((r) => ({
      cardKey: r.card_key as string,
      name: r.name as string,
      rarity: r.rarity as string,
      officialValue: Number(r.official_value ?? 0),
      reason: (r.reason ?? null) as string,
    }));
  }

  /** Ensures the global burn milestone exists for the event (idempotent). */
  async ensureMilestone(eventId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO event_global_milestones (id, event_id, slug, title, objective, reward)
       VALUES ($1, $2, 'burn-milestone', 'The Great Pyre',
               '{"type": "targeted_burns", "target": 250}',
               '{"items": [{"slug": "extinction_sigil", "quantity": 1}]}')
       ON CONFLICT (event_id, slug) DO NOTHING`,
      [uuidv4(), eventId],
    );
  }

  /**
   * Called when any card is burned. If the card is a target of the ACTIVE
   * extinction event, the burner earns 1 Extinction Sigil, the global pyre
   * milestone advances, and `burn_targets` quests progress.
   */
  async onCardBurned(userId: string, cardKey: string, now: Date = new Date()): Promise<boolean> {
    const event = await this.extinctionEvent(now);
    if (!event || (event.status as string) !== 'active') return false;
    const config = await this.events.getConfig();
    const target = await this.db.queryOne<{ card_key: string }>(
      `SELECT card_key FROM event_extinction_targets
       WHERE event_id = $1 AND card_key = $2`,
      [event.id, cardKey],
    );
    if (!target) return false;

    await this.items.grantItem(userId, config.extinction.sigilItemSlug, 1);
    await this.db.query(
      `UPDATE event_global_milestones
       SET progress = progress + 1, completed_at = COALESCE(completed_at, NOW())
       WHERE event_id = $1 AND objective ->> 'type' = 'targeted_burns'`,
      [event.id],
    );
    await this.quests.applyProgress(userId, event.id as string, 'burn_targets', 1, now);
    this.logger.log(`Sigil earned by ${userId} for burning targeted card ${cardKey}`);
    return true;
  }

  async listMilestones(userId: string, eventId: string): Promise<MilestoneView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT m.*, (u.claimed_at IS NOT NULL) AS claimed
       FROM event_global_milestones m
       LEFT JOIN user_milestone_claims u
         ON u.milestone_id = m.id AND u.user_id = $2
       WHERE m.event_id = $1
       ORDER BY m.slug`,
      [eventId, userId],
    );
    return rows.map((r) => {
      const objective = this.parseJson(r.objective);
      return {
        id: r.id as string,
        slug: r.slug as string,
        title: r.title as string,
        progress: Number(r.progress ?? 0),
        target: Number(objective.target ?? 1),
        completed: Boolean(r.completed_at),
        claimed: Boolean(r.claimed),
      };
    });
  }

  /** One-shot claim: when the pyre milestone completes, claim 1 Sigil. */
  async claimMilestone(userId: string, milestoneId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const row = await client.query<Record<string, unknown>>(
        `SELECT * FROM event_global_milestones WHERE id = $1 FOR UPDATE`,
        [milestoneId],
      );
      const milestone = row.rows[0];
      if (!milestone) throw new NotFoundException('Milestone not found');
      if (!milestone.completed_at) {
        throw new BadRequestException('Milestone has not been completed yet');
      }
      const claimed = await client.query<{ id: string }>(
        `SELECT id FROM user_milestone_claims WHERE user_id = $1 AND milestone_id = $2`,
        [userId, milestoneId],
      );
      if (claimed.rows[0]) {
        throw new BadRequestException('Milestone reward already claimed');
      }
      const reward = this.parseJson(milestone.reward);
      const items = (reward.items ?? []) as Array<{ slug: string; quantity?: number }>;
      for (const item of items) {
        await this.items.grantItemWithClient(client, userId, item.slug, Number(item.quantity ?? 1));
      }
      await client.query(
        `INSERT INTO user_milestone_claims (user_id, milestone_id) VALUES ($1, $2)`,
        [userId, milestoneId],
      );
    });
  }

  /** Transfers Extinction Sigils to a friend (the "trade with another player" path). */
  async transferSigil(userId: string, toUserId: string, quantity: number): Promise<void> {
    const config = await this.events.getConfig();
    if (userId === toUserId) {
      throw new BadRequestException('You cannot transfer a Sigil to yourself');
    }
    const friend = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1))
       LIMIT 1`,
      [userId, toUserId],
    );
    if (!friend) {
      throw new BadRequestException('Only friends can trade Extinction Sigils');
    }
    await this.db.transaction(async (client) => {
      await this.items.consumeItemWithClient(
        client,
        userId,
        config.extinction.sigilItemSlug,
        quantity,
      );
      await this.items.grantItemWithClient(
        client,
        toUserId,
        config.extinction.sigilItemSlug,
        quantity,
      );
    });
    this.logger.log(`${userId} transferred ${quantity} Sigil(s) to ${toUserId}`);
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return (value ?? {}) as Record<string, unknown>;
  }
}
