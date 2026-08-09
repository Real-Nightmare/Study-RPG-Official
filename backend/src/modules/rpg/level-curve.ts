/**
 * Config-driven level progression (master prompt §12).
 * Thresholds come from game_config; this pure helper maps XP → level.
 */
export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  totalXp: number;
}

export function levelFromXp(totalXp: number, thresholds: number[]): LevelInfo {
  const sorted = [...thresholds].sort((a, b) => a - b);
  let level = 1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (totalXp >= sorted[i]) {
      level = i + 1;
      break;
    }
  }
  const currentLevelXp = sorted[Math.max(0, level - 1)] ?? 0;
  const nextLevelXp = sorted[level] ?? currentLevelXp + 2500;
  return { level, currentLevelXp, nextLevelXp, totalXp };
}
