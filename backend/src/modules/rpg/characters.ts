/**
 * Playable character archetypes (completion plan T9). All original — names,
 * lore and art belong to Study RPG.
 *
 * Modifiers are DATA (seeded into `game_config.rpg.characters`) so future
 * systems can adopt them without new migrations. Currently consumed:
 *   - xpBonusPct / xpTypeBonus → PlayerService.addXp
 *   - battleMaxHpBonus         → BattleService (PvE battles)
 * Declared for upcoming consumers (config is already in place):
 *   - pvpStartRatingBonus      → PvP matchmaking baseline
 *   - burnValueBonusPct        → card burner/scrapper value
 *   - streakShieldBonus        → streak-shield economy
 */

export interface CharacterModifiers {
  /** Percentage bonus applied to every XP gain (rounded down). */
  xpBonusPct: number;
  /** Extra percentage XP for specific award types, e.g. { problem_solved: 10 }. */
  xpTypeBonus: Record<string, number>;
  /** Flat bonus to starting max HP in PvE battles. */
  battleMaxHpBonus: number;
  /** Bonus added to the PvP baseline rating when duels settle. */
  pvpStartRatingBonus: number;
  /** Percentage bonus to STP gained from burning/scraping cards. */
  burnValueBonusPct: number;
  /** Extra streak shields granted by the streak economy. */
  streakShieldBonus: number;
}

export interface CharacterArchetype {
  key: string;
  name: string;
  title: string;
  lore: string;
  accentColor: string;
  modifiers: CharacterModifiers;
}

export const ZERO_MODIFIERS: CharacterModifiers = {
  xpBonusPct: 0,
  xpTypeBonus: {},
  battleMaxHpBonus: 0,
  pvpStartRatingBonus: 0,
  burnValueBonusPct: 0,
  streakShieldBonus: 0,
};

export const CHARACTERS: CharacterArchetype[] = [
  {
    key: 'lorekeeper',
    name: 'Wren, the Lorekeeper',
    title: 'Memory archivist',
    lore:
      'Keeps a ledger of everything ever learned and refuses to let facts fade. ' +
      'Every lesson revisited pays a little more.',
    accentColor: '#7c5cff',
    modifiers: { ...ZERO_MODIFIERS, xpBonusPct: 5 },
  },
  {
    key: 'focuser',
    name: 'Tomas, the Focuser',
    title: 'Deep-work sentinel',
    lore:
      'Trained in the old art of the untouched timer. Enters every battle rested, ' +
      'patient and harder to knock off balance.',
    accentColor: '#16a34a',
    modifiers: { ...ZERO_MODIFIERS, battleMaxHpBonus: 20 },
  },
  {
    key: 'solver',
    name: 'Ines, the Solver',
    title: 'Problem hunter',
    lore:
      'Believes every hard question is a monster wearing a costume. Problems and ' +
      'quizzes feed her faster than any other path.',
    accentColor: '#ea580c',
    modifiers: { ...ZERO_MODIFIERS, xpTypeBonus: { problem_solved: 10, quiz_completed: 5 } },
  },
  {
    key: 'duelist',
    name: 'Kai, the Duelist',
    title: 'Rating climber',
    lore:
      'Reads opponents like exam papers — skim the questions first. Steps onto the ' +
      'ladder with a head start over the field.',
    accentColor: '#dc2626',
    modifiers: { ...ZERO_MODIFIERS, pvpStartRatingBonus: 50 },
  },
  {
    key: 'alchemist',
    name: 'Sable, the Alchemist',
    title: 'Value distiller',
    lore:
      'Turns forgotten cards into pure essence. Where others see dust, Sable sees ' +
      'a better exchange rate.',
    accentColor: '#d97706',
    modifiers: { ...ZERO_MODIFIERS, burnValueBonusPct: 15 },
  },
  {
    key: 'warden',
    name: 'Petra, the Warden',
    title: 'Streak guardian',
    lore:
      'Swore an oath at the campfire: no streak breaks on her watch. Study habits ' +
      'under her protection simply last longer.',
    accentColor: '#2563eb',
    modifiers: { ...ZERO_MODIFIERS, streakShieldBonus: 2, battleMaxHpBonus: 10 },
  },
];

/** The level at which every player receives one free respec token. */
export const RESPEC_TOKEN_LEVEL = 10;

/** Shape stored under game_config key 'rpg.characters'. */
export interface CharactersConfig {
  respecTokenLevel: number;
  characters: CharacterArchetype[];
}

export const DEFAULT_CHARACTERS_CONFIG: CharactersConfig = {
  respecTokenLevel: RESPEC_TOKEN_LEVEL,
  characters: CHARACTERS,
};

export function findCharacter(key: string | null | undefined): CharacterArchetype | undefined {
  if (!key) return undefined;
  return CHARACTERS.find((c) => c.key === key);
}

/**
 * Apply an archetype's XP modifiers to a raw award.
 *   total = base * (1 + xpBonusPct/100 + typeBonus/100), floored to int.
 */
export function applyXpModifiers(
  baseXp: number,
  character: CharacterArchetype | undefined,
  awardType: string,
): number {
  if (!character || baseXp <= 0) return baseXp;
  const m = character.modifiers;
  const typeBonus = m.xpTypeBonus[awardType] ?? m.xpTypeBonus['*'] ?? 0;
  const pct = m.xpBonusPct + typeBonus;
  if (pct === 0) return baseXp;
  return Math.floor(baseXp * (1 + pct / 100));
}

/** Starting max HP for a PvE battle under this archetype. */
export function battleMaxHp(baseMaxHp: number, character?: CharacterArchetype): number {
  if (!character) return baseMaxHp;
  return baseMaxHp + character.modifiers.battleMaxHpBonus;
}

/**
 * Selection rule: a character may be chosen when none is set yet, or when the
 * player holds at least one respec token (granted on first reaching the token
 * level; each use consumes one token).
 */
export function canSelectCharacter(
  currentKey: string | null,
  respecTokens: number,
): boolean {
  return currentKey === null || currentKey === undefined || respecTokens > 0;
}
