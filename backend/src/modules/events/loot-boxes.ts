/**
 * Loot-box odds (§28 Free/Gold track rewards). Purely weighted rarity picks
 * with **published odds**: the exact percentage per rarity is returned with
 * every opening — "Legendary-Chance" never means guaranteed.
 */

/** Converts raw weights into human-readable percentage odds (2 decimals). */
export function lootBoxOdds(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Loot box weights must sum to a positive number');
  }
  const odds: Record<string, number> = {};
  for (const [key, weight] of Object.entries(weights)) {
    odds[key] = Math.round((weight / total) * 10000) / 100;
  }
  return odds;
}

/** Weighted random rarity pick. Deterministic when `rand` is injected. */
export function pickRarity(
  weights: Record<string, number>,
  rand: () => number = Math.random,
): string {
  const entries = Object.entries(weights).filter(([, w]) => Number(w) > 0);
  if (entries.length === 0) {
    throw new Error('Loot box has no positive weights');
  }
  const total = entries.reduce((sum, [, w]) => sum + Number(w), 0);
  let roll = rand() * total;
  for (const [key, weight] of entries) {
    roll -= Number(weight);
    // Strict `< 0`: a roll landing exactly on a boundary falls into the
    // NEXT bucket (0.70 → rare, never common).
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}
