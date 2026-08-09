import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../admin/audit.service';
import { moderationVerdict, isRateLimited } from './dm-moderation';

export interface FriendUser {
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  status: 'accepted' | 'pending' | 'blocked';
  direction: 'outgoing' | 'incoming';
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- Friends ----------------

  async searchUsers(query: string, limit = 10) {
    const rows = await this.db.queryMany<{
      id: string;
      name: string;
      username: string | null;
      email: string | null;
      avatar_url: string | null;
    }>(
      `SELECT id, name, username, email, avatar_url
       FROM users
       WHERE name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1
       ORDER BY name ASC
       LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username,
      email: r.email,
      avatarUrl: r.avatar_url,
    }));
  }

  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
    if (requesterId === addresseeId) {
      throw new BadRequestException('You cannot friend yourself');
    }
    const target = await this.db.queryOne('SELECT id FROM users WHERE id = $1', [addresseeId]);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.db.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [requesterId, addresseeId],
    );
    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException('Already friends');
      }
      if (existing.status === 'blocked') {
        throw new BadRequestException('This relationship is blocked');
      }
      throw new BadRequestException('Friend request already pending');
    }

    await this.db.query(
      `INSERT INTO friendships (id, requester_id, addressee_id, status)
       VALUES ($1, $2, $3, 'pending')`,
      [uuidv4(), requesterId, addresseeId],
    );

    await this.notifications.create({
      userId: addresseeId,
      type: 'info',
      title: 'New friend request',
      message: 'Someone wants to be your study friend.',
      link: '/dashboard/social',
    });
  }

  async respondToRequest(userId: string, friendshipId: string, accept: boolean): Promise<void> {
    const friendship = await this.db.queryOne<{ id: string; requester_id: string }>(
      'SELECT id, requester_id FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = $3',
      [friendshipId, userId, 'pending'],
    );
    if (!friendship) {
      throw new NotFoundException('Pending friend request not found');
    }

    if (accept) {
      await this.db.query('UPDATE friendships SET status = $1, responded_at = $2 WHERE id = $3', [
        'accepted',
        new Date(),
        friendshipId,
      ]);
      await this.notifications.create({
        userId: friendship.requester_id,
        type: 'success',
        title: 'Friend request accepted',
        message: 'You are now study friends.',
        link: '/dashboard/social',
      });
    } else {
      await this.db.query('DELETE FROM friendships WHERE id = $1', [friendshipId]);
    }
  }

  async blockUser(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) {
      throw new BadRequestException('Cannot block yourself');
    }
    await this.db.query(
      `INSERT INTO friendships (id, requester_id, addressee_id, status)
       VALUES ($1, $2, $3, 'blocked')
       ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'blocked'`,
      [uuidv4(), userId, targetId],
    );
  }

  async listFriends(userId: string): Promise<FriendUser[]> {
    const rows = await this.db.queryMany<{
      id: string;
      status: string;
      user_id: string;
      direction: string;
      name: string;
      username: string | null;
      email: string | null;
      avatar_url: string | null;
    }>(
      `SELECT f.id, f.status,
              CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS user_id,
              CASE WHEN f.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
              u.name, u.username, u.email, u.avatar_url
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1)
         AND f.status IN ('accepted', 'pending')
       ORDER BY f.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      username: r.username,
      email: r.email,
      avatarUrl: r.avatar_url,
      status: r.status as FriendUser['status'],
      direction: r.direction as FriendUser['direction'],
    }));
  }

  // ---------------- Direct messages ----------------

  async listConversations(userId: string): Promise<FriendUser[]> {
    // Friends (accepted) are the conversation list; pending handled separately.
    const friends = await this.listFriends(userId);
    return friends.filter((f) => f.status === 'accepted');
  }

  async getMessages(userId: string, friendId: string, limit = 100): Promise<DirectMessage[]> {
    await this.requireFriend(userId, friendId);
    const rows = await this.db.queryMany<DirectMessage>(
      `SELECT * FROM direct_messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at ASC
       LIMIT $3`,
      [userId, friendId, limit],
    );
    return rows.map((r) => this.mapMessage(r));
  }

  async sendMessage(userId: string, friendId: string, body: string): Promise<DirectMessage> {
    const cleanBody = (body || '').trim();
    if (!cleanBody) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (cleanBody.length > 4000) {
      throw new BadRequestException('Message too long (max 4000 chars)');
    }
    await this.requireFriend(userId, friendId);

    // Phase 9 §32: no unrestricted private messaging — rate limit + moderation.
    const verdict = moderationVerdict(cleanBody);
    if (verdict.severity === 2) {
      await this.audit.log({
        actorId: userId,
        action: 'social.dm_moderated',
        targetType: 'user',
        targetId: friendId,
        reason: `Blocked DM: ${verdict.reason}`,
        details: { severity: 2 },
      });
      throw new BadRequestException(
        'This message was blocked by content moderation. Reach out to an admin if you believe this is a mistake.',
      );
    }
    if (verdict.severity === 1) {
      await this.audit.log({
        actorId: userId,
        action: 'social.dm_moderated',
        targetType: 'user',
        targetId: friendId,
        reason: `Link-spam DM blocked: ${verdict.reason}`,
        details: { severity: 1, linkCount: verdict.linkCount },
      });
      throw new BadRequestException('This message was blocked because it contains too many links.');
    }

    const config = await this.dmConfig();
    const sentInWindow = await this.countMessagesInWindow(userId);
    if (isRateLimited(sentInWindow, config.maxPerMinute)) {
      await this.audit.log({
        actorId: userId,
        action: 'social.dm_rate_limited',
        targetType: 'user',
        targetId: friendId,
        reason: `DM rate limit hit (${config.maxPerMinute}/min)`,
        details: { sentInWindow },
      });
      throw new BadRequestException(
        `You are sending messages too quickly (max ${config.maxPerMinute} per minute). Slow down and try again.`,
      );
    }

    const id = uuidv4();
    const result = await this.db.queryOne<DirectMessage>(
      `INSERT INTO direct_messages (id, sender_id, recipient_id, body, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, userId, friendId, cleanBody, new Date()],
    );

    await this.notifications.create({
      userId: friendId,
      type: 'info',
      title: 'New message',
      message: cleanBody.substring(0, 120),
      link: '/dashboard/social',
    });

    return this.mapMessage(result!);
  }

  /** Reads `security.dm.maxPerMinute` from game_config (code default 20). */
  private async dmConfig(): Promise<{ maxPerMinute: number }> {
    const row = await this.db.queryOne<{ value: unknown }>(
      "SELECT value FROM game_config WHERE key = 'security.dm'",
    );
    const value =
      row && typeof row.value === 'string'
        ? (JSON.parse(row.value) as Record<string, unknown>)
        : {};
    const maxPerMinute = Number(value.maxPerMinute ?? 20);
    return {
      maxPerMinute: Number.isFinite(maxPerMinute) && maxPerMinute > 0 ? maxPerMinute : 20,
    };
  }

  /** Count of messages sent by the user in the last 60 seconds. */
  private async countMessagesInWindow(userId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM direct_messages
       WHERE sender_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
      [userId],
    );
    return parseInt(row?.count || '0', 10);
  }

  async markRead(userId: string, friendId: string): Promise<void> {
    await this.db.query(
      `UPDATE direct_messages SET read_at = $1
       WHERE recipient_id = $2 AND sender_id = $3 AND read_at IS NULL`,
      [new Date(), userId, friendId],
    );
  }

  async unreadCount(userId: string): Promise<number> {
    const result = await this.db.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM direct_messages WHERE recipient_id = $1 AND read_at IS NULL',
      [userId],
    );
    return parseInt(result?.count || '0', 10);
  }

  private async requireFriend(userId: string, friendId: string): Promise<void> {
    const row = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [userId, friendId],
    );
    if (!row) {
      throw new BadRequestException('You must be friends to message');
    }
  }

  private mapMessage(row: unknown): DirectMessage {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      senderId: r.sender_id as string,
      recipientId: r.recipient_id as string,
      body: r.body as string,
      readAt: r.read_at ? new Date(r.read_at as string) : null,
      createdAt: new Date(r.created_at as string),
    };
  }
}
