/**
 * Elo battle-rating math for PvP duels (Phase 5 — PvP, "Ranked battle rating").
 * Pure and deterministic; the caller applies deltas inside the settle
 * transaction. Ratings never go below 0.
 */

/** Expected score of player A against player B (0..1). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Rating delta for the winner of a match (positive). */
export function winnerDelta(winnerRating: number, loserRating: number, k = 32): number {
  return Math.round(k * (1 - expectedScore(winnerRating, loserRating)));
}

/** Rating delta for the loser of a match (negative). */
export function loserDelta(loserRating: number, winnerRating: number, k = 32): number {
  return -Math.round(k * expectedScore(loserRating, winnerRating));
}

/** Applies a delta, flooring the result at 0. */
export function applyRatingChange(rating: number, delta: number): number {
  return Math.max(0, rating + delta);
}

/** Convenience: compute both post-match ratings at once. */
export function computeRatings(
  winnerRating: number,
  loserRating: number,
  k = 32,
): {
  winnerRatingAfter: number;
  loserRatingAfter: number;
  winnerDelta: number;
  loserDelta: number;
} {
  const wDelta = winnerDelta(winnerRating, loserRating, k);
  const lDelta = loserDelta(loserRating, winnerRating, k);
  return {
    winnerRatingAfter: applyRatingChange(winnerRating, wDelta),
    loserRatingAfter: applyRatingChange(loserRating, lDelta),
    winnerDelta: wDelta,
    loserDelta: lDelta,
  };
}
