/**
 * Admin AI benchmarking pipeline (owner brief).
 *
 * "A special section for admins to go and start an AI benchmarking process
 * where Study RPG is completely assessed on how effective it is based on
 * their past performance and how much it improved."
 *
 * Flow: an admin picks a window length (N days) and an optional cohort, the
 * service computes the same metrics for the two consecutive windows
 * [2N, N) and [N, 0) ending now, derives per-metric deltas + a 0–100
 * effectiveness score (pure module `benchmark-metrics.ts`), then grounds an
 * AI narrative ONLY in those numbers (deterministic fallback when AI is
 * unavailable). The report is admin-only and is never published — it never
 * touches the data marketplace / Ocean path.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
import { withPhilosophy } from '../ai/study-rpg-philosophy';
import { ALLOWED_COHORT_FILTERS, CohortFilterKey } from './marketplace-config';
import {
  BenchmarkWindowMetrics,
  EffectivenessReport,
  buildEffectivenessReport,
} from './benchmark-metrics';

export interface StartBenchmarkInput {
  /** Window length in days (clamped 7–180). */
  windowDays?: number;
  cohortFilters?: Partial<Record<CohortFilterKey, string>>;
  /** Extra note stored with the run (optional). */
  note?: string;
}

export interface BenchmarkView {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  config: Record<string, unknown>;
  metrics: {
    before: BenchmarkWindowMetrics;
    after: BenchmarkWindowMetrics;
    deltas: EffectivenessReport['deltas'];
    score: number;
    band: string;
  } | null;
  report: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  error: string | null;
  startedBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai?: AiService,
  ) {}

  async start(actorId: string, input: StartBenchmarkInput = {}): Promise<BenchmarkView> {
    const windowDays = Math.max(7, Math.min(180, Number(input.windowDays || 30)));
    const cohortFilters = this.normalizeFilters(input.cohortFilters);
    const runId = uuidv4();

    try {
      await this.db.query(
        `INSERT INTO benchmark_runs (id, status, config, started_by, started_at, created_at)
         VALUES ($1, 'running', $2, $3, NOW(), NOW())`,
        [runId, JSON.stringify({ windowDays, cohortFilters, note: input.note ?? null }), actorId],
      );

      const now = new Date();
      const beforeEnd = new Date(now.getTime() - windowDays * 86400000);
      const beforeStart = new Date(beforeEnd.getTime() - windowDays * 86400000);

      const before = await this.computeWindowMetrics(beforeStart, beforeEnd, cohortFilters);
      const after = await this.computeWindowMetrics(beforeEnd, now, cohortFilters);
      const report = buildEffectivenessReport(before, after);
      const narrative = await this.buildNarrative(before, after, report);

      const summary = {
        windowDays,
        cohortFilters,
        from: beforeStart.toISOString(),
        mid: beforeEnd.toISOString(),
        to: now.toISOString(),
        activeUsersAfter: after.activeUsers,
      };

      await this.db.query(
        `UPDATE benchmark_runs
         SET status = 'completed', metrics = $1, report = $2, summary = $3, completed_at = NOW()
         WHERE id = $4`,
        [
          JSON.stringify({
            before,
            after,
            deltas: report.deltas,
            score: report.score,
            band: report.band,
          }),
          JSON.stringify(narrative),
          JSON.stringify(summary),
          runId,
        ],
      );
      this.logger.log(`Benchmark run completed ${runId} score=${report.score}`);
      return (await this.get(actorId, runId))!;
    } catch (err) {
      this.logger.error(`Benchmark run failed ${runId}: ${(err as Error).message}`);
      await this.db.query(
        `UPDATE benchmark_runs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
        [(err as Error).message.slice(0, 2000), runId],
      );
      return (await this.get(actorId, runId))!;
    }
  }

  async list(_actorId: string): Promise<BenchmarkView[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT id, status, config, metrics, report, summary, error, started_by,
              created_at, completed_at
       FROM benchmark_runs ORDER BY created_at DESC LIMIT 50`,
      [],
    );
    return rows.map((r) => this.mapView(r));
  }

  async get(_actorId: string, id: string): Promise<BenchmarkView | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, status, config, metrics, report, summary, error, started_by,
              created_at, completed_at
       FROM benchmark_runs WHERE id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Benchmark run not found');
    return this.mapView(row);
  }

  // -------------------------------------------------------------------------
  // Window metrics (admin-only assessment; no consent gating)
  // -------------------------------------------------------------------------

  private async computeWindowMetrics(
    from: Date,
    to: Date,
    filters: Record<string, string>,
  ): Promise<BenchmarkWindowMetrics> {
    const cohort = this.buildCohortWhere(filters);
    const params = [from, to, ...cohort.params];

    const focus = await this.db.queryOne<Record<string, unknown>>(
      `SELECT COUNT(DISTINCT fs.user_id)::int AS active_users,
              COALESCE(SUM(fs.focus_minutes), 0)::float AS focus_minutes
       FROM focus_sessions fs
       JOIN users u ON u.id = fs.user_id
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       WHERE fs.status = 'completed' AND fs.ended_at >= $1 AND fs.ended_at < $2${cohort.sql}`,
      params,
    );

    const quiz = await this.db.queryOne<{ avg: number | null }>(
      `SELECT AVG(CASE WHEN qa.total_questions > 0 THEN qa.score / qa.total_questions * 100 END)::float AS avg
       FROM quiz_attempts qa
       JOIN users u ON u.id = qa.user_id
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       WHERE qa.created_at >= $1 AND qa.created_at < $2${cohort.sql}`,
      params,
    );

    const exam = await this.db.queryOne<{ avg: number | null }>(
      `SELECT AVG(ea.score)::float AS avg
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       WHERE ea.created_at >= $1 AND ea.created_at < $2${cohort.sql}`,
      params,
    );

    const depth = await this.db.queryOne<Record<string, unknown>>(
      `SELECT COALESCE(AVG(NULLIF((tb.evaluation->>'score'), '')::float), 0)::float AS teach_back,
              COALESCE(AVG(cr.depth_score), 0)::float AS campfire
       FROM users u
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       LEFT JOIN teach_back_sessions tb ON tb.user_id = u.id AND tb.created_at >= $1 AND tb.created_at < $2 AND tb.status IN ('submitted','evaluated')
       LEFT JOIN campfire_reflections cr ON cr.user_id = u.id AND cr.created_at >= $1 AND cr.created_at < $2 AND cr.status = 'answered'
       WHERE 1=1${cohort.sql}`,
      params,
    );

    const rpg = await this.db.queryOne<Record<string, unknown>>(
      `SELECT COALESCE(AVG(pp.study_streak), 0)::float AS streak,
              COALESCE(SUM(wl.amount), 0)::float AS stp
       FROM player_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN academic_profiles ap ON ap.user_id = u.id
       LEFT JOIN wallet_ledger wl ON wl.user_id = u.id AND wl.amount > 0 AND wl.created_at >= $1 AND wl.created_at < $2
       WHERE 1=1${cohort.sql}`,
      params,
    );

    return {
      activeUsers: Number(focus?.active_users ?? 0),
      focusMinutes: Number(focus?.focus_minutes ?? 0),
      quizAccuracyPct: Number(quiz?.avg ?? 0),
      examScorePct: Number(exam?.avg ?? 0),
      teachBackDepth: Number(depth?.teach_back ?? 0),
      campfireDepth: Number(depth?.campfire ?? 0),
      stpEarned: Number(rpg?.stp ?? 0),
      avgStudyStreak: Number(rpg?.streak ?? 0),
    };
  }

  /** AI narrative grounded ONLY in the computed numbers (never raw data). */
  private async buildNarrative(
    before: BenchmarkWindowMetrics,
    after: BenchmarkWindowMetrics,
    report: EffectivenessReport,
  ): Promise<Record<string, unknown>> {
    const deterministic = {
      summary: report.summary,
      strengths: report.deltas.filter((d) => d.improved && d.delta > 0).map((d) => d.label),
      risks: report.deltas.filter((d) => !d.improved && d.delta < 0).map((d) => d.label),
      recommendation:
        report.band === 'negative' || report.band === 'neutral'
          ? 'Revisit onboarding and study-loop quality before scaling; measure again after two more windows.'
          : 'Keep the current study loop; the effectiveness score supports scaling the approach.',
    };

    if (!this.ai || !this.ai.isAvailable()) return deterministic;

    try {
      const res = await this.ai.completeJson<{
        summary: string;
        strengths: string[];
        risks: string[];
        recommendation: string;
      }>(
        [
          {
            role: 'system',
            content: withPhilosophy(
              'You are the Study RPG effectiveness auditor. You evaluate how much the product improved real student outcomes using ONLY the aggregate metrics provided. Never invent numbers, never reference individual students, and never claim causal proof — frame everything as observed deltas. Return JSON: { "summary": "2-3 sentences grounded in the deltas", "strengths": ["..."], "risks": ["..."], "recommendation": "one sentence" }.',
            ),
          },
          {
            role: 'user',
            content: JSON.stringify({
              before,
              after,
              deltas: report.deltas,
              score: report.score,
              band: report.band,
            }),
          },
        ],
        { maxTokens: 600, temperature: 0.3 },
      );
      const summary = res?.summary?.trim?.();
      if (summary && summary.length > 10) {
        return {
          summary,
          strengths: Array.isArray(res.strengths) ? res.strengths.slice(0, 8) : [],
          risks: Array.isArray(res.risks) ? res.risks.slice(0, 8) : [],
          recommendation: res.recommendation ?? deterministic.recommendation,
          generatedBy: 'ai',
        };
      }
    } catch (err) {
      this.logger.warn(
        `Benchmark narrative AI failed, using deterministic: ${(err as Error).message}`,
      );
    }
    return deterministic;
  }

  private buildCohortWhere(filters: Record<string, string>): { sql: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    for (const key of ALLOWED_COHORT_FILTERS) {
      const value = filters?.[key];
      if (typeof value === 'string' && value.trim()) {
        clauses.push(`ap.${key} = $${params.length + 3}`); // $1/$2 are the window bounds
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

  private mapView(r: Record<string, unknown>): BenchmarkView {
    return {
      id: r.id as string,
      status: (r.status ?? 'queued') as BenchmarkView['status'],
      config: this.parseJson(r.config),
      metrics: this.parseJson(r.metrics) as BenchmarkView['metrics'],
      report: this.parseJson(r.report),
      summary: this.parseJson(r.summary),
      error: (r.error ?? null) as string | null,
      startedBy: (r.started_by ?? null) as string | null,
      createdAt: new Date(r.created_at as string).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
    };
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
