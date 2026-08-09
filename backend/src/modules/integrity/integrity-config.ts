/**
 * Integrity configuration (spec 014). Stored in `game_config` under
 * `rpg.integrity`; the code defaults apply when the row is absent or a key is
 * missing, so the module always has a working configuration. Keep this file in
 * sync with the seed in `backend/migrations/028_study_integrity.sql`.
 */
import { DatabaseService } from '../database/database.service';

export interface IntegrityRewardConfig {
  quiz: { baseXp: number; stpPassThreshold: number; stpOnPass: number; dailyStpCap: number };
  exam: {
    baseXp: number;
    stpPassThreshold: number;
    stpOnPass: number;
    dailyStpCap: number;
    dailyAttemptCap: number;
  };
  teachBack: {
    baseXp: number;
    stpPassThreshold: number;
    stpOnPass: number;
    dailyStpCap: number;
    minExplanationChars: number;
  };
  battle: { integrityFloor: number; maxPremiumMultiplier: number };
}

export interface IntegrityGuardConfig {
  quizAttemptsPerHour: number;
  minMsPerQuestion: number;
  examAttemptsPerDay: number;
  focusDailyCapMinutes: number;
  focusMinMinutes: number;
  focusUnverifiedExpFactor: number;
  focusEngagementWindowMinutes: number;
}

export interface CampfireConfig {
  maxPerDay: number;
  depthForFullMultiplier: number;
  maxMultiplier: number;
  baseMultiplier: number;
  minAnswerChars: number;
}

/**
 * Anti-overstudy / health-first configuration (spec 015). The reward economy
 * deliberately makes excess studying *less* rewarding so the game teaches
 * smarter studying — spaced, bounded, rested — instead of grinding.
 */
export interface OverStudyConfig {
  /** Focus minutes per day that earn full rewards (the healthy optimum). */
  optimalDailyMinutes: number;
  /** After this many minutes, rewards start decaying linearly. */
  decayStartMinutes: number;
  /** Absolute stop: no new focus sessions may start once this is reached. */
  hardDailyCapMinutes: number;
  /** Reward floor factor once the hard cap is reached (heavily dampened). */
  minFactor: number;
  /** Rest window a student must observe after a long study block. */
  sessionCooldownMinutes: number;
  /** A completed session this long (minutes) triggers the cooldown. */
  cooldownAfterMinutes: number;
  /** IST hour (0-23) at which night study begins. */
  nightStartHour: number;
  /** IST hour (0-23) at which night study ends. */
  nightEndHour: number;
  /** Reward multiplier applied to night-window study activity. */
  nightFactor: number;
}

export interface IntegrityConfig {
  rewards: IntegrityRewardConfig;
  guards: IntegrityGuardConfig;
  campfire: CampfireConfig;
  overStudy: OverStudyConfig;
}

export const DEFAULT_INTEGRITY_CONFIG: IntegrityConfig = {
  rewards: {
    quiz: { baseXp: 12, stpPassThreshold: 90, stpOnPass: 25, dailyStpCap: 75 },
    exam: {
      baseXp: 30,
      stpPassThreshold: 80,
      stpOnPass: 40,
      dailyStpCap: 120,
      dailyAttemptCap: 5,
    },
    teachBack: {
      baseXp: 30,
      stpPassThreshold: 70,
      stpOnPass: 30,
      dailyStpCap: 60,
      minExplanationChars: 80,
    },
    battle: { integrityFloor: 0.6, maxPremiumMultiplier: 2.0 },
  },
  guards: {
    quizAttemptsPerHour: 12,
    minMsPerQuestion: 4000,
    examAttemptsPerDay: 5,
    focusDailyCapMinutes: 240,
    focusMinMinutes: 10,
    focusUnverifiedExpFactor: 0.35,
    focusEngagementWindowMinutes: 120,
  },
  campfire: {
    maxPerDay: 3,
    depthForFullMultiplier: 80,
    maxMultiplier: 1.5,
    baseMultiplier: 1.0,
    minAnswerChars: 60,
  },
  overStudy: {
    optimalDailyMinutes: 120,
    decayStartMinutes: 120,
    hardDailyCapMinutes: 240,
    minFactor: 0.1,
    sessionCooldownMinutes: 20,
    cooldownAfterMinutes: 60,
    nightStartHour: 22,
    nightEndHour: 6,
    nightFactor: 0.5,
  },
};

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : fallback;
}

function toNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Deep-merges the parsed `game_config` value over the defaults. */
export function mergeIntegrityConfig(raw: unknown): IntegrityConfig {
  const value =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>);

  const rewards = (value.rewards ?? {}) as Record<string, unknown>;
  const quiz = (rewards.quiz ?? {}) as Record<string, unknown>;
  const exam = (rewards.exam ?? {}) as Record<string, unknown>;
  const teachBack = (rewards.teachBack ?? {}) as Record<string, unknown>;
  const battle = (rewards.battle ?? {}) as Record<string, unknown>;

  const guards = (value.guards ?? {}) as Record<string, unknown>;
  const campfire = (value.campfire ?? {}) as Record<string, unknown>;
  const overStudy = (value.overStudy ?? {}) as Record<string, unknown>;

  return {
    rewards: {
      quiz: {
        baseXp: toInt(quiz.baseXp, DEFAULT_INTEGRITY_CONFIG.rewards.quiz.baseXp),
        stpPassThreshold: toInt(
          quiz.stpPassThreshold,
          DEFAULT_INTEGRITY_CONFIG.rewards.quiz.stpPassThreshold,
        ),
        stpOnPass: toInt(quiz.stpOnPass, DEFAULT_INTEGRITY_CONFIG.rewards.quiz.stpOnPass),
        dailyStpCap: toInt(quiz.dailyStpCap, DEFAULT_INTEGRITY_CONFIG.rewards.quiz.dailyStpCap),
      },
      exam: {
        baseXp: toInt(exam.baseXp, DEFAULT_INTEGRITY_CONFIG.rewards.exam.baseXp),
        stpPassThreshold: toInt(
          exam.stpPassThreshold,
          DEFAULT_INTEGRITY_CONFIG.rewards.exam.stpPassThreshold,
        ),
        stpOnPass: toInt(exam.stpOnPass, DEFAULT_INTEGRITY_CONFIG.rewards.exam.stpOnPass),
        dailyStpCap: toInt(exam.dailyStpCap, DEFAULT_INTEGRITY_CONFIG.rewards.exam.dailyStpCap),
        dailyAttemptCap: toInt(
          exam.dailyAttemptCap,
          DEFAULT_INTEGRITY_CONFIG.rewards.exam.dailyAttemptCap,
        ),
      },
      teachBack: {
        baseXp: toInt(teachBack.baseXp, DEFAULT_INTEGRITY_CONFIG.rewards.teachBack.baseXp),
        stpPassThreshold: toInt(
          teachBack.stpPassThreshold,
          DEFAULT_INTEGRITY_CONFIG.rewards.teachBack.stpPassThreshold,
        ),
        stpOnPass: toInt(teachBack.stpOnPass, DEFAULT_INTEGRITY_CONFIG.rewards.teachBack.stpOnPass),
        dailyStpCap: toInt(
          teachBack.dailyStpCap,
          DEFAULT_INTEGRITY_CONFIG.rewards.teachBack.dailyStpCap,
        ),
        minExplanationChars: toInt(
          teachBack.minExplanationChars,
          DEFAULT_INTEGRITY_CONFIG.rewards.teachBack.minExplanationChars,
        ),
      },
      battle: {
        integrityFloor: toNum(
          battle.integrityFloor,
          DEFAULT_INTEGRITY_CONFIG.rewards.battle.integrityFloor,
        ),
        maxPremiumMultiplier: toNum(
          battle.maxPremiumMultiplier,
          DEFAULT_INTEGRITY_CONFIG.rewards.battle.maxPremiumMultiplier,
        ),
      },
    },
    guards: {
      quizAttemptsPerHour: toInt(
        guards.quizAttemptsPerHour,
        DEFAULT_INTEGRITY_CONFIG.guards.quizAttemptsPerHour,
      ),
      minMsPerQuestion: toInt(
        guards.minMsPerQuestion,
        DEFAULT_INTEGRITY_CONFIG.guards.minMsPerQuestion,
      ),
      examAttemptsPerDay: toInt(
        guards.examAttemptsPerDay,
        DEFAULT_INTEGRITY_CONFIG.guards.examAttemptsPerDay,
      ),
      focusDailyCapMinutes: toInt(
        guards.focusDailyCapMinutes,
        DEFAULT_INTEGRITY_CONFIG.guards.focusDailyCapMinutes,
      ),
      focusMinMinutes: toInt(
        guards.focusMinMinutes,
        DEFAULT_INTEGRITY_CONFIG.guards.focusMinMinutes,
      ),
      focusUnverifiedExpFactor: toNum(
        guards.focusUnverifiedExpFactor,
        DEFAULT_INTEGRITY_CONFIG.guards.focusUnverifiedExpFactor,
      ),
      focusEngagementWindowMinutes: toInt(
        guards.focusEngagementWindowMinutes,
        DEFAULT_INTEGRITY_CONFIG.guards.focusEngagementWindowMinutes,
      ),
    },
    campfire: {
      maxPerDay: toInt(campfire.maxPerDay, DEFAULT_INTEGRITY_CONFIG.campfire.maxPerDay),
      depthForFullMultiplier: toInt(
        campfire.depthForFullMultiplier,
        DEFAULT_INTEGRITY_CONFIG.campfire.depthForFullMultiplier,
      ),
      maxMultiplier: toNum(campfire.maxMultiplier, DEFAULT_INTEGRITY_CONFIG.campfire.maxMultiplier),
      baseMultiplier: toNum(
        campfire.baseMultiplier,
        DEFAULT_INTEGRITY_CONFIG.campfire.baseMultiplier,
      ),
      minAnswerChars: toInt(
        campfire.minAnswerChars,
        DEFAULT_INTEGRITY_CONFIG.campfire.minAnswerChars,
      ),
    },
    overStudy: {
      optimalDailyMinutes: toInt(
        overStudy.optimalDailyMinutes,
        DEFAULT_INTEGRITY_CONFIG.overStudy.optimalDailyMinutes,
      ),
      decayStartMinutes: toInt(
        overStudy.decayStartMinutes,
        DEFAULT_INTEGRITY_CONFIG.overStudy.decayStartMinutes,
      ),
      hardDailyCapMinutes: toInt(
        overStudy.hardDailyCapMinutes,
        DEFAULT_INTEGRITY_CONFIG.overStudy.hardDailyCapMinutes,
      ),
      minFactor: toNum(overStudy.minFactor, DEFAULT_INTEGRITY_CONFIG.overStudy.minFactor),
      sessionCooldownMinutes: toInt(
        overStudy.sessionCooldownMinutes,
        DEFAULT_INTEGRITY_CONFIG.overStudy.sessionCooldownMinutes,
      ),
      cooldownAfterMinutes: toInt(
        overStudy.cooldownAfterMinutes,
        DEFAULT_INTEGRITY_CONFIG.overStudy.cooldownAfterMinutes,
      ),
      nightStartHour: toInt(
        overStudy.nightStartHour,
        DEFAULT_INTEGRITY_CONFIG.overStudy.nightStartHour,
      ),
      nightEndHour: toInt(
        overStudy.nightEndHour,
        DEFAULT_INTEGRITY_CONFIG.overStudy.nightEndHour,
      ),
      nightFactor: toNum(overStudy.nightFactor, DEFAULT_INTEGRITY_CONFIG.overStudy.nightFactor),
    },
  };
}

/** Reads `rpg.integrity` from game_config, merged over the code defaults. */
export async function getIntegrityConfig(db: DatabaseService): Promise<IntegrityConfig> {
  const row = await db.queryOne<{ value: unknown }>(
    "SELECT value FROM game_config WHERE key = 'rpg.integrity'",
  );
  return mergeIntegrityConfig(row?.value ?? DEFAULT_INTEGRITY_CONFIG);
}
