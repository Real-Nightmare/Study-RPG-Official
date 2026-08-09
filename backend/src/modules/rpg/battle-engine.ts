/**
 * Deterministic, server-authoritative battle engine (master prompt §13).
 *
 * The server decides outcomes; the browser may only display predictions.
 * All randomness flows through an injectable seeded RNG, so the same
 * (seed, deck, actions) sequence reproduces an identical battle log.
 *
 * Turn flow (§13.1): start-of-turn effects → shield processing → status
 * processing → optional study challenge → action selection → server
 * validation → mana payment → target resolution → damage calculation →
 * status application → defeat check → reward check → battle log →
 * end-of-turn effects → next turn.
 *
 * Damage-over-time is logged separately from immediate damage (§13.6).
 * Abilities are data-driven; no per-card switch statements (§13.7).
 */
import { Rng } from './seeded-rng';
import { Ability, BattleDefaults, CardInHand } from './card-definitions';

export type BattlePhase = 'active' | 'player_won' | 'monster_won' | 'forfeited';

export interface AppliedStatus {
  type: string; // poison | decay | burn | bleed | shield | buff | debuff | silence | stun | resistance
  remaining: number;
  damagePerTurn?: number;
  shieldValue?: number;
  source: string; // card key or 'start'
}

export interface MonsterState {
  key: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
}

export interface BattleLogEntry {
  turn: number;
  sequence: number;
  eventType: string; // start | action | damage | dot_damage | heal | shield | status | mana | quiz | challenge | defeat | reward | end
  payload: Record<string, unknown>;
}

export interface BattleState {
  seed: number;
  turn: number;
  playerHp: number;
  playerMana: number;
  maxHp: number;
  maxMana: number;
  monster: MonsterState;
  shieldRemaining: number;
  statuses: AppliedStatus[];
  phase: BattlePhase;
  hand: CardInHand[];
  cooldowns: Record<string, number>; // abilityKey -> turns remaining
  challengeBonusThisTurn: number; // +10 from the one-turn damage challenge
  log: BattleLogEntry[];
  lastAction: string | null;
}

export interface PlayerActionInput {
  cardInstanceId: string;
}

export interface ManaQuizResult {
  correctCount: number;
  manaRestored: number;
}

export interface ActionResult {
  state: BattleState;
  events: BattleLogEntry[];
}

function pushLog(state: BattleState, eventType: string, payload: Record<string, unknown>): void {
  state.log.push({
    turn: state.turn,
    sequence: state.log.length + 1,
    eventType,
    payload,
  });
}

/** Creates a fresh battle state from a deck + monster + defaults. */
export function createBattleState(params: {
  seed: number;
  hand: CardInHand[];
  monster: MonsterState;
  defaults: BattleDefaults;
}): BattleState {
  const { seed, hand, monster, defaults } = params;
  const state: BattleState = {
    seed,
    turn: 1,
    playerHp: defaults.maxHp,
    playerMana: defaults.maxMana,
    maxHp: defaults.maxHp,
    maxMana: defaults.maxMana,
    monster: { ...monster },
    shieldRemaining: 0,
    statuses: [],
    phase: 'active',
    hand,
    cooldowns: {},
    challengeBonusThisTurn: 0,
    log: [],
    lastAction: null,
  };

  pushLog(state, 'start', {
    seed,
    monsterKey: monster.key,
    monsterName: monster.name,
    monsterHp: monster.hp,
    deck: hand.map((c) => c.cardKey),
  });

  // §13.3: a valid shield card activates at the start of the match
  // and lasts for the first two turns.
  const shieldCard = hand.find((c) => c.ability.category === 'shield');
  if (shieldCard) {
    state.shieldRemaining = defaults.shieldTurns;
    pushLog(state, 'shield', {
      source: shieldCard.cardKey,
      turns: defaults.shieldTurns,
    });
  }

  return state;
}

/** Monster's simple attack on its turn. */
function monsterAttack(state: BattleState, rng: Rng, defaults: BattleDefaults): void {
  // Monster attacks the player; the shield absorbs it while active.
  let damage = state.monster.attack;
  const rolled = rng.int(0, 3);
  damage += rolled;

  if (state.shieldRemaining > 0) {
    pushLog(state, 'shield', { absorbed: damage, remaining: state.shieldRemaining - 1 });
    state.shieldRemaining -= 1;
  } else {
    state.playerHp = Math.max(0, state.playerHp - damage);
    pushLog(state, 'damage', { target: 'player', amount: damage, source: state.monster.name });
  }
}

/** Processes damage-over-time statuses; logged separately (§13.6). */
function applyStatusTicks(state: BattleState): void {
  for (const status of state.statuses) {
    if (status.damagePerTurn && status.damagePerTurn > 0) {
      const amount = status.damagePerTurn;
      state.monster.hp = Math.max(0, state.monster.hp - amount);
      pushLog(state, 'dot_damage', {
        target: 'monster',
        amount,
        status: status.type,
        source: status.source,
      });
    }
    status.remaining -= 1;
  }
  state.statuses = state.statuses.filter((s) => s.remaining > 0);
}

function decrementCooldowns(state: BattleState): void {
  const next: Record<string, number> = {};
  for (const [key, remaining] of Object.entries(state.cooldowns)) {
    if (remaining > 1) {
      next[key] = remaining - 1;
    }
  }
  state.cooldowns = next;
}

/**
 * Applies a player action (playing one card from hand) with full server
 * validation, then resolves the monster's turn. Returns the mutated state.
 */
export function applyPlayerAction(
  state: BattleState,
  action: PlayerActionInput,
  rng: Rng,
  defaults: BattleDefaults,
): ActionResult {
  if (state.phase !== 'active') {
    return { state, events: [] };
  }

  const events: BattleLogEntry[] = [];
  const card = state.hand.find((c) => c.instanceId === action.cardInstanceId);
  if (!card) {
    throw new Error('Card not in hand');
  }
  const ability = card.ability;

  // Server validation (§13.1 step 6).
  const cost =
    ability.category === 'abstracted'
      ? defaults.abstractedAbilityManaCost
      : ability.manaCost > 0
        ? ability.manaCost
        : defaults.normalAbilityManaCost;
  if (state.playerMana < cost) {
    throw new Error('Not enough mana');
  }
  const cd = state.cooldowns[ability.key] ?? 0;
  if (cd > 0) {
    throw new Error(`Ability on cooldown (${cd} turns)`);
  }
  // Restricted one-per-deck abilities cannot be replayed from hand repeatedly.
  if (ability.restrictions && ability.restrictions.length > 0) {
    const played = state.log.some(
      (e) => e.eventType === 'action' && e.payload.abilityKey === ability.key,
    );
    if (played) {
      throw new Error(`Restricted ability ${ability.key} already used this battle`);
    }
  }

  // Mana payment (§13.1 step 7).
  state.playerMana -= cost;
  pushLog(state, 'mana', { change: -cost, remaining: state.playerMana });
  pushLog(state, 'action', { cardKey: card.cardKey, abilityKey: ability.key, cost });

  // Target resolution + damage/healing/status application.
  if (ability.healing && ability.healing > 0) {
    const heal = Math.min(ability.healing, state.maxHp - state.playerHp);
    state.playerHp += heal;
    pushLog(state, 'heal', { target: 'player', amount: heal });
  }

  if (ability.statusEffect) {
    applyStatusFromAbility(state, ability);
  }

  // Damage calculation (§13.1 step 9): basic attack + ability + stackable
  // bonus + one-turn damage challenge bonus (§13.5/§13.6).
  let damage = defaults.basicAttackDamage;
  if (ability.damage && ability.damage > 0) {
    damage += ability.damage;
  }
  damage += state.challengeBonusThisTurn;
  state.challengeBonusThisTurn = 0; // bonus lasts for that turn only

  // Poison's stackable addition (§13.6).
  const poisonStatus = state.statuses.find((s) => s.type === 'poison');
  if (poisonStatus) {
    damage += defaults.poisonBonus;
  }

  if (damage > 0) {
    state.monster.hp = Math.max(0, state.monster.hp - damage);
    pushLog(state, 'damage', { target: 'monster', amount: damage, source: card.cardKey });
  }

  if (ability.cooldown && ability.cooldown > 1) {
    state.cooldowns[ability.key] = ability.cooldown;
  }
  state.lastAction = card.cardKey;
  events.push(...state.log.slice(-8));

  // Defeat check (§13.1 step 11).
  if (state.monster.hp <= 0) {
    state.phase = 'player_won';
    pushLog(state, 'defeat', { winner: 'player', monsterKey: state.monster.key });
    return { state, events };
  }

  // Monster turn.
  monsterAttack(state, rng, defaults);

  if (state.playerHp <= 0) {
    state.phase = 'monster_won';
    pushLog(state, 'defeat', { winner: 'monster' });
    return { state, events };
  }

  // End-of-turn effects (§13.1 step 14) → next turn.
  decrementCooldowns(state);
  applyStatusTicks(state);
  state.turn += 1;
  pushLog(state, 'end', { turn: state.turn - 1 });

  return { state, events };
}

function applyStatusFromAbility(state: BattleState, ability: Ability): void {
  const effect = ability.statusEffect!;
  // Only one Poison card / one Decay card / one Shield card may be equipped
  // (deck rule), so a same-type status replaces any previous application.
  const existing = state.statuses.findIndex((s) => s.type === effect.type);
  const applied: AppliedStatus = {
    type: effect.type,
    remaining: effect.duration,
    damagePerTurn: effect.damagePerTurn,
    shieldValue: effect.shieldValue,
    source: ability.key,
  };
  if (existing >= 0) {
    state.statuses[existing] = applied;
  } else {
    state.statuses.push(applied);
  }
  pushLog(state, 'status', {
    type: effect.type,
    duration: effect.duration,
    source: ability.key,
  });
}

/** Grades the mana-recovery quiz (§13.4): +4 mana per correct, capped. */
export function gradeManaQuiz(
  state: BattleState,
  correctCount: number,
  defaults: BattleDefaults,
): ManaQuizResult {
  const restored = Math.min(
    correctCount * defaults.manaPerCorrect,
    defaults.manaQuizMaxRestore,
    state.maxMana - state.playerMana,
  );
  state.playerMana += restored;
  pushLog(state, 'quiz', {
    kind: 'mana',
    correct: correctCount,
    total: defaults.manaQuizQuestions,
    manaRestored: restored,
    remaining: state.playerMana,
  });
  return { correctCount, manaRestored: restored };
}

/** Grades the one-turn damage challenge (§13.5). */
export function gradeDamageChallenge(
  state: BattleState,
  allCorrect: boolean,
  defaults: BattleDefaults,
): boolean {
  pushLog(state, 'challenge', { allCorrect });
  if (allCorrect) {
    state.challengeBonusThisTurn = defaults.damageChallengeBonus;
  }
  return allCorrect;
}

/** Applies a forfeit. */
export function forfeitBattle(state: BattleState): BattleState {
  if (state.phase !== 'active') {
    return state;
  }
  state.phase = 'forfeited';
  pushLog(state, 'defeat', { winner: 'forfeit' });
  return state;
}
