import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { WebPushService } from './web-push.service';
import { AppGateway } from '../../common/gateways/app.gateway';

export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'reminder';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface CreateNotificationDto {
  userId: string;
  type: Notification['type'];
  title: string;
  message: string;
  link?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  studyReminders: boolean;
  weeklyDigest: boolean;
  achievementAlerts: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: true,
  push: true,
  inApp: true,
  studyReminders: true,
  weeklyDigest: true,
  achievementAlerts: true,
};

/**
 * Notification pipeline: persisted row + real-time WebSocket push + VAPID
 * web push. No Firebase/FCM — only self-hosted Docker services.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly webPush: WebPushService,
    private readonly appGateway: AppGateway,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const id = uuidv4();
    const result = await this.db.queryOne<Notification>(
      `INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       RETURNING *`,
      [id, dto.userId, dto.type, dto.title, dto.message, dto.link || null, new Date()],
    );

    this.appGateway.notifyUser(dto.userId, {
      type: dto.type,
      title: dto.title,
      message: dto.message,
      id,
      link: dto.link || null,
      createdAt: new Date().toISOString(),
    });

    await this.sendPushNotification(dto.userId, dto.title, dto.message, {
      notificationId: id,
      type: dto.type,
    });

    this.logger.debug(`Notification created for user ${dto.userId}: ${dto.title}`);
    return this.mapNotification(result!);
  }

  async createBulk(notifications: CreateNotificationDto[]): Promise<void> {
    for (const dto of notifications) {
      await this.create(dto);
    }
  }

  async getByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
    const offset = (page - 1) * limit;

    const [results, countResult, unreadResult] = await Promise.all([
      this.db.queryMany<Notification>(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset],
      ),
      this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
        [userId],
      ),
      this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId],
      ),
    ]);

    return {
      data: results.map((row) => this.mapNotification(row)),
      total: parseInt(countResult?.count || '0', 10),
      unreadCount: parseInt(unreadResult?.count || '0', 10),
    };
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId],
    );
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);
  }

  async deleteAll(userId: string): Promise<void> {
    await this.db.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const result = await this.db.queryOne<NotificationPreferences>(
      'SELECT preferences FROM users WHERE id = $1',
      [userId],
    );

    const prefs = result as unknown as Record<string, unknown>;
    const stored = prefs?.preferences
      ? typeof prefs.preferences === 'string'
        ? JSON.parse(prefs.preferences)
        : prefs.preferences
      : {};

    const userPrefs = stored.notifications ?? {};
    return {
      ...DEFAULT_PREFERENCES,
      ...userPrefs,
    };
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...prefs };

    await this.db.query(
      `UPDATE users SET preferences = jsonb_set(COALESCE(preferences, '{}')::jsonb, '{notifications}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify(updated), userId],
    );

    return updated;
  }

  async sendStudyReminder(userId: string): Promise<void> {
    await this.create({
      userId,
      type: 'reminder',
      title: 'Time to study!',
      message: "Don't break your streak! Review some flashcards today.",
      link: '/study',
    });
  }

  async sendAchievementNotification(userId: string, achievement: string): Promise<void> {
    await this.create({
      userId,
      type: 'success',
      title: 'Achievement Unlocked!',
      message: achievement,
      link: '/achievements',
    });
  }

  /**
   * VAPID web push only — no FCM tokens, no Firebase.
   * Subscriptions are managed via WebPushService.subscribe/unsubscribe.
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const prefs = await this.getPreferences(userId);
      if (!prefs.push) return;

      const webSent = await this.webPush.sendToUser(userId, title, body, data);
      if (webSent > 0) {
        this.logger.debug(`Sent ${webSent} push notification(s) for user ${userId}`);
      }
    } catch (error) {
      this.logger.warn(`Push notification failed: ${(error as Error).message}`);
    }
  }

  private mapNotification(row: unknown): Notification {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      type: r.type as Notification['type'],
      title: r.title as string,
      message: r.message as string,
      link: r.link as string | null,
      isRead: r.is_read as boolean,
      createdAt: new Date(r.created_at as string),
    };
  }
}
