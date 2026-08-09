import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';

function makeDb() {
  const state: { profiles: Map<string, number>; ledger: any[] } = {
    profiles: new Map(),
    ledger: [],
  };
  const client = {
    query: async (text: string, params: unknown[] = []) => {
      if (/INSERT INTO player_profiles/.test(text)) {
        if (!state.profiles.has(params[0] as string)) state.profiles.set(params[0] as string, 0);
        return { rows: [] };
      }
      if (/SELECT stp FROM player_profiles WHERE user_id = \$1 FOR UPDATE/.test(text)) {
        if (!state.profiles.has(params[0] as string)) state.profiles.set(params[0] as string, 0);
        return { rows: [{ stp: state.profiles.get(params[0] as string) }] };
      }
      if (/SELECT id, user_id, currency/.test(text)) {
        const existing = state.ledger.find(
          (e) => e.user_id === params[0] && e.idempotency_key === params[1],
        );
        return { rows: existing ? [existing] : [] };
      }
      if (/INSERT INTO wallet_ledger/.test(text)) {
        const entry = {
          id: params[0],
          user_id: params[1],
          currency: 'STP',
          amount: params[2],
          balance_before: params[3],
          balance_after: params[4],
          transaction_type: params[5],
          reason: params[6],
          related_entity_id: params[7],
          idempotency_key: params[8],
          actor: params[9],
          created_at: new Date(),
        };
        state.ledger.push(entry);
        return { rows: [entry] };
      }
      if (/UPDATE player_profiles SET stp/.test(text)) {
        state.profiles.set(params[1] as string, params[0] as number);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return {
    state,
    db: {
      transaction: async (cb: any) => {
        return cb(client);
      },
      query: client.query,
      queryOne: client.query,
      queryMany: client.query,
    } as any,
  };
}

describe('WalletService', () => {
  it('credits STP and records an immutable ledger entry', async () => {
    const { db, state } = makeDb();
    const wallet = new WalletService(db);
    const entry = await wallet.applyChange('u1', {
      amount: 40,
      transactionType: 'battle_win',
      idempotencyKey: 'battle_win:b1',
    });
    expect(entry.balanceBefore).toBe(0);
    expect(entry.balanceAfter).toBe(40);
    expect(state.profiles.get('u1')).toBe(40);
    expect(state.ledger).toHaveLength(1);
  });

  it('is idempotent per user+key', async () => {
    const { db, state } = makeDb();
    const wallet = new WalletService(db);
    await wallet.applyChange('u1', {
      amount: 40,
      transactionType: 'battle_win',
      idempotencyKey: 'k',
    });
    await wallet.applyChange('u1', {
      amount: 40,
      transactionType: 'battle_win',
      idempotencyKey: 'k',
    });
    expect(state.ledger).toHaveLength(1);
    expect(state.profiles.get('u1')).toBe(40);
  });

  it('rejects a debit that would go negative', async () => {
    const { db } = makeDb();
    const wallet = new WalletService(db);
    await expect(
      wallet.applyChange('u1', { amount: -50, transactionType: 'purchase', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects zero or non-integer amounts', async () => {
    const { db } = makeDb();
    const wallet = new WalletService(db);
    await expect(
      wallet.applyChange('u1', { amount: 0, transactionType: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      wallet.applyChange('u1', { amount: 1.5, transactionType: 'x', idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
