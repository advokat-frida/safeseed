/**
 * Tiny seeded PRNG so generation is deterministic: the same seed always produces
 * the same dataset, which makes output a committable, reviewable fixture.
 *
 * mulberry32 — a well-known, public-domain 32-bit generator. Not cryptographic;
 * it never needs to be. Determinism, not unpredictability, is the requirement.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministically pick one element from a non-empty array. */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Deterministic integer in [min, max] inclusive. */
export function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
