import { Injectable, Logger } from '@nestjs/common';
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
 * Standards-based Web Push (VAPID) — PDF Phase 9 §32-adjacent. Additive channel
 * on top of Firebase FCM. Everything degrades gracefully: when VAPID keys are
 * absent or the user has no subscriptions, sends are silent no-ops.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private configured = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:admin@studyrpg.app');
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** Public key for the browser subscribe flow, or null when unconfigured. */
  getPublicKey(): string | null {
    return this.configured ? this.config.get<string>('VAPID_PUBLIC_KEY') || null : null;
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
