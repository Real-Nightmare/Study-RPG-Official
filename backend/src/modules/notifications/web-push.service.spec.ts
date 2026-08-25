import * as webpush from 'web-push';
import { WebPushService } from './web-push.service';

// web-push does not allow redefining its exports, so wrap the real module and
// let individual tests inject a generation failure.
const mockGeneration: { failure: Error | null } = { failure: null };

jest.mock('web-push', () => {
  const actual = jest.requireActual('web-push') as typeof import('web-push');
  return {
    generateVAPIDKeys: () => {
      if (mockGeneration.failure) throw mockGeneration.failure;
      return actual.generateVAPIDKeys();
    },
    setVapidDetails: actual.setVapidDetails.bind(actual),
    sendNotification: actual.sendNotification.bind(actual),
  };
});

// Real 65-byte VAPID keys so setVapidDetails passes validation.
const KEYS = webpush.generateVAPIDKeys();

function makeDb() {
  const subscriptions: Array<Record<string, unknown>> = [];
  const db = {
    query: jest.fn(async () => {
      /* insert/delete */
    }),
    queryOne: jest.fn(async () => null),
    queryMany: jest.fn(async () => [] as unknown[]),
  };
  return { db, subscriptions };
}

function makeConfig(keys?: { publicKey?: string; privateKey?: string }) {
  return {
    get: (key: string, fallback?: string) => {
      if (keys) {
        if (key === 'VAPID_PUBLIC_KEY') return keys.publicKey;
        if (key === 'VAPID_PRIVATE_KEY') return keys.privateKey;
      }
      return fallback;
    },
  };
}

describe('WebPushService', () => {
  afterEach(() => {
    mockGeneration.failure = null;
  });

  it('is not configured without VAPID keys when generation is unavailable', async () => {
    const { db } = makeDb();
    db.queryOne.mockRejectedValue(new Error('no table'));
    mockGeneration.failure = new Error('no crypto');
    const service = new WebPushService(db as never, makeConfig() as never);
    await service.onModuleInit();
    expect(service.isConfigured()).toBe(false);
    expect(service.getPublicKey()).toBeNull();
  });

  it('is configured with VAPID keys and exposes the public key', async () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, makeConfig(KEYS) as never);
    await service.onModuleInit();
    expect(service.isConfigured()).toBe(true);
    expect(service.getPublicKey()).toBe(KEYS.publicKey);
  });

  it('generates and persists VAPID keys on first boot (zero-setup push)', async () => {
    const { db } = makeDb();
    db.queryOne.mockRejectedValue(new Error('no table')); // nothing persisted yet
    const service = new WebPushService(db as never, makeConfig() as never);
    await service.onModuleInit();

    expect(service.isConfigured()).toBe(true);
    // Keys were persisted into game_config for subsequent boots.
    expect(db.query).toHaveBeenCalled();
    const sql = (db.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('game_config');
    expect(sql).toContain("'notifications.vapid'");
  });

  it('reuses keys persisted in game_config across restarts', async () => {
    const { db } = makeDb();
    db.queryOne.mockResolvedValue({
      value: { publicKey: KEYS.publicKey, privateKey: KEYS.privateKey },
    } as never);
    const service = new WebPushService(db as never, makeConfig() as never);
    await service.onModuleInit();
    expect(service.isConfigured()).toBe(true);
    expect(service.getPublicKey()).toBe(KEYS.publicKey);
  });

  it('stores a subscription via INSERT with conflict upsert', async () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, makeConfig() as never);
    await service.subscribe('user-1', {
      endpoint: 'https://push.example.com/sub/1',
      p256dh: 'p256dh-value',
      auth: 'auth-value',
      userAgent: 'test-agent',
    });
    expect(db.query).toHaveBeenCalled();
    const sql = (db.query as jest.Mock).mock.calls.at(-1)[0] as string;
    expect(sql).toContain('ON CONFLICT (endpoint)');
    expect(sql).toContain('web_push_subscriptions');
  });

  it('rejects incomplete subscriptions', async () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, makeConfig() as never);
    await expect(
      service.subscribe('user-1', { endpoint: '', p256dh: 'x', auth: 'y' }),
    ).rejects.toThrow('endpoint, p256dh and auth are all required');
  });

  it('sendToUser is a silent no-op when unconfigured', async () => {
    const { db } = makeDb();
    db.queryOne.mockRejectedValue(new Error('no table'));
    mockGeneration.failure = new Error('no crypto');
    const service = new WebPushService(db as never, makeConfig() as never);
    await service.onModuleInit();
    await expect(service.sendToUser('user-1', 't', 'b')).resolves.toBe(0);
    expect(db.queryMany).not.toHaveBeenCalled();
  });

  it('sendToUser is a no-op without stored subscriptions', async () => {
    const { db } = makeDb();
    db.queryMany = jest.fn(async () => []);
    const service = new WebPushService(db as never, makeConfig(KEYS) as never);
    await service.onModuleInit();
    await expect(service.sendToUser('user-1', 't', 'b')).resolves.toBe(0);
  });
});
