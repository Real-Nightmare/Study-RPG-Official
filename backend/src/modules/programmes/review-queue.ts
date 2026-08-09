/**
 * Programme review queue + history (PDF Phase 8 §31 follow-up). Pure logic —
 * no database access. The review queue shows programmes that still need a
 * human decision: no AI verdict yet, or an AI verdict with a low score.
 */

export interface ProgrammeReview {
  verdict?: string;
  score?: number | null;
  reasons?: string[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface ReviewEvent {
  verdict: 'accepted' | 'rejected';
  score: number | null;
  reasons: string[];
  reviewer: string | null; // 'ai', an admin id, or null
  reviewedAt: string;
}

const LOW_SCORE_THRESHOLD = 50;
const MAX_HISTORY = 50;

/** A programme needs human review when it has no verdict or a weak score. */
export function needsReview(review: ProgrammeReview | null | undefined): boolean {
  if (!review) return true;
  if (!review.verdict) return true;
  const score = review.score ?? null;
  if (score === null || Number.isNaN(score)) return true;
  return score < LOW_SCORE_THRESHOLD;
}

/** Appends a review event to the history, capped at MAX_HISTORY events. */
export function reviewHistoryAppend(
  history: ReviewEvent[] | null | undefined,
  event: ReviewEvent,
): ReviewEvent[] {
  const next = [...(Array.isArray(history) ? history : []), event];
  return next.slice(-MAX_HISTORY);
}

/** True when the programme currently sits in the rejected or archived state. */
export function isSettled(status: string | null | undefined): boolean {
  return status === 'rejected' || status === 'archived';
}

/** True when a programme is live for students. */
export function isLive(status: string | null | undefined): boolean {
  return status === 'active';
}
