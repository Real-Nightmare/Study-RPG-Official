export { IntegrityModule } from './integrity.module';
export { CampfireService } from './campfire.service';
export type { CampfireView, CampfireStatusView, CampfireSourceKind } from './campfire.service';
export {
  computeReward,
  accuracyFactor,
  focusFactor,
  difficultyFactor,
  campfireMultiplier,
  passesPremiumThreshold,
} from './reward-curve';
export type { RewardInput, MaterialDifficulty } from './reward-curve';
export {
  rateLimited,
  remainingInWindow,
  answerTimeSanity,
  verifyFocusSession,
  clampDailyFocus,
} from './behavior-guard';
export {
  getIntegrityConfig,
  mergeIntegrityConfig,
  DEFAULT_INTEGRITY_CONFIG,
} from './integrity-config';
export type { IntegrityConfig, OverStudyConfig } from './integrity-config';
export {
  overStudyFactor,
  restRequired,
  minutesUntilRestAllowed,
  isNightHour,
  studyHealth,
  dailyBudgetRemaining,
  istHour,
} from './overstudy';
export type {
  OverStudyOptions,
  CompletedSession,
  StudyHealthBand,
  StudyHealthView,
} from './overstudy';
