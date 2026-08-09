import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BattleService, BattleView } from './battle.service';
import { CardService, DeckView } from './card.service';
import { PlayerService } from './player.service';
import { WalletService } from './wallet.service';
import { buildGhostAvatar, DEFAULT_PVP_CONFIG, DeckSnapshotCard, PvpConfig } from './pvp-ghost';
import { computeRatings } from './pvp-rating';
import { DuelMargins, outcomeOf, settleDuel, SettlementResult } from './pvp-settlement';
import { getConfigValue } from './rpg-config';
import { levelFromXp } from './level-curve';

export type PvpDuelStatus = 'challenged' | 'in_progress' | 'settled' | 'expired';
export type DuelSide = 'challenger' | 'defender';

export interface PvpRewards {
  xp: number;
  stp: number;
  limited: boolean;
}

export interface PvpDuelView {
  id: string;
  status: PvpDuelStatus;
  challenger: { id: string; name: string; rating: number };
  defender: { id: string; name: string; rating: number };
  mySide: DuelSide | null;
  myBattleId: string | null;
  myBattle: BattleView | null;
  opponentBattleId: string | null;
  opponentPlayed: boolean;
  winner: DuelSide | 'draw' | null;
  margins: DuelMargins | null;
  ratingChange: { challenger: number; defender: number } | null;
  rewards: PvpRewards | null;
  expiresAt: Date;
  settledAt: Date | null;
  createdAt: Date;
}

interface DuelRow {
  id: string;
  status: string;
  challengerId: string;
  defenderId: string;
  challengerBattleId: string | null;
  defenderBattleId: string | null;
  challengerRatingBefore: number;
  defenderRatingBefore: number;
  challengerRatingAfter: number | null;
  defenderRatingAfter: number | null;
  winnerId: string | null;
  margins: DuelMargins | null;
  rewards: PvpRewards | null;
  challengerDeck: DeckSnapshotCard[];
  defenderDeck: DeckSnapshotCard[];
  expiresAt: Date;
  settledAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class PvpService {
  private readonly logger = new Logger(PvpService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly battles: BattleService,
    private readonly cards: CardService,
    private readonly player: PlayerService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Duel lifecycle
  // ---------------------------------------------------------------------------

  /** Creates a duel — by opponent email, or random matchmaking by rating. */
  async create(
    userId: string,
    dto: { opponentEmail?: string; deckId?: string },
  ): Promise<PvpDuelView> {
    const myDeck = await this.requireValidatedDeck(userId, dto.deckId);
    const mySnapshot = this.snapshotDeck(myDeck);
    const myProfile = await this.getProfile(userId);
    const opponentEmail = dto.opponentEmail?.trim().toLowerCase();

    let opponentId: string;
    let opponentName: string;
    let opponentRating: number;
    let opponentSnapshot: DeckSnapshotCard[];

    if (opponentEmail) {
      const opponent = await this.findUserByEmail(opponentEmail);
      if (!opponent || opponent.id === userId) {
        throw new NotFoundException('No player found with that email');
      }
      const opponentDeck = await this.cards.getActiveDeck(opponent.id);
      if (!opponentDeck || !opponentDeck.validated) {
        throw new ConflictException('Opponent has no validated active deck to fight');
      }
      const opponentProfile = await this.getProfile(opponent.id);
      opponentId = opponent.id;
      opponentName = opponent.name;
      opponentRating = opponentProfile.battleRating;
      opponentSnapshot = this.snapshotDeck(opponentDeck);
    } else {
      const found = await this.matchmake(userId, myProfile.battleRating);
      if (!found) {
        throw new ConflictException('No eligible opponents available right now');
      }
      const opponentDeck = await this.cards.getActiveDeck(found.id);
      opponentId = found.id;
      opponentName = found.name;
      opponentRating = found.rating;
      opponentSnapshot = opponentDeck ? this.snapshotDeck(opponentDeck) : [];
    }

    const config = await this.getPvpConfig();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + config.expiryHours * 3600 * 1000);

    await this.db.query(
      `INSERT INTO pvp_duels
         (id, challenger_id, defender_id, status, challenger_deck, defender_deck,
          challenger_rating_before, defender_rating_before, expires_at)
       VALUES ($1, $2, $3, 'challenged', $4, $5, $6, $7, $8)`,
      [
        id,
        userId,
        opponentId,
        JSON.stringify(mySnapshot),
        JSON.stringify(opponentSnapshot),
        myProfile.battleRating,
        opponentRating,
        expiresAt,
      ],
    );

    await this.notifications.create({
      userId: opponentId,
      type: 'info',
      title: 'New Study RPG duel challenge',
      message: `${myProfileName(userId, myProfile)} challenged you to a duel`,
      link: '/dashboard/rpg',
    });
    this.logger.log(`Duel created: ${id} (${userId} vs ${opponentId})`);

    return this.buildView(await this.loadDuel(id), userId);
  }

  async list(userId: string): Promise<PvpDuelView[]> {
    await this.expireOverdue(userId);
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT d.* FROM pvp_duels d
       WHERE d.challenger_id = $1 OR d.defender_id = $1
       ORDER BY d.created_at DESC`,
      [userId],
    );
    const views: PvpDuelView[] = [];
    for (const row of rows) {
      const duel = this.mapRow(row);
      if (this.isReadyToSettle(duel)) {
        await this.settle(duel.id);
        views.push(await this.buildView(await this.loadDuel(duel.id), userId));
      } else {
        views.push(await this.buildView(duel, userId));
      }
    }
    return views;
  }

  async get(userId: string, duelId: string): Promise<PvpDuelView> {
    await this.expireOverdue(userId);
    const duel = await this.loadDuel(duelId);
    this.assertParty(duel, userId);
    if (this.isReadyToSettle(duel)) {
      await this.settle(duelId);
      return this.buildView(await this.loadDuel(duelId), userId);
    }
    return this.buildView(duel, userId);
  }

  /** Starts the caller's battle vs the opponent's ghost avatar. */
  async startBattle(userId: string, duelId: string): Promise<BattleView> {
    const duel = await this.loadDuel(duelId);
    this.assertParty(duel, userId);
    if (duel.status === 'settled' || duel.status === 'expired') {
      throw new ConflictException('This duel is already finished');
    }

    const mySide: DuelSide = duel.challengerId === userId ? 'challenger' : 'defender';
    const myBattleId = mySide === 'challenger' ? duel.challengerBattleId : duel.defenderBattleId;
    if (myBattleId) {
      return this.battles.get(userId, myBattleId);
    }

    const opponentId = mySide === 'challenger' ? duel.defenderId : duel.challengerId;
    const opponentSnapshot = mySide === 'challenger' ? duel.defenderDeck : duel.challengerDeck;
    const opponentName = await this.getUserName(opponentId);
    const config = await this.getPvpConfig();
    const { monster } = buildGhostAvatar(opponentSnapshot, config, opponentName);

    const battle = await this.battles.create(userId, {
      monster,
      pvpDuelId: duelId,
      world: 'pvp',
    });

    const column = mySide === 'challenger' ? 'challenger_battle_id' : 'defender_battle_id';
    await this.db.query(
      `UPDATE pvp_duels SET ${column} = $1, status = 'in_progress', updated_at = NOW()
       WHERE id = $2`,
      [battle.id, duelId],
    );
    return battle;
  }

  async leaderboard(
    limit = 20,
  ): Promise<Array<{ userId: string; name: string; rating: number; level: number }>> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT p.user_id, u.name, p.battle_rating, p.level
       FROM player_profiles p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.battle_rating DESC, p.level DESC
       LIMIT $1`,
      [Math.min(100, Math.max(1, limit))],
    );
    return rows.map((r) => ({
      userId: r.user_id as string,
      name: r.name as string,
      rating: Number(r.battle_rating),
      level: Number(r.level),
    }));
  }

  // ---------------------------------------------------------------------------
  // Settlement
  // ---------------------------------------------------------------------------

  /** Settles a duel when both battles are terminal (or it expired). Idempotent. */
  private async settle(duelId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const lock = await client.query(`SELECT * FROM pvp_duels WHERE id = $1 FOR UPDATE`, [duelId]);
      const row = lock.rows[0];
      if (!row || row.status === 'settled' || row.status === 'expired') {
        return;
      }
      const duel = this.mapRow(row);

      const challengerOutcome = await this.battleOutcomeFor(client, duel.challengerBattleId);
      const defenderOutcome = await this.battleOutcomeFor(client, duel.defenderBattleId);
      const expired = new Date(duel.expiresAt) < new Date();

      // Not ready: neither finished and it hasn't expired.
      if (!challengerOutcome.played && !defenderOutcome.played && !expired) {
        return;
      }

      const result: SettlementResult = settleDuel(challengerOutcome, defenderOutcome);
      const config = await this.getPvpConfig();

      let winnerId: string | null = null;
      let ratingChange: { challenger: number; defender: number } | null = null;
      let rewards: PvpRewards | null = null;

      if (result.winner === 'challenger') {
        winnerId = duel.challengerId;
      } else if (result.winner === 'defender') {
        winnerId = duel.defenderId;
      }

      if (winnerId) {
        // Ensure both profiles exist so rating updates land.
        await client.query(
          `INSERT INTO player_profiles (user_id) VALUES ($1), ($2)
           ON CONFLICT (user_id) DO NOTHING`,
          [duel.challengerId, duel.defenderId],
        );
        const r = computeRatings(
          duel.challengerRatingBefore,
          duel.defenderRatingBefore,
          config.ratingK,
        );
        const challengerDelta = winnerId === duel.challengerId ? r.winnerDelta : r.loserDelta;
        const defenderDelta = winnerId === duel.defenderId ? r.winnerDelta : r.loserDelta;
        const challengerAfter = Math.max(0, duel.challengerRatingBefore + challengerDelta);
        const defenderAfter = Math.max(0, duel.defenderRatingBefore + defenderDelta);

        await client.query(
          `UPDATE player_profiles SET battle_rating = $1, updated_at = NOW() WHERE user_id = $2`,
          [challengerAfter, duel.challengerId],
        );
        await client.query(
          `UPDATE player_profiles SET battle_rating = $1, updated_at = NOW() WHERE user_id = $2`,
          [defenderAfter, duel.defenderId],
        );
        ratingChange = { challenger: challengerAfter, defender: defenderAfter };

        const loserId = winnerId === duel.challengerId ? duel.defenderId : duel.challengerId;
        rewards = await this.grantPvpRewards(client, duelId, winnerId, loserId, config);
      }

      await client.query(
        `UPDATE pvp_duels SET
           status = 'settled', winner_id = $1,
           challenger_rating_after = $2, defender_rating_after = $3,
           margins = $4, rewards = $5, settled_at = NOW(), updated_at = NOW()
         WHERE id = $6`,
        [
          winnerId,
          ratingChange ? ratingChange.challenger : null,
          ratingChange ? ratingChange.defender : null,
          JSON.stringify(result.margins),
          rewards ? JSON.stringify(rewards) : null,
          duelId,
        ],
      );

      if (winnerId) {
        const loserId = winnerId === duel.challengerId ? duel.defenderId : duel.challengerId;
        await this.notifications.create({
          userId: winnerId,
          type: 'success',
          title: 'Duel won',
          message: `You won a Study RPG duel (+${rewards?.stp ?? 0} STP)`,
          link: '/dashboard/rpg',
        });
        await this.notifications.create({
          userId: loserId,
          type: 'info',
          title: 'Duel lost',
          message: 'You lost a Study RPG duel — study harder and rematch!',
          link: '/dashboard/rpg',
        });
      }
      this.logger.log(`Duel settled: ${duelId} winner=${result.winner}`);
    });
  }

  /**
   * Grants winner STP + XP and loser consolation XP on the settle
   * transaction's client (single atomic unit, mirroring battle rewards).
   * Idempotent via the duel's settle guard; respects the daily PvP win cap.
   */
  private async grantPvpRewards(
    client: import('pg').PoolClient,
    duelId: string,
    winnerId: string,
    loserId: string,
    config: PvpConfig,
  ): Promise<PvpRewards> {
    const count = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM wallet_ledger
       WHERE user_id = $1 AND transaction_type = 'pvp_win' AND created_at >= CURRENT_DATE`,
      [winnerId],
    );
    const limited = Number(count.rows[0]?.count ?? 0) >= config.dailyPvpWinLimit;
    if (limited) {
      return { xp: 0, stp: 0, limited: true };
    }

    // Winner STP via the immutable ledger (single transaction, locked row).
    await client.query(
      `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [winnerId],
    );
    const stpLock = await client.query(
      'SELECT stp FROM player_profiles WHERE user_id = $1 FOR UPDATE',
      [winnerId],
    );
    const stpBefore = Number(stpLock.rows[0]?.stp ?? 0);
    const stpAfter = stpBefore + config.winStp;
    await client.query(
      `INSERT INTO wallet_ledger
         (id, user_id, currency, amount, balance_before, balance_after,
          transaction_type, reason, related_entity_id, idempotency_key, actor)
       VALUES ($1, $2, 'STP', $3, $4, $5, 'pvp_win', $6, $7, $8, 'pvp')`,
      [
        uuidv4(),
        winnerId,
        config.winStp,
        stpBefore,
        stpAfter,
        `PvP duel victory (${duelId})`,
        duelId,
        `pvp_win:${duelId}`,
      ],
    );
    await client.query(
      'UPDATE player_profiles SET stp = $1, updated_at = NOW() WHERE user_id = $2',
      [stpAfter, winnerId],
    );

    // Winner + loser XP: event rows + profile level recompute on the same client.
    const levelConfig = await this.player.getLevelConfig();
    for (const [id, amount, type] of [
      [winnerId, config.winXp, 'pvp_win'],
      [loserId, config.lossXp, 'pvp_loss'],
    ] as Array<[string, number, string]>) {
      await client.query(
        `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [id],
      );
      const xpLock = await client.query(
        'SELECT xp FROM player_profiles WHERE user_id = $1 FOR UPDATE',
        [id],
      );
      const totalXp = Number(xpLock.rows[0]?.xp ?? 0) + amount;
      const info = levelFromXp(totalXp, levelConfig.thresholds);
      await client.query(
        `INSERT INTO user_xp_events (id, user_id, type, xp) VALUES ($1, $2, $3, $4)`,
        [uuidv4(), id, type, amount],
      );
      await client.query(
        'UPDATE player_profiles SET xp = $1, level = $2, updated_at = NOW() WHERE user_id = $3',
        [totalXp, info.level, id],
      );
    }

    return { xp: config.winXp, stp: config.winStp, limited: false };
  }

  private async expireOverdue(userId: string): Promise<void> {
    const rows = await this.db.queryMany<{ id: string }>(
      `SELECT id FROM pvp_duels
       WHERE (challenger_id = $1 OR defender_id = $1)
         AND status IN ('challenged', 'in_progress')
         AND expires_at < NOW()`,
      [userId],
    );
    for (const row of rows) {
      await this.settle(row.id);
    }
  }

  private isReadyToSettle(duel: DuelRow): boolean {
    const bothPlayed = Boolean(duel.challengerBattleId) && Boolean(duel.defenderBattleId);
    const expired = new Date(duel.expiresAt) < new Date();
    return (bothPlayed || expired) && duel.status === 'in_progress';
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async requireValidatedDeck(userId: string, deckId?: string): Promise<DeckView> {
    const deck = deckId
      ? await this.cards.getDeck(userId, deckId)
      : await this.cards.getActiveDeck(userId);
    if (!deck) {
      throw new BadRequestException('No deck equipped — build and equip a deck first');
    }
    if (!deck.validated) {
      throw new BadRequestException(`Deck invalid: ${deck.invalidReason ?? 'must be repaired'}`);
    }
    return deck;
  }

  private snapshotDeck(deck: DeckView): DeckSnapshotCard[] {
    return deck.cards.map((c) => ({
      cardKey: c.cardKey,
      rarity: c.rarity,
      ability: c.ability,
    }));
  }

  private async getProfile(userId: string): Promise<{ battleRating: number; level: number }> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT user_id, battle_rating, level FROM player_profiles WHERE user_id = $1`,
      [userId],
    );
    return {
      battleRating: Number(row?.battle_rating ?? 1000),
      level: Number(row?.level ?? 1),
    };
  }

  private async getUserName(userId: string): Promise<string> {
    const row = await this.db.queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [
      userId,
    ]);
    return row?.name ?? 'Unknown Seeker';
  }

  private async findUserByEmail(email: string): Promise<{ id: string; name: string } | null> {
    const row = await this.db.queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM users WHERE LOWER(email) = $1',
      [email],
    );
    return row ?? null;
  }

  /** Nearest eligible opponent by rating; widens the window until any exists. */
  private async matchmake(
    userId: string,
    rating: number,
  ): Promise<{ id: string; name: string; rating: number } | null> {
    const config = await this.getPvpConfig();
    for (const window of [config.ratingWindow, config.ratingWindow * 4, Number.MAX_SAFE_INTEGER]) {
      const row = await this.db.queryOne<Record<string, unknown>>(
        `SELECT p.user_id, u.name, p.battle_rating
         FROM player_profiles p
         JOIN users u ON u.id = p.user_id
         JOIN decks d ON d.user_id = p.user_id AND d.is_active = true AND d.validated = true
         WHERE p.user_id <> $1 AND ABS(p.battle_rating - $2) <= $3
         ORDER BY ABS(p.battle_rating - $2) ASC, p.battle_rating ASC
         LIMIT 1`,
        [userId, rating, window],
      );
      if (row) {
        return {
          id: row.user_id as string,
          name: row.name as string,
          rating: Number(row.battle_rating),
        };
      }
    }
    return null;
  }

  private async loadDuel(duelId: string): Promise<DuelRow> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM pvp_duels WHERE id = $1',
      [duelId],
    );
    if (!row) {
      throw new NotFoundException('Duel not found');
    }
    return this.mapRow(row);
  }

  private mapRow(row: Record<string, unknown>): DuelRow {
    return {
      id: (row.id ?? row.id) as string,
      status: (row.status ?? 'challenged') as string,
      challengerId: (row.challenger_id ?? row.challengerId) as string,
      defenderId: (row.defender_id ?? row.defenderId) as string,
      challengerBattleId: (row.challenger_battle_id ?? null) as string | null,
      defenderBattleId: (row.defender_battle_id ?? null) as string | null,
      challengerRatingBefore: Number(row.challenger_rating_before ?? 1000),
      defenderRatingBefore: Number(row.defender_rating_before ?? 1000),
      challengerRatingAfter: (row.challenger_rating_after ?? null) as number | null,
      defenderRatingAfter: (row.defender_rating_after ?? null) as number | null,
      winnerId: (row.winner_id ?? null) as string | null,
      margins: this.parseJson(row.margins),
      rewards: this.parseJson(row.rewards),
      challengerDeck: this.parseJson(row.challenger_deck) ?? [],
      defenderDeck: this.parseJson(row.defender_deck) ?? [],
      expiresAt: new Date((row.expires_at ?? row.expiresAt) as string),
      settledAt: row.settled_at ? new Date(row.settled_at as string) : null,
      createdAt: new Date((row.created_at ?? row.createdAt) as string),
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    return value as T;
  }

  private assertParty(duel: DuelRow, userId: string): void {
    if (duel.challengerId !== userId && duel.defenderId !== userId) {
      throw new NotFoundException('Duel not found');
    }
  }

  private async battleOutcomeFor(client: import('pg').PoolClient, battleId: string | null) {
    if (!battleId) {
      return { won: false, hpPct: 0, turns: 0, played: false };
    }
    const result = await client.query<Record<string, unknown>>(
      `SELECT state, phase FROM battles WHERE id = $1`,
      [battleId],
    );
    const row = result.rows[0];
    if (!row) {
      return { won: false, hpPct: 0, turns: 0, played: false };
    }
    const state = this.parseJson<{ phase: string; playerHp: number; maxHp: number; turn: number }>(
      row.state,
    );
    const phase = (state?.phase ?? row.phase ?? 'active') as string;
    const terminal = phase === 'player_won' || phase === 'monster_won' || phase === 'forfeited';
    return outcomeOf(phase, state?.playerHp ?? 0, state?.maxHp ?? 100, state?.turn ?? 0, terminal);
  }

  private async buildView(duel: DuelRow, userId: string): Promise<PvpDuelView> {
    const mySide: DuelSide | null =
      duel.challengerId === userId ? 'challenger' : duel.defenderId === userId ? 'defender' : null;
    const myBattleId = mySide === 'challenger' ? duel.challengerBattleId : duel.defenderBattleId;
    const opponentBattleId =
      mySide === 'challenger' ? duel.defenderBattleId : duel.challengerBattleId;

    const [challengerName, defenderName, myBattle] = await Promise.all([
      this.getUserName(duel.challengerId),
      this.getUserName(duel.defenderId),
      myBattleId ? this.battles.get(userId, myBattleId).catch(() => null) : Promise.resolve(null),
    ]);

    const winner: DuelSide | 'draw' | null = duel.winnerId
      ? duel.winnerId === duel.challengerId
        ? 'challenger'
        : duel.winnerId === duel.defenderId
          ? 'defender'
          : null
      : null;

    return {
      id: duel.id,
      status: duel.status as PvpDuelStatus,
      challenger: {
        id: duel.challengerId,
        name: challengerName,
        rating: duel.challengerRatingBefore,
      },
      defender: { id: duel.defenderId, name: defenderName, rating: duel.defenderRatingBefore },
      mySide,
      myBattleId,
      myBattle,
      opponentBattleId,
      opponentPlayed: Boolean(opponentBattleId),
      winner,
      margins: duel.margins,
      ratingChange:
        duel.challengerRatingAfter != null && duel.defenderRatingAfter != null
          ? { challenger: duel.challengerRatingAfter, defender: duel.defenderRatingAfter }
          : null,
      rewards: duel.rewards,
      expiresAt: duel.expiresAt,
      settledAt: duel.settledAt,
      createdAt: duel.createdAt,
    };
  }

  private async getPvpConfig(): Promise<PvpConfig> {
    return getConfigValue<PvpConfig>(this.db, 'rpg.pvp', DEFAULT_PVP_CONFIG);
  }
}

/** Small helper for notification display name. */
function myProfileName(userId: string, profile: { battleRating: number }): string {
  return `Seeker ${userId.slice(0, 8)} (${profile.battleRating})`;
}
