import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface WalletEntry {
  id: string;
  userId: string;
  currency: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionType: string;
  reason: string | null;
  relatedEntityId: string | null;
  idempotencyKey: string;
  actor: string;
  createdAt: Date;
}

export interface WalletChangeInput {
  /** Signed delta; positive credits, negative debits. */
  amount: number;
  transactionType: string;
  reason?: string;
  relatedEntityId?: string;
  idempotencyKey: string;
  actor?: string;
}

/**
 * STP/SLC wallet (master prompt §14). Single fictional currency — STP,
 * also called SLC — with one balance and one immutable ledger.
 *
 * Every mutation appends a `wallet_ledger` row inside a transaction that
 * locks the profile row (SELECT ... FOR UPDATE), uses integer arithmetic
 * only, rejects negative balances, and is idempotent per user+key.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly db: DatabaseService) {}

  async getBalance(userId: string): Promise<number> {
    await this.ensureProfile(userId);
    const row = await this.db.queryOne<{ stp: number | string }>(
      'SELECT stp FROM player_profiles WHERE user_id = $1',
      [userId],
    );
    return Number(row?.stp ?? 0);
  }

  async getLedger(userId: string, limit = 50): Promise<WalletEntry[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT id, user_id, currency, amount, balance_before, balance_after,
              transaction_type, reason, related_entity_id, idempotency_key,
              actor, created_at
       FROM wallet_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => this.mapEntry(r));
  }

  /**
   * Applies a signed balance change, appending an immutable ledger entry.
   * Idempotent: replaying the same (user, idempotencyKey) returns the
   * original entry without double-applying.
   */
  async applyChange(userId: string, input: WalletChangeInput): Promise<WalletEntry> {
    return this.db.transaction(async (client) => {
      return this.applyChangeWithClient(client, userId, input);
    });
  }

  /**
   * Same as `applyChange` but runs inside a caller-owned transaction, so
   * multi-step operations (marketplace settlement, burn instalments) stay
   * atomic. `client` must be the transaction's PoolClient.
   */
  async applyChangeWithClient(
    client: import('pg').PoolClient,
    userId: string,
    input: WalletChangeInput,
  ): Promise<WalletEntry> {
    if (!Number.isInteger(input.amount) || input.amount === 0) {
      throw new BadRequestException('Wallet amounts must be non-zero integers');
    }
    if (!input.idempotencyKey) {
      throw new BadRequestException('idempotencyKey is required');
    }

    await client.query(
      `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );

    // Idempotency replay: return the original entry.
    const existing = await client.query(
      `SELECT id, user_id, currency, amount, balance_before, balance_after,
              transaction_type, reason, related_entity_id, idempotency_key,
              actor, created_at
       FROM wallet_ledger
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, input.idempotencyKey],
    );
    if (existing.rows.length > 0) {
      return this.mapEntry(existing.rows[0]);
    }

    // Lock the profile row so concurrent changes serialize.
    const lock = await client.query(
      'SELECT stp FROM player_profiles WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    const balanceBefore = Number(lock.rows[0]?.stp ?? 0);
    const balanceAfter = balanceBefore + input.amount;
    if (balanceAfter < 0) {
      throw new BadRequestException(
        `Insufficient STP/SLC balance (${balanceBefore} + ${input.amount} < 0)`,
      );
    }

    const id = uuidv4();
    const inserted = await client.query(
      `INSERT INTO wallet_ledger
         (id, user_id, currency, amount, balance_before, balance_after,
          transaction_type, reason, related_entity_id, idempotency_key, actor)
       VALUES ($1, $2, 'STP', $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, currency, amount, balance_before, balance_after,
                 transaction_type, reason, related_entity_id, idempotency_key,
                 actor, created_at`,
      [
        id,
        userId,
        input.amount,
        balanceBefore,
        balanceAfter,
        input.transactionType,
        input.reason ?? null,
        input.relatedEntityId ?? null,
        input.idempotencyKey,
        input.actor ?? 'system',
      ],
    );
    await client.query(
      'UPDATE player_profiles SET stp = $1, updated_at = NOW() WHERE user_id = $2',
      [balanceAfter, userId],
    );
    this.logger.log(
      `Wallet ${input.transactionType}: ${userId} ${input.amount >= 0 ? '+' : ''}${input.amount} STP (${balanceBefore} → ${balanceAfter})`,
    );
    return this.mapEntry(inserted.rows[0]);
  }

  private async ensureProfile(userId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO player_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  }

  private mapEntry(row: unknown): WalletEntry {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: (r.user_id ?? r.userId) as string,
      currency: r.currency as string,
      amount: Number(r.amount),
      balanceBefore: Number(r.balance_before ?? r.balanceBefore),
      balanceAfter: Number(r.balance_after ?? r.balanceAfter),
      transactionType: (r.transaction_type ?? r.transactionType) as string,
      reason: (r.reason ?? null) as string | null,
      relatedEntityId: (r.related_entity_id ?? r.relatedEntityId ?? null) as string | null,
      idempotencyKey: (r.idempotency_key ?? r.idempotencyKey) as string,
      actor: r.actor as string,
      createdAt: new Date((r.created_at ?? r.createdAt) as string),
    };
  }

  /** Not used yet — reserved for read-only balance checks. */
  async assertSufficientBalance(userId: string, amount: number): Promise<void> {
    const balance = await this.getBalance(userId);
    if (balance < amount) {
      throw new BadRequestException(`Insufficient balance: have ${balance}, need ${amount}`);
    }
  }
}
