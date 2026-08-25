import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as webpush from 'web-push';
import { DatabaseService } from '../database/database.service';

export interface WebPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/**
 * Standards-based Web Push (VAPID) — the primary notification channel (owner
 * policy T6: no Google/Firebase account required). VAPID keys are resolved in
 * order: env → `game_config` (persisted from a previous boot) → generated on
 * first boot and persisted. A stock deployment therefore has working browser
 * push with ZERO setup. Sends degrade to silent no-ops when unconfigured.
 */
@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private configured = false;
  private publicKey: string | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    let publicKey: string | undefined = this.config.get<string>('VAPID_PUBLIC_KEY');
    let privateKey: string | undefined = this.config.get<string>('VAPID_PRIVATE_KEY');

    // Fall back to keys persisted by an earlier boot, then generate fresh ones.
    if (!publicKey || !privateKey) {
      const persisted = await this.loadPersistedKeys();
      publicKey = publicKey || persisted?.publicKey;
      privateKey = privateKey || persisted?.privateKey;
    }
    if (!publicKey || !privateKey) {
      try {
        const generated = webpush.generateVAPIDKeys();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;
        await this.persistKeys(publicKey, privateKey);
        this.logger.log('Generated and persisted new VAPID keys (zero-setup browser push)');
      } catch (error) {
        this.logger.warn(`Could not auto-generate VAPID keys: ${(error as Error).message}`);
      }
    }

    if (publicKey && privateKey) {
      const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:admin@studyrpg.app');
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        this.publicKey = publicKey;
        this.configured = true;
      } catch (error) {
        this.logger.warn(`Invalid VAPID keys, web push disabled: ${(error as Error).message}`);
      }
    }
  }

  private async loadPersistedKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
    try {
      const row = await this.db.queryOne<{ value: { publicKey?: string; privateKey?: string } }>(
        `SELECT value FROM game_config WHERE key = 'notifications.vapid'`,
      );
      if (row?.value?.publicKey && row?.value?.privateKey) {
        return { publicKey: row.value.publicKey, privateKey: row.value.privateKey };
      }
    } catch {
      /* table may not exist yet during bootstrap — fall through to generation */
    }
    return null;
  }

  private async persistKeys(publicKey: string, privateKey: string): Promise<void> {
    await this.db.query(
      `INSERT INTO game_config (key, value, description)
       VALUES ('notifications.vapid', $1::jsonb, 'Auto-generated VAPID keys for browser push')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ publicKey, privateKey })],
    );
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** Public key for the browser subscribe flow, or null when unconfigured. */
  getPublicKey(): string | null {
    return this.configured ? this.publicKey : null;
  }

  async subscribe(userId: string, input: WebPushSubscriptionInput): Promise<void> {
    if (!input.endpoint || !input.p256dh || !input.auth) {
      throw new Error('endpoint, p256dh and auth are all required');
    }
    await this.db.query(
      `INSERT INTO web_push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE SET
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW()`,
      [uuidv4(), userId, input.endpoint, input.p256dh, input.auth, input.userAgent || null],
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.db.query('DELETE FROM web_push_subscriptions WHERE user_id = $1 AND endpoint = $2', [
      userId,
      endpoint,
    ]);
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<number> {
    if (!this.configured) {
      return 0;
    }
    const rows = await this.db.queryMany<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>('SELECT endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1', [userId]);
    if (rows.length === 0) {
      return 0;
    }

    const payload = JSON.stringify({ title, body, ...data });
    let sent = 0;
    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent += 1;
      } catch (error) {
        const err = error as { statusCode?: number; message?: string };
        // 404/410 → the subscription is dead; drop it silently.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await this.unsubscribe(userId, sub.endpoint).catch(() => undefined);
        } else {
          this.logger.warn(`Web push failed for ${sub.endpoint}: ${err.message}`);
        }
      }
    }
    return sent;
  }
}
