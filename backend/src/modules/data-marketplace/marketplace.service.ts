/**
 * Data marketplace service (owner brief).
 *
 * Privacy-first rules enforced here (mirrored in `privacy-guard.ts`):
 *   1. Only AGGREGATES may be published — raw rows and per-user values never
 *      leave the module (`sanitizeAggregate` is the final gate).
 *   2. Only consenting students (`data_consent`) are included in published
 *      aggregates.
 *   3. A minimum cohort size and consent-coverage threshold must be met
 *      before anything can be published.
 *   4. Every publish/revoke action is audited with a reason.
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { assertPublishable, sanitizeAggregate } from './privacy-guard';
import {
  ALLOWED_COHORT_FILTERS,
  CohortFilterKey,
  DATASET_TYPES,
  DatasetType,
  MARKETPLACE_DEFAULTS,
} from './marketplace-config';
import { OceanService } from './ocean.service';

export interface ConsentView {
  consented: boolean;
  consentedAt: string | null;
  withdrawnAt: string | null;
}

export interface CreateDatasetInput {
  name: string;
  description?: string;
  datasetType: DatasetType;
  cohortFilters?: Partial<Record<CohortFilterKey, string>>;
  priceCurrency?: string;
  priceAmount?: number;
  reason: string;
}

export interface UpdateDatasetInput {
  name?: string;
  description?: string;
  datasetType?: DatasetType;
  cohortFilters?: Partial<Record<CohortFilterKey, string>>;
  priceCurrency?: string;
  priceAmount?: number;
  reason: string;
}

export interface DatasetView {
  id: string;
  name: string;
  description: string;
  datasetType: string;
  cohortFilters: Record<string, string>;
  priceCurrency: string;
  priceAmount: number;
  status: 'draft' | 'published' | 'revoked';
  did: string | null;
  privacyReport: Record<string, unknown> | null;
  checksum: string | null;
  createdAt: string;
  publishedAt: string | null;
  revokedAt: string | null;
}

const AGGREGATE_WINDOW_DAYS = Number(process.env.MARKETPLACE_AGGREGATE_WINDOW_DAYS || 90);

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ocean: OceanService,
  ) {}

  // -------------------------------------------------------------------------
  // Consent (students)
  // -------------------------------------------------------------------------

  async getConsent(userId: string): Promise<ConsentView> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT consented, consented_at, withdrawn_at FROM data_consent WHERE user_id = $1`,
      [userId],
    );
    return {
      consented: Boolean(row?.consented ?? false),
      consentedAt: row?.consented_at ? new Date(row.consented_at as string).toISOString() : null,
      withdrawnAt: row?.withdrawn_at ? new Date(row.withdrawn_at as string).toISOString() : null,
    };
  }

  async setConsent(userId: string, consented: boolean): Promise<ConsentView> {
    const now = new Date();
    await this.db.query(
      `INSERT INTO data_consent (user_id, consented, consented_at, withdrawn_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         consented = EXCLUDED.consented,
         consented_at = CASE WHEN EXCLUDED.consented THEN EXCLUDED.consented_at ELSE data_consent.consented_at END,
         withdrawn_at = CASE WHEN EXCLUDED.consented THEN NULL ELSE EXCLUDED.withdrawn_at END,
         updated_at = EXCLUDED.updated_at`,
      [userId, consented, consented ? now : null, consented ? null : now, now],
    );
    await this.audit(
      userId,
      'data_consent.change',
      'data_consent',
      null,
      consented
        ? 'Student opted in to anonymised aggregate data sharing.'
        : 'Student withdrew consent for anonymised aggregate data sharing.',
      { consented },
    );
    return this.getConsent(userId);
  }

  // -------------------------------------------------------------------------
  // Datasets (admin CRUD)
  // -------------------------------------------------------------------------

  async listDatasets(actorRole: string | undefined): Promise<DatasetView[]> {
    const where = actorRole === 'admin' ? '' : "WHERE status = 'published'";
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT id, name, description, dataset_type, cohort_filters, price_currency,
              price_amount, status, did, privacy_report, checksum,
              created_at, published_at, revoked_at
       FROM marketplace_datasets ${where}
       ORDER BY created_at DESC`,
      [],
    );
    return rows.map((r) => this.mapDataset(r));
  }

  async createDataset(actorId: string, input: CreateDatasetInput): Promise<DatasetView> {
    if (!input.name?.trim()) throw new BadRequestException('Dataset name is required.');
    if (!DATASET_TYPES.includes(input.datasetType)) {
      throw new BadRequestException(`datasetType must be one of: ${DATASET_TYPES.join(', ')}`);
    }
    const filters = this.normalizeFilters(input.cohortFilters);
    const id = uuidv4();
    await this.db.query(
      `INSERT INTO marketplace_datasets
         (id, name, description, dataset_type, cohort_filters, price_currency, price_amount,
          status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, NOW(), NOW())`,
      [
        id,
        input.name.trim(),
        input.description?.trim() ?? '',
        input.datasetType,
        JSON.stringify(filters),
        input.priceCurrency || 'OCEAN',
        input.priceAmount ?? 0,
        actorId,
      ],
    );
    await this.audit(
      actorId,
      'data_marketplace.dataset_create',
      'marketplace_datasets',
      id,
      input.reason || `Created dataset "${input.name.trim()}".`,
      { datasetType: input.datasetType },
    );
    this.logger.log(`Dataset created by ${actorId}: ${id}`);
    const created = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, name, description, dataset_type, cohort_filters, price_currency, price_amount,
              status, did, privacy_report, checksum, created_at, published_at, revoked_at
       FROM marketplace_datasets WHERE id = $1`,
      [id],
    );
    return this.mapDataset(created!);
  }

  async updateDataset(
    actorId: string,
    id: string,
    input: UpdateDatasetInput,
  ): Promise<DatasetView> {
    const existing = await this.getDatasetRow(id);
    if (!existing) throw new NotFoundException('Dataset not found');
    if (existing.status === 'published' && input.datasetType) {
      throw new BadRequestException(
        'Cannot change the type of a published dataset — revoke it first.',
      );
    }

    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;
    const setIf = (col: string, val: unknown, isJson = false) => {
      if (val !== undefined) {
        sets.push(`${col} = $${i++}`);
        values.push(isJson ? JSON.stringify(val) : val);
      }
    };
    setIf('name', input.name?.trim());
    setIf('description', input.description?.trim());
    setIf('dataset_type', input.datasetType);
    if (input.cohortFilters)
      setIf('cohort_filters', this.normalizeFilters(input.cohortFilters), true);
    setIf('price_currency', input.priceCurrency);
    setIf('price_amount', input.priceAmount);
    values.push(id);

    await this.db.query(
      `UPDATE marketplace_datasets SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
      values,
    );
    await this.audit(
      actorId,
      'data_marketplace.dataset_update',
      'marketplace_datasets',
      id,
      input.reason || 'Updated dataset.',
      { name: input.name },
    );
    return this.mapDataset((await this.getDatasetRow(id))!);
  }

  async deleteDataset(actorId: string, id: string, reason: string): Promise<{ id: string }> {
    const existing = await this.getDatasetRow(id);
    if (!existing) throw new NotFoundException('Dataset not found');
    if (existing.status === 'published') {
      throw new BadRequestException('Revoke the dataset before deleting it.');
    }
    await this.db.query('DELETE FROM marketplace_datasets WHERE id = $1', [id]);
    await this.audit(
      actorId,
      'data_marketplace.dataset_delete',
      'marketplace_datasets',
      id,
      reason || 'Deleted draft dataset.',
      {},
    );
    return { id };
  }

  // -------------------------------------------------------------------------
  // Publish / revoke (the privacy-guarded path to Ocean)
  // -------------------------------------------------------------------------

  async publishDataset(actorId: string, id: string, reason: string): Promise<DatasetView> {
    const existing = await this.getDatasetRow(id);
    if (!existing) throw new NotFoundException('Dataset not found');

    const cfg = this.ocean.getConfig();
    const minGroupSize = cfg.minGroupSize || MARKETPLACE_DEFAULTS.minGroupSize;
    const consentThreshold = cfg.consentThreshold || MARKETPLACE_DEFAULTS.consentThreshold;

    // 1) Compute the aggregate over consenting users only.
    const aggregate = await this.computeAggregate(
      existing.dataset_type as DatasetType,
      this.parseStringRecord(existing.cohort_filters),
    );

    // 2) Final gate: strip anything that is not a numeric aggregate.
    const payload = sanitizeAggregate(aggregate.row);
    if (Object.keys(payload).length === 0) {
      throw new BadRequestException(
        'Aggregate payload is empty — the privacy guard found nothing publishable.',
      );
    }
    const verdict = assertPublishable({
      fieldNames: Object.keys(payload),
      cohortSize: aggregate.cohortSize,
      totalCohortSize: aggregate.totalCohortSize,
      minGroupSize,
      consentThreshold,
    });
    if (!verdict.ok) {
      throw new BadRequestException(
        `Privacy guard blocked publication: ${verdict.reasons.join(' ')}`,
      );
    }

    // 3) Checksum the exact payload that would be delivered.
    const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    // 4) Build + attempt Ocean publish (never blocks on network errors).
    const ddo = this.ocean.buildDdo({
      name: existing.name as string,
      description: (existing.description as string) ?? '',
      datasetType: existing.dataset_type as string,
      priceCurrency: (existing.price_currency as string) || 'OCEAN',
      priceAmount: Number(existing.price_amount ?? 0),
      checksum,
      cohortSize: verdict.cohortSize,
      consentCoverage: verdict.consentCoverage,
      license: cfg.license,
      author: 'Study RPG (Real-Nightmare)',
    });
    const oceanResult = await this.ocean.publishMetadata(ddo);

    const privacyReport = {
      cohortSize: verdict.cohortSize,
      totalCohortSize: aggregate.totalCohortSize,
      consentCoverage: Number(verdict.consentCoverage.toFixed(4)),
      minGroupSize,
      consentThreshold,
      fields: Object.keys(payload),
      payload,
      ocean: { published: oceanResult.published, reason: oceanResult.reason ?? null },
    };

    await this.db.query(
      `UPDATE marketplace_datasets
       SET status = 'published', did = $1, ddo = $2, privacy_report = $3, checksum = $4,
           published_at = NOW(), revoked_at = NULL, updated_at = NOW()
       WHERE id = $5`,
      [ddo.id, JSON.stringify(ddo), JSON.stringify(privacyReport), checksum, id],
    );
    await this.audit(
      actorId,
      'data_marketplace.publish',
      'marketplace_datasets',
      id,
      reason || `Published dataset "${existing.name}".`,
      {
        did: ddo.id,
        oceanPublished: oceanResult.published,
        cohortSize: verdict.cohortSize,
        checksum,
      },
    );
    this.logger.log(`Dataset published ${id} (ocean=${oceanResult.published})`);

    return this.mapDataset((await this.getDatasetRow(id))!);
  }

  async revokeDataset(actorId: string, id: string, reason: string): Promise<DatasetView> {
    const existing = await this.getDatasetRow(id);
    if (!existing) throw new NotFoundException('Dataset not found');
    await this.db.query(
      `UPDATE marketplace_datasets
       SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
    await this.audit(
      actorId,
      'data_marketplace.revoke',
      'marketplace_datasets',
      id,
      reason || `Revoked dataset "${existing.name}".`,
      { did: existing.did ?? null },
    );
    return this.mapDataset((await this.getDatasetRow(id))!);
  }

  // -------------------------------------------------------------------------
  // Aggregate computation (consenting cohort only)
  // -------------------------------------------------------------------------

  private async computeAggregate(
    datasetType: DatasetType,
    filters: Record<string, string>,
  ): Promise<{
    row: Record<string, unknown>;
    cohortSize: number;
    totalCohortSize: number;
  }> {
    const cohort = this.buildCohortWhere(filters);
    const window = `NOW() - INTERVAL '${AGGREGATE_WINDOW_DAYS} days'`;

    let row: Record<string, unknown> = {};
    if (datasetType === 'study_engagement') {
      row =
        (await this.db.queryOne<Record<string, unknown>>(
          `SELECT
           COUNT(DISTINCT fs.user_id)::int AS count_active_users,
           COALESCE(SUM(fs.focus_minutes), 0)::float AS total_focus_minutes,
           COALESCE(AVG(fs.focus_minutes), 0)::float AS avg_focus_minutes_per_session,
           COUNT(*)::int AS count_completed_sessions,
           COALESCE(SUM(fs.focus_minutes)::float / NULLIF(COUNT(DISTINCT fs.user_id), 0), 0) AS avg_focus_minutes_per_user,
           COUNT(DISTINCT (fs.user_id, fs.started_at::date))::int AS count_user_session_days
         FROM focus_sessions fs
         JOIN users u ON u.id = fs.user_id
         JOIN data_consent dc ON dc.user_id = u.id AND dc.consented = TRUE
         LEFT JOIN academic_profiles ap ON ap.user_id = u.id
         WHERE fs.status = 'completed' AND fs.ended_at >= ${window}${cohort.sql}`,
          cohort.params,
        )) ?? {};
    } else if (datasetType === 'academic_outcomes') {
      row =
        (await this.db.queryOne<Record<string, unknown>>(
          `SELECT
           COUNT(DISTINCT qa.user_id)::int AS count_quiz_users,
           COALESCE(AVG(CASE WHEN qa.total_questions > 0 THEN qa.score / qa.total_questions * 100 END), 0)::float AS avg_quiz_accuracy_pct,
           COUNT(DISTINCT ea.user_id)::int AS count_exam_users,
           COALESCE(AVG(ea.score), 0)::float AS avg_exam_score_pct,
           COUNT(DISTINCT tb.user_id)::int AS count_teachback_users,
           COALESCE(AVG(NULLIF((tb.evaluation->>'score'), '')::float), 0)::float AS avg_teachback_depth,
           COUNT(DISTINCT cr.user_id)::int AS count_campfire_users,
           COALESCE(AVG(cr.depth_score), 0)::float AS avg_campfire_depth
         FROM users u
         JOIN data_consent dc ON dc.user_id = u.id AND dc.consented = TRUE
         LEFT JOIN academic_profiles ap ON ap.user_id = u.id
         LEFT JOIN quiz_attempts qa ON qa.user_id = u.id AND qa.created_at >= ${window}
         LEFT JOIN exam_attempts ea ON ea.user_id = u.id AND ea.created_at >= ${window}
         LEFT JOIN teach_back_sessions tb ON tb.user_id = u.id AND tb.created_at >= ${window} AND tb.status IN ('submitted','evaluated')
         LEFT JOIN campfire_reflections cr ON cr.user_id = u.id AND cr.created_at >= ${window} AND cr.status = 'answered'
         WHERE 1=1${cohort.sql}`,
          cohort.params,
        )) ?? {};
    } else {
      row =
        (await this.db.queryOne<Record<string, unknown>>(
          `SELECT
           COUNT(DISTINCT pp.user_id)::int AS count_active_players,
           COALESCE(AVG(pp.xp), 0)::float AS avg_player_xp,
           COALESCE(AVG(pp.level), 0)::float AS avg_player_level,
           COALESCE(AVG(pp.study_streak), 0)::float AS avg_study_streak,
           COALESCE(SUM(wl.amount), 0)::float AS total_stp_earned,
           COALESCE(SUM(wl.amount)::float / NULLIF(COUNT(DISTINCT wl.user_id), 0), 0) AS avg_stp_per_player
         FROM player_profiles pp
         JOIN users u ON u.id = pp.user_id
         JOIN data_consent dc ON dc.user_id = u.id AND dc.consented = TRUE
         LEFT JOIN academic_profiles ap ON ap.user_id = u.id
         LEFT JOIN wallet_ledger wl ON wl.user_id = u.id AND wl.amount > 0 AND wl.created_at >= ${window}
         WHERE 1=1${cohort.sql}`,
          cohort.params,
        )) ?? {};
    }
    const consenting = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users u
       JOIN data_consent dc ON dc.user_id = u.id AND dc.consented = TRUE
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       WHERE 1=1${cohort.sql}`,
      cohort.params,
    );
    const total = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users u
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       WHERE 1=1${cohort.sql}`,
      cohort.params,
    );

    const rowOut: Record<string, unknown> = { ...row };
    rowOut.count_consenting_users = Number(consenting?.count ?? 0);
    rowOut.count_total_cohort_users = Number(total?.count ?? 0);
    return {
      row: rowOut,
      cohortSize: Number(consenting?.count ?? 0),
      totalCohortSize: Number(total?.count ?? 0),
    };
  }

  /** Allowlisted cohort filters → SQL WHERE fragment (never free-form). */
  private buildCohortWhere(filters: Record<string, string>): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    for (const key of ALLOWED_COHORT_FILTERS) {
      const value = filters?.[key];
      if (typeof value === 'string' && value.trim()) {
        clauses.push(`ap.${key} = $${params.length + 1}`);
        params.push(value.trim());
      }
    }
    return { sql: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '', params };
  }

  private normalizeFilters(
    filters: Partial<Record<CohortFilterKey, string>> | undefined,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of ALLOWED_COHORT_FILTERS) {
      const value = filters?.[key];
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async getDatasetRow(id: string): Promise<Record<string, unknown> | null> {
    return this.db.queryOne<Record<string, unknown>>(
      `SELECT id, name, description, dataset_type, cohort_filters, price_currency,
              price_amount, status, did, ddo, privacy_report, checksum,
              created_at, published_at, revoked_at
       FROM marketplace_datasets WHERE id = $1`,
      [id],
    );
  }

  private mapDataset(r: Record<string, unknown>): DatasetView {
    return {
      id: r.id as string,
      name: r.name as string,
      description: (r.description ?? '') as string,
      datasetType: r.dataset_type as string,
      cohortFilters: this.parseStringRecord(r.cohort_filters),
      priceCurrency: (r.price_currency ?? 'OCEAN') as string,
      priceAmount: Number(r.price_amount ?? 0),
      status: (r.status ?? 'draft') as DatasetView['status'],
      did: (r.did ?? null) as string | null,
      privacyReport: this.parseJson(r.privacy_report),
      checksum: (r.checksum ?? null) as string | null,
      createdAt: new Date(r.created_at as string).toISOString(),
      publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
      revokedAt: r.revoked_at ? new Date(r.revoked_at as string).toISOString() : null,
    };
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string | null,
    reason: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, action, targetType, targetId, reason, JSON.stringify(details)],
    );
  }

  private parseStringRecord(value: unknown): Record<string, string> {
    const parsed = this.parseJson(value);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return (value ?? {}) as Record<string, unknown>;
  }
}
