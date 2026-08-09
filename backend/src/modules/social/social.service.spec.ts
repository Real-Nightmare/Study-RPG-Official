import { SocialService } from './social.service';

function makeDb() {
  const db = {
    queryOne: jest.fn(),
    queryMany: jest.fn(),
    query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] })),
  } as unknown as {
    queryOne: jest.Mock;
    queryMany: jest.Mock;
    query: jest.Mock;
  };
  return db;
}

function makeService(db: ReturnType<typeof makeDb>) {
  const notifications = { create: jest.fn(async () => ({})) };
  const audit = { log: jest.fn(async () => ({})) };
  const service = new SocialService(db as never, notifications as never, audit as never);
  return { service, notifications, audit };
}

describe('SocialService DMs (Phase 9)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects messages with blocked content and audits the attempt', async () => {
    const db = makeDb();
    db.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('friendships')) return { id: 'f1' }; // friend check passes
      if (sql.includes('game_config')) return { value: '{"maxPerMinute": 20}' };
      return null;
    });
    const { service, audit } = makeService(db);

    await expect(service.sendMessage('u1', 'u2', 'my address is 12 Elm Street')).rejects.toThrow(
      'content moderation',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'social.dm_moderated' }),
    );
  });

  it('rejects link-spam messages (>=4 bare links)', async () => {
    const db = makeDb();
    db.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('friendships')) return { id: 'f1' };
      return null;
    });
    const { service } = makeService(db);

    const spam = [1, 2, 3, 4].map((i) => `https://example.com/${i}`).join(' ');
    await expect(service.sendMessage('u1', 'u2', spam)).rejects.toThrow('too many links');
  });

  it('rejects when the per-minute rate limit is hit and audits it', async () => {
    const db = makeDb();
    db.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('friendships')) return { id: 'f1' };
      if (sql.includes('game_config')) return { value: '{"maxPerMinute": 20}' };
      if (sql.includes('COUNT(*)')) return { count: '20' }; // already at cap
      return null;
    });
    const { service, audit } = makeService(db);

    await expect(service.sendMessage('u1', 'u2', 'hello friend')).rejects.toThrow('too quickly');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'social.dm_rate_limited' }),
    );
  });

  it('allows clean messages under the limit', async () => {
    const db = makeDb();
    db.queryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('friendships')) return { id: 'f1' };
      if (sql.includes('game_config')) return { value: '{"maxPerMinute": 20}' };
      if (sql.includes('COUNT(*)')) return { count: '1' };
      if (sql.includes('INSERT INTO direct_messages')) {
        return {
          id: params?.[0],
          sender_id: params?.[1],
          recipient_id: params?.[2],
          body: params?.[3],
          created_at: new Date().toISOString(),
        };
      }
      return null;
    });
    const { service, audit } = makeService(db);

    const message = await service.sendMessage('u1', 'u2', 'Great job on the faction quest!');
    expect(message.body).toBe('Great job on the faction quest!');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('falls back to the default 20/min when config is missing', async () => {
    const db = makeDb();
    db.queryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('friendships')) return { id: 'f1' };
      if (sql.includes('game_config')) return null; // no config row
      if (sql.includes('COUNT(*)')) return { count: '20' };
      return null;
    });
    const { service } = makeService(db);
    await expect(service.sendMessage('u1', 'u2', 'hello')).rejects.toThrow('too quickly');
  });
});
