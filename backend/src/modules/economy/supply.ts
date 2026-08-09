/**
 * Supply accounting (§16.3, §22–§24) — pure helpers.
 *
 * `original_supply` is the total number of copies ever minted (the print run).
 * `active_supply` is how many copies exist right now (not burned/scraped).
 * Burned/scraped copies are permanently removed and count against supply.
 */

export interface SupplyRow {
  removed_at: string | Date | null;
  removed_reason?: string | null;
}

export interface SupplyAggregate {
  minted: number;
  active: number;
  burned: number;
  scraped: number;
}

/**
 * Aggregates per-card totals from `card_instances` rows (including removed
 * ones). Minted = every row; active = not removed; burned/scraped by reason.
 */
export function aggregateSupply(rows: SupplyRow[]): SupplyAggregate {
  let active = 0;
  let burned = 0;
  let scraped = 0;
  for (const row of rows) {
    if (!row.removed_at) {
      active += 1;
    } else if (row.removed_reason === 'burn') {
      burned += 1;
    } else if (row.removed_reason === 'scrape') {
      scraped += 1;
    }
  }
  return { minted: rows.length, active, burned, scraped };
}

/**
 * §24: a definition is extinct when its active supply reaches zero and it has
 * not been declared extinct already. Extinct definitions leave loot pools and
 * are replaced (see `replacementKey`).
 */
export function shouldDeclareExtinction(activeSupply: number, extinct: boolean): boolean {
  return activeSupply <= 0 && !extinct;
}

/**
 * Names the replacement definition for an extinct card. Replacement copies get
 * a NEW definition identity (new key + fresh print run) per §24.
 */
export function replacementKey(cardKey: string, generation: number): string {
  return `${cardKey}__echo_${Math.max(1, generation)}`;
}
