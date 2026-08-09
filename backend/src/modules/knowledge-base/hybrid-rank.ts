/**
 * Hybrid retrieval ranking helpers (master prompt §8.7).
 *
 * Combines dense (semantic) and lexical (sparse) candidate lists through
 * Reciprocal Rank Fusion, removes near-duplicates, enforces a minimum
 * relevance threshold and prefers source diversity.
 */

export interface RankedCandidate {
  id: string;
  /** Dense/semantic similarity or lexical rank score, when available. */
  score?: number;
  documentId?: string | null;
  content?: string;
  payload?: Record<string, unknown>;
}

export interface HybridRankOptions {
  /** Standard RRF constant (default 60). */
  k?: number;
  /** Minimum dense/semantic score a candidate must have to be kept. */
  minDenseScore?: number;
  /** Limit results per source document to favour diversity. */
  maxPerDocument?: number;
  /** Remove exact (normalised) duplicate content. */
  dedupeContent?: boolean;
}

const DEFAULT_K = 60;

/**
 * Reciprocal Rank Fusion. Each candidate list contributes 1 / (k + rank);
 * candidates present in multiple lists are boosted. Higher score = better.
 */
export function reciprocalRankFusion(lists: RankedCandidate[][], k = DEFAULT_K): RankedCandidate[] {
  const fused = new Map<string, { candidate: RankedCandidate; score: number }>();

  for (const list of lists) {
    list.forEach((candidate, rank) => {
      const existing = fused.get(candidate.id);
      const contribution = 1 / (k + rank + 1);
      if (existing) {
        existing.score += contribution;
      } else {
        fused.set(candidate.id, { candidate, score: contribution });
      }
    });
  }

  return [...fused.values()]
    .map(({ candidate, score }) => ({
      ...candidate,
      score: Number(score.toFixed(6)),
    }))
    .sort((a, b) => b.score - a.score);
}

/** Collapses whitespace/lowercases content for near-duplicate detection. */
export function normalizeContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Removes candidates whose normalised content is identical to an earlier
 * candidate (content-level deduplication).
 */
export function removeDuplicateContent<T extends RankedCandidate>(candidates: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const candidate of candidates) {
    const key = candidate.content ? normalizeContent(candidate.content) : candidate.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

/**
 * Filters candidates below a minimum dense (semantic) score. Lexical-only
 * results have no dense score and are kept unless `minDenseScore` is
 * explicitly required for every candidate.
 */
export function filterByMinScore(
  candidates: RankedCandidate[],
  minScore: number | undefined,
  source: 'dense' | 'lexical',
): RankedCandidate[] {
  if (minScore === undefined || minScore <= 0) {
    return candidates;
  }
  if (source === 'dense') {
    return candidates.filter((c) => c.score !== undefined && c.score >= minScore);
  }
  return candidates;
}

/**
 * Caps the number of results coming from the same source document
 * (source diversity — a single long document should not flood the results).
 */
export function enforceSourceDiversity<T extends RankedCandidate>(
  candidates: T[],
  maxPerDocument: number | undefined,
): T[] {
  if (maxPerDocument === undefined || maxPerDocument <= 0) {
    return candidates;
  }
  const counts = new Map<string, number>();
  const result: T[] = [];
  for (const candidate of candidates) {
    const key = candidate.documentId ?? '__none__';
    const used = counts.get(key) ?? 0;
    if (used >= maxPerDocument) {
      continue;
    }
    counts.set(key, used + 1);
    result.push(candidate);
  }
  return result;
}
