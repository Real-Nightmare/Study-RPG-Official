import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { AuditService } from './audit.service';
import { UsersService } from '../users/users.service';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../redis/redis.service';
import { QdrantService } from '../qdrant/qdrant.service';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export interface CreateManagedUserDto {
  name: string;
  email?: string;
  username?: string;
  password: string;
  role?: 'user' | 'teacher' | 'admin';
  reason: string;
}

export interface UpdateManagedUserDto {
  name?: string;
  email?: string;
  username?: string;
  role?: 'user' | 'teacher' | 'admin';
  isActive?: boolean;
  reason: string;
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly qdrant: QdrantService,
  ) {}

  async onModuleInit() {
    await this.ensureNightmareAdmin();
    this.registerRetentionWorker();
  }

  /**
   * Phase 9: scheduled audit-retention purge (daily repeatable BullMQ job).
   * Safe when Redis is unavailable — worker registration is best-effort.
   */
  private registerRetentionWorker(): void {
    try {
      const worker = this.queue.registerWorker<{ retentionDays?: number }>(
        'audit-retention',
        async (job) => {
          const retention = await this.audit.getRetention();
          const days = job.data?.retentionDays ?? retention.retentionDays;
          return this.audit.purgeOlderThan(days);
        },
        1,
      );
      worker.on('completed', (job) => {
        this.logger.log(`Audit retention purge job ${job.id} completed`);
      });
      void this.queue
        .addJob(
          'audit-retention',
          'daily-retention',
          {},
          {
            repeat: { every: 24 * 60 * 60 * 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        )
        .catch((error) => this.logger.warn(`Could not schedule retention job: ${error.message}`));
    } catch (error) {
      this.logger.warn(`Audit retention worker unavailable: ${(error as Error).message}`);
    }
  }

  /** Seed the built-in Nightmare super-admin when no admin account exists. */
  private async ensureNightmareAdmin(): Promise<void> {
    try {
      const existing = await this.db.queryOne<{ id: string }>(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
      );
      if (existing) {
        return;
      }

      const username = this.config.get<string>('NIGHTMARE_ADMIN_USERNAME', 'nightmare');
      const email = this.config.get<string>('NIGHTMARE_ADMIN_EMAIL', 'nightmare@studyrpg.app');
      const password = this.config.get<string>('NIGHTMARE_ADMIN_PASSWORD', '123456789');

      const user = await this.users.create({
        username,
        email,
        password: await bcrypt.hash(password, 12),
        name: 'Nightmare',
        role: 'admin',
        emailVerified: true,
      });

      await this.audit.log({
        actorId: user.id,
        action: 'admin.seed',
        targetType: 'user',
        targetId: user.id,
        reason: 'Initial super-admin bootstrap (Phase 6 governance)',
      });
      this.logger.log(`Seeded Nightmare super-admin (${username})`);
    } catch (error) {
      this.logger.error('Failed to seed Nightmare admin', error);
    }
  }

  async listUsers(options: {
    search?: string;
    role?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AdminUserRow[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.search) {
      conditions.push(
        `(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`,
      );
      values.push(`%${options.search}%`);
      paramIndex++;
    }
    if (options.role) {
      conditions.push(`u.role = $${paramIndex++}`);
      values.push(options.role);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      this.db.queryMany<AdminUserRow>(
        `SELECT u.id, u.name, u.email, u.username, u.role, u.is_active, u.email_verified,
                u.created_at, u.last_login_at
         FROM users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset],
      ),
      this.db.queryOne<{ count: string }>(`SELECT COUNT(*) AS count FROM users u ${where}`, values),
    ]);

    return {
      data: rows,
      total: parseInt(countResult?.count || '0', 10),
    };
  }

  async createUser(actorId: string, dto: CreateManagedUserDto): Promise<AdminUserRow> {
    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    if (!dto.email && !dto.username) {
      throw new BadRequestException('Provide an email or a username');
    }
    if (dto.email) {
      const existing = await this.users.findByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already registered');
      }
    }
    if (dto.username) {
      const existing = await this.users.findByUsername(dto.username);
      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }

    const user = await this.users.create({
      email: dto.email,
      username: dto.username,
      password: await bcrypt.hash(dto.password, 12),
      name: dto.name,
      role: dto.role || 'user',
      emailVerified: true,
    });

    await this.audit.log({
      actorId,
      action: 'admin.create_user',
      targetType: 'user',
      targetId: user.id,
      reason,
      details: { role: dto.role || 'user', name: dto.name },
    });

    return this.mapRow(user);
  }

  async updateUser(
    actorId: string,
    userId: string,
    dto: UpdateManagedUserDto,
  ): Promise<AdminUserRow> {
    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (userId === actorId && dto.isActive === false) {
      throw new BadRequestException('You cannot disable your own account');
    }

    await this.users.update(userId, {
      name: dto.name,
      email: dto.email,
      username: dto.username,
    });

    if (dto.isActive !== undefined) {
      await this.db.query('UPDATE users SET is_active = $1 WHERE id = $2', [dto.isActive, userId]);
    }
    if (dto.role && dto.role !== user.role) {
      await this.db.query('UPDATE users SET role = $1 WHERE id = $2', [dto.role, userId]);
    }

    await this.audit.log({
      actorId,
      action: 'admin.update_user',
      targetType: 'user',
      targetId: userId,
      reason,
      details: {
        role: dto.role || user.role,
        isActive: dto.isActive,
      },
    });

    const refreshed = await this.users.findById(userId);
    if (!refreshed) {
      throw new NotFoundException('User not found after update');
    }
    return this.mapRow(refreshed);
  }

  async resetPassword(
    actorId: string,
    userId: string,
    newPassword: string,
    reason: string,
  ): Promise<void> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.users.updatePassword(userId, await bcrypt.hash(newPassword, 12));
    await this.audit.log({
      actorId,
      action: 'admin.reset_password',
      targetType: 'user',
      targetId: userId,
      reason: cleanReason,
    });
  }

  // -------------------------------------------------------------------------
  // Phase 9 — System status dashboard
  // -------------------------------------------------------------------------

  async status(): Promise<Record<string, unknown>> {
    const [users, auditCount, activeEvents, factions, queueHealth, dbHealth] = await Promise.all([
      this.db.queryMany<{ role: string; count: string }>(
        'SELECT role, COUNT(*)::text AS count FROM users GROUP BY role',
      ),
      this.db.queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM audit_logs'),
      this.db.queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM events WHERE status = 'active'",
      ),
      this.db.queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM factions WHERE status = 'active'",
      ),
      Promise.resolve().then(async () => {
        try {
          return await this.queue.healthCheck();
        } catch {
          return false;
        }
      }),
      Promise.resolve().then(async () => {
        try {
          await this.db.query('SELECT 1');
          return true;
        } catch {
          return false;
        }
      }),
    ]);

    const queueStats = await this.queue
      .getQueueStats('default')
      .catch(() => ({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }));

    return {
      users: Object.fromEntries(users.map((r) => [r.role, parseInt(r.count, 10)])),
      auditCount: parseInt(auditCount?.count || '0', 10),
      activeEvents: parseInt(activeEvents?.count || '0', 10),
      activeFactions: parseInt(factions?.count || '0', 10),
      health: {
        database: dbHealth,
        redis: await this.redis.healthCheck().catch(() => false),
        qdrant: await this.qdrant.healthCheck().catch(() => false),
        queue: queueHealth,
      },
      queue: queueStats,
    };
  }

  private mapRow(user: {
    id: string;
    name: string;
    email: string | null;
    username: string | null;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: Date;
    lastLoginAt: Date | null;
  }): AdminUserRow {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      is_active: user.isActive,
      email_verified: user.emailVerified,
      created_at: user.createdAt,
      last_login_at: user.lastLoginAt,
    };
  }
}
