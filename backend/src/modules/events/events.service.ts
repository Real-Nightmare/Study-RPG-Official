import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { WalletService } from '../rpg/wallet.service';
import { CardService } from '../rpg/card.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../admin/audit.service';
import { QuestsService } from './quests.service';
import { EventItemsService } from './event-items.service';
import { EventsConfig, mergeEventsConfig, DEFAULT_EVENTS_CONFIG } from './events-config';
import { buildStudyPassView } from './study-pass';
import { EVENT_ADVISORY_LOCK_KEY, isActiveWindow, nextStatusFor } from './event-scheduler';
import { getIntegrityConfig } from '../integrity/integrity-config';
import { overStudyFactor, isNightHour, istHour } from '../integrity/overstudy';

export interface EventView {
  id: string;
  slug: string;
  name: string;
  story: string | null;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  graceHours: number;
  claimDeadline: Date;
  config: Record<string, unknown>;
  status: string;
}

export interface StudyPassTrackView {
  track: string | null;
  trackLocked: boolean;
  goldPaidAt: Date | null;
  level: number;
  exp: number;
  currentThreshold: number;
  nextThreshold: number | null;
  levelProgressPct: number;
  maxed: boolean;
  claimedLevels: number[];
  claimableLevels: number[];
}

/**
 * PDF Phase 7 — Events (§25–§27). Owns the always-active event scheduler,
 * the 14-level StudyPass with Free/Gold tracks, and the study-activity feed
 * that accrues event EXP. Study-first: every reward is gated on recorded
 * study activity with idempotent wallet/card grants.
 */
@Injectable()
export class StudyEventsService {
  private readonly logger = new Logger(StudyEventsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly cards: CardService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly quests: QuestsService,
    private readonly items: EventItemsService,
  ) {}

  /** Reads `rpg.events` from game_config, merged over code defaults. */
  async getConfig(): Promise<EventsConfig> {
    const row = await this.db.queryOne<{ value: unknown }>(
      "SELECT value FROM game_config WHERE key = 'rpg.events'",
    );
    return mergeEventsConfig(row?.value ?? DEFAULT_EVENTS_CONFIG);
  }

  // -------------------------------------------------------------------------
  // Scheduler (§25)
  // -------------------------------------------------------------------------

  /**
   * Guarantees one active event at all times: lazily transitions
   * scheduled → active → ended, and when nothing is live and nothing is
   * scheduled next, creates the Study Sprint fallback under a Postgres
   * advisory lock — warning admins BEFORE activation.
   */
  async ensureActiveEvent(now: Date = new Date()): Promise<EventView | null> {
    await this.db.query(
      `UPDATE events SET status = 'ended', updated_at = NOW()
       WHERE status <> 'ended' AND claim_deadline <= $1`,
      [now],
    );
    await this.db.query(
      `UPDATE events SET status = 'active', updated_at = NOW()
       WHERE status = 'scheduled' AND starts_at <= $1`,
      [now],
    );

    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM events
       WHERE status = 'active' AND claim_deadline > $1
       ORDER BY starts_at DESC LIMIT 1`,
      [now],
    );
    if (row) return this.mapEvent(row);

    const upcoming = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM events
       WHERE starts_at > $1 AND status <> 'ended'
       ORDER BY starts_at ASC LIMIT 1`,
      [now],
    );
    if (upcoming) return null;

    // No active event and nothing scheduled → Study Sprint fallback.
    const config = await this.getConfig();
    return this.db.transaction<EventView | null>(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [EVENT_ADVISORY_LOCK_KEY]);
      const recheck = await client.query<Record<string, unknown>>(
        `SELECT * FROM events
         WHERE status = 'active' AND claim_deadline > $1
         ORDER BY starts_at DESC LIMIT 1`,
        [now],
      );
      if (recheck.rows[0]) return this.mapEvent(recheck.rows[0]);
      const recheckUpcoming = await client.query<Record<string, unknown>>(
        `SELECT * FROM events
         WHERE starts_at > $1 AND status <> 'ended'
         ORDER BY starts_at ASC LIMIT 1`,
        [now],
      );
      if (recheckUpcoming.rows[0]) return null;

      // Warn administrators before the fallback activates.
      const admins = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE role = 'admin'",
      );
      for (const admin of admins.rows) {
        await this.notifications.create({
          userId: admin.id,
          type: 'warning',
          title: `${config.fallback.name} fallback activated`,
          message: `No event was scheduled after the previous one ended — the safe fallback event "${config.fallback.name}" is now active. Please schedule the next event.`,
          link: '/dashboard/events',
        });
      }

      const id = uuidv4();
      const startsAt = now;
      const endsAt = new Date(now.getTime() + config.fallback.durationDays * 24 * 60 * 60 * 1000);
      const claimDeadline = new Date(
        endsAt.getTime() + config.fallback.graceHours * 60 * 60 * 1000,
      );
      await client.query(
        `INSERT INTO events
           (id, slug, name, story, kind, starts_at, ends_at, grace_hours, claim_deadline, config, status)
         VALUES ($1, $2, $3, $4, 'fallback', $5, $6, $7, $8, '{"studyPass": false}', 'active')`,
        [
          id,
          config.fallback.slug,
          config.fallback.name,
          'An automatic fallback event, always active when no scheduled event follows an ending event. Study normally — every minute counts.',
          startsAt,
          endsAt,
          config.fallback.graceHours,
          claimDeadline,
        ],
      );
      this.logger.warn(`Fallback event "${config.fallback.name}" activated (${id})`);
      return {
        id,
        slug: config.fallback.slug,
        name: config.fallback.name,
        story:
          'An automatic fallback event, always active when no scheduled event follows an ending event. Study normally — every minute counts.',
        kind: 'fallback',
        startsAt,
        endsAt,
        graceHours: config.fallback.graceHours,
        claimDeadline,
        config: { studyPass: false },
        status: 'active',
      };
    });
  }

  async activeEvent(now: Date = new Date()): Promise<EventView | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM events
       WHERE status = 'active' AND claim_deadline > $1
       ORDER BY starts_at DESC LIMIT 1`,
      [now],
    );
    return row ? this.mapEvent(row) : null;
  }

  async listEvents(now: Date = new Date()): Promise<EventView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT * FROM events ORDER BY starts_at DESC LIMIT 50`,
    );
    return rows.map((r) => this.mapEvent(r));
  }

  async getBySlug(slug: string): Promise<EventView> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM events WHERE slug = $1',
      [slug],
    );
    if (!row) throw new NotFoundException('Event not found');
    return this.mapEvent(row);
  }

  /** Admin: create a scheduled event. Every admin mutation is audited with a reason. */
  async createEvent(
    actorId: string,
    dto: {
      slug: string;
      name: string;
      story?: string;
      startsAt: Date;
      endsAt: Date;
      graceHours?: number;
      config?: Record<string, unknown>;
      reason: string;
    },
  ): Promise<EventView> {
    const graceHours = dto.graceHours ?? 48;
    const claimDeadline = new Date(dto.endsAt.getTime() + graceHours * 60 * 60 * 1000);
    const id = uuidv4();
    await this.db.query(
      `INSERT INTO events
         (id, slug, name, story, kind, starts_at, ends_at, grace_hours, claim_deadline, config, status)
       VALUES ($1, $2, $3, $4, 'normal', $5, $6, $7, $8, $9, 'scheduled')`,
      [
        id,
        dto.slug,
        dto.name,
        dto.story ?? null,
        dto.startsAt,
        dto.endsAt,
        graceHours,
        claimDeadline,
        JSON.stringify(dto.config ?? {}),
      ],
    );
    await this.audit.log({
      actorId,
      action: 'events.create',
      targetType: 'event',
      targetId: id,
      reason: dto.reason,
      details: { slug: dto.slug, name: dto.name },
    });
    return this.getBySlug(dto.slug);
  }

  /** Admin: force-activate an event (early start or manual override). Audited. */
  async activateEvent(actorId: string, eventId: string, reason: string): Promise<EventView> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE events
       SET status = 'active',
           starts_at = LEAST(starts_at, NOW()),
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [eventId],
    );
    if (!row) throw new NotFoundException('Event not found');
    await this.audit.log({
      actorId,
      action: 'events.activate',
      targetType: 'event',
      targetId: eventId,
      reason,
      details: { slug: row.slug },
    });
    return this.mapEvent(row);
  }

  // -------------------------------------------------------------------------
  // Study-activity feed (event EXP + quests)
  // -------------------------------------------------------------------------

  /**
   * Accrues event EXP and quest progress from real study activity. No-ops
   * when no event is active or the activity type is not configured — the
   * study tools keep working even if the event layer is empty.
   */
  async recordStudyActivity(
    userId: string,
    input: { type: string; amount?: number },
    now: Date = new Date(),
  ): Promise<void> {
    const config = await this.getConfig();
    const expRate = config.expByActivity[input.type];
    if (!expRate) return;
    const active = await this.activeEvent(now);
    if (!active) return;
    const amount = input.amount && input.amount > 0 ? input.amount : 1;
    // Anti-overstudy dampening (spec 015): event EXP shrinks once the day's
    // completed focus minutes exceed the healthy optimum, and night-window
    // activity is additionally dampened. `study_session` minutes are already
    // dampened by the focus-sessions service, so we never double-apply there.
    // Best-effort — a config/db hiccup must never block studying.
    let dampening = 1;
    if (input.type !== 'study_session') {
      try {
        const integrity = await getIntegrityConfig(this.db);
        const today = await this.db.queryOne<{ total: number }>(
          `SELECT COALESCE(SUM(focus_minutes), 0)::int AS total
           FROM focus_sessions
           WHERE user_id = $1 AND status = 'completed' AND started_at >= CURRENT_DATE`,
          [userId],
        );
        const todayMinutes = Number(today?.total ?? 0);
        dampening = Number(
          (
            overStudyFactor(todayMinutes, integrity.overStudy) *
            (isNightHour(
              istHour(now),
              integrity.overStudy.nightStartHour,
              integrity.overStudy.nightEndHour,
            )
              ? integrity.overStudy.nightFactor
              : 1)
          ).toFixed(3),
        );
      } catch (err) {
        this.logger.warn(`Over-study dampening unavailable: ${(err as Error).message}`);
      }
    }
    const expGain = Math.max(1, Math.round(expRate * amount * dampening));

    await this.db.query(
      `INSERT INTO user_event_state (user_id, event_id, event_exp)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, event_id) DO UPDATE SET
         event_exp = user_event_state.event_exp + EXCLUDED.event_exp,
         updated_at = NOW()`,
      [userId, active.id, expGain],
    );
    await this.quests.applyActivity(userId, active.id, input.type, amount, now);
  }

  // -------------------------------------------------------------------------
  // StudyPass & tracks (§26, §27)
  // -------------------------------------------------------------------------

  async studyPassState(userId: string, eventId: string): Promise<StudyPassTrackView> {
    const config = await this.getConfig();
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM user_event_state WHERE user_id = $1 AND event_id = $2`,
      [userId, eventId],
    );
    const exp = Number(row?.event_exp ?? 0);
    const claimed = this.parseLevels(row?.claimed_levels);
    return {
      track: (row?.track ?? null) as string | null,
      trackLocked: Boolean(row?.track_locked),
      goldPaidAt: row?.gold_paid_at ? new Date(row.gold_paid_at as string) : null,
      ...buildStudyPassView(exp, config.studyPassLevels, claimed),
    };
  }

  /** Choose/purchase a track. Gold costs 1500 SLC; the choice locks forever. */
  async chooseTrack(
    userId: string,
    eventId: string,
    track: 'free' | 'gold',
  ): Promise<StudyPassTrackView> {
    const config = await this.getConfig();
    await this.db.transaction(async (client) => {
      const existing = await client.query<Record<string, unknown>>(
        `SELECT track FROM user_event_state
         WHERE user_id = $1 AND event_id = $2 FOR UPDATE`,
        [userId, eventId],
      );
      if (existing.rows[0]?.track) {
        const current = existing.rows[0].track as string;
        if (current === track) return;
        throw new BadRequestException(
          `Study Pass track is already locked to ${current.toUpperCase()}`,
        );
      }
      if (track === 'gold') {
        await this.wallet.applyChangeWithClient(client, userId, {
          amount: -config.goldCost,
          transactionType: 'event_gold_pass',
          reason: `Gold Pass — event ${eventId}`,
          relatedEntityId: eventId,
          idempotencyKey: `events:gold:${eventId}`,
        });
        await client.query(
          `INSERT INTO user_event_state (user_id, event_id, track, track_locked, gold_paid_at)
           VALUES ($1, $2, 'gold', TRUE, NOW())
           ON CONFLICT (user_id, event_id) DO UPDATE SET
             track = 'gold', track_locked = TRUE, gold_paid_at = NOW(), updated_at = NOW()`,
          [userId, eventId],
        );
      } else {
        await client.query(
          `INSERT INTO user_event_state (user_id, event_id, track, track_locked)
           VALUES ($1, $2, 'free', TRUE)
           ON CONFLICT (user_id, event_id) DO UPDATE SET
             track = 'free', track_locked = TRUE, updated_at = NOW()`,
          [userId, eventId],
        );
      }
    });
    return this.studyPassState(userId, eventId);
  }

  /**
   * Claim a StudyPass level reward. Track exclusivity (Gold cannot claim Free
   * rewards and vice-versa), no double claiming, and lock-before-claim are
   * enforced atomically; every grant is idempotent.
   */
  async claimLevel(
    userId: string,
    eventId: string,
    level: number,
  ): Promise<{ level: number; granted: string[]; studyPass: StudyPassTrackView }> {
    const config = await this.getConfig();
    const granted: string[] = [];
    await this.db.transaction(async (client) => {
      const row = await client.query<Record<string, unknown>>(
        `SELECT * FROM user_event_state
         WHERE user_id = $1 AND event_id = $2 FOR UPDATE`,
        [userId, eventId],
      );
      const state = row.rows[0];
      if (!state || !state.track) {
        throw new BadRequestException('Choose a Study Pass track before claiming rewards');
      }
      if (!state.track_locked) {
        throw new BadRequestException('Study Pass track is not locked yet');
      }
      const thresholds = config.studyPassLevels;
      if (level < 0 || level >= thresholds.length) {
        throw new BadRequestException('Invalid Study Pass level');
      }
      const claimed = this.parseLevels(state.claimed_levels);
      if (claimed.includes(level)) {
        throw new BadRequestException('Reward already claimed for this level');
      }
      if (Number(state.event_exp ?? 0) < thresholds[level]) {
        throw new BadRequestException('Study Pass level not reached yet');
      }
      const track = state.track as string;
      const trackRewards =
        track === 'gold' ? config.abstracted.goldTrack : config.abstracted.freeTrack;
      const reward = trackRewards[level];
      if (!reward) {
        throw new BadRequestException('No reward configured for this level');
      }

      if (reward.stp) {
        await this.wallet.applyChangeWithClient(client, userId, {
          amount: reward.stp,
          transactionType: 'event_pass_reward',
          reason: `Study Pass level ${level + 1} (${track} track)`,
          relatedEntityId: eventId,
          idempotencyKey: `events:pass:${eventId}:${level}`,
        });
        granted.push(`stp:${reward.stp}`);
      }
      if (reward.loot) {
        const box = config.lootBoxes[reward.loot];
        if (!box) throw new BadRequestException(`Unknown loot box type: ${reward.loot}`);
        const opened = await this.cards.openLootBox(
          userId,
          reward.loot,
          box.weights,
          { source: `pass:${eventId}` },
          client,
        );
        granted.push(`loot:${opened.cardKey}`);
      }
      if (reward.item) {
        await this.items.grantItemWithClient(client, userId, reward.item, 1);
        granted.push(`item:${reward.item}`);
      }
      if (reward.card) {
        const card = await this.cards.grantEventCard(
          userId,
          reward.card,
          {
            source: `pass:${eventId}`,
            abstracted: {
              eventId,
              legendaryResultKey: config.abstracted.defaultLegendaryResultKey,
            },
          },
          client,
        );
        granted.push(`card:${card.cardKey}`);
      }

      await client.query(
        `UPDATE user_event_state
         SET claimed_levels = $1, track_locked = TRUE, updated_at = NOW()
         WHERE user_id = $2 AND event_id = $3`,
        [JSON.stringify([...claimed, level]), userId, eventId],
      );
    });
    this.logger.log(`Study Pass level ${level} claimed by ${userId} (${granted.join(', ')})`);
    return { level, granted, studyPass: await this.studyPassState(userId, eventId) };
  }

  /** Composed view for the events page. */
  async currentEventView(userId: string, now: Date = new Date()) {
    const event = await this.ensureActiveEvent(now);
    if (!event) return null;
    const config = await this.getConfig();
    const [studyPass, quests, items] = await Promise.all([
      this.studyPassState(userId, event.id),
      this.quests.listForEvent(userId, event.id, now),
      this.items.getItems(userId),
    ]);
    return {
      event,
      studyPass,
      quests,
      items,
      lootBoxOdds: config.lootBoxes,
      goldCost: config.goldCost,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private parseLevels(value: unknown): number[] {
    if (Array.isArray(value)) return value.map((v) => Number(v)).filter((n) => Number.isInteger(n));
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown[];
        return parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n));
      } catch {
        return [];
      }
    }
    return [];
  }

  private mapEvent(r: Record<string, unknown>): EventView {
    return {
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      story: (r.story ?? null) as string | null,
      kind: (r.kind ?? 'normal') as string,
      startsAt: new Date(r.starts_at as string),
      endsAt: new Date(r.ends_at as string),
      graceHours: Number(r.grace_hours ?? 48),
      claimDeadline: new Date(r.claim_deadline as string),
      config: this.parseJson(r.config),
      status: (r.status ?? 'scheduled') as string,
    };
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

  // Kept for scheduler tests: pure status decision for a single event.
  transitionStatus(
    event: { status: string; startsAt: Date; claimDeadline: Date },
    now: Date,
  ): string {
    return nextStatusFor(
      { ...event, status: event.status as import('./event-scheduler').EventStatus },
      now,
    );
  }
}
