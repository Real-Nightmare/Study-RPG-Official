/**
 * Benchmark metrics (owner brief: "a special section for admins to go and
 * start an AI benchmarking process where Study RPG is completely assessed on
 * how effective it is based on their past performance and how much it
 * improved").
 *
 * Pure module — no DB, no AI. It takes two pre-aggregated window metrics
 * (baseline vs recent) and computes per-metric relative deltas, a weighted
 * 0–100 effectiveness score, and a deterministic verdict band. The AI
 * narrative lives in `benchmark.service.ts` and is grounded ONLY in these
 * numbers (never in raw student data).
 */

export interface BenchmarkWindowMetrics {
  /** Distinct active users in the window. */
  activeUsers: number;
  /** Total completed focus-session minutes in the window. */
  focusMinutes: number;
  /** Mean quiz accuracy as a percentage (0–100). */
  quizAccuracyPct: number;
  /** Mean exam-clone score as a percentage (0–100). */
  examScorePct: number;
  /** Mean teach-back depth score (0–100). */
  teachBackDepth: number;
  /** Mean campfire reflection depth score (0–100). */
  campfireDepth: number;
  /** Total STP earned (positive wallet ledger) in the window. */
  stpEarned: number;
  /** Mean study-streak length across players. */
  avgStudyStreak: number;
}

export interface MetricDelta {
  key: keyof BenchmarkWindowMetrics;
  label: string;
  before: number;
  after: number;
  /** Relative change (after-before)/before, clamped to [-1, 3]. */
  delta: number;
  /** True when the metric moved in the desired direction. */
  improved: boolean;
}

export type EffectivenessBand = 'transformative' | 'strong' | 'moderate' | 'neutral' | 'negative';

export interface EffectivenessReport {
  score: number;
  band: EffectivenessBand;
  deltas: MetricDelta[];
  summary: string;
}

/** Metrics that count as "more is better" for the effectiveness score. */
export const IMPROVEMENT_METRICS: ReadonlyArray<keyof BenchmarkWindowMetrics> = [
  'focusMinutes',
  'quizAccuracyPct',
  'examScorePct',
  'teachBackDepth',
  'campfireDepth',
  'stpEarned',
  'avgStudyStreak',
];

export const METRIC_LABELS: Record<keyof BenchmarkWindowMetrics, string> = {
  activeUsers: 'Active users',
  focusMinutes: 'Focused study minutes',
  quizAccuracyPct: 'Quiz accuracy',
  examScorePct: 'Exam-clone score',
  teachBackDepth: 'Teach-back depth',
  campfireDepth: 'Metacognitive reflection depth',
  stpEarned: 'STP earned',
  avgStudyStreak: 'Average study streak',
};

/** Weights used for the composite effectiveness score (sums to 1). */
export const DEFAULT_WEIGHTS: Record<keyof BenchmarkWindowMetrics, number> = {
  activeUsers: 0,
  focusMinutes: 0.15,
  quizAccuracyPct: 0.3,
  examScorePct: 0.25,
  teachBackDepth: 0.15,
  campfireDepth: 0.1,
  stpEarned: 0.05,
  avgStudyStreak: 0,
};

export const EPSILON = 1e-9;

/** Relative change (after-before)/before, guarded and clamped to [-1, 3]. */
export function metricDelta(before: number, after: number): number {
  if (Math.abs(before) < EPSILON) {
    // No baseline: only a positive after value counts as improvement.
    return after > 0 ? 0.5 : 0;
  }
  return Math.max(-1, Math.min(3, (after - before) / Math.abs(before)));
}

/** Compute per-metric deltas for every improvement metric. */
export function computeDeltas(
  before: BenchmarkWindowMetrics,
  after: BenchmarkWindowMetrics,
): MetricDelta[] {
  return IMPROVEMENT_METRICS.map((key) => {
    const beforeVal = before[key];
    const afterVal = after[key];
    const delta = metricDelta(beforeVal, afterVal);
    return {
      key,
      label: METRIC_LABELS[key],
      before: beforeVal,
      after: afterVal,
      delta,
      improved: afterVal >= beforeVal - EPSILON,
    };
  });
}

/**
 * Weighted 0–100 effectiveness score. Each metric contributes its clamped
 * relative delta: +100% improvement yields the full weight for that metric,
 * +300% or more caps at 1. Unweighted metrics are ignored. A +25-30%
 * across-the-board improvement typically lands around 30 ('moderate');
 * dramatic gains (e.g. accuracy 50% → 90%) land in the 80s+ ('transformative').
 */
export function effectivenessScore(
  deltas: MetricDelta[],
  weights: Record<keyof BenchmarkWindowMetrics, number> = DEFAULT_WEIGHTS,
): number {
  let total = 0;
  let weightSum = 0;
  for (const d of deltas) {
    const w = weights[d.key] ?? 0;
    if (w <= 0) continue;
    total += w * Math.min(1, Math.max(-1, d.delta)) * 100;
    weightSum += w;
  }
  if (weightSum <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, total / weightSum)));
}

/** Verdict band for a 0–100 score (0 = no measured movement = neutral). */
export function effectivenessBand(score: number): EffectivenessBand {
  if (score <= 0) return 'neutral';
  if (score >= 70) return 'transformative';
  if (score >= 50) return 'strong';
  if (score >= 30) return 'moderate';
  if (score >= 12) return 'neutral';
  return 'negative';
}

/**
 * Deterministic narrative summary — used directly when AI is unavailable and
 * as the grounding frame for the AI narrative when it is available.
 */
export function buildEffectivenessReport(
  before: BenchmarkWindowMetrics,
  after: BenchmarkWindowMetrics,
  weights: Record<keyof BenchmarkWindowMetrics, number> = DEFAULT_WEIGHTS,
): EffectivenessReport {
  const deltas = computeDeltas(before, after);
  const score = effectivenessScore(deltas, weights);
  const band = effectivenessBand(score);

  const improved = deltas.filter((d) => d.improved && d.delta > EPSILON);
  const regressed = deltas.filter((d) => !d.improved && d.delta < -EPSILON);

  const parts: string[] = [];
  if (improved.length > 0) {
    parts.push(
      `Improved on ${improved.length} of ${deltas.length} tracked metrics: ${improved
        .map((d) => `${d.label} +${(d.delta * 100).toFixed(0)}%`)
        .join(', ')}.`,
    );
  }
  if (regressed.length > 0) {
    parts.push(
      `Regressed on ${regressed.length}: ${regressed
        .map((d) => `${d.label} ${(d.delta * 100).toFixed(0)}%`)
        .join(', ')}.`,
    );
  }
  if (parts.length === 0) parts.push('No material change across the tracked metrics.');

  return { score, band, deltas, summary: parts.join(' ') };
}

/** Per-window descriptive stats (mean helper, guards empty sets). */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return (num / denom) * 100;
}
