/**
 * Deck rules (§13.2): five cards, and restricted abilities — only one
 * Poison card, one Decay card, one Shield card, and one card for each other
 * restricted ability key. Decks containing removed or invalid cards are
 * marked invalid and must be repaired before ranked play.
 */
import { Ability } from './card-definitions';

export interface DeckValidation {
  valid: boolean;
  size: number;
  errors: string[];
  restrictedCounts: Record<string, number>;
}

/** Restricted ability keys that may appear at most once per deck. */
export function restrictedKeyOf(ability: Ability): string | null {
  if (ability.restrictions && ability.restrictions.length > 0) {
    return ability.restrictions[0];
  }
  return null;
}

/** Validates a list of abilities (one per deck slot). */
export function validateDeck(abilities: Ability[], deckSize = 5): DeckValidation {
  const errors: string[] = [];
  const restrictedCounts: Record<string, number> = {};

  if (abilities.length !== deckSize) {
    errors.push(`Deck must contain exactly ${deckSize} cards (found ${abilities.length})`);
  }

  for (const ability of abilities) {
    const restricted = restrictedKeyOf(ability);
    if (restricted) {
      restrictedCounts[restricted] = (restrictedCounts[restricted] ?? 0) + 1;
    }
  }

  for (const [key, count] of Object.entries(restrictedCounts)) {
    if (count > 1) {
      errors.push(`Restricted ability "${key}" may only appear once per deck (found ${count})`);
    }
  }

  return {
    valid: errors.length === 0 && abilities.length === deckSize,
    size: abilities.length,
    errors,
    restrictedCounts,
  };
}

/** Marks a deck invalid when it references a removed/unknown card. */
export function repairDeck(abilities: Ability[]): { abilities: Ability[]; removed: string[] } {
  const validAbilities = abilities.filter((a) => a.key && a.key.length > 0);
  return {
    abilities: validAbilities,
    removed: abilities.filter((a) => !validAbilities.includes(a)).map((a) => a.key),
  };
}
