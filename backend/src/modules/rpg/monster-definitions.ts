/**
 * Original Study RPG monsters (master prompt §10–§11).
 * Distraction, unfinished learning and forgotten knowledge become monsters.
 * All names and lore are original — no third-party copyrighted content.
 */
export interface MonsterDefinition {
  key: string;
  name: string;
  world: string;
  hp: number;
  attack: number;
  manaReward: number;
  lore: string;
  boss?: boolean;
}

export const MONSTERS: MonsterDefinition[] = [
  {
    key: 'procrastiwraith',
    name: 'Procrastiwraith',
    world: 'overworld',
    hp: 60,
    attack: 8,
    manaReward: 15,
    lore: 'Feeds on homework pushed to tomorrow. Strikes hardest at 11 PM.',
  },
  {
    key: 'forgottenfog',
    name: 'Forgotten Fog',
    world: 'overworld',
    hp: 50,
    attack: 6,
    manaReward: 12,
    lore: 'A mist of half-remembered formulas that hides what you once knew.',
  },
  {
    key: 'misconceptionslime',
    name: 'Misconception Slime',
    world: 'otherworld',
    hp: 70,
    attack: 9,
    manaReward: 18,
    lore: 'Absorbs wrong answers until they feel right. It never feels right.',
  },
  {
    key: 'distractionimp',
    name: 'Distraction Imp',
    world: 'otherworld',
    hp: 45,
    attack: 7,
    manaReward: 14,
    lore: 'Whispers about notifications mid-sentence. Immune to willpower, weak to timers.',
  },
  {
    key: 'fearwisp',
    name: 'Fear Wisp',
    world: 'limbo',
    hp: 80,
    attack: 11,
    manaReward: 22,
    lore: 'Wears the face of every test you have not prepared for.',
  },
  {
    key: 'abstractederror',
    name: 'Abstracted Error',
    world: 'the_end',
    hp: 100,
    attack: 13,
    manaReward: 30,
    boss: true,
    lore: 'The final error message. Seven of its fragments gate the Limbo gates.',
  },
];

export function getMonster(key: string): MonsterDefinition {
  const monster = MONSTERS.find((m) => m.key === key);
  if (!monster) {
    throw new Error(`Unknown monster: ${key}`);
  }
  return monster;
}
