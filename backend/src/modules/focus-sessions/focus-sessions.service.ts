import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { StudyEventsService } from '../events/events.service';
import { getIntegrityConfig } from '../integrity/integrity-config';
import { clampDailyFocus, verifyFocusSession } from '../integrity/behavior-guard';
import {
  overStudyFactor,
  restRequired,
  isNightHour,
  istHour,
  studyHealth,
  dailyBudgetRemaining,
  minutesUntilRestAllowed,
} from '../integrity/overstudy';
import type { CompletedSession } from '../integrity/overstudy';
import {
  StartFocusSessionDto,
  UpdateFocusSessionDto,
  CompleteFocusSessionDto,
} from './dto/focus-session.dto';

export interface FocusSession {
  id: string;
  userId: string;
  taskId: string | null;
  subject: string | null;
  startedAt: Date;
  endedAt: Date | null;
  focusMinutes: number;
  status: 'running' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FocusSessionsService {
  private readonly logger = new Logger(FocusSessionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly events?: StudyEventsService,
  ) {}

  /**
   * Starts a focus session (spec 015 — anti-overstudy gates). Two health-first
   * checks happen BEFORE any session begins:
   *  1. Daily hard stop: once today's completed focus minutes reach the hard
   *     daily cap, no new session may start — the day's budget is spent and
   *     rest is what makes the study count.
   *  2. Cooldown: after a long completed block, a mandatory rest window must
   *     pass before another block can start (spaced, rested studying).
   */
  async start(userId: string, dto: StartFocusSessionDto): Promise<FocusSession> {
    const active = await this.findActive(userId);
    if (active) {
      throw new ConflictException('A focus session is already running or paused');
    }

    const config = await getIntegrityConfig(this.db);
    const todayMinutes = await this.todayMinutes(userId);
    if (todayMinutes >= config.overStudy.hardDailyCapMinutes) {
      throw new BadRequestException(
        `You have reached your healthy daily study budget (${config.overStudy.hardDailyCapMinutes} min). Rest now — memory consolidates during sleep, and tomorrow's session will count for more than another hour today.`,
      );
    }
    const lastSession = await this.lastCompleted(userId);
    if (restRequired(lastSession, new Date(), config.overStudy)) {
      const wait = minutesUntilRestAllowed(
        lastSession?.endedAt ?? null,
        new Date(),
        config.overStudy.sessionCooldownMinutes,
      );
      throw new BadRequestException(
        `Your last focus block was long — take a real break${wait > 0 ? ` (about ${wait} more min)` : ''} before the next one. Your brain consolidates what you just studied during rest.`,
      );
    }

    const id = uuidv4();
    const result = await this.db.queryOne<FocusSession>(
      `INSERT INTO focus_sessions (id, user_id, task_id, subject, started_at, status)
       VALUES ($1, $2, $3, $4, NOW(), 'running')
       RETURNING *`,
      [id, userId, dto.taskId || null, dto.subject || null],
    );
    this.logger.log(`Focus session started: ${id}`);
    return this.mapSession(result!);
  }

  async pause(userId: string, id: string): Promise<FocusSession> {
    const session = await this.findOwned(userId, id);
    if (session.status !== 'running') {
      throw new ConflictException('Only a running session can be paused');
    }
    const minutes = Math.max(
      session.focusMinutes,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000),
    );
    const result = await this.db.queryOne<FocusSession>(
      `UPDATE focus_sessions SET status = 'paused', focus_minutes = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [minutes, id],
    );
    return this.mapSession(result!);
  }

  async resume(userId: string, id: string): Promise<FocusSession> {
    const session = await this.findOwned(userId, id);
    if (session.status !== 'paused') {
      throw new ConflictException('Only a paused session can be resumed');
    }
    // Reset started_at so elapsed time accrues from now.
    const result = await this.db.queryOne<FocusSession>(
      `UPDATE focus_sessions SET status = 'running', started_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapSession(result!);
  }

  /**
   * Completes a focus session (US2 / FR-004 — anti-cheese).
   *
   * The server clock is the single source of truth: any client-supplied
   * `focusMinutes` override is intentionally ignored so passive/idle timers
   * cannot mint reward minutes. Minutes are clamped to the daily cap and the
   * session is verified against real study engagement (quiz/exam/teach-back
   * activity inside the session window) — idle sessions accrue a reduced
   * event-EXP factor and are stamped with a `verification` JSONB record.
   */
  async complete(userId: string, id: string, _dto: CompleteFocusSessionDto): Promise<FocusSession> {
    const session = await this.findOwned(userId, id);
    if (session.status === 'completed') {
      throw new ConflictException('Session already completed');
    }
    const config = await getIntegrityConfig(this.db);
    const elapsed = Math.max(
      0,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000),
    );
    // Server-clock total: minutes accumulated across pause/resume + current run.
    const claimedMinutes = session.focusMinutes + elapsed;

    const engagementCount = await this.countEngagement(userId, session.startedAt, new Date());
    const verdict = verifyFocusSession({
      claimedMinutes,
      serverElapsedMinutes: claimedMinutes,
      engagementCount,
    });
    const todayMinutes = await this.todayMinutes(userId);
    const grantedMinutes = clampDailyFocus(
      todayMinutes,
      claimedMinutes,
      config.guards.focusDailyCapMinutes,
    );
    // Anti-overstudy dampening (spec 015): once the daily total crosses the
    // healthy optimum, further minutes earn progressively less event EXP; late
    // night (IST) grinding is additionally dampened. Rest is never punished.
    const rewardFactor = Number(
      (
        overStudyFactor(todayMinutes + grantedMinutes, config.overStudy) *
        (isNightHour(
          istHour(new Date()),
          config.overStudy.nightStartHour,
          config.overStudy.nightEndHour,
        )
          ? config.overStudy.nightFactor
          : 1)
      ).toFixed(3),
    );
    const nightStudy = isNightHour(
      istHour(new Date()),
      config.overStudy.nightStartHour,
      config.overStudy.nightEndHour,
    );
    const verification = {
      verdict,
      engagementCount,
      claimedMinutes,
      grantedMinutes,
      unverifiedExpFactor: config.guards.focusUnverifiedExpFactor,
      overStudyFactor: rewardFactor,
      nightStudy,
    };

    const result = await this.db.queryOne<FocusSession>(
      `UPDATE focus_sessions
       SET status = 'completed', ended_at = NOW(), focus_minutes = $1,
           verification = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [grantedMinutes, JSON.stringify(verification), id],
    );

    // Study-activity feed: only count credible, capped minutes; idle sessions
    // (passive tab left open) earn a reduced fraction of event EXP; over-study
    // and night-window minutes are dampened by the anti-overstudy factor.
    if (this.events && grantedMinutes >= config.guards.focusMinMinutes) {
      const baseAmount =
        verdict === 'idle'
          ? Math.round(grantedMinutes * config.guards.focusUnverifiedExpFactor)
          : grantedMinutes;
      const amount = Math.max(1, Math.round(baseAmount * rewardFactor));
      await this.events
        .recordStudyActivity(userId, { type: 'study_session', amount })
        .catch(() => undefined);
    }
    this.logger.log(
      `Focus session completed: ${id} (${grantedMinutes} min, verdict=${verdict}, engagement=${engagementCount})`,
    );
    return this.mapSession(result!);
  }

  async update(userId: string, id: string, dto: UpdateFocusSessionDto): Promise<FocusSession> {
    await this.findOwned(userId, id);
    const result = await this.db.queryOne<FocusSession>(
      `UPDATE focus_sessions
       SET task_id = COALESCE($1, task_id), subject = COALESCE($2, subject), updated_at = NOW()
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [dto.taskId ?? null, dto.subject ?? null, id, userId],
    );
    return this.mapSession(result!);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.db.query('DELETE FROM focus_sessions WHERE id = $1', [id]);
  }

  async list(userId: string, limit = 50): Promise<FocusSession[]> {
    const rows = await this.db.queryMany<FocusSession>(
      `SELECT * FROM focus_sessions WHERE user_id = $1
       ORDER BY started_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => this.mapSession(r));
  }

  async todaySummary(
    userId: string,
  ): Promise<{ totalMinutes: number; bySubject: Array<{ subject: string; minutes: number }> }> {
    const rows = await this.db.queryMany<{ subject: string | null; minutes: number }>(
      `SELECT COALESCE(subject, 'general') AS subject, COALESCE(SUM(focus_minutes), 0)::int AS minutes
       FROM focus_sessions
       WHERE user_id = $1 AND status = 'completed' AND started_at >= CURRENT_DATE
       GROUP BY COALESCE(subject, 'general')`,
      [userId],
    );
    const totalMinutes = rows.reduce((acc, r) => acc + Number(r.minutes), 0);
    return {
      totalMinutes,
      bySubject: rows.map((r) => ({ subject: r.subject ?? 'general', minutes: Number(r.minutes) })),
    };
  }

  /** Verified study signals inside a session window (quiz/exam/teach-back). */
  private async countEngagement(userId: string, startedAt: Date, endedAt: Date): Promise<number> {
    const rows = await this.db.queryMany<{ n: number }>(
      `SELECT
         (SELECT COUNT(*) FROM quiz_attempts
           WHERE user_id = $1 AND created_at BETWEEN $2 - INTERVAL '5 minutes' AND $3 + INTERVAL '5 minutes')
       + (SELECT COUNT(*) FROM exam_attempts
           WHERE user_id = $1 AND created_at BETWEEN $2 - INTERVAL '5 minutes' AND $3 + INTERVAL '5 minutes')
       + (SELECT COUNT(*) FROM teach_back_sessions
           WHERE user_id = $1 AND status IN ('submitted','evaluated')
             AND updated_at BETWEEN $2 - INTERVAL '5 minutes' AND $3 + INTERVAL '5 minutes')
       AS n`,
      [userId, startedAt, endedAt],
    );
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Health-first status view (spec 015) for the Focus Sessions UI: today's
   * minutes vs the healthy optimum and hard cap, a study-health meter band,
   * the active reward factor, cooldown state, and the night-study flag.
   */
  async wellbeing(
    userId: string,
    now: Date = new Date(),
  ): Promise<{
    todayMinutes: number;
    optimalDailyMinutes: number;
    hardDailyCapMinutes: number;
    budgetRemaining: number;
    healthPercent: number;
    band: 'fresh' | 'focused' | 'draining' | 'depleted';
    rewardFactor: number;
    cooldownActive: boolean;
    cooldownMinutesLeft: number;
    nightStudy: boolean;
    nightFactor: number;
    canStart: boolean;
  }> {
    const config = await getIntegrityConfig(this.db);
    const todayMinutes = await this.todayMinutes(userId);
    const last = await this.lastCompleted(userId);
    const health = studyHealth(todayMinutes, config.overStudy);
    const night = isNightHour(
      istHour(now),
      config.overStudy.nightStartHour,
      config.overStudy.nightEndHour,
    );
    const cooldownActive = restRequired(last, now, config.overStudy);
    return {
      todayMinutes,
      optimalDailyMinutes: config.overStudy.optimalDailyMinutes,
      hardDailyCapMinutes: config.overStudy.hardDailyCapMinutes,
      budgetRemaining: dailyBudgetRemaining(todayMinutes, config.overStudy.hardDailyCapMinutes),
      healthPercent: health.percent,
      band: health.band,
      rewardFactor: overStudyFactor(todayMinutes, config.overStudy),
      cooldownActive,
      cooldownMinutesLeft: cooldownActive
        ? minutesUntilRestAllowed(
            last?.endedAt ?? null,
            now,
            config.overStudy.sessionCooldownMinutes,
          )
        : 0,
      nightStudy: night,
      nightFactor: config.overStudy.nightFactor,
      canStart: !cooldownActive && todayMinutes < config.overStudy.hardDailyCapMinutes,
    };
  }

  /** Most recent completed session (for the rest-cooldown check). */
  private async lastCompleted(userId: string): Promise<CompletedSession | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT ended_at, focus_minutes FROM focus_sessions
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY ended_at DESC LIMIT 1`,
      [userId],
    );
    return row
      ? {
          endedAt: new Date(row.ended_at as string),
          minutes: Number(row.focus_minutes ?? 0),
        }
      : null;
  }

  /** Completed focus minutes today (for the daily cap). */
  private async todayMinutes(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(focus_minutes), 0)::int AS total
       FROM focus_sessions
       WHERE user_id = $1 AND status = 'completed' AND started_at >= CURRENT_DATE`,
      [userId],
    );
    return Number(row?.total ?? 0);
  }

  private async findActive(userId: string): Promise<FocusSession | null> {
    const row = await this.db.queryOne<FocusSession>(
      `SELECT * FROM focus_sessions WHERE user_id = $1 AND status IN ('running', 'paused') LIMIT 1`,
      [userId],
    );
    return row ? this.mapSession(row) : null;
  }

  private async findOwned(userId: string, id: string): Promise<FocusSession> {
    const row = await this.db.queryOne<FocusSession>(
      'SELECT * FROM focus_sessions WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!row) {
      throw new NotFoundException('Focus session not found');
    }
    return this.mapSession(row);
  }

  private mapSession(row: unknown): FocusSession {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: (r.user_id ?? r.userId) as string,
      taskId: (r.task_id ?? r.taskId ?? null) as string | null,
      subject: (r.subject ?? null) as string | null,
      startedAt: new Date((r.started_at ?? r.startedAt) as string),
      endedAt: (r.ended_at ?? r.endedAt) ? new Date((r.ended_at ?? r.endedAt) as string) : null,
      focusMinutes: Number(r.focus_minutes ?? r.focusMinutes ?? 0),
      status: r.status as FocusSession['status'],
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
      updatedAt: new Date((r.updated_at ?? r.updatedAt) as string),
    };
  }
}
