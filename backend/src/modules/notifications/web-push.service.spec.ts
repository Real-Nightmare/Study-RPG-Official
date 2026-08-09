import * as webpush from 'web-push';
import { WebPushService } from './web-push.service';

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

describe('WebPushService (Phase 9)', () => {
  it('is not configured without VAPID keys', () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, { get: () => undefined } as never);
    expect(service.isConfigured()).toBe(false);
    expect(service.getPublicKey()).toBeNull();
  });

  it('is configured with VAPID keys and exposes the public key', () => {
    const { db } = makeDb();
    const service = new WebPushService(
      db as never,
      {
        get: (key: string, fallback?: string) => {
          if (key === 'VAPID_PUBLIC_KEY') return KEYS.publicKey;
          if (key === 'VAPID_PRIVATE_KEY') return KEYS.privateKey;
          return fallback;
        },
      } as never,
    );
    expect(service.isConfigured()).toBe(true);
    expect(service.getPublicKey()).toBe(KEYS.publicKey);
  });

  it('stores a subscription via INSERT with conflict upsert', async () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, { get: () => undefined } as never);
    await service.subscribe('user-1', {
      endpoint: 'https://push.example.com/sub/1',
      p256dh: 'p256dh-value',
      auth: 'auth-value',
      userAgent: 'test-agent',
    });
    expect(db.query).toHaveBeenCalled();
    const sql = (db.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT (endpoint)');
    expect(sql).toContain('web_push_subscriptions');
  });

  it('rejects incomplete subscriptions', async () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, { get: () => undefined } as never);
    await expect(
      service.subscribe('user-1', { endpoint: '', p256dh: 'x', auth: 'y' }),
    ).rejects.toThrow('endpoint, p256dh and auth are all required');
  });

  it('sendToUser is a silent no-op when unconfigured', async () => {
    const { db } = makeDb();
    const service = new WebPushService(db as never, { get: () => undefined } as never);
    await expect(service.sendToUser('user-1', 't', 'b')).resolves.toBe(0);
    expect(db.queryMany).not.toHaveBeenCalled();
  });

  it('sendToUser is a no-op without stored subscriptions', async () => {
    const { db } = makeDb();
    db.queryMany = jest.fn(async () => []);
    const service = new WebPushService(
      db as never,
      {
        get: (key: string, fallback?: string) => {
          if (key === 'VAPID_PUBLIC_KEY') return KEYS.publicKey;
          if (key === 'VAPID_PRIVATE_KEY') return KEYS.privateKey;
          return fallback;
        },
      } as never,
    );
    await expect(service.sendToUser('user-1', 't', 'b')).resolves.toBe(0);
  });
});
