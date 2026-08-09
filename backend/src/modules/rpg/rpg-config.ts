import { DatabaseService } from '../database/database.service';

/**
 * Reads a config-driven value from `game_config` (master prompt §12/§14).
 * Falls back to the supplied default when the row is missing or invalid.
 */
export async function getConfigValue<T>(db: DatabaseService, key: string, fallback: T): Promise<T> {
  const row = await db.queryOne<{ value: unknown }>(
    'SELECT value FROM game_config WHERE key = $1',
    [key],
  );
  if (!row) {
    return fallback;
  }
  try {
    return row.value as T;
  } catch {
    return fallback;
  }
}

export interface LevelConfig {
  thresholds: number[];
}

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  thresholds: [
    0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000, 13000, 16500, 20000, 24000,
    28500, 33500, 39000, 45000, 52000,
  ],
};

export interface RewardConfig {
  battleWinXp: number;
  battleWinStp: number;
  battleLossXp: number;
  dailyBattleRewardLimit: number;
  dailyRewardLimitStp: number;
  dailyRewardLimitXp: number;
}

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  battleWinXp: 50,
  battleWinStp: 40,
  battleLossXp: 15,
  dailyBattleRewardLimit: 10,
  dailyRewardLimitStp: 200,
  dailyRewardLimitXp: 300,
};
