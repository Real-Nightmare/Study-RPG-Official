import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { levelFromXp, LevelInfo } from './level-curve';
import { DEFAULT_LEVEL_CONFIG, getConfigValue, LevelConfig } from './rpg-config';
import {
  applyXpModifiers,
  canSelectCharacter,
  CharactersConfig,
  CharacterArchetype,
  DEFAULT_CHARACTERS_CONFIG,
  findCharacter,
  RESPEC_TOKEN_LEVEL,
} from './characters';

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
  /** Selected archetype key (null until the player picks one). */
  characterKey: string | null;
  /** Free archetype changes remaining (one granted at RESPEC_TOKEN_LEVEL). */
  respecTokens: number;
  levelInfo: LevelInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface XpGain {
  amount: number;
  type: string;
  totalXp: number;
  leveledUp: boolean;
  /** True when this gain triggered the one-time level-10 respec grant. */
  respecGranted?: boolean;
  level: number;
  levelInfo: LevelInfo;
}

export interface CharacterView extends CharacterArchetype {
  selected: boolean;
  canSelect: boolean;
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
                best_puzzle_streak, current_world, character_key, respec_tokens,
                created_at, updated_at
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
      characterKey: (row.character_key ?? null) as string | null,
      respecTokens: Number(row.respec_tokens ?? 0),
      levelInfo,
      createdAt: new Date((row.created_at ?? row.createdAt) as string),
      updatedAt: new Date((row.updated_at ?? row.updatedAt) as string),
    };
  }

  /**
   * Grants XP: appends a `user_xp_events` row (legacy gamification feed) and
   * updates `player_profiles.xp`/`level`. Returns level-up detection.
   *
   * The selected archetype's XP modifiers are applied here (completion plan
   * T9), and the first crossing of the respec-token level grants one free
   * archetype change.
   */
  async addXp(userId: string, amount: number, type: string, _reason?: string): Promise<XpGain> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('XP must be a positive integer');
    }
    const levelConfig = await this.getLevelConfig();
    const character = await this.getSelectedCharacter(userId);
    const bonusXp = applyXpModifiers(amount, character, type);

    return this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const lock = await client.query(
        'SELECT xp, respec_tokens FROM player_profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const before = Number(lock.rows[0]?.xp ?? 0);
      const tokensBefore = Number(lock.rows[0]?.respec_tokens ?? 0);
      const totalXp = before + bonusXp;

      const info = levelFromXp(totalXp, levelConfig.thresholds);
      const previousLevel = levelFromXp(before, levelConfig.thresholds).level;
      const leveledUp = info.level > previousLevel;

      // First time the player reaches the token level → grant one respec.
      let respecTokens = tokensBefore;
      let respecGranted = false;
      if (
        previousLevel < RESPEC_TOKEN_LEVEL &&
        info.level >= RESPEC_TOKEN_LEVEL &&
        tokensBefore < 1
      ) {
        respecTokens += 1;
        respecGranted = true;
        await client.query(
          `UPDATE player_profiles SET respec_tokens = respec_tokens + 1 WHERE user_id = $1`,
          [userId],
        );
        this.logger.log(`Respec token granted to ${userId} (reached level ${RESPEC_TOKEN_LEVEL})`);
      }

      await client.query(
        `INSERT INTO user_xp_events (id, user_id, type, xp)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), userId, type, bonusXp],
      );
      await client.query(
        `UPDATE player_profiles SET xp = $1, level = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [totalXp, info.level, userId],
      );
      this.logger.log(
        `XP +${bonusXp}${character ? ` (${character.key} bonus)` : ''} (${type}) for ${userId} → level ${info.level}`,
      );

      return {
        amount: bonusXp,
        type,
        totalXp,
        leveledUp,
        respecGranted,
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

  // ---------------------------------------------------------------------
  // Character archetypes (completion plan T9)
  // ---------------------------------------------------------------------

  /** Archetype list with the caller's selection state. */
  async listCharacters(userId: string): Promise<CharacterView[]> {
    const profile = await this.getProfile(userId);
    const cfg = await this.getCharactersConfig();
    return cfg.characters.map((c) => ({
      ...c,
      selected: profile.characterKey === c.key,
      canSelect: canSelectCharacter(profile.characterKey, profile.respecTokens),
    }));
  }

  /**
   * Choose an archetype. Locked after the first pick unless the player holds
   * a respec token (one is granted on first reaching level 10); using a
   * token consumes it and the choice is audited in the XP feed.
   */
  async selectCharacter(userId: string, key: string): Promise<PlayerProfile> {
    const character = findCharacter(key);
    if (!character) {
      throw new Error(`Unknown character archetype: ${key}`);
    }
    return this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const lock = await client.query(
        `SELECT character_key, respec_tokens FROM player_profiles
         WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const currentKey = (lock.rows[0]?.character_key ?? null) as string | null;
      const tokens = Number(lock.rows[0]?.respec_tokens ?? 0);

      if (!canSelectCharacter(currentKey, tokens)) {
        throw new Error(
          'Character already selected. Respec tokens are granted at level ' +
            `${RESPEC_TOKEN_LEVEL} — reach it to change your archetype.`,
        );
      }
      if (currentKey !== null && currentKey === key) {
        throw new Error(`${character.name} is already your archetype.`);
      }

      if (currentKey !== null) {
        await client.query(
          `UPDATE player_profiles
           SET respec_tokens = respec_tokens - 1, updated_at = NOW()
           WHERE user_id = $1`,
          [userId],
        );
      } else {
        await client.query(
          `UPDATE player_profiles SET updated_at = NOW() WHERE user_id = $1`,
          [userId],
        );
      }
      await client.query(
        `UPDATE player_profiles SET character_key = $1 WHERE user_id = $2`,
        [key, userId],
      );
      this.logger.log(
        `Player ${userId} selected archetype "${key}"` +
          (currentKey ? ` (respec token used, was "${currentKey}")` : ''),
      );
      return this.getProfile(userId);
    });
  }

  /** The caller's selected archetype, or undefined when none chosen yet. */
  async getSelectedCharacter(userId: string): Promise<CharacterArchetype | undefined> {
    const row = await this.db.queryOne<{ character_key: string | null }>(
      `SELECT character_key FROM player_profiles WHERE user_id = $1`,
      [userId],
    );
    return findCharacter(row?.character_key);
  }

  async getCharactersConfig(): Promise<CharactersConfig> {
    return getConfigValue<CharactersConfig>(
      this.db,
      'rpg.characters',
      DEFAULT_CHARACTERS_CONFIG,
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
