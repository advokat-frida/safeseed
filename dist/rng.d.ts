/**
 * Tiny seeded PRNG so generation is deterministic: the same seed always produces
 * the same dataset, which makes output a committable, reviewable fixture.
 *
 * mulberry32 — a well-known, public-domain 32-bit generator. Not cryptographic;
 * it never needs to be. Determinism, not unpredictability, is the requirement.
 */
export declare function mulberry32(seed: number): () => number;
/** Deterministically pick one element from a non-empty array. */
export declare function pick<T>(rng: () => number, arr: readonly T[]): T;
/** Deterministic integer in [min, max] inclusive. */
export declare function intBetween(rng: () => number, min: number, max: number): number;
//# sourceMappingURL=rng.d.ts.map