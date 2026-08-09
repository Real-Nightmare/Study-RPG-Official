/**
 * PvP ghost avatar derivation (Phase 5 — PvP).
 *
 * A duel does not require the opponent to be online: each side fights a
 * deterministic "ghost" of the other's deck snapshot through the existing
 * battle engine. The ghost is a MonsterState with stats derived purely from
 * the deck composition — rarity-weighted HP and damage-derived attack — so
 * stronger collections present a harder duel without any new battle logic.
 */
import { MonsterState } from './battle-engine';

export interface PvpConfig {
  ghostHpBase: number;
  ghostHpPerRare: number;
  ghostHpPerLegendary: number;
  ghostAttackBase: number;
  ratingK: number;
  winStp: number;
  winXp: number;
  lossXp: number;
  dailyPvpWinLimit: number;
  expiryHours: number;
  ratingWindow: number;
}

export const DEFAULT_PVP_CONFIG: PvpConfig = {
  ghostHpBase: 100,
  ghostHpPerRare: 6,
  ghostHpPerLegendary: 12,
  ghostAttackBase: 6,
  ratingK: 32,
  winStp: 60,
  winXp: 80,
  lossXp: 20,
  dailyPvpWinLimit: 10,
  expiryHours: 48,
  ratingWindow: 150,
};

export interface DeckSnapshotCard {
  cardKey: string;
  rarity?: string;
  ability?: {
    damage?: number;
  };
}

export interface GhostAvatar {
  monster: MonsterState;
  /** Structural detail used for margins/UI: total damage pool of the deck. */
  totalDamage: number;
  rareCount: number;
  legendaryCount: number;
}

/**
 * Builds a ghost avatar from a deck snapshot.
 *
 * HP   = base + rare * perRare + legendary * perLegendary
 * ATK  = base + floor(totalCardDamage / deckSize)   (burst cards only)
 * Poison/decay DoT cards contribute nothing to burst attack — consistent with
 * the engine's basic-attack-first damage model (a poison card is still strong
 * because the ghost inherits the player-side DoT mechanics, not the avatar).
 */
export function buildGhostAvatar(
  deck: DeckSnapshotCard[],
  config: PvpConfig,
  displayName: string,
  key = 'pvp_ghost',
): GhostAvatar {
  const cards = deck.slice(0, 5);
  const rareCount = cards.filter((c) => c.rarity === 'rare').length;
  const legendaryCount = cards.filter((c) => c.rarity === 'legendary').length;
  const totalDamage = cards.reduce((sum, c) => sum + (c.ability?.damage ?? 0), 0);
  const deckSize = Math.max(1, cards.length);
  const attackBonus = Math.floor(totalDamage / deckSize);

  const maxHp =
    config.ghostHpBase +
    rareCount * config.ghostHpPerRare +
    legendaryCount * config.ghostHpPerLegendary;

  const monster: MonsterState = {
    key,
    name: displayName,
    hp: maxHp,
    maxHp,
    attack: Math.max(1, config.ghostAttackBase + attackBonus),
  };

  return { monster, totalDamage, rareCount, legendaryCount };
}
