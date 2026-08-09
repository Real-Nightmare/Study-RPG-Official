/**
 * Pure retrieval-evaluation metrics (master prompt §8.10).
 * All functions are side-effect free and operate on plain arrays so they can
 * be unit-tested without any service or database.
 */

export function recallAtK(retrieved: string[], relevant: string[]): number {
  if (relevant.length === 0) {
    return 0;
  }
  const retrievedSet = new Set(retrieved);
  const hits = relevant.filter((id) => retrievedSet.has(id)).length;
  return hits / relevant.length;
}

export function precisionAtK(retrieved: string[], relevant: string[], k: number): number {
  if (k <= 0) {
    return 0;
  }
  const relevantSet = new Set(relevant);
  const topK = retrieved.slice(0, k);
  const hits = topK.filter((id) => relevantSet.has(id)).length;
  return hits / k;
}

export function f1AtK(recall: number, precision: number): number {
  if (recall + precision === 0) {
    return 0;
  }
  return (2 * recall * precision) / (recall + precision);
}

/** Nearest-rank percentile over a sorted list; null when empty. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface EvalCaseResult {
  caseId: string;
  query: string;
  retrievedCount: number;
  relevantCount: number;
  recall: number;
  precision: number;
  f1: number;
  latencyMs: number;
  empty: boolean;
}

export interface EvalRunReport {
  k: number;
  caseCount: number;
  emptyCount: number;
  emptyRate: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  aggregateRecall: number | null;
  aggregatePrecision: number | null;
  aggregateF1: number | null;
  /** LLM-judged unsupported-claim rate — intentionally null (needs LLM pass). */
  unsupportedClaimRate: null;
  leakage: { count: number; chunkIds: string[] };
  cases: EvalCaseResult[];
}

export interface BuildRunInput {
  k: number;
  caseResults: Array<{
    caseId: string;
    query: string;
    retrievedIds: string[];
    relevantIds: string[];
    latencyMs: number;
  }>;
  leakageChunkIds: string[];
}

export function buildRunReport(input: BuildRunInput): EvalRunReport {
  const { k, caseResults, leakageChunkIds } = input;

  const cases: EvalCaseResult[] = caseResults.map((c) => {
    const recall = recallAtK(c.retrievedIds.slice(0, k), c.relevantIds);
    const precision = precisionAtK(c.retrievedIds, c.relevantIds, k);
    return {
      caseId: c.caseId,
      query: c.query,
      retrievedCount: c.retrievedIds.length,
      relevantCount: c.relevantIds.length,
      recall,
      precision,
      f1: f1AtK(recall, precision),
      latencyMs: c.latencyMs,
      empty: c.retrievedIds.length === 0,
    };
  });

  const emptyCount = cases.filter((c) => c.empty).length;
  const latencies = cases.map((c) => c.latencyMs);

  return {
    k,
    caseCount: cases.length,
    emptyCount,
    emptyRate: cases.length === 0 ? 0 : emptyCount / cases.length,
    avgLatencyMs: mean(latencies),
    p95LatencyMs: percentile(latencies, 95),
    aggregateRecall: mean(cases.map((c) => c.recall)),
    aggregatePrecision: mean(cases.map((c) => c.precision)),
    aggregateF1: mean(cases.map((c) => c.f1)),
    unsupportedClaimRate: null,
    leakage: { count: leakageChunkIds.length, chunkIds: leakageChunkIds },
    cases,
  };
}
