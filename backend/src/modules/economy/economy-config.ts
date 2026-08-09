/**
 * Economy configuration (§17, §21–§24). Stored in `game_config` under
 * `rpg.economy`; the code defaults apply when the row is absent or a key is
 * missing, so the module always has a working configuration.
 */

export interface EconomyConfig {
  listingDurationHours: number;
  offerDurationHours: number;
  marketplaceFeePercent: number;
  burnInstalments: number;
  burnInstalmentIntervalHours: number;
  scrapePayoutPercent: number;
  burnPayoutPercent: number;
  rarityBaseValues: Record<string, number>;
  supplyMultiplierFloor: number;
  supplyMultiplierCap: number;
  supplyInitialPrint: Record<string, number>;
  inventoryCapacity: number;
  vaultCapacity: number;
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  listingDurationHours: 168,
  offerDurationHours: 72,
  marketplaceFeePercent: 0,
  burnInstalments: 4,
  burnInstalmentIntervalHours: 24,
  scrapePayoutPercent: 80,
  burnPayoutPercent: 100,
  rarityBaseValues: { common: 25, rare: 120, legendary: 600 },
  supplyMultiplierFloor: 0.5,
  supplyMultiplierCap: 3.0,
  supplyInitialPrint: { common: 1500, rare: 400, legendary: 100 },
  inventoryCapacity: 50,
  vaultCapacity: 50,
};

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : fallback;
}

function toRecord(value: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!value || typeof value !== 'object') return { ...fallback };
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(val);
    out[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : (fallback[key] ?? 1);
  }
  return out;
}

/** Deep-merges the parsed `game_config` value over the defaults. */
export function mergeEconomyConfig(raw: unknown): EconomyConfig {
  const value =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>);

  return {
    listingDurationHours: toInt(value.listingDurationHours, DEFAULT_ECONOMY_CONFIG.listingDurationHours),
    offerDurationHours: toInt(value.offerDurationHours, DEFAULT_ECONOMY_CONFIG.offerDurationHours),
    marketplaceFeePercent: toInt(value.marketplaceFeePercent, DEFAULT_ECONOMY_CONFIG.marketplaceFeePercent),
    burnInstalments: toInt(value.burnInstalments, DEFAULT_ECONOMY_CONFIG.burnInstalments),
    burnInstalmentIntervalHours: toInt(
      value.burnInstalmentIntervalHours,
      DEFAULT_ECONOMY_CONFIG.burnInstalmentIntervalHours,
    ),
    scrapePayoutPercent: toInt(value.scrapePayoutPercent, DEFAULT_ECONOMY_CONFIG.scrapePayoutPercent),
    burnPayoutPercent: toInt(value.burnPayoutPercent, DEFAULT_ECONOMY_CONFIG.burnPayoutPercent),
    rarityBaseValues: toRecord(value.rarityBaseValues, DEFAULT_ECONOMY_CONFIG.rarityBaseValues),
    supplyMultiplierFloor: Number.isFinite(Number(value.supplyMultiplierFloor))
      ? Number(value.supplyMultiplierFloor)
      : DEFAULT_ECONOMY_CONFIG.supplyMultiplierFloor,
    supplyMultiplierCap: Number.isFinite(Number(value.supplyMultiplierCap))
      ? Number(value.supplyMultiplierCap)
      : DEFAULT_ECONOMY_CONFIG.supplyMultiplierCap,
    supplyInitialPrint: toRecord(value.supplyInitialPrint, DEFAULT_ECONOMY_CONFIG.supplyInitialPrint),
    inventoryCapacity: toInt(value.inventoryCapacity, DEFAULT_ECONOMY_CONFIG.inventoryCapacity),
    vaultCapacity: toInt(value.vaultCapacity, DEFAULT_ECONOMY_CONFIG.vaultCapacity),
  };
}
