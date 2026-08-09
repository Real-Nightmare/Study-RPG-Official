import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { normalizeRetentionDays, purgeCondition } from './audit-retention';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface LogAuditParams {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  reason: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Write an audit log entry. `reason` is REQUIRED for every mutating admin
   * action — callers must pass a non-empty string (throw otherwise).
   */
  async log(params: LogAuditParams): Promise<AuditLogEntry> {
    const reason = (params.reason || '').trim();
    if (!reason) {
      throw new Error('Audit log requires a reason');
    }

    const id = uuidv4();
    const result = await this.db.queryOne<AuditLogEntry>(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, reason, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, actor_id, action, target_type, target_id, reason, details, created_at`,
      [
        id,
        params.actorId,
        params.action,
        params.targetType || null,
        params.targetId || null,
        reason,
        JSON.stringify(params.details || {}),
        new Date(),
      ],
    );

    this.logger.log(`Audit: ${params.action} by ${params.actorId || 'system'} — ${reason}`);
    return this.mapEntry(result!);
  }

  async list(options: {
    actorId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLogEntry[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.actorId) {
      conditions.push(`a.actor_id = $${paramIndex++}`);
      values.push(options.actorId);
    }
    if (options.action) {
      conditions.push(`a.action = $${paramIndex++}`);
      values.push(options.action);
    }
    if (options.targetType) {
      conditions.push(`a.target_type = $${paramIndex++}`);
      values.push(options.targetType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      this.db.queryMany<AuditLogEntry>(
        `SELECT a.id, a.actor_id, a.action, a.target_type, a.target_id, a.reason, a.details, a.created_at,
                u.name AS actor_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset],
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM audit_logs a ${where}`,
        values,
      ),
    ]);

    return {
      data: rows.map((r) => this.mapEntry(r)),
      total: parseInt(countResult?.count || '0', 10),
    };
  }

  // -------------------------------------------------------------------------
  // Phase 9 — Export + retention
  // -------------------------------------------------------------------------

  /** CSV export of the same filtered view used by the list endpoint. */
  async exportCsv(options: {
    actorId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
  }): Promise<string> {
    const { data } = await this.list({ ...options, limit: options.limit ?? 5000 });
    const header = [
      'id',
      'created_at',
      'actor_id',
      'actor_name',
      'action',
      'target_type',
      'target_id',
      'reason',
      'details',
    ];
    const escape = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = data.map((e) =>
      [
        e.id,
        e.createdAt.toISOString(),
        e.actorId,
        e.actorName,
        e.action,
        e.targetType,
        e.targetId,
        e.reason,
        JSON.stringify(e.details),
      ]
        .map(escape)
        .join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  /** JSON export of the same filtered view. */
  async exportJson(options: {
    actorId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const { data } = await this.list({ ...options, limit: options.limit ?? 5000 });
    return data;
  }

  /** Current retention window from `game_config security.audit.retentionDays`. */
  async getRetention(): Promise<{ retentionDays: number }> {
    const row = await this.db.queryOne<{ value: unknown }>(
      "SELECT value FROM game_config WHERE key = 'security.audit'",
    );
    const value =
      row && typeof row.value === 'string'
        ? (JSON.parse(row.value) as Record<string, unknown>)
        : {};
    return { retentionDays: normalizeRetentionDays(value.retentionDays ?? 365) };
  }

  /** Admin sets the retention window (audited, reason required). */
  async setRetention(actorId: string, retentionDays: number, reason: string): Promise<void> {
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      throw new BadRequestException('A reason is required for admin actions');
    }
    const days = normalizeRetentionDays(retentionDays);
    await this.db.query(
      `INSERT INTO game_config (key, value) VALUES ('security.audit', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ retentionDays: days })],
    );
    await this.log({
      actorId,
      action: 'audit.retention_set',
      targetType: 'system',
      reason: cleanReason,
      details: { retentionDays: days },
    });
  }

  /**
   * Deletes entries older than the window. Advisory-locked so concurrent runs
   * never double-purge; the run itself is audited. A disabled window (0 days)
   * is a safe no-op.
   */
  async purgeOlderThan(days: number, actorId: string | null = null): Promise<{ deleted: number }> {
    const condition = purgeCondition(days);
    if (!condition) {
      return { deleted: 0 };
    }
    return this.db.transaction<{ deleted: number }>(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [742913]); // 'audit' lock key
      const result = await client.query<{ deleted: string }>(
        `DELETE FROM audit_logs WHERE ${condition} RETURNING id`,
      );
      const deleted = result.rowCount ?? 0;
      if (deleted > 0) {
        await client.query(
          `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, reason, details, created_at)
           VALUES ($1, $2, 'audit.purge', 'system', NULL, $3, $4, NOW())`,
          [
            uuidv4(),
            actorId,
            `Automated retention purge removed ${deleted} entries older than ${days} days`,
            JSON.stringify({ retentionDays: days, deleted }),
          ],
        );
      }
      return { deleted };
    });
  }

  private mapEntry(row: unknown): AuditLogEntry {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      actorId: (r.actor_id as string | null) || null,
      actorName: (r.actor_name as string | null) || null,
      action: r.action as string,
      targetType: (r.target_type as string | null) || null,
      targetId: (r.target_id as string | null) || null,
      reason: r.reason as string,
      details:
        typeof r.details === 'string'
          ? JSON.parse(r.details)
          : (r.details as Record<string, unknown>) || {},
      createdAt: new Date(r.created_at as string),
    };
  }
}
