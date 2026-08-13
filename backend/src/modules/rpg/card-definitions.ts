/**
 * Original Study RPG cards (master prompt §13.7). Abilities are data-driven —
 * key, name, category, description, mana cost, damage, healing, duration,
 * cooldown, target, stack policy, status effect, trigger, restrictions and
 * balance version. All cards are original; no third-party content.
 */
export interface StatusEffectDefinition {
  type:
    | 'poison'
    | 'decay'
    | 'burn'
    | 'bleed'
    | 'shield'
    | 'silence'
    | 'stun'
    | 'buff'
    | 'debuff'
    | 'resistance';
  duration: number;
  damagePerTurn?: number;
  shieldValue?: number;
}

export interface Ability {
  key: string;
  name: string;
  category:
    | 'attack'
    | 'poison'
    | 'decay'
    | 'burn'
    | 'bleed'
    | 'shield'
    | 'heal'
    | 'mana'
    | 'drain'
    | 'cleanse'
    | 'reflect'
    | 'dodge'
    | 'silence'
    | 'stun'
    | 'resistance'
    | 'buff'
    | 'debuff'
    | 'abstracted';
  description: string;
  manaCost: number;
  damage?: number;
  healing?: number;
  duration?: number;
  cooldown?: number;
  target: 'enemy' | 'self' | 'all';
  stackPolicy: 'none' | 'stack' | 'replace';
  statusEffect?: StatusEffectDefinition;
  trigger?: string;
  /** Restricted ability keys: only one card with each such key per deck (§13.2). */
  restrictions?: string[];
  balanceVersion: string;
}

export interface CardDefinition {
  key: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  category: Ability['category'];
  ability: Ability;
  lore: string;
  balanceVersion: string;
}

export interface CardInHand {
  instanceId: string;
  cardKey: string;
  ability: Ability;
}

export interface BattleDefaults {
  maxHp: number;
  maxMana: number;
  deckSize: number;
  normalAbilityManaCost: number;
  abstractedAbilityManaCost: number;
  shieldTurns: number;
  manaQuizQuestions: number;
  manaPerCorrect: number;
  manaQuizMaxRestore: number;
  damageChallengeQuestions: number;
  damageChallengeBonus: number;
  basicAttackDamage: number;
  poisonBonus: number;
}

export const DEFAULT_BATTLE_DEFAULTS: BattleDefaults = {
  maxHp: 100,
  maxMana: 100,
  deckSize: 5,
  normalAbilityManaCost: 20,
  abstractedAbilityManaCost: 40,
  shieldTurns: 2,
  manaQuizQuestions: 5,
  manaPerCorrect: 4,
  manaQuizMaxRestore: 20,
  damageChallengeQuestions: 5,
  damageChallengeBonus: 10,
  basicAttackDamage: 10,
  poisonBonus: 10,
};

/** Original starter set. Restricted abilities: one poison, one shield per deck. */
export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    key: 'mana_slash',
    name: 'Mana Slash',
    rarity: 'common',
    category: 'attack',
    ability: {
      key: 'mana_slash',
      name: 'Mana Slash',
      category: 'attack',
      description: 'A focused strike charged with focused recall.',
      manaCost: 20,
      damage: 10,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'A blade drawn from a perfectly memorised formula.',
    balanceVersion: '1.0',
  },
  {
    key: 'study_burst',
    name: 'Study Burst',
    rarity: 'common',
    category: 'attack',
    ability: {
      key: 'study_burst',
      name: 'Study Burst',
      category: 'attack',
      description: 'Release a stored revision session in one blow.',
      manaCost: 20,
      damage: 14,
      cooldown: 2,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Three hours of notes, compressed into a single moment.',
    balanceVersion: '1.0',
  },
  {
    key: 'poison_vial',
    name: 'Poison Vial',
    rarity: 'common',
    category: 'poison',
    ability: {
      key: 'poison_vial',
      name: 'Poison Vial',
      category: 'poison',
      description: 'Poisons the monster: +10 to attacks and damage over time.',
      manaCost: 20,
      duration: 3,
      target: 'enemy',
      stackPolicy: 'replace',
      statusEffect: { type: 'poison', duration: 3, damagePerTurn: 5 },
      restrictions: ['poison'],
      balanceVersion: '1.0',
    },
    lore: 'What you got wrong yesterday, weaponised.',
    balanceVersion: '1.0',
  },
  {
    key: 'decay_curse',
    name: 'Decay Curse',
    rarity: 'rare',
    category: 'decay',
    ability: {
      key: 'decay_curse',
      name: 'Decay Curse',
      category: 'decay',
      description: 'Rot the monster\u2019s defences with neglected revision.',
      manaCost: 25,
      duration: 3,
      target: 'enemy',
      stackPolicy: 'replace',
      statusEffect: { type: 'decay', duration: 3, damagePerTurn: 7 },
      restrictions: ['decay'],
      balanceVersion: '1.0',
    },
    lore: 'Knowledge not revisited slowly erodes.',
    balanceVersion: '1.0',
  },
  {
    key: 'focus_shield',
    name: 'Focus Shield',
    rarity: 'common',
    category: 'shield',
    ability: {
      key: 'focus_shield',
      name: 'Focus Shield',
      category: 'shield',
      description: 'Absorbs the next monster attacks; active for the first two turns.',
      manaCost: 20,
      duration: 2,
      target: 'self',
      stackPolicy: 'replace',
      statusEffect: { type: 'shield', duration: 2, shieldValue: 99 },
      restrictions: ['shield'],
      balanceVersion: '1.0',
    },
    lore: 'A wall of uninterrupted concentration.',
    balanceVersion: '1.0',
  },
  {
    key: 'revival_note',
    name: 'Revival Note',
    rarity: 'common',
    category: 'heal',
    ability: {
      key: 'revival_note',
      name: 'Revival Note',
      category: 'heal',
      description: 'Rewrite a mistake and recover health.',
      manaCost: 20,
      healing: 18,
      target: 'self',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Every corrected error is a small resurrection.',
    balanceVersion: '1.0',
  },
  {
    key: 'mana_battery',
    name: 'Mana Battery',
    rarity: 'rare',
    category: 'mana',
    ability: {
      key: 'mana_battery',
      name: 'Mana Battery',
      category: 'mana',
      description: 'Recover 25 mana from a completed practice set.',
      manaCost: 0,
      target: 'self',
      stackPolicy: 'none',
      cooldown: 3,
      balanceVersion: '1.0',
    },
    lore: 'Practice is fuel.',
    balanceVersion: '1.0',
  },
  {
    key: 'silence_pact',
    name: 'Silence Pact',
    rarity: 'rare',
    category: 'silence',
    ability: {
      key: 'silence_pact',
      name: 'Silence Pact',
      category: 'silence',
      description: 'Quiet the monster\u2019s abilities for two turns.',
      manaCost: 30,
      duration: 2,
      target: 'enemy',
      stackPolicy: 'replace',
      statusEffect: { type: 'silence', duration: 2 },
      restrictions: ['silence'],
      balanceVersion: '1.0',
    },
    lore: 'Distractions can be muted.',
    balanceVersion: '1.0',
  },
  {
    key: 'abstracted_recall',
    name: 'Abstracted Recall',
    rarity: 'legendary',
    category: 'abstracted',
    ability: {
      key: 'abstracted_recall',
      name: 'Abstracted Recall',
      category: 'abstracted',
      description: 'A legendary strike from deep memory.',
      manaCost: 40,
      damage: 30,
      cooldown: 3,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Seven fragments of every error ever corrected.',
    balanceVersion: '1.0',
  },
  // ---- Phase 6 blocky-style original cards (BlockTales-inspired vibe, all original) ----
  {
    key: 'blockbash',
    name: 'Sturdy Block Bash',
    rarity: 'common',
    category: 'attack',
    ability: {
      key: 'blockbash',
      name: 'Sturdy Block Bash',
      category: 'attack',
      description: 'A heavy cube swing that crushes hesitation.',
      manaCost: 15,
      damage: 12,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Every block has a memory. This one remembers all your skipped homework.',
    balanceVersion: '1.0',
  },
  {
    key: 'focuscookie',
    name: 'Cookie of Focus',
    rarity: 'rare',
    category: 'mana',
    ability: {
      key: 'focuscookie',
      name: 'Cookie of Focus',
      category: 'mana',
      description: 'Munch it and your mana snaps back to attention.',
      manaCost: 0,
      duration: 1,
      cooldown: 2,
      target: 'self',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Baked from 40-minute sprints and mint-flavoured determination.',
    balanceVersion: '1.0',
  },
  {
    key: 'eraserblade',
    name: 'Eraser Blade',
    rarity: 'rare',
    category: 'attack',
    ability: {
      key: 'eraserblade',
      name: 'Eraser Blade',
      category: 'attack',
      description: 'Wipes one mistake off the battlefield with a clean sweep.',
      manaCost: 20,
      damage: 16,
      cooldown: 1,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Duller than the pencil it once guarded, sharper than regret.',
    balanceVersion: '1.0',
  },
  {
    key: 'highlighter_wand',
    name: 'Highlighter Wand',
    rarity: 'rare',
    category: 'buff',
    ability: {
      key: 'highlighter_wand',
      name: 'Highlighter Wand',
      category: 'buff',
      description: 'Marks the key point: your next answers glow brighter.',
      manaCost: 18,
      duration: 2,
      cooldown: 2,
      target: 'self',
      stackPolicy: 'replace',
      statusEffect: { type: 'buff', duration: 2 },
      balanceVersion: '1.0',
    },
    lore: 'One swipe turns a wall of text into a target-rich environment.',
    balanceVersion: '1.0',
  },
  {
    key: 'sticky_note_shuriken',
    name: 'Sticky Note Shuriken',
    rarity: 'common',
    category: 'attack',
    ability: {
      key: 'sticky_note_shuriken',
      name: 'Sticky Note Shuriken',
      category: 'attack',
      description: 'Throws a note that sticks: reminder damage every turn.',
      manaCost: 16,
      damage: 8,
      duration: 2,
      cooldown: 2,
      target: 'enemy',
      stackPolicy: 'stack',
      statusEffect: { type: 'bleed', duration: 2, damagePerTurn: 3 },
      balanceVersion: '1.0',
    },
    lore: '“Don’t forget!” — the note reads, every single turn.',
    balanceVersion: '1.0',
  },
  {
    key: 'protractor_pauldron',
    name: 'Protractor Pauldron',
    rarity: 'rare',
    category: 'shield',
    ability: {
      key: 'protractor_pauldron',
      name: 'Protractor Pauldron',
      category: 'shield',
      description: 'Measures every incoming angle and blocks them.',
      manaCost: 18,
      duration: 2,
      cooldown: 3,
      target: 'self',
      stackPolicy: 'replace',
      statusEffect: { type: 'shield', duration: 2, shieldValue: 12 },
      balanceVersion: '1.0',
    },
    lore: '120° of pure geometric confidence.',
    balanceVersion: '1.0',
  },
];

const byKey = new Map(CARD_DEFINITIONS.map((c) => [c.key, c]));

export function getCardDefinition(key: string): CardDefinition {
  const card = byKey.get(key);
  if (!card) {
    throw new Error(`Unknown card definition: ${key}`);
  }
  return card;
}

/**
 * Original event-exclusive cards (PDF Phase 7 §28–§29). These are NOT seeded
 * by `syncDefinitions` — they are granted on demand by `grantEventCard` (the
 * definition and the first instance are inserted in the same transaction, so
 * an unowned event card can never be auto-extinguished by a supply reconcile).
 * All names, abilities and lore are original; no third-party content.
 */
export interface EventCardDefinition extends CardDefinition {
  tradable: boolean;
  burnable: boolean;
  scrapable: boolean;
}

export const EVENT_CARD_DEFINITIONS: EventCardDefinition[] = [
  {
    key: 'event_echo_courier',
    name: 'Echo Courier',
    rarity: 'rare',
    category: 'attack',
    ability: {
      key: 'echo_courier',
      name: 'Echo Step',
      category: 'attack',
      description:
        'A feint copied from a memory of a memory — lands where the enemy is about to be.',
      manaCost: 20,
      damage: 16,
      cooldown: 2,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'It delivers the punchline two turns before the joke is told.',
    balanceVersion: '1.0',
    tradable: false,
    burnable: true,
    scrapable: true,
  },
  {
    key: 'event_sigil_warden',
    name: 'Sigil Warden',
    rarity: 'rare',
    category: 'shield',
    ability: {
      key: 'sigil_warden',
      name: 'Warden Sigil',
      category: 'shield',
      description: 'A vow inscribed in chalk — blocks the next wave of mistakes.',
      manaCost: 18,
      duration: 2,
      cooldown: 3,
      target: 'self',
      stackPolicy: 'replace',
      statusEffect: { type: 'shield', duration: 2, shieldValue: 14 },
      balanceVersion: '1.0',
    },
    lore: 'Every strike it turns aside was once a wrong answer.',
    balanceVersion: '1.0',
    tradable: false,
    burnable: true,
    scrapable: true,
  },
  {
    key: 'abstracted_recluse',
    name: 'Void Recluse',
    rarity: 'legendary',
    category: 'abstracted',
    ability: {
      key: 'abstracted_recluse',
      name: 'Abstracted Recall',
      category: 'abstracted',
      description:
        'Pulls knowledge straight from the glitch between pages — 40 Mana, and it reacts when the Recluse is struck.',
      manaCost: 40,
      damage: 42,
      cooldown: 3,
      target: 'enemy',
      stackPolicy: 'none',
      trigger: 'reacts-when-hit',
      balanceVersion: '1.0',
    },
    lore: 'The first card to remember a lesson the syllabus forgot.',
    balanceVersion: '1.0',
    tradable: false,
    burnable: false,
    scrapable: false,
  },
  {
    key: 'awakened_guardian',
    name: 'Awakened Guardian',
    rarity: 'legendary',
    category: 'buff',
    ability: {
      key: 'awakened_guardian',
      name: 'Guardian Awakening',
      category: 'buff',
      description: 'A sleeping concept wakes up sure of itself — boosts the whole study session.',
      manaCost: 22,
      duration: 3,
      cooldown: 3,
      target: 'self',
      stackPolicy: 'replace',
      statusEffect: { type: 'buff', duration: 3 },
      balanceVersion: '1.0',
    },
    lore: 'Every unabstracted card leaves a guardian behind to mind the seams.',
    balanceVersion: '1.0',
    tradable: false,
    burnable: false,
    scrapable: false,
  },
  {
    key: 'limbo_warden',
    name: 'Limbo Warden',
    rarity: 'legendary',
    category: 'drain',
    ability: {
      key: 'limbo_warden',
      name: 'Limbo Toll',
      category: 'drain',
      description:
        'Charges a toll in lost certainty — drains the enemy and repays you in confidence.',
      manaCost: 40,
      damage: 36,
      healing: 18,
      cooldown: 3,
      target: 'enemy',
      stackPolicy: 'none',
      balanceVersion: '1.0',
    },
    lore: 'Seven errors answered its knock. It remembered every one of them.',
    balanceVersion: '1.0',
    tradable: false,
    burnable: false,
    scrapable: false,
  },
];

const eventByKey = new Map(EVENT_CARD_DEFINITIONS.map((c) => [c.key, c]));

/** Keys of cards that are born Abstracted (grant an `abstracted_instances` row). */
export const ABSTRACTED_CARD_KEYS: ReadonlySet<string> = new Set(['abstracted_recluse']);

export function getEventCardDefinition(key: string): EventCardDefinition | undefined {
  return eventByKey.get(key);
}
