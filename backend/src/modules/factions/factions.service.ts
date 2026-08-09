import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../admin/audit.service';
import { QueueService } from '../queue/queue.service';
import {
  factionColorFor,
  factionCountFor,
  pickFactionForUser,
  FactionBalanceCandidate,
} from './faction-balancer';
import {
  currentPeriodKeyIST,
  previousPeriodKeyIST,
  settleFactions,
  FactionSettlementInput,
  DEFAULT_SETTLEMENT_REWARD,
} from './faction-settlement';

export interface Faction {
  id: string;
  programmeId: string | null;
  programmeName: string | null;
  name: string;
  color: string;
  targetSize: number;
  status: string;
  memberCount: number;
  myRole: string | null;
  score: number;
  createdAt: Date;
}

export interface FactionMember {
  userId: string;
  name: string;
  role: string;
  joinedAt: Date;
}

@Injectable()
export class FactionsService implements OnModuleInit {
  private readonly logger = new Logger(FactionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Phase 9: monthly (IST) settlement on a repeatable BullMQ job — recurring
   * rewards no longer wait for a lazy read. Idempotent per period.
   */
  async onModuleInit(): Promise<void> {
    this.registerSettlementJob();
  }

  private registerSettlementJob(): void {
    try {
      const worker = this.queue.registerWorker(
        'faction-settlement',
        async () => {
          const ran = await this.settleIfDue();
          return { ran };
        },
        1,
      );
      worker.on('completed', (job) => {
        this.logger.log(`Faction settlement job ${job.id} completed`);
      });
      void this.queue
        .addJob(
          'faction-settlement',
          'monthly-ist',
          {},
          {
            repeat: { every: 24 * 60 * 60 * 1000 }, // daily check; settleIfDue is period-idempotent
            removeOnComplete: true,
            removeOnFail: 100,
          },
        )
        .catch((error) => this.logger.warn(`Could not schedule settlement job: ${error.message}`));
    } catch (error) {
      this.logger.warn(`Faction settlement worker unavailable: ${(error as Error).message}`);
    }
  }

  // ---------------- Listing ----------------

  async listForProgramme(programmeId: string | null): Promise<Faction[]> {
    const rows = await this.db.queryMany<Faction>(
      `SELECT f.*, p.name AS programme_name,
              COUNT(fm.user_id) AS member_count,
              COALESCE(SUM(fse.points), 0)::int AS score
       FROM factions f
       LEFT JOIN programmes p ON p.id = f.programme_id
       LEFT JOIN faction_members fm ON fm.faction_id = f.id
       LEFT JOIN faction_score_events fse
         ON fse.faction_id = f.id AND fse.period_key = $1
       WHERE ($2::uuid IS NULL OR f.programme_id = $2)
         AND f.status = 'active'
       GROUP BY f.id, p.name
       ORDER BY f.created_at ASC`,
      [currentPeriodKeyIST(), programmeId],
    );
    return rows.map((r) => this.mapFaction(r));
  }

  async myFaction(userId: string): Promise<Faction | null> {
    const row = await this.db.queryOne<Faction>(
      `SELECT f.*, p.name AS programme_name, fm.role AS my_role,
              (SELECT COUNT(*) FROM faction_members fm2 WHERE fm2.faction_id = f.id)::int AS member_count,
              COALESCE(SUM(fse.points), 0)::int AS score
       FROM faction_members fm
       JOIN factions f ON f.id = fm.faction_id
       LEFT JOIN programmes p ON p.id = f.programme_id
       LEFT JOIN faction_score_events fse
         ON fse.faction_id = f.id AND fse.period_key = $2
       WHERE fm.user_id = $1 AND f.status = 'active'
       GROUP BY f.id, p.name, fm.role
       LIMIT 1`,
      [userId, currentPeriodKeyIST()],
    );
    return row ? this.mapFaction(row) : null;
  }

  async members(factionId: string): Promise<FactionMember[]> {
    await this.requireFaction(factionId);
    const rows = await this.db.queryMany<{
      user_id: string;
      name: string;
      role: string;
      joined_at: string;
    }>(
      `SELECT fm.user_id, u.name, fm.role, fm.joined_at
       FROM faction_members fm
       JOIN users u ON u.id = fm.user_id
       WHERE fm.faction_id = $1
       ORDER BY (fm.role = 'leader') DESC, fm.joined_at ASC`,
      [factionId],
    );
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      role: r.role,
      joinedAt: new Date(r.joined_at),
    }));
  }

  async leaderboard(programmeId: string | null): Promise<Faction[]> {
    await this.settleIfDue();
    return this.listForProgramme(programmeId);
  }

  // ---------------- Auto-assign & join ----------------

  /**
   * Auto-assign a user to the smallest faction of a programme (creating
   * factions as needed so 28 students → 4 factions of 7). If the user already
   * has a faction, returns it unchanged.
   */
  async autoAssign(userId: string, programmeId: string | null): Promise<Faction> {
    const existing = await this.myFaction(userId);
    if (existing) {
      return existing;
    }

    let targetSize = 7;
    if (programmeId) {
      const prog = await this.db.queryOne<{ faction_size: number }>(
        'SELECT faction_size FROM programmes WHERE id = $1',
        [programmeId],
      );
      if (prog) {
        targetSize = prog.faction_size || 7;
      }
    }

    let factions = await this.listForProgramme(programmeId);
    const totalMembers = factions.reduce((sum, f) => sum + f.memberCount, 0);
    const needed = factionCountFor(totalMembers + 1, targetSize);

    if (factions.length < needed) {
      for (let i = factions.length; i < needed; i++) {
        const id = uuidv4();
        await this.db.query(
          `INSERT INTO factions (id, programme_id, name, color, target_size)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, programmeId, `Faction ${i + 1}`, factionColorFor(i), targetSize],
        );
      }
      factions = await this.listForProgramme(programmeId);
    }

    const candidates: FactionBalanceCandidate[] = factions.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      memberCount: f.memberCount,
      targetSize: f.targetSize,
    }));
    const target = pickFactionForUser(candidates);

    await this.db.query(
      `INSERT INTO faction_members (faction_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [target.id, userId],
    );

    return (await this.myFaction(userId))!;
  }

  // ---------------- Elections (2 leaders, elected by members) ----------------

  async vote(userId: string, factionId: string, candidateId: string): Promise<void> {
    const faction = await this.requireFaction(factionId);
    const memberRows = await this.db.queryMany<{ user_id: string }>(
      'SELECT user_id FROM faction_members WHERE faction_id = $1',
      [factionId],
    );
    const memberIds = memberRows.map((r) => r.user_id);
    if (!memberIds.includes(userId)) {
      throw new BadRequestException('Only faction members can vote');
    }
    if (!memberIds.includes(candidateId)) {
      throw new BadRequestException('Candidate must be a faction member');
    }
    if (candidateId === userId) {
      throw new BadRequestException('You cannot vote for yourself');
    }

    const period = currentPeriodKeyIST();
    await this.db.query(
      `INSERT INTO faction_votes (faction_id, voter_id, candidate_id, period_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (faction_id, voter_id, period_key)
       DO UPDATE SET candidate_id = EXCLUDED.candidate_id`,
      [factionId, userId, candidateId, period],
    );

    void faction;
  }

  async electionResults(
    factionId: string,
  ): Promise<Array<{ userId: string; name: string; votes: number }>> {
    await this.requireFaction(factionId);
    const period = currentPeriodKeyIST();
    const rows = await this.db.queryMany<{ user_id: string; name: string; votes: number }>(
      `SELECT fv.candidate_id, u.name, COUNT(*)::int AS votes
       FROM faction_votes fv
       JOIN users u ON u.id = fv.candidate_id
       WHERE fv.faction_id = $1 AND fv.period_key = $2
       GROUP BY fv.candidate_id, u.name
       ORDER BY votes DESC`,
      [factionId, period],
    );
    return rows.map((r) => ({
      userId: r.user_id as string,
      name: r.name as string,
      votes: r.votes as number,
    }));
  }

  // ---------------- Score events ----------------

  async recordScoreEvent(params: {
    userId: string;
    eventType: string;
    points: number;
    periodKey?: string;
  }): Promise<void> {
    const faction = await this.myFaction(params.userId);
    if (!faction || params.points <= 0) {
      return;
    }
    await this.db.query(
      `INSERT INTO faction_score_events (id, faction_id, user_id, event_type, points, period_key)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        uuidv4(),
        faction.id,
        params.userId,
        params.eventType,
        params.points,
        params.periodKey || currentPeriodKeyIST(),
      ],
    );
  }

  // ---------------- Help pledges (stronger helps weaker) ----------------

  async recordHelpActivity(params: {
    userId: string;
    helpedFactionId: string;
    note?: string;
  }): Promise<void> {
    const myFaction = await this.myFaction(params.userId);
    if (!myFaction) {
      throw new BadRequestException('You are not in a faction');
    }
    const period = currentPeriodKeyIST();

    const pledge = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM faction_help_pledges
       WHERE helper_faction_id = $1 AND helped_faction_id = $2 AND period_key = $3 AND status = 'open'
       LIMIT 1`,
      [myFaction.id, params.helpedFactionId, period],
    );
    if (!pledge) {
      throw new BadRequestException(
        'No open help pledge from your faction toward that faction this period',
      );
    }

    await this.db.query(
      `INSERT INTO faction_help_activities (id, pledge_id, faction_id, user_id, activity_type, note)
       VALUES ($1, $2, $3, $4, 'help', $5)`,
      [uuidv4(), pledge.id, myFaction.id, params.userId, params.note || null],
    );
  }

  async activeHelpPledges(): Promise<
    Array<{
      id: string;
      helperFactionId: string;
      helperName: string;
      helpedFactionId: string;
      helpedName: string;
      periodKey: string;
      status: string;
      activityCount: number;
    }>
  > {
    const rows = await this.db.queryMany<{
      id: string;
      helper_faction_id: string;
      helper_name: string;
      helped_faction_id: string;
      helped_name: string;
      period_key: string;
      status: string;
      activity_count: number;
    }>(
      `SELECT p.id, p.helper_faction_id, fh.name AS helper_name,
              p.helped_faction_id, fd.name AS helped_name,
              p.period_key, p.status,
              (SELECT COUNT(*) FROM faction_help_activities fa WHERE fa.pledge_id = p.id)::int AS activity_count
       FROM faction_help_pledges p
       JOIN factions fh ON fh.id = p.helper_faction_id
       JOIN factions fd ON fd.id = p.helped_faction_id
       WHERE p.period_key = $1
       ORDER BY p.created_at DESC`,
      [currentPeriodKeyIST()],
    );
    return rows.map((r) => ({
      id: r.id,
      helperFactionId: r.helper_faction_id,
      helperName: r.helper_name,
      helpedFactionId: r.helped_faction_id,
      helpedName: r.helped_name,
      periodKey: r.period_key,
      status: r.status,
      activityCount: r.activity_count,
    }));
  }

  // ---------------- Monthly settlement ----------------

  /** Lazy settlement: runs once per period on read. */
  async settleIfDue(): Promise<boolean> {
    const period = currentPeriodKeyIST();
    const done = await this.db.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM faction_settlements WHERE period_key = $1',
      [period],
    );
    if (done && parseInt(done.count, 10) > 0) {
      return false;
    }
    await this.settle(period);
    return true;
  }

  async settle(periodKey: string): Promise<void> {
    const rows = await this.db.queryMany<{
      faction_id: string;
      name: string;
      score: number;
    }>(
      `SELECT f.id AS faction_id, f.name,
              COALESCE(SUM(fse.points), 0)::int AS score
       FROM factions f
       LEFT JOIN faction_score_events fse
         ON fse.faction_id = f.id AND fse.period_key = $1
       WHERE f.status = 'active'
         AND (EXISTS (SELECT 1 FROM faction_members fm2 WHERE fm2.faction_id = f.id)
              OR EXISTS (SELECT 1 FROM faction_score_events fse2 WHERE fse2.faction_id = f.id))
       GROUP BY f.id, f.name
       ORDER BY score DESC`,
      [periodKey],
    );

    const previousPeriod = previousPeriodKeyIST(periodKeyToDate(periodKey));
    const inputs: FactionSettlementInput[] = [];
    for (const row of rows) {
      const prev = await this.db.queryOne<{ score: number }>(
        'SELECT COALESCE(SUM(points), 0)::int AS score FROM faction_score_events WHERE faction_id = $1 AND period_key = $2',
        [row.faction_id, previousPeriod],
      );
      inputs.push({
        factionId: row.faction_id,
        name: row.name,
        score: row.score,
        previousScore: prev ? prev.score : null,
      });
    }

    const results = settleFactions(inputs, DEFAULT_SETTLEMENT_REWARD);

    for (const result of results) {
      await this.db.query(
        `INSERT INTO faction_settlements (id, faction_id, period_key, rank, score, reward)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (faction_id, period_key) DO UPDATE
         SET rank = EXCLUDED.rank, score = EXCLUDED.score, reward = EXCLUDED.reward`,
        [
          uuidv4(),
          result.factionId,
          periodKey,
          result.rank,
          result.score,
          JSON.stringify({ tier: result.tier, stp: result.stpReward }),
        ],
      );

      if (result.helpPledgeToward && result.helpPledgeToward !== result.factionId) {
        await this.db.query(
          `INSERT INTO faction_help_pledges (id, helper_faction_id, helped_faction_id, period_key, status)
           VALUES ($1, $2, $3, $4, 'open')
           ON CONFLICT (helper_faction_id, helped_faction_id, period_key) DO NOTHING`,
          [uuidv4(), result.factionId, result.helpPledgeToward, periodKey],
        );
      }

      // Notify leaders of the settlement result.
      const leaders = await this.db.queryMany<{ user_id: string }>(
        "SELECT user_id FROM faction_members WHERE faction_id = $1 AND role = 'leader'",
        [result.factionId],
      );
      for (const leader of leaders) {
        await this.notifications.create({
          userId: leader.user_id,
          type: 'success',
          title: 'Faction settlement',
          message: `${result.name} ranked #${result.rank} this month (${result.tier} tier, +${result.stpReward} STP).`,
          link: '/dashboard/factions',
        });
      }
    }

    this.logger.log(`Faction settlement completed for ${periodKey}`);
  }

  // ---------------- Admin: leader promotion ----------------

  /** Promote the top-2 vote getters to leaders for a period. */
  async promoteLeaders(factionId: string): Promise<string[]> {
    const faction = await this.requireFaction(factionId);
    const results = await this.electionResults(factionId);
    const top = results.slice(0, 2).map((r) => r.userId);
    if (top.length === 0) {
      return [];
    }

    await this.db.query('UPDATE faction_members SET role = $1 WHERE faction_id = $2', [
      'member',
      factionId,
    ]);
    for (const userId of top) {
      await this.db.query(
        'UPDATE faction_members SET role = $1 WHERE faction_id = $2 AND user_id = $3',
        ['leader', factionId, userId],
      );
    }

    await this.audit.log({
      actorId: null,
      action: 'faction.leaders_elected',
      targetType: 'faction',
      targetId: factionId,
      reason: `Members elected leaders for ${faction.name}`,
      details: { leaders: top },
    });
    return top;
  }

  private async requireFaction(factionId: string): Promise<Faction> {
    const row = await this.db.queryOne<Faction>(
      `SELECT f.*, p.name AS programme_name,
              (SELECT COUNT(*) FROM faction_members fm2 WHERE fm2.faction_id = f.id)::int AS member_count,
              0 AS score
       FROM factions f
       LEFT JOIN programmes p ON p.id = f.programme_id
       WHERE f.id = $1`,
      [factionId],
    );
    if (!row) {
      throw new NotFoundException('Faction not found');
    }
    return this.mapFaction(row);
  }

  private mapFaction(row: unknown): Faction {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      programmeId: (r.programme_id as string | null) || null,
      programmeName: (r.programme_name as string | null) || null,
      name: r.name as string,
      color: (r.color as string) || 'indigo',
      targetSize: (r.target_size as number) || 7,
      status: (r.status as string) || 'active',
      memberCount: Number(r.member_count ?? r.memberCount ?? 0),
      myRole: (r.my_role as string | null) || null,
      score: Number(r.score ?? 0),
      createdAt: new Date(r.created_at as string),
    };
  }
}

/** Convert 'YYYY-MM' to a Date (1st of month, UTC) for previous-period math. */
function periodKeyToDate(periodKey: string): Date {
  const [year, month] = periodKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}
