/**
 * Data marketplace service (owner policy, tightened).
 *
 * STRICT COMPUTE-TO-DATA ONLY — nothing PII-related is ever for sale:
 *   0. The whole marketplace is OFF by default (`MARKETPLACE_ENABLED=false`);
 *      while disabled every endpoint answers 501 and nothing leaves the
 *      platform. Only the internal benchmark pipeline keeps running.
 *   1. Only AGGREGATES may be published — raw rows and per-user values never
 *      leave the module (`sanitizeAggregate` is the final gate, plus a
 *      value-level PII scan as defense in depth).
 *   2. Publishing requires a REAL on-chain compute asset (ERC721 + datatoken
 *      + `compute` service). There is NO download/access path and NO
 *      metadata-only fallback — if compute cannot be guaranteed, nothing is
 *      published and the dataset stays a draft.
 *   3. Compute jobs NEVER get network access (`allowNetworkAccess` is a hard
 *      false) and run in an isolated container (`c2d-runner`) with no route
 *      to the internet or Study RPG data.
 *   4. Only consenting students (`data_consent`) are included; minimum cohort
 *      size + consent coverage must be met.
 *   5. Every publish/revoke/test-run action is audited with a reason.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { assertPublishable, sanitizeAggregate, scanPayloadForPii } from './privacy-guard';
import {
  ALLOWED_COHORT_FILTERS,
  CohortFilterKey,
  DATASET_TYPES,
  DatasetType,
  MARKETPLACE_DEFAULTS,
  normalizeC2dPolicy,
} from './marketplace-config';
import { OceanC2DService, ComputeAssetResult } from './ocean-c2d.service';
import { OceanService } from './ocean.service';
import { C2dRunnerService, C2dRunResult } from './c2d-runner.service';

/**
 * Raw caller-supplied C2D policy override (API DTO shape). Network access is
 * deliberately a plain boolean here so we can detect and REJECT attempts to
 * enable it; `normalizeC2dPolicy` forces it back to false.
 */
export interface C2DPolicyOverride {
  allowRawAlgorithm?: boolean;
  allowNetworkAccess?: boolean;
  trustedAlgorithmPublishers?: string[];
}

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
  /** On-chain C2D artifact addresses (null while the dataset is a draft). */
  nftAddress: string | null;
  datatokenAddress: string | null;
  exchangeId: string | null;
  providerUrl: string | null;
  c2dPolicy: Record<string, unknown> | null;
  c2dError: string | null;
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
    private readonly c2d: OceanC2DService,
    private readonly storage: StorageService,
    private readonly runner: C2dRunnerService,
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
              nft_address, datatoken_address, exchange_id, provider_url, c2d_policy, c2d_error,
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
              status, did, privacy_report, checksum,
              nft_address, datatoken_address, exchange_id, provider_url, c2d_policy, c2d_error,
              created_at, published_at, revoked_at
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

  async publishDataset(
    actorId: string,
    id: string,
    reason: string,
    c2dOverride?: C2DPolicyOverride,
  ): Promise<DatasetView> {
    const cfg = this.ocean.getConfig();
    // Master switch: the marketplace is strictly opt-in. Nothing may be
    // created, published or revoked while MARKETPLACE_ENABLED=false.
    if (!cfg.enabled) {
      throw new NotImplementedException(
        'Data marketplace is disabled on this deployment (MARKETPLACE_ENABLED=false). ' +
          'No data, aggregate or otherwise, leaves Study RPG while disabled.',
      );
    }
    if (c2dOverride?.allowNetworkAccess === true) {
      throw new BadRequestException(
        'C2D policy violation: compute jobs can never be granted network access.',
      );
    }

    const existing = await this.getDatasetRow(id);
    if (!existing) throw new NotFoundException('Dataset not found');

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
    // 2b) Defense in depth: scan the payload VALUES for PII-shaped content
    //     even though the field names already passed the aggregate check.
    const piiReasons = scanPayloadForPii(payload);
    if (piiReasons.length > 0) {
      throw new BadRequestException(
        `Privacy guard blocked publication (value-level PII scan): ${piiReasons.join(' ')}`,
      );
    }

    // 3) Checksum the exact payload that would be delivered.
    const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    // 4) COMPUTE-TO-DATA ONLY (owner policy): a dataset is published if and
    //    only if a real on-chain compute asset exists — ERC721 + datatoken +
    //    fixed-rate exchange + a `compute` service whose jobs run inside an
    //    isolated, network-less environment. There is deliberately NO
    //    metadata-only/download fallback: buyers can run algorithms on the
    //    aggregate, they can never obtain the aggregate itself. Any failure
    //    keeps the dataset in `draft` with `c2d_error` explaining why.
    const c2dConfig = this.c2d.getConfig();
    const policy = normalizeC2dPolicy(c2dOverride, c2dConfig.c2d);
    const c2dAttempted =
      !!c2dConfig.publisherPrivateKey && !!c2dConfig.rpcUrl && !!c2dConfig.nodeUrl;
    let c2dResult: ComputeAssetResult | null = null;
    let c2dError: string | null;
    let aggregateFileKey: string | null = null;

    if (!c2dAttempted) {
      c2dError =
        'Compute-to-data publishing requires OCEAN_PUBLISHER_PRIVATE_KEY, OCEAN_RPC_URL ' +
        'and OCEAN_NODE_URL. The marketplace never publishes without a working isolated ' +
        'compute path — there is no download/access fallback.';
      await this.db.query(
        `UPDATE marketplace_datasets
         SET privacy_report = $1, checksum = $2, c2d_error = $3, updated_at = NOW()
         WHERE id = $4`,
        [
          JSON.stringify({
            cohortSize: verdict.cohortSize,
            totalCohortSize: aggregate.totalCohortSize,
            consentCoverage: Number(verdict.consentCoverage.toFixed(4)),
            minGroupSize,
            consentThreshold,
            fields: Object.keys(payload),
            payload,
            status: 'blocked-c2d-unconfigured',
          }),
          checksum,
          c2dError,
          id,
        ],
      );
      await this.audit(
        actorId,
        'data_marketplace.publish_blocked',
        'marketplace_datasets',
        id,
        reason || `Blocked publish for dataset "${existing.name}" (C2D unconfigured).`,
        { cohortSize: verdict.cohortSize, checksum },
      );
      return this.mapDataset((await this.getDatasetRow(id))!);
    }

    try {
      const uploaded = await this.storage.upload(
        Buffer.from(JSON.stringify(payload)),
        `${existing.dataset_type}-aggregate.json`,
        { contentType: 'application/json', folder: 'marketplace' },
      );
      if (!/^https?:\/\//.test(uploaded.url)) {
        c2dError =
          'C2D needs a public file URL for the Ocean Node — configure R2_PUBLIC_URL ' +
          '(the dataset stays a draft; nothing was published).';
      } else {
        aggregateFileKey = uploaded.key;
        const result = await this.c2d.publishComputeAsset({
          name: existing.name as string,
          description: (existing.description as string) ?? '',
          datasetType: existing.dataset_type as string,
          priceCurrency: (existing.price_currency as string) || 'OCEAN',
          priceAmount: Number(existing.price_amount ?? 0),
          checksum,
          cohortSize: verdict.cohortSize,
          consentCoverage: verdict.consentCoverage,
          license: cfg.license,
          author: 'Study RPG',
          fileUrl: uploaded.url,
          policy,
        });
        if (result.ok) {
          c2dResult = result;
          c2dError = null;
          this.logger.log(
            `Dataset ${id} published as C2D asset ${result.did} ` +
              `(nft=${result.nftAddress}, dt=${result.datatokenAddress})`,
          );
        } else {
          c2dError = result.reason;
        }
      }
    } catch (err) {
      c2dError = `C2D publish failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    // 5) Without a successful on-chain compute asset the dataset STAYS A
    //    DRAFT — the strict no-download rule means we never fall back to
    //    exposing the data any other way.
    if (!c2dResult) {
      await this.db.query(
        `UPDATE marketplace_datasets
         SET privacy_report = $1, checksum = $2, c2d_policy = $3, aggregate_file_key = $4,
             c2d_error = $5, updated_at = NOW()
         WHERE id = $6`,
        [
          JSON.stringify({
            cohortSize: verdict.cohortSize,
            totalCohortSize: aggregate.totalCohortSize,
            consentCoverage: Number(verdict.consentCoverage.toFixed(4)),
            minGroupSize,
            consentThreshold,
            fields: Object.keys(payload),
            payload,
            status: 'blocked-c2d-failed',
          }),
          checksum,
          JSON.stringify(policy),
          aggregateFileKey,
          c2dError,
          id,
        ],
      );
      await this.audit(
        actorId,
        'data_marketplace.publish_blocked',
        'marketplace_datasets',
        id,
        reason || `Blocked publish for dataset "${existing.name}" (C2D failed).`,
        { cohortSize: verdict.cohortSize, checksum, c2dError },
      );
      return this.mapDataset((await this.getDatasetRow(id))!);
    }

    const ddo = c2dResult.ddo;
    const privacyReport = {
      cohortSize: verdict.cohortSize,
      totalCohortSize: aggregate.totalCohortSize,
      consentCoverage: Number(verdict.consentCoverage.toFixed(4)),
      minGroupSize,
      consentThreshold,
      fields: Object.keys(payload),
      payload,
      ocean: { published: true, reason: null },
      c2d: {
        published: true,
        nftAddress: c2dResult.nftAddress,
        datatokenAddress: c2dResult.datatokenAddress,
        exchangeId: c2dResult.exchangeId,
        providerUrl: c2dResult.providerUrl,
        chainId: c2dResult.chainId,
        transactions: c2dResult.transactions,
      },
    };

    await this.db.query(
      `UPDATE marketplace_datasets
       SET status = 'published', did = $1, ddo = $2, privacy_report = $3, checksum = $4,
           nft_address = $5, datatoken_address = $6, exchange_id = $7, provider_url = $8,
           c2d_policy = $9, aggregate_file_key = $10, c2d_error = NULL,
           published_at = NOW(), revoked_at = NULL, updated_at = NOW()
       WHERE id = $11`,
      [
        ddo.id,
        JSON.stringify(ddo),
        JSON.stringify(privacyReport),
        checksum,
        c2dResult?.nftAddress ?? null,
        c2dResult?.datatokenAddress ?? null,
        c2dResult?.exchangeId ?? null,
        c2dResult?.providerUrl ?? null,
        JSON.stringify(policy),
        aggregateFileKey,
        id,
      ],
    );
    await this.audit(
      actorId,
      'data_marketplace.publish',
      'marketplace_datasets',
      id,
      reason || `Published dataset "${existing.name}" as a compute-to-data asset.`,
      {
        did: ddo.id,
        c2dPublished: true,
        cohortSize: verdict.cohortSize,
        checksum,
      },
    );
    this.logger.log(`Dataset published ${id} as compute-to-data asset ${ddo.id}`);

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
  // Compute-to-data research harness (isolated c2d-runner container)
  // -------------------------------------------------------------------------

  /**
   * Run a researcher's algorithm against this dataset's sanitized aggregate
   * inside the isolated, network-less compute environment. Only the
   * privacy-guarded payload is handed to the algorithm — never raw rows — and
   * every run is audited. This is the local, zero-blockchain way for
   * researchers to test exactly what a compute job could see and do.
   */
  async testCompute(
    actorId: string,
    id: string,
    code: string,
    options: { language?: string; timeoutSeconds?: number } = {},
  ): Promise<C2dRunResult> {
    if (!this.ocean.getConfig().enabled) {
      throw new NotImplementedException(
        'Data marketplace is disabled on this deployment (MARKETPLACE_ENABLED=false).',
      );
    }
    const existing = await this.getDatasetRow(id);
    if (!existing) throw new NotFoundException('Dataset not found');

    const report = this.parseJson(existing.privacy_report);
    const payload = report.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException(
        'No privacy-guarded aggregate exists for this dataset yet — publish it first ' +
          '(the publish step computes and stores the sanitized payload).',
      );
    }

    const result = await this.runner.run({
      code,
      language: options.language || 'python',
      data: JSON.stringify(payload),
      timeoutSeconds: options.timeoutSeconds,
    });
    await this.audit(
      actorId,
      'data_marketplace.c2d_test_run',
      'marketplace_datasets',
      id,
      'Researcher algorithm executed against the sanitized aggregate in the isolated runner.',
      {
        language: (options.language || 'python').toLowerCase(),
        status: result.status,
        executionTimeMs: result.executionTimeMs,
        datasetType: existing.dataset_type as string,
      },
    );
    return result;
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
              nft_address, datatoken_address, exchange_id, provider_url, c2d_policy,
              aggregate_file_key, c2d_error,
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
      nftAddress: (r.nft_address ?? null) as string | null,
      datatokenAddress: (r.datatoken_address ?? null) as string | null,
      exchangeId: (r.exchange_id ?? null) as string | null,
      providerUrl: (r.provider_url ?? null) as string | null,
      c2dPolicy: this.parseJson(r.c2d_policy),
      c2dError: (r.c2d_error ?? null) as string | null,
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
