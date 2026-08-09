/**
 * Deterministic PRNG (mulberry32) — the battle engine's only source of
 * randomness, injected so the same seed reproduces identical outcomes.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Pick one element. */
  pick<T>(items: T[]): T;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
