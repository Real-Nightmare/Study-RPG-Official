/**
 * Pure faction balancing (Phase 6). Given existing factions (with current
 * member counts) and the number of users to place, pick the faction with the
 * fewest members — the property that keeps all factions within ±1 of each
 * other (28 students → 4 factions of 7).
 */

export interface FactionBalanceCandidate {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  targetSize: number;
}

/** Pick the smallest faction; ties broken by earliest creation. */
export function pickFactionForUser(factions: FactionBalanceCandidate[]): FactionBalanceCandidate {
  if (factions.length === 0) {
    throw new Error('No factions available for assignment');
  }

  return factions.reduce((smallest, current) => {
    if (current.memberCount < smallest.memberCount) {
      return current;
    }
    return smallest;
  });
}

/** Compute how many factions are needed to hold `totalMembers` at `targetSize`. */
export function factionCountFor(totalMembers: number, targetSize: number): number {
  if (targetSize <= 0) {
    return 1;
  }
  if (totalMembers <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(totalMembers / targetSize));
}

/** Color palette assigned to newly created factions in order. */
export const FACTION_COLORS = [
  'indigo',
  'emerald',
  'rose',
  'amber',
  'sky',
  'violet',
  'lime',
  'orange',
];

export function factionColorFor(index: number): string {
  return FACTION_COLORS[index % FACTION_COLORS.length];
}
