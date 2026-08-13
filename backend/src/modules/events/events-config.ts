/**
 * Events configuration (PDF Phase 7 §25–§30). Stored in `game_config` under
 * `rpg.events`; the code defaults apply when the row is absent or a key is
 * missing, so the module always has a working configuration. Keep this file
 * in sync with the seed in `backend/migrations/025_study_events.sql`.
 */

export interface StudyPassReward {
  stp?: number;
  /** Loot-box type key (see `lootBoxes`). */
  loot?: string;
  /** Event item slug (e.g. `abstracted_fragment`). */
  item?: string;
  /** Event card key (see EVENT_CARD_DEFINITIONS). */
  card?: string;
}

export interface EventsConfig {
  goldCost: number;
  /** 14 StudyPass level thresholds — cumulative event EXP. */
  studyPassLevels: number[];
  expByActivity: Record<string, number>;
  fallback: {
    slug: string;
    name: string;
    durationDays: number;
    graceHours: number;
  };
  abstracted: {
    slug: string;
    name: string;
    abilityCostMana: number;
    unabstractStp: number;
    errorsForLimbo: number;
    limboRewardCard: string;
    defaultLegendaryResultKey: string;
    freeTrack: StudyPassReward[];
    goldTrack: StudyPassReward[];
  };
  extinction: {
    slug: string;
    name: string;
    targetCount: number;
    commonRareTargets: number;
    legendaryTargets: number;
    sigilItemSlug: string;
  };
  lootBoxes: Record<string, { label: string; weights: Record<string, number> }>;
}

export const DEFAULT_EVENTS_CONFIG: EventsConfig = {
  goldCost: 1500,
  studyPassLevels: [0, 100, 200, 300, 400, 550, 700, 900, 1100, 1300, 1450, 1550, 1650, 1750],
  expByActivity: {
    task_completed: 25,
    study_session: 10,
    quiz_attempt: 30,
    puzzle_solved: 20,
    battle_win: 40,
    boss_win: 120,
  },
  fallback: { slug: 'study-sprint', name: 'Study Sprint', durationDays: 14, graceHours: 48 },
  abstracted: {
    slug: 'abstracted',
    name: 'Abstracted',
    abilityCostMana: 40,
    unabstractStp: 500,
    errorsForLimbo: 7,
    limboRewardCard: 'limbo_warden',
    defaultLegendaryResultKey: 'awakened_guardian',
    freeTrack: [
      { stp: 100 },
      { loot: 'normal' },
      { stp: 75 },
      { loot: 'common' },
      { stp: 125 },
      { loot: 'uncommon' },
      { stp: 200 },
      { loot: 'rare' },
      { stp: 100, loot: 'normal' },
      { item: 'abstracted_fragment' },
      { card: 'event_echo_courier' },
      { stp: 300 },
      { loot: 'epic_chance' },
      { card: 'abstracted_recluse' },
    ],
    goldTrack: [
      { stp: 200 },
      { loot: 'boosted' },
      { loot: 'event' },
      { stp: 200 },
      { card: 'event_echo_courier' },
      { loot: 'rare' },
      { stp: 300 },
      { card: 'event_sigil_warden' },
      { stp: 150, loot: 'boosted' },
      { loot: 'epic_chance' },
      { card: 'event_echo_courier', stp: 200 },
      { stp: 500 },
      { loot: 'legendary_chance' },
      { card: 'abstracted_recluse' },
    ],
  },
  extinction: {
    slug: 'great-extinction',
    name: 'The Great Extinction',
    targetCount: 10,
    commonRareTargets: 5,
    legendaryTargets: 5,
    sigilItemSlug: 'extinction_sigil',
  },
  lootBoxes: {
    normal: { label: 'Normal Loot Box', weights: { common: 70, rare: 25, legendary: 5 } },
    common: { label: 'Common Loot Box', weights: { common: 55, rare: 35, legendary: 10 } },
    uncommon: { label: 'Uncommon+ Loot Box', weights: { common: 40, rare: 45, legendary: 15 } },
    boosted: { label: 'Boosted Loot Box', weights: { common: 30, rare: 50, legendary: 20 } },
    event: { label: 'Event Loot Box', weights: { common: 25, rare: 50, legendary: 25 } },
    rare: { label: 'Rare Loot Box', weights: { common: 10, rare: 60, legendary: 30 } },
    epic_chance: {
      label: 'Epic-Chance Event Loot Box',
      weights: { common: 0, rare: 45, legendary: 55 },
    },
    legendary_chance: {
      label: 'Legendary-Chance Event Loot Box',
      weights: { common: 0, rare: 25, legendary: 75 },
    },
  },
};

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : fallback;
}

function toLevels(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length === 0) return [...fallback];
  const levels = value.map((v) => Number(v));
  return levels.every((n) => Number.isFinite(n) && n >= 0) ? levels : [...fallback];
}

function toRewards(value: unknown, fallback: StudyPassReward[]): StudyPassReward[] {
  if (!Array.isArray(value)) return fallback.map((r) => ({ ...r }));
  const rewards = value
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      stp: r.stp !== undefined ? toInt(r.stp, 0) : undefined,
      loot: typeof r.loot === 'string' ? r.loot : undefined,
      item: typeof r.item === 'string' ? r.item : undefined,
      card: typeof r.card === 'string' ? r.card : undefined,
    }));
  return rewards.length >= 1 ? rewards : fallback.map((r) => ({ ...r }));
}

/** Deep-merges the parsed `game_config` value over the defaults. */
export function mergeEventsConfig(raw: unknown): EventsConfig {
  const value =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>);

  const abstracted = (value.abstracted ?? {}) as Record<string, unknown>;
  const extinction = (value.extinction ?? {}) as Record<string, unknown>;
  const fallback = (value.fallback ?? {}) as Record<string, unknown>;

  return {
    goldCost: toInt(value.goldCost, DEFAULT_EVENTS_CONFIG.goldCost),
    studyPassLevels: toLevels(value.studyPassLevels, DEFAULT_EVENTS_CONFIG.studyPassLevels),
    expByActivity: Object.fromEntries(
      Object.entries({
        ...DEFAULT_EVENTS_CONFIG.expByActivity,
        ...((value.expByActivity ?? {}) as Record<string, unknown>),
      }).map(([key, v]) => [key, Number(v)]),
    ) as Record<string, number>,
    fallback: {
      slug: typeof fallback.slug === 'string' ? fallback.slug : DEFAULT_EVENTS_CONFIG.fallback.slug,
      name: typeof fallback.name === 'string' ? fallback.name : DEFAULT_EVENTS_CONFIG.fallback.name,
      durationDays: toInt(fallback.durationDays, DEFAULT_EVENTS_CONFIG.fallback.durationDays),
      graceHours: toInt(fallback.graceHours, DEFAULT_EVENTS_CONFIG.fallback.graceHours),
    },
    abstracted: {
      slug:
        typeof abstracted.slug === 'string'
          ? abstracted.slug
          : DEFAULT_EVENTS_CONFIG.abstracted.slug,
      name:
        typeof abstracted.name === 'string'
          ? abstracted.name
          : DEFAULT_EVENTS_CONFIG.abstracted.name,
      abilityCostMana: toInt(
        abstracted.abilityCostMana,
        DEFAULT_EVENTS_CONFIG.abstracted.abilityCostMana,
      ),
      unabstractStp: toInt(
        abstracted.unabstractStp,
        DEFAULT_EVENTS_CONFIG.abstracted.unabstractStp,
      ),
      errorsForLimbo: toInt(
        abstracted.errorsForLimbo,
        DEFAULT_EVENTS_CONFIG.abstracted.errorsForLimbo,
      ),
      limboRewardCard:
        typeof abstracted.limboRewardCard === 'string'
          ? abstracted.limboRewardCard
          : DEFAULT_EVENTS_CONFIG.abstracted.limboRewardCard,
      defaultLegendaryResultKey:
        typeof abstracted.defaultLegendaryResultKey === 'string'
          ? abstracted.defaultLegendaryResultKey
          : DEFAULT_EVENTS_CONFIG.abstracted.defaultLegendaryResultKey,
      freeTrack: toRewards(abstracted.freeTrack, DEFAULT_EVENTS_CONFIG.abstracted.freeTrack),
      goldTrack: toRewards(abstracted.goldTrack, DEFAULT_EVENTS_CONFIG.abstracted.goldTrack),
    },
    extinction: {
      slug:
        typeof extinction.slug === 'string'
          ? extinction.slug
          : DEFAULT_EVENTS_CONFIG.extinction.slug,
      name:
        typeof extinction.name === 'string'
          ? extinction.name
          : DEFAULT_EVENTS_CONFIG.extinction.name,
      targetCount: toInt(extinction.targetCount, DEFAULT_EVENTS_CONFIG.extinction.targetCount),
      commonRareTargets: toInt(
        extinction.commonRareTargets,
        DEFAULT_EVENTS_CONFIG.extinction.commonRareTargets,
      ),
      legendaryTargets: toInt(
        extinction.legendaryTargets,
        DEFAULT_EVENTS_CONFIG.extinction.legendaryTargets,
      ),
      sigilItemSlug:
        typeof extinction.sigilItemSlug === 'string'
          ? extinction.sigilItemSlug
          : DEFAULT_EVENTS_CONFIG.extinction.sigilItemSlug,
    },
    lootBoxes: Object.fromEntries(
      Object.entries(DEFAULT_EVENTS_CONFIG.lootBoxes).map(([key, box]) => {
        const custom = (value.lootBoxes ?? {}) as Record<string, unknown>;
        const override = custom[key] as Record<string, unknown> | undefined;
        const mergedWeights = {
          ...box.weights,
          ...((override?.weights ?? {}) as Record<string, unknown>),
        };
        return [
          key,
          {
            label: typeof override?.label === 'string' ? override.label : box.label,
            weights: Object.fromEntries(
              Object.entries(mergedWeights).map(([k, w]) => [k, Number(w)]),
            ) as Record<string, number>,
          },
        ];
      }),
    ) as Record<string, { label: string; weights: Record<string, number> }>,
  };
}
