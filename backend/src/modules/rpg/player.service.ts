import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { levelFromXp, LevelInfo } from './level-curve';
import { DEFAULT_LEVEL_CONFIG, getConfigValue, LevelConfig } from './rpg-config';

export interface PlayerProfile {
  userId: string;
  xp: number;
  level: number;
  eventExp: number;
  stp: number;
  battleRating: number;
  studyStreak: number;
  bestPuzzleStreak: number;
  currentWorld: string;
  levelInfo: LevelInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface XpGain {
  amount: number;
  type: string;
  totalXp: number;
  leveledUp: boolean;
  level: number;
  levelInfo: LevelInfo;
}

/**
 * Player progression (master prompt §12): config-driven level thresholds,
 * cumulative XP, and level-up detection. XP is appended to `user_xp_events`
 * for the legacy gamification feed and mirrored on `player_profiles`.
 */
@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(private readonly db: DatabaseService) {}

  async getProfile(userId: string): Promise<PlayerProfile> {
    await this.ensureProfile(userId);
    const [row, levelConfig] = await Promise.all([
      this.db.queryOne<Record<string, unknown>>(
        `SELECT user_id, xp, level, event_exp, stp, battle_rating, study_streak,
                best_puzzle_streak, current_world, created_at, updated_at
         FROM player_profiles WHERE user_id = $1`,
        [userId],
      ),
      this.getLevelConfig(),
    ]);
    if (!row) {
      throw new Error('Profile row missing after ensure');
    }
    const totalXp = Number(row.xp ?? 0);
    const levelInfo = levelFromXp(totalXp, levelConfig.thresholds);
    return {
      userId: (row.user_id ?? userId) as string,
      xp: totalXp,
      level: levelInfo.level,
      eventExp: Number(row.event_exp ?? 0),
      stp: Number(row.stp ?? 0),
      battleRating: Number(row.battle_rating ?? 1000),
      studyStreak: Number(row.study_streak ?? 0),
      bestPuzzleStreak: Number(row.best_puzzle_streak ?? 0),
      currentWorld: (row.current_world ?? 'overworld') as string,
      levelInfo,
      createdAt: new Date((row.created_at ?? row.createdAt) as string),
      updatedAt: new Date((row.updated_at ?? row.updatedAt) as string),
    };
  }

  /**
   * Grants XP: appends a `user_xp_events` row (legacy gamification feed) and
   * updates `player_profiles.xp`/`level`. Returns level-up detection.
   */
  async addXp(userId: string, amount: number, type: string, _reason?: string): Promise<XpGain> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('XP must be a positive integer');
    }
    const levelConfig = await this.getLevelConfig();

    return this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const lock = await client.query(
        'SELECT xp FROM player_profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const before = Number(lock.rows[0]?.xp ?? 0);
      const totalXp = before + amount;

      const info = levelFromXp(totalXp, levelConfig.thresholds);
      const leveledUp = info.level > levelFromXp(before, levelConfig.thresholds).level;

      await client.query(
        `INSERT INTO user_xp_events (id, user_id, type, xp)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), userId, type, amount],
      );
      await client.query(
        `UPDATE player_profiles SET xp = $1, level = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [totalXp, info.level, userId],
      );
      this.logger.log(`XP +${amount} (${type}) for ${userId} → level ${info.level}`);

      return {
        amount,
        type,
        totalXp,
        leveledUp,
        level: info.level,
        levelInfo: info,
      };
    });
  }

  /** Marks event XP (used by the study RPG event system later). */
  async addEventExp(userId: string, amount: number): Promise<void> {
    await this.db.query(
      `UPDATE player_profiles SET event_exp = event_exp + $1, updated_at = NOW()
       WHERE user_id = $2`,
      [amount, userId],
    );
  }

  async getLevelConfig(): Promise<LevelConfig> {
    return getConfigValue<LevelConfig>(this.db, 'rpg.levels', DEFAULT_LEVEL_CONFIG);
  }

  private async ensureProfile(userId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }
}
