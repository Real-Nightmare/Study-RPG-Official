/**
 * Official card value (§21) and payout rules (§22 scraper, §23 burner).
 *
 * The official reference price starts from a base rarity value and applies a
 * bounded supply multiplier: scarcer cards (lower active supply relative to the
 * original print run) are worth more, clamped between a floor and a cap so the
 * price can never spike or crash suddenly. Integer arithmetic only.
 */

export interface CardValueConfig {
  baseValues: Record<string, number>;
  supplyMultiplierFloor: number;
  supplyMultiplierCap: number;
}

export const DEFAULT_VALUE_CONFIG: CardValueConfig = {
  baseValues: { common: 25, rare: 120, legendary: 600 },
  supplyMultiplierFloor: 0.5,
  supplyMultiplierCap: 3.0,
};

export interface CardValueInput {
  rarity: string;
  activeSupply: number;
  originalSupply: number;
}

/**
 * Official reference value of a card definition.
 * multiplier = 1 + (1 - active/original) * 1.5, clamped to [floor, cap].
 * A full (unremoved) supply yields multiplier 1; a card at 10% supply yields
 * multiplier 2.35; results are floored to integers with a minimum of 1.
 */
export function computeOfficialValue(
  input: CardValueInput,
  config: CardValueConfig = DEFAULT_VALUE_CONFIG,
): number {
  const base = config.baseValues[input.rarity] ?? config.baseValues.common ?? 1;
  if (base <= 0) return 1;

  const original = Math.max(0, Math.floor(input.originalSupply));
  const active = Math.max(
    0,
    Math.min(original === 0 ? original : input.activeSupply, original === 0 ? 0 : original),
  );

  let multiplier = 1;
  if (original > 0) {
    const scarcity = 1 - active / original;
    multiplier = 1 + scarcity * 1.5;
  }
  multiplier = Math.min(
    Math.max(multiplier, config.supplyMultiplierFloor),
    config.supplyMultiplierCap,
  );

  return Math.max(1, Math.floor(base * multiplier));
}

/** Payout a scraper receives: `percent` of the official value, floored. */
export function scrapePayout(officialValue: number, percent: number): number {
  if (!Number.isInteger(officialValue) || officialValue <= 0) return 0;
  const pct = Math.min(100, Math.max(0, percent));
  return Math.floor((officialValue * pct) / 100);
}

/** Payout a burner receives (defaults to 100% of the official value). */
export function burnPayout(officialValue: number, percent = 100): number {
  return scrapePayout(officialValue, percent);
}
