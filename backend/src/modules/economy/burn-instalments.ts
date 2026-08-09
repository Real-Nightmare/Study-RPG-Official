/**
 * Burn instalment scheduling (§23).
 *
 * The Card Burner pays the total burn value in `count` instalments:
 * the first immediately, the rest on later days. Amounts split the total as
 * evenly as possible and the FINAL instalment carries the integer remainder
 * (never a fractional STP). All arithmetic is integer-only.
 */

export interface InstalmentPlan {
  amounts: number[];
  /** When each instalment becomes payable (index 0 = immediately). */
  dueAt: Date[];
  total: number;
}

/**
 * Splits `total` into `count` integer instalments, remainder on the last one.
 * Examples: (10, 4) → [2, 2, 2, 4] · (100, 4) → [25, 25, 25, 25] · (101, 4) → [25, 25, 25, 26].
 */
export function splitInstalments(total: number, count: number): number[] {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error('Burn total must be a positive integer');
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Instalment count must be a positive integer');
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? base + remainder : base,
  );
}

/**
 * Builds the full plan: amounts plus due dates starting at `now` (first
 * instalment due immediately, then every `intervalHours`).
 */
export function buildInstalmentPlan(
  total: number,
  count: number,
  intervalHours: number,
  now: Date = new Date(),
): InstalmentPlan {
  const amounts = splitInstalments(total, count);
  const dueAt = amounts.map((_, index) => {
    if (index === 0) return new Date(now.getTime());
    return new Date(now.getTime() + index * intervalHours * 60 * 60 * 1000);
  });
  return { amounts, dueAt, total };
}

/** Whether all instalments have been paid given `paidCount`. */
export function isBurnComplete(plan: InstalmentPlan, paidCount: number): boolean {
  return paidCount >= plan.amounts.length;
}
