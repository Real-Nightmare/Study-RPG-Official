import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { CardService } from './card.service';
import { WalletService } from './wallet.service';
import { PlayerService } from './player.service';
import { BattleDefaults, CardInHand, DEFAULT_BATTLE_DEFAULTS } from './card-definitions';
import { battleMaxHp } from './characters';
import {
  ActionResult,
  applyPlayerAction,
  BattleState,
  createBattleState,
  forfeitBattle,
  gradeDamageChallenge,
  gradeManaQuiz,
  MonsterState,
} from './battle-engine';
import { getMonster, MONSTERS, MonsterDefinition } from './monster-definitions';
import { createRng } from './seeded-rng';
import { levelFromXp } from './level-curve';
import { DEFAULT_REWARD_CONFIG, getConfigValue, RewardConfig } from './rpg-config';
import { CampfireService } from '../integrity/campfire.service';
import { getIntegrityConfig } from '../integrity/integrity-config';

export interface BattleView {
  id: string;
  seed: number;
  subject: string | null;
  world: string;
  monster: { key: string; name: string; hp: number; maxHp: number; attack: number };
  state: BattleState;
  phase: string;
  rewardClaimed: boolean;
  reward: { xp: number; stp: number; limited: boolean } | null;
  pvpDuelId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BattleRewardResult {
  xp: number;
  stp: number;
  limited: boolean;
}

@Injectable()
export class BattleService {
  private readonly logger = new Logger(BattleService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cards: CardService,
    private readonly wallet: WalletService,
    private readonly player: PlayerService,
    @Optional() private readonly events?: import('../events/events.service').StudyEventsService,
    @Optional() private readonly campfire?: CampfireService,
  ) {}

  async create(
    userId: string,
    dto: {
      monsterKey?: string;
      subject?: string;
      deckId?: string;
      /** Custom opponent (PvP ghost avatar). Overrides monsterKey/monster pick. */
      monster?: MonsterState;
      /** PvP duel this battle belongs to (world 'pvp', monster 'pvp_ghost'). */
      pvpDuelId?: string;
      world?: string;
    },
  ): Promise<BattleView> {
    const deck = dto.deckId
      ? await this.cards.getDeck(userId, dto.deckId)
      : await this.cards.getActiveDeck(userId);
    if (!deck) {
      throw new BadRequestException('No deck equipped — build and equip a deck first');
    }
    if (!deck.validated) {
      throw new BadRequestException(`Deck invalid: ${deck.invalidReason ?? 'must be repaired'}`);
    }

    const hand: CardInHand[] = deck.cards.map((c) => ({
      instanceId: c.instanceId,
      cardKey: c.cardKey,
      ability: c.ability,
    }));

    const seed = Math.floor(Math.random() * 2 ** 31);
    const rng = createRng(seed);
    const world = dto.world ?? 'overworld';
    let monster: MonsterState;
    if (dto.monster) {
      monster = dto.monster;
    } else {
      const monsterDef: MonsterDefinition = dto.monsterKey
        ? getMonster(dto.monsterKey)
        : rng.pick(MONSTERS);
      monster = {
        key: monsterDef.key,
        name: monsterDef.name,
        hp: monsterDef.hp,
        maxHp: monsterDef.hp,
        attack: monsterDef.attack,
      };
    }

    const defaults = await this.getBattleDefaults();
    // Archetype bonus (completion plan T9): e.g. the Focuser enters battles
    // with extra max HP.
    const character = await this.player.getSelectedCharacter(userId);
    const tunedDefaults: BattleDefaults = {
      ...defaults,
      maxHp: battleMaxHp(defaults.maxHp, character),
    };
    const state = createBattleState({ seed, hand, monster, defaults: tunedDefaults });
    const id = uuidv4();

    // Exam-world bosses are earned through verified mastery (US1/FR-008): a
    // student must show recent academic proof — practice exam ≥ 80%, perfect
    // quiz run, or a passing Teach-Back — before entering the exam world.
    const isExamWorld =
      dto.world === 'exam' || /^(exam|boss)[_-]/.test(String(dto.monsterKey ?? ''));
    if (isExamWorld && !(await this.hasRecentMastery(userId))) {
      throw new ForbiddenException(
        'Boss battles are earned through mastery. Pass a practice exam (80%+), a perfect quiz run, or a Teach-Back (70+) in the last 14 days to unlock the exam world — then come back and fight.',
      );
    }

    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO battles
           (id, user_id, deck_id, seed, subject, world, monster_key,
            player_hp, player_mana, monster_hp, turn, shield_remaining,
            statuses, phase, state, hand, pvp_duel_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          id,
          userId,
          deck.id,
          seed,
          dto.subject ?? null,
          world,
          monster.key,
          state.playerHp,
          state.playerMana,
          state.monster.hp,
          state.turn,
          state.shieldRemaining,
          JSON.stringify(state.statuses),
          state.phase,
          JSON.stringify(state),
          JSON.stringify(hand),
          dto.pvpDuelId ?? null,
        ],
      );
      await this.persistLogEntries(client, id, state.log);
    });

    this.logger.log(`Battle created: ${id} vs ${monster.key} (seed ${seed})`);
    return this.toView({
      id,
      seed,
      subject: dto.subject ?? null,
      world,
      state,
      phase: state.phase,
      rewardClaimed: false,
      reward: null,
      pvpDuelId: dto.pvpDuelId ?? null,
    });
  }

  async get(userId: string, battleId: string): Promise<BattleView> {
    const row = await this.loadOwnedBattle(userId, battleId);
    const state = this.parseState(row.state);
    const reward = row.reward_claimed ? null : await this.computeRewardPreview(userId, row);
    return this.toView({
      id: battleId,
      seed: Number(row.seed),
      subject: (row.subject ?? null) as string | null,
      world: (row.world ?? 'overworld') as string,
      state,
      phase: row.phase as string,
      rewardClaimed: Boolean(row.reward_claimed),
      reward,
      pvpDuelId: ((row.pvp_duel_id ?? null) as string) || null,
    });
  }

  async action(
    userId: string,
    battleId: string,
    dto: { cardInstanceId: string },
  ): Promise<BattleView> {
    return this.mutate(
      userId,
      battleId,
      (state, defaults, rng) => {
        if (state.phase !== 'active') {
          throw new ConflictException('Battle is already finished');
        }
        const result: ActionResult = applyPlayerAction(
          state,
          { cardInstanceId: dto.cardInstanceId },
          rng,
          defaults,
        );
        return result.state;
      },
      { claimOnWin: true },
    );
  }

  async manaQuiz(userId: string, battleId: string, correctCount: number): Promise<BattleView> {
    return this.mutate(userId, battleId, (state, defaults) => {
      if (state.phase !== 'active') {
        throw new ConflictException('Battle is already finished');
      }
      gradeManaQuiz(state, correctCount, defaults);
      return state;
    });
  }

  async damageChallenge(
    userId: string,
    battleId: string,
    allCorrect: boolean,
  ): Promise<BattleView> {
    return this.mutate(userId, battleId, (state, defaults) => {
      if (state.phase !== 'active') {
        throw new ConflictException('Battle is already finished');
      }
      gradeDamageChallenge(state, allCorrect, defaults);
      return state;
    });
  }

  async forfeit(userId: string, battleId: string): Promise<BattleView> {
    return this.mutate(userId, battleId, (state) => {
      forfeitBattle(state);
      return state;
    });
  }

  async history(
    userId: string,
    limit = 20,
  ): Promise<
    Array<{
      id: string;
      phase: string;
      monsterKey: string;
      world: string;
      rewardClaimed: boolean;
      createdAt: Date;
    }>
  > {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT id, phase, monster_key, world, reward_claimed, created_at
       FROM battles WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: r.id as string,
      phase: r.phase as string,
      monsterKey: (r.monster_key ?? r.monsterKey) as string,
      world: r.world as string,
      rewardClaimed: Boolean(r.reward_claimed),
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
    }));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async mutate(
    userId: string,
    battleId: string,
    fn: (
      state: BattleState,
      defaults: BattleDefaults,
      rng: ReturnType<typeof createRng>,
    ) => BattleState,
    opts?: { claimOnWin?: boolean },
  ): Promise<BattleView> {
    const row = await this.loadOwnedBattle(userId, battleId);
    const state = this.parseState(row.state);
    const defaults = await this.getBattleDefaults();
    const rng = createRng(Number(row.seed) + state.turn * 7919 + state.log.length * 104729);
    const prevLogLength = state.log.length;
    const next = fn(state, defaults, rng);
    const newEvents = next.log.slice(prevLogLength);

    let reward: BattleRewardResult | null = null;
    let rewardClaimed = Boolean(row.reward_claimed);

    if (opts?.claimOnWin && next.phase === 'player_won' && !rewardClaimed) {
      reward = await this.claimRewards(userId, battleId, row);
      rewardClaimed = reward !== null;
    }

    // Study-activity feed: real battle wins accrue event EXP (PDF Phase 7 §25).
    if (reward && !reward.limited && this.events) {
      const isBoss =
        row.world === 'exam' ||
        row.world === 'boss' ||
        /^(exam|boss)[_-]/.test(String(row.monster_key ?? ''));
      await this.events
        .recordStudyActivity(userId, { type: isBoss ? 'boss_win' : 'battle_win' })
        .catch(() => undefined);
    }

    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE battles SET
           player_hp = $1, player_mana = $2, monster_hp = $3, turn = $4,
           shield_remaining = $5, statuses = $6, phase = $7, state = $8,
           reward_claimed = $9, updated_at = NOW()
         WHERE id = $10 AND user_id = $11`,
        [
          next.playerHp,
          next.playerMana,
          next.monster.hp,
          next.turn,
          next.shieldRemaining,
          JSON.stringify(next.statuses),
          next.phase,
          JSON.stringify(next),
          rewardClaimed,
          battleId,
          userId,
        ],
      );
      if (newEvents.length > 0) {
        await this.persistLogEntries(client, battleId, newEvents);
      }
    });

    return this.toView({
      id: battleId,
      seed: Number(row.seed),
      subject: (row.subject ?? null) as string | null,
      world: (row.world ?? 'overworld') as string,
      state: next,
      phase: next.phase,
      rewardClaimed,
      reward,
      pvpDuelId: ((row.pvp_duel_id ?? null) as string) || null,
    });
  }

  private async claimRewards(
    userId: string,
    battleId: string,
    _row: Record<string, unknown>,
  ): Promise<BattleRewardResult | null> {
    const config = await this.getRewardConfig();
    const idempotencyKey = `battle_win:${battleId}`;

    return this.db.transaction(async (client) => {
      const lock = await client.query(
        'SELECT reward_claimed, reward_idempotency_key FROM battles WHERE id = $1 FOR UPDATE',
        [battleId],
      );
      if (lock.rows[0]?.reward_claimed || lock.rows[0]?.reward_idempotency_key === idempotencyKey) {
        return null;
      }

      // Anti-farming daily limits (§14): count today's claimed wins + earned STP/XP.
      const winCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM battles
         WHERE user_id = $1 AND reward_claimed = true AND created_at >= CURRENT_DATE`,
        [userId],
      );
      const stpToday = await client.query<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0)::int AS total FROM wallet_ledger
         WHERE user_id = $1 AND transaction_type = 'battle_win' AND created_at >= CURRENT_DATE`,
        [userId],
      );
      const xpToday = await client.query<{ total: number }>(
        `SELECT COALESCE(SUM(xp), 0)::int AS total FROM user_xp_events
         WHERE user_id = $1 AND type = 'battle_win' AND created_at >= CURRENT_DATE`,
        [userId],
      );

      const winsToday = Number(winCount.rows[0]?.count ?? 0);
      const stpEarned = Number(stpToday.rows[0]?.total ?? 0);
      const xpEarned = Number(xpToday.rows[0]?.total ?? 0);

      const overLimit =
        winsToday >= config.dailyBattleRewardLimit ||
        stpEarned + config.battleWinStp > config.dailyRewardLimitStp ||
        xpEarned + config.battleWinXp > config.dailyRewardLimitXp;

      if (overLimit) {
        await client.query(
          `UPDATE battles SET reward_claimed = true, reward_idempotency_key = $1, updated_at = NOW()
           WHERE id = $2`,
          [idempotencyKey, battleId],
        );
        return { xp: 0, stp: 0, limited: true };
      }

      // ── Integrity multiplier (US1/FR-008) ────────────────────────────────
      // The base battle reward is multiplied by the player's rolling 7-day
      // academic accuracy (premium, up to 2.0x) and any active campfire
      // reflection multiplier (up to 1.5x). Students who demonstrate real
      // mastery earn premium loot; bot-farmed battles pay the flat baseline.
      const integrity = await this.rollingAcademicIntegrity(userId);
      const integrityConfig = await getIntegrityConfig(this.db);
      const campMultiplier = this.campfire
        ? await this.campfire.latestMultiplier(userId)
        : integrityConfig.campfire.baseMultiplier;
      let premium = 1;
      if (integrity !== null && integrity >= integrityConfig.rewards.battle.integrityFloor) {
        const t =
          (integrity - integrityConfig.rewards.battle.integrityFloor) /
          (1 - integrityConfig.rewards.battle.integrityFloor);
        premium =
          1 +
          Math.min(1, Math.max(0, t)) * (integrityConfig.rewards.battle.maxPremiumMultiplier - 1);
      }
      const mult = premium * campMultiplier;
      const xpGrant = Math.max(1, Math.round(config.battleWinXp * mult));
      const stpGrant = Math.max(0, Math.round(config.battleWinStp * mult));

      // Grant STP inside the same transaction (immutable ledger row + balance
      // update on player_profiles), so the claim is atomic.
      await client.query(
        `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const profileLock = await client.query(
        'SELECT stp FROM player_profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const balanceBefore = Number(profileLock.rows[0]?.stp ?? 0);
      const balanceAfter = balanceBefore + stpGrant;
      await client.query(
        `INSERT INTO wallet_ledger
           (id, user_id, currency, amount, balance_before, balance_after,
            transaction_type, reason, related_entity_id, idempotency_key, actor)
         VALUES ($1, $2, 'STP', $3, $4, $5, 'battle_win', $6, $7, $8, 'battle')`,
        [
          uuidv4(),
          userId,
          stpGrant,
          balanceBefore,
          balanceAfter,
          `Battle victory reward (${battleId})`,
          battleId,
          idempotencyKey,
        ],
      );
      await client.query(
        'UPDATE player_profiles SET stp = $1, updated_at = NOW() WHERE user_id = $2',
        [balanceAfter, userId],
      );

      // Grant XP: event row + profile level recomputation (same transaction).
      const xpLock = await client.query(
        'SELECT xp FROM player_profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const totalXp = Number(xpLock.rows[0]?.xp ?? 0) + xpGrant;
      const levelConfig = await this.player.getLevelConfig();
      const info = levelFromXp(totalXp, levelConfig.thresholds);
      await client.query(
        `INSERT INTO user_xp_events (id, user_id, type, xp) VALUES ($1, $2, 'battle_win', $3)`,
        [uuidv4(), userId, xpGrant],
      );
      await client.query(
        'UPDATE player_profiles SET xp = $1, level = $2, updated_at = NOW() WHERE user_id = $3',
        [totalXp, info.level, userId],
      );

      await client.query(
        `UPDATE battles SET reward_claimed = true, reward_idempotency_key = $1, updated_at = NOW()
         WHERE id = $2`,
        [idempotencyKey, battleId],
      );
      this.logger.log(
        `Battle rewards claimed: ${battleId} +${xpGrant} XP +${stpGrant} STP (mult ${mult.toFixed(2)})`,
      );
      return { xp: xpGrant, stp: stpGrant, limited: false };
    });
  }

  private async computeRewardPreview(
    userId: string,
    row: Record<string, unknown>,
  ): Promise<BattleRewardResult | null> {
    if (row.phase !== 'player_won') {
      return null;
    }
    const config = await this.getRewardConfig();
    const winsToday = Number(
      (
        await this.db.queryOne<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM battles
           WHERE user_id = $1 AND reward_claimed = true AND created_at >= CURRENT_DATE`,
          [userId],
        )
      )?.count ?? 0,
    );
    const limited = winsToday >= config.dailyBattleRewardLimit;
    return { xp: config.battleWinXp, stp: config.battleWinStp, limited };
  }

  /**
   * Rolling 7-day academic accuracy (0..1) from quiz + practice-exam scores.
   * Returns null when there is no signal — the claim then pays the flat
   * baseline without the premium multiplier.
   */
  private async rollingAcademicIntegrity(userId: string): Promise<number | null> {
    const quiz = await this.db.queryOne<{ avg: number | string }>(
      `SELECT AVG(score)::float AS avg FROM quiz_attempts
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [userId],
    );
    const exam = await this.db.queryOne<{ avg: number | string }>(
      `SELECT AVG(score)::float AS avg FROM exam_attempts
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [userId],
    );
    const quizAvg = quiz ? Number(quiz.avg) : NaN;
    const examAvg = exam ? Number(exam.avg) : NaN;
    const valid = [quizAvg, examAvg].filter((n) => Number.isFinite(n) && n > 0);
    if (valid.length === 0) return null;
    return Math.max(0, Math.min(1, valid.reduce((a, b) => a + b, 0) / valid.length / 100));
  }

  /** Verified academic mastery in the last 14 days (exam-boss gate). */
  private async hasRecentMastery(userId: string): Promise<boolean> {
    const examPass = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM exam_attempts
       WHERE user_id = $1 AND score >= 80 AND created_at > NOW() - INTERVAL '14 days'`,
      [userId],
    );
    if (Number(examPass?.count ?? 0) > 0) return true;
    const perfectQuiz = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM quiz_attempts
       WHERE user_id = $1 AND score >= 99.5 AND created_at > NOW() - INTERVAL '14 days'`,
      [userId],
    );
    if (Number(perfectQuiz?.count ?? 0) > 0) return true;
    const teachBack = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM teach_back_sessions
       WHERE user_id = $1 AND status = 'evaluated' AND created_at > NOW() - INTERVAL '14 days'
         AND (evaluation->>'overallScore')::float >= 70`,
      [userId],
    );
    return Number(teachBack?.count ?? 0) > 0;
  }

  private async getBattleDefaults(): Promise<BattleDefaults> {
    return getConfigValue<BattleDefaults>(this.db, 'rpg.battle.defaults', DEFAULT_BATTLE_DEFAULTS);
  }

  private async getRewardConfig(): Promise<RewardConfig> {
    return getConfigValue<RewardConfig>(this.db, 'rpg.rewards', DEFAULT_REWARD_CONFIG);
  }

  private async loadOwnedBattle(
    userId: string,
    battleId: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, user_id, seed, subject, world, monster_key,
              player_hp, player_mana, monster_hp, turn, shield_remaining,
              statuses, phase, state, hand, reward_claimed, reward_idempotency_key,
              pvp_duel_id, created_at, updated_at
       FROM battles WHERE id = $1 AND user_id = $2`,
      [battleId, userId],
    );
    if (!row) {
      throw new NotFoundException('Battle not found');
    }
    return row;
  }

  private parseState(raw: unknown): BattleState {
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!state || typeof state !== 'object' || typeof state.turn !== 'number') {
      throw new BadRequestException('Battle state is corrupt');
    }
    return state as BattleState;
  }

  private async persistLogEntries(
    client: import('pg').PoolClient,
    battleId: string,
    entries: BattleState['log'],
  ): Promise<void> {
    for (const entry of entries) {
      await client.query(
        `INSERT INTO battle_log (id, battle_id, turn, sequence, event_type, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          battleId,
          entry.turn,
          entry.sequence,
          entry.eventType,
          JSON.stringify(entry.payload),
        ],
      );
    }
  }

  private toView(data: {
    id: string;
    seed: number;
    subject: string | null;
    world: string;
    state: BattleState;
    phase: string;
    rewardClaimed: boolean;
    reward: BattleRewardResult | null;
    pvpDuelId: string | null;
  }): BattleView {
    const state = data.state;
    return {
      id: data.id,
      seed: data.seed,
      subject: data.subject,
      world: data.world,
      monster: {
        key: state.monster.key,
        name: state.monster.name,
        hp: state.monster.hp,
        maxHp: state.monster.maxHp,
        attack: state.monster.attack,
      },
      state,
      phase: data.phase,
      rewardClaimed: data.rewardClaimed,
      reward: data.reward,
      pvpDuelId: data.pvpDuelId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
