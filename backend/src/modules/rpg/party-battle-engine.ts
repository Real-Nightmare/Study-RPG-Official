/**
 * Party battle engine (Phase 6). Up to 4 heroes (the player + friends) fight
 * a single shared boss. Each hero has their own HP/mana/hand from their active
 * deck; heroes act in rotation; the boss attacks the active hero. The boss HP
 * is shared across the party.
 *
 * Pure and deterministic: same (seed, hands, actions) → same log.
 * Rewards are granted per-member with idempotency by the service layer.
 */
import { createRng } from './seeded-rng';
import { CardInHand, BattleDefaults } from './card-definitions';
import { applyPlayerAction, BattleState, createBattleState, MonsterState } from './battle-engine';

export type PartyBattlePhase = 'active' | 'won' | 'lost' | 'forfeited';

export interface PartyHeroState {
  userId: string;
  name: string;
  state: BattleState;
  isDown: boolean; // hp <= 0
  actedThisRound: boolean;
}

export interface PartyBattleState {
  seed: number;
  round: number;
  boss: MonsterState;
  heroes: PartyHeroState[];
  activeHeroIndex: number;
  phase: PartyBattlePhase;
  log: Array<{ round: number; eventType: string; payload: Record<string, unknown> }>;
}

export interface PartyHeroInput {
  userId: string;
  name: string;
  hand: CardInHand[];
}

export function createPartyBattleState(params: {
  seed: number;
  heroes: PartyHeroInput[];
  boss: MonsterState;
  defaults: BattleDefaults;
}): PartyBattleState {
  const { seed, heroes, boss, defaults } = params;

  const heroStates: PartyHeroState[] = heroes.map((hero) => ({
    userId: hero.userId,
    name: hero.name,
    state: createBattleState({
      seed: (seed + hero.userId.length * 131) >>> 0, // per-hero seed, deterministic
      hand: hero.hand,
      monster: { ...boss },
      defaults,
    }),
    isDown: false,
    actedThisRound: false,
  }));

  const state: PartyBattleState = {
    seed,
    round: 1,
    boss: { ...boss },
    heroes: heroStates,
    activeHeroIndex: 0,
    phase: 'active',
    log: [
      {
        round: 1,
        eventType: 'start',
        payload: {
          seed,
          bossKey: boss.key,
          bossName: boss.name,
          bossHp: boss.hp,
          heroes: heroes.map((h) => h.userId),
        },
      },
    ],
  };

  return state;
}

/** Advance to the next alive hero that hasn't acted this round. */
function nextActiveHero(state: PartyBattleState): number {
  const n = state.heroes.length;
  for (let step = 1; step <= n; step++) {
    const idx = (state.activeHeroIndex + step) % n;
    const hero = state.heroes[idx];
    if (!hero.isDown && !hero.actedThisRound) {
      return idx;
    }
  }
  return state.activeHeroIndex;
}

/**
 * Apply a hero action against the shared boss. Each hero's battle state holds
 * a mirror of the boss; we sync the shared boss HP before/after resolution so
 * damage carries across the party.
 */
export function applyPartyAction(
  state: PartyBattleState,
  heroUserId: string,
  cardInstanceId: string,
  defaults: BattleDefaults,
): { state: PartyBattleState; events: PartyBattleState['log'] } {
  if (state.phase !== 'active') {
    throw new Error(`Party battle is ${state.phase}`);
  }

  const hero = state.heroes.find((h) => h.userId === heroUserId);
  if (!hero) {
    throw new Error('Hero not in this party battle');
  }
  if (hero.isDown) {
    throw new Error('Hero is down');
  }
  if (hero.actedThisRound) {
    throw new Error('Hero already acted this round');
  }

  // Sync the hero's monster mirror to the current shared boss HP.
  hero.state.monster.hp = state.boss.hp;
  hero.state.monster.maxHp = state.boss.maxHp;

  const rng = createRng((state.seed + state.round * 97 + hero.userId.length * 13) >>> 0);
  const action = applyPlayerAction(hero.state, { cardInstanceId }, rng, defaults);
  const events = action.events.map((e) => ({
    round: state.round,
    eventType: e.eventType,
    payload: { ...e.payload, heroUserId },
  }));

  // Sync shared boss HP back from the hero's mirror.
  state.boss.hp = Math.max(0, hero.state.monster.hp);

  if (state.boss.hp <= 0) {
    state.phase = 'won';
    state.log.push({
      round: state.round,
      eventType: 'party_victory',
      payload: { heroUserId, bossKey: state.boss.key },
    });
    return { state, events };
  }

  hero.actedThisRound = true;
  state.log.push(...events);

  if (hero.state.playerHp <= 0) {
    hero.isDown = true;
    state.log.push({ round: state.round, eventType: 'hero_down', payload: { heroUserId } });
  }

  // Boss counter-attacks the active hero (once per action round).
  const bossRng = createRng((state.seed + state.round * 31) >>> 0);
  const variance = bossRng.next() * 0.2 - 0.1; // ±10%
  const damage = Math.max(1, Math.round(state.boss.attack * (1 + variance)));
  hero.state.playerHp = Math.max(0, hero.state.playerHp - damage);
  state.log.push({ round: state.round, eventType: 'boss_attack', payload: { heroUserId, damage } });

  if (hero.state.playerHp <= 0) {
    hero.isDown = true;
    state.log.push({ round: state.round, eventType: 'hero_down', payload: { heroUserId } });
  }

  // Advance: if everyone has acted (or is down), start a new round.
  const everyoneActed = state.heroes.every((h) => h.isDown || h.actedThisRound);
  if (everyoneActed) {
    const anyAlive = state.heroes.some((h) => !h.isDown);
    if (!anyAlive) {
      state.phase = 'lost';
      state.log.push({ round: state.round, eventType: 'party_defeat', payload: {} });
    } else {
      state.round += 1;
      for (const h of state.heroes) {
        h.actedThisRound = false;
      }
      state.log.push({ round: state.round, eventType: 'round_start', payload: {} });
    }
  }

  state.activeHeroIndex = nextActiveHero(state);
  return { state, events };
}

export function forfeitPartyBattle(state: PartyBattleState): PartyBattleState {
  state.phase = 'forfeited';
  state.log.push({ round: state.round, eventType: 'forfeit', payload: {} });
  return state;
}
