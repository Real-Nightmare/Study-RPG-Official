import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { CardService } from './card.service';
import { PlayerService } from './player.service';
import { WalletService } from './wallet.service';
import { DEFAULT_BATTLE_DEFAULTS, BattleDefaults } from './card-definitions';
import { MonsterState } from './battle-engine';
import {
  applyPartyAction,
  createPartyBattleState,
  forfeitPartyBattle,
  PartyBattleState,
} from './party-battle-engine';
import { getExamBoss, scaleExamBoss, EXAM_BOSSES } from './exam-bosses';
import { NotificationsService } from '../notifications/notifications.service';

export interface RpgParty {
  id: string;
  leaderId: string;
  leaderName: string;
  name: string;
  maxMembers: number;
  memberCount: number;
  members: Array<{ userId: string; name: string }>;
  createdAt: Date;
}

export interface PartyBattleView {
  id: string;
  partyId: string;
  boss: MonsterState;
  examId: string | null;
  state: PartyBattleState;
  phase: string;
  rewardClaimed: boolean;
  reward: { xp: number; stp: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PartyBattleRow {
  id: string;
  party_id: string;
  boss_key: string;
  exam_id: string | null;
  seed: number;
  state: string;
  phase: string;
  reward_claimed: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PartyService {
  private readonly logger = new Logger(PartyService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cards: CardService,
    private readonly player: PlayerService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------- Parties ----------------

  async createParty(userId: string, name: string): Promise<RpgParty> {
    const id = uuidv4();
    await this.db.query(
      `INSERT INTO rpg_parties (id, leader_id, name, max_members) VALUES ($1, $2, $3, 4)`,
      [id, userId, (name || 'Study Squad').substring(0, 120)],
    );
    await this.db.query(`INSERT INTO rpg_party_members (party_id, user_id) VALUES ($1, $2)`, [
      id,
      userId,
    ]);
    return this.getParty(userId, id);
  }

  async myParty(userId: string): Promise<RpgParty | null> {
    const row = await this.db.queryOne<{ party_id: string }>(
      `SELECT party_id FROM rpg_party_members WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (!row) {
      return null;
    }
    return this.getParty(userId, row.party_id);
  }

  async getParty(userId: string, partyId: string): Promise<RpgParty> {
    const party = await this.db.queryOne<{
      id: string;
      leader_id: string;
      leader_name: string;
      name: string;
      max_members: number;
      member_count: number;
      created_at: string;
    }>(
      `SELECT p.*, u.name AS leader_name,
              (SELECT COUNT(*) FROM rpg_party_members pm WHERE pm.party_id = p.id)::int AS member_count
       FROM rpg_parties p
       JOIN users u ON u.id = p.leader_id
       WHERE p.id = $1`,
      [partyId],
    );
    if (!party) {
      throw new NotFoundException('Party not found');
    }
    const members = await this.db.queryMany<{ user_id: string; name: string }>(
      `SELECT pm.user_id, u.name FROM rpg_party_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.party_id = $1 ORDER BY pm.joined_at ASC`,
      [partyId],
    );
    const isMember = members.some((m) => m.user_id === userId);
    if (!isMember && party.leader_id !== userId) {
      throw new ForbiddenException('You are not a member of this party');
    }
    return {
      id: party.id,
      leaderId: party.leader_id,
      leaderName: party.leader_name,
      name: party.name,
      maxMembers: party.max_members,
      memberCount: party.member_count,
      members: members.map((m) => ({ userId: m.user_id, name: m.name })),
      createdAt: new Date(party.created_at),
    };
  }

  /** Invite an accepted friend. Max 4 members (leader + 3 friends). */
  async invite(userId: string, partyId: string, friendId: string): Promise<RpgParty> {
    const party = await this.getParty(userId, partyId);
    if (party.leaderId !== userId) {
      throw new ForbiddenException('Only the party leader can invite');
    }
    if (party.memberCount >= party.maxMembers) {
      throw new BadRequestException('Party is full (max 4)');
    }

    const isFriend = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [userId, friendId],
    );
    if (!isFriend) {
      throw new BadRequestException('You can only invite accepted friends');
    }

    await this.db.query(
      `INSERT INTO rpg_party_members (party_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [partyId, friendId],
    );
    await this.notifications.create({
      userId: friendId,
      type: 'info',
      title: 'Party invitation',
      message: `${party.leaderName} added you to their study party.`,
      link: '/dashboard/rpg',
    });
    return this.getParty(userId, partyId);
  }

  async leave(userId: string, partyId: string): Promise<void> {
    const party = await this.getParty(userId, partyId);
    if (party.leaderId === userId) {
      // Leader leaving dissolves the party.
      await this.db.query('DELETE FROM rpg_party_members WHERE party_id = $1', [partyId]);
      await this.db.query('DELETE FROM rpg_parties WHERE id = $1', [partyId]);
      return;
    }
    await this.db.query('DELETE FROM rpg_party_members WHERE party_id = $1 AND user_id = $2', [
      partyId,
      userId,
    ]);
  }

  // ---------------- Party battles ----------------

  async startBattle(
    userId: string,
    partyId: string,
    dto: { examId?: string; bossKey?: string },
  ): Promise<PartyBattleView> {
    const party = await this.getParty(userId, partyId);
    if (party.memberCount < 2) {
      throw new BadRequestException('Add at least one friend to your party first');
    }

    // Resolve boss.
    let bossDef = EXAM_BOSSES.find((b) => b.key === dto.bossKey);
    let daysUntilExam: number | null = null;
    const examId: string | null = dto.examId || null;
    if (!bossDef && examId) {
      const exam = await this.db.queryOne<{
        name: string;
        subject: string;
        exam_date: Date | null;
      }>(
        `SELECT e.name, s.name AS subject, e.exam_date
         FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id
         WHERE e.id = $1`,
        [examId],
      );
      if (!exam) {
        throw new NotFoundException('Exam not found');
      }
      bossDef = getExamBoss(exam.subject);
      if (exam.exam_date) {
        daysUntilExam = Math.ceil(
          (new Date(exam.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
      }
    }
    if (!bossDef) {
      bossDef = getExamBoss(null);
    }

    const scaled = scaleExamBoss(bossDef, daysUntilExam, party.memberCount);
    const boss: MonsterState = {
      key: bossDef.key,
      name: bossDef.name,
      hp: scaled.hp,
      maxHp: scaled.hp,
      attack: scaled.attack,
    };

    // Build hero inputs from each member's active deck.
    const heroes = [];
    for (const member of party.members) {
      const deck = await this.cards.getActiveDeck(member.userId);
      if (!deck || !deck.validated) {
        throw new BadRequestException(`${member.name} has no valid equipped deck`);
      }
      heroes.push({
        userId: member.userId,
        name: member.name,
        hand: deck.cards.map((c) => ({
          instanceId: c.instanceId,
          cardKey: c.cardKey,
          ability: c.ability,
        })),
      });
    }

    const seed = Math.floor(Math.random() * 2 ** 31);
    const defaults: BattleDefaults = await this.getBattleDefaults();
    const state = createPartyBattleState({ seed, heroes, boss, defaults });
    const id = uuidv4();

    await this.db.query(
      `INSERT INTO rpg_party_battles (id, party_id, boss_key, exam_id, seed, state, phase)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [id, partyId, bossDef.key, examId, seed, JSON.stringify(state)],
    );

    return this.getBattle(userId, id);
  }

  async listBattles(userId: string, partyId: string): Promise<PartyBattleView[]> {
    await this.getParty(userId, partyId);
    const rows = await this.db.queryMany<PartyBattleRow>(
      `SELECT * FROM rpg_party_battles WHERE party_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [partyId],
    );
    return Promise.all(rows.map((r) => this.viewFromRow(r, userId)));
  }

  async getBattle(userId: string, battleId: string): Promise<PartyBattleView> {
    const row = await this.db.queryOne<PartyBattleRow>(
      `SELECT * FROM rpg_party_battles WHERE id = $1`,
      [battleId],
    );
    if (!row) {
      throw new NotFoundException('Party battle not found');
    }
    return this.viewFromRow(row, userId);
  }

  async action(
    userId: string,
    battleId: string,
    dto: { cardInstanceId: string },
  ): Promise<PartyBattleView> {
    const row = await this.db.queryOne<PartyBattleRow>(
      `SELECT * FROM rpg_party_battles WHERE id = $1`,
      [battleId],
    );
    if (!row) {
      throw new NotFoundException('Party battle not found');
    }
    const party = await this.getParty(userId, row.party_id);
    if (!party.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a party member');
    }

    const state = JSON.parse(row.state as unknown as string) as PartyBattleState;
    const defaults = await this.getBattleDefaults();
    const result = applyPartyAction(state, userId, dto.cardInstanceId, defaults);

    await this.db.query(
      `UPDATE rpg_party_battles SET state = $1, phase = $2, updated_at = $3 WHERE id = $4`,
      [JSON.stringify(result.state), result.state.phase, new Date(), battleId],
    );

    // Grant rewards on victory (idempotent).
    if (result.state.phase === 'won') {
      await this.grantVictoryRewards(party, battleId);
    }

    return this.getBattle(userId, battleId);
  }

  async forfeit(userId: string, battleId: string): Promise<PartyBattleView> {
    const row = await this.db.queryOne<PartyBattleRow>(
      `SELECT * FROM rpg_party_battles WHERE id = $1`,
      [battleId],
    );
    if (!row) {
      throw new NotFoundException('Party battle not found');
    }
    const party = await this.getParty(userId, row.party_id);
    if (!party.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('Not a party member');
    }
    const state = JSON.parse(row.state as unknown as string) as PartyBattleState;
    forfeitPartyBattle(state);
    await this.db.query(
      `UPDATE rpg_party_battles SET state = $1, phase = 'forfeited', updated_at = $2 WHERE id = $3`,
      [JSON.stringify(state), new Date(), battleId],
    );
    return this.getBattle(userId, battleId);
  }

  private async grantVictoryRewards(party: RpgParty, battleId: string): Promise<void> {
    await this.db.query(`UPDATE rpg_party_battles SET reward_claimed = true WHERE id = $1`, [
      battleId,
    ]);

    for (const member of party.members) {
      const xp = 60;
      const stp = 40;
      try {
        await this.wallet.applyChange(member.userId, {
          amount: stp,
          transactionType: 'party_win',
          reason: 'Party battle victory',
          relatedEntityId: battleId,
          idempotencyKey: `party_win:${battleId}:${member.userId}`,
        });
        await this.player.addXp(member.userId, xp, 'party_win');
      } catch (error) {
        this.logger.warn(
          `Party reward already claimed for ${member.userId}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async viewFromRow(row: PartyBattleRow, _viewerUserId: string): Promise<PartyBattleView> {
    const state = JSON.parse(row.state) as PartyBattleState;
    const won = state.phase === 'won' || row.phase === 'won';
    return {
      id: row.id,
      partyId: row.party_id,
      boss: state.boss,
      examId: row.exam_id || null,
      state,
      phase: row.phase,
      rewardClaimed: row.reward_claimed,
      reward: won ? { xp: 60, stp: 40 } : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async getBattleDefaults(): Promise<BattleDefaults> {
    try {
      const config = await this.db.queryOne<{ value: string }>(
        `SELECT value FROM game_config WHERE key = 'rpg.battle'`,
      );
      if (config) {
        const parsed = JSON.parse(config.value);
        return { ...DEFAULT_BATTLE_DEFAULTS, ...parsed };
      }
    } catch {
      // fall through to defaults
    }
    return DEFAULT_BATTLE_DEFAULTS;
  }
}
