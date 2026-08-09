import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { WalletService } from '../rpg/wallet.service';
import { EventItemsService } from './event-items.service';
import { capProgress, periodKeyFor, progressDelta } from './quest-rules';

export interface QuestView {
  id: string;
  slug: string;
  category: string;
  title: string;
  story: string | null;
  objective: Record<string, unknown>;
  rewards: Record<string, unknown>;
  period: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface QuestClaimResult {
  questId: string;
  title: string;
  granted: string[];
  completed: boolean;
}

interface QuestRow {
  id: string;
  event_id: string | null;
  slug: string;
  category: string;
  title: string;
  story: string | null;
  objective: unknown;
  rewards: unknown;
  period: string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

/**
 * Data-driven quests (PDF Phase 7 §30): categories daily | weekly | study |
 * puzzle; period-aware progress (IST day / ISO week / event-long); single
 * claim of STP / event EXP / event item rewards.
 */
@Injectable()
export class QuestsService {
  private readonly logger = new Logger(QuestsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly items: EventItemsService,
  ) {}

  async listForEvent(userId: string, eventId: string, now: Date = new Date()): Promise<QuestView[]> {
    const rows = await this.db.queryMany<QuestRow>(
      `SELECT * FROM quests
       WHERE event_id = $1 AND active = TRUE
         AND (starts_at IS NULL OR starts_at <= $2)
         AND (ends_at IS NULL OR ends_at > $2)
       ORDER BY sort_order ASC, title ASC`,
      [eventId, now],
    );
    const views: QuestView[] = [];
    for (const row of rows) {
      const objective = this.parseJson(row.objective);
      const target = Number(objective.target ?? 1);
      const periodKey = periodKeyFor(row.period, now);
      const mine = await this.db.queryOne<{
        progress: number;
        completed_at: string | null;
        claimed_at: string | null;
      }>(
        `SELECT progress, completed_at, claimed_at FROM user_quests
         WHERE user_id = $1 AND quest_id = $2 AND period_key = $3`,
        [userId, row.id, periodKey],
      );
      const progress = Number(mine?.progress ?? 0);
      views.push({
        id: row.id,
        slug: row.slug,
        category: row.category,
        title: row.title,
        story: row.story,
        objective,
        rewards: this.parseJson(row.rewards),
        period: row.period,
        progress,
        target,
        completed: Boolean(mine?.completed_at) || progress >= target,
        claimed: Boolean(mine?.claimed_at),
      });
    }
    return views;
  }

  /** Applies a study-activity event to matching quests (objectives of type `study_activity`). */
  async applyActivity(
    userId: string,
    eventId: string,
    activityType: string,
    amount: number,
    now: Date = new Date(),
  ): Promise<void> {
    const rows = await this.db.queryMany<QuestRow>(
      `SELECT * FROM quests WHERE event_id = $1 AND active = TRUE`,
      [eventId],
    );
    for (const row of rows) {
      const objective = this.parseJson(row.objective);
      const delta = progressDelta(objective, activityType, amount);
      if (delta <= 0) continue;
      await this.applyDelta(userId, row, objective, delta, now);
    }
  }

  /** Applies raw progress to quests whose objective `type` matches (e.g. `burn_targets`). */
  async applyProgress(
    userId: string,
    eventId: string,
    objectiveType: string,
    amount: number,
    now: Date = new Date(),
  ): Promise<void> {
    const rows = await this.db.queryMany<QuestRow>(
      `SELECT * FROM quests WHERE event_id = $1 AND active = TRUE`,
      [eventId],
    );
    for (const row of rows) {
      const objective = this.parseJson(row.objective);
      if (objective.type !== objectiveType) continue;
      await this.applyDelta(userId, row, objective, amount > 0 ? amount : 1, now);
    }
  }

  async claim(userId: string, questId: string): Promise<QuestClaimResult> {
    return this.db.transaction(async (client) => {
      const qrow = await client.query<QuestRow>('SELECT * FROM quests WHERE id = $1', [questId]);
      const quest = qrow.rows[0];
      if (!quest) {
        throw new NotFoundException('Quest not found');
      }
      const now = new Date();
      // Resolve the user's latest progress row for this quest (any period): a
      // player claims the most recent completed period, so progress recorded
      // earlier in the day/week is still claimable.
      const mine = await client.query<{
        progress: number;
        completed_at: string | null;
        claimed_at: string | null;
        period_key: string;
      }>(
        `SELECT progress, completed_at, claimed_at, period_key FROM user_quests
         WHERE user_id = $1 AND quest_id = $2
         ORDER BY period_key DESC
         LIMIT 1
         FOR UPDATE`,
        [userId, questId],
      );
      const row = mine.rows[0];
      if (!row) {
        throw new BadRequestException('Quest not completed yet');
      }
      const periodKey = row.period_key ?? periodKeyFor(quest.period, now);
      if (row.claimed_at) {
        throw new BadRequestException('Quest reward already claimed');
      }
      const objective = this.parseJson(quest.objective);
      const target = Number(objective.target ?? 1);
      if (Number(row.progress) < target || !row.completed_at) {
        throw new BadRequestException('Quest not completed yet');
      }

      // A Sigil can satisfy selected event objectives (§29.1): consuming one
      // completes the quest instead of requiring the burn.
      if (objective.type === 'consume_sigil') {
        await this.items.consumeItemWithClient(client, userId, 'extinction_sigil', 1);
      }

      const rewards = this.parseJson(quest.rewards);
      const granted: string[] = [];
      const stp = Number(rewards.stp ?? 0);
      if (stp > 0) {
        await this.wallet.applyChangeWithClient(client, userId, {
          amount: stp,
          transactionType: 'quest_reward',
          reason: `Quest: ${quest.title}`,
          relatedEntityId: questId,
          idempotencyKey: `events:quest:${questId}:${periodKey}`,
        });
        granted.push(`stp:${stp}`);
      }
      const eventExp = Number(rewards.eventExp ?? 0);
      if (eventExp > 0 && quest.event_id) {
        await client.query(
          `INSERT INTO user_event_state (user_id, event_id, event_exp)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, event_id) DO UPDATE SET
             event_exp = user_event_state.event_exp + EXCLUDED.event_exp,
             updated_at = NOW()`,
          [userId, quest.event_id, eventExp],
        );
        granted.push(`eventExp:${eventExp}`);
      }
      const itemRewards = (rewards.items ?? []) as Array<{ slug: string; quantity?: number }>;
      for (const item of itemRewards) {
        await this.items.grantItemWithClient(client, userId, item.slug, Number(item.quantity ?? 1));
        granted.push(`item:${item.slug}`);
      }

      await client.query(
        `UPDATE user_quests SET claimed_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND quest_id = $2 AND period_key = $3`,
        [userId, questId, periodKey],
      );
      this.logger.log(`Quest claimed: ${questId} by ${userId} (${granted.join(', ')})`);
      return { questId, title: quest.title, granted, completed: true };
    });
  }

  private async applyDelta(
    userId: string,
    quest: QuestRow,
    objective: Record<string, unknown>,
    delta: number,
    now: Date,
  ): Promise<void> {
    if (quest.starts_at && new Date(quest.starts_at) > now) return;
    if (quest.ends_at && new Date(quest.ends_at) <= now) return;
    const target = Number(objective.target ?? 1);
    const periodKey = periodKeyFor(quest.period, now);
    await this.db.query(
      `INSERT INTO user_quests (user_id, quest_id, period_key, progress, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 >= $5 THEN NOW() ELSE NULL END, NOW())
       ON CONFLICT (user_id, quest_id, period_key) DO UPDATE SET
         progress = LEAST(user_quests.progress + $4, $5),
         completed_at = CASE
           WHEN LEAST(user_quests.progress + $4, $5) >= $5 AND user_quests.completed_at IS NULL
           THEN NOW() ELSE user_quests.completed_at END,
         updated_at = NOW()`,
      [userId, quest.id, periodKey, capProgress(delta, target), target],
    );
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
