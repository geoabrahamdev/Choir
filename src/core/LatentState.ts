/**
 * LatentState — fixed-size Float32 vector with the small algebra the
 * agents and gossip need. Pure functions, no classes, no side effects
 * except where explicitly documented. All vectors are unit-normalised.
 *
 * §6.2 of IMPLEMENTATION_PLAN.
 */

export type LatentState = Float32Array;

/**
 * Deterministic LCG pseudo-random generator. Good enough for seeding
 * personalities + drift noise; we never need crypto-random here.
 * Returns a function that yields floats in [0, 1).
 */
export function makeRng(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    // Convert to unsigned 32-bit then scale to [0, 1).
    return ((state >>> 0) & 0x7fffffff) / 0x7fffffff;
  };
}

/** Box-Muller gaussian sample (mean=0, std=1). */
export function gaussian(rng: () => number): number {
  // Avoid log(0).
  let u = rng();
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** L2-normalise in place. Returns the same reference for chaining. */
export function normalise(v: LatentState): LatentState {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const n = Math.sqrt(sum);
  if (n > 1e-12) {
    const inv = 1 / n;
    for (let i = 0; i < v.length; i++) v[i] *= inv;
  } else {
    // Degenerate zero vector — re-seed with a tiny unit vector on axis 0.
    v[0] = 1;
    for (let i = 1; i < v.length; i++) v[i] = 0;
  }
  return v;
}

/**
 * Produce a uniformly random unit vector of the given dimension.
 * rng is optional; defaults to Math.random.
 */
export function random(dim: number, rng: () => number = Math.random): LatentState {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) v[i] = gaussian(rng);
  return normalise(v);
}

/** Cosine similarity ∈ [-1, 1]. Assumes both vectors same length. */
export function cosineSim(a: LatentState, b: LatentState): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  const denom = Math.sqrt(aa * bb);
  if (denom < 1e-12) return 0;
  const c = dot / denom;
  // Guard against tiny floating-point overshoot.
  if (c > 1) return 1;
  if (c < -1) return -1;
  return c;
}

/**
 * Linear blend a·(1-α) + b·α, re-normalised to unit length.
 * α=0 returns a copy of a (unit); α=1 returns a copy of b (unit).
 * Produces a new Float32Array.
 */
export function blend(a: LatentState, b: LatentState, alpha: number): LatentState {
  const out = new Float32Array(a.length);
  const inv = 1 - alpha;
  for (let i = 0; i < a.length; i++) out[i] = a[i] * inv + b[i] * alpha;
  return normalise(out);
}

/**
 * Drift v slightly toward personalityBias, then add gaussian noise of
 * amplitude `noise`, then renormalise. Returns a NEW vector so callers
 * can snapshot the previous state cheaply.
 *
 * - personalityBias is treated as an attraction target, strength 0.02.
 * - noise multiplies per-dimension gaussian samples before adding.
 */
export function drift(
  v: LatentState,
  personalityBias: LatentState,
  noise: number,
  rng: () => number = Math.random
): LatentState {
  const out = new Float32Array(v.length);
  const bias = 0.02;
  const inv = 1 - bias;
  for (let i = 0; i < v.length; i++) {
    const n = gaussian(rng) * noise;
    out[i] = v[i] * inv + personalityBias[i] * bias + n;
  }
  return normalise(out);
}

/** Deep copy. */
export function clone(v: LatentState): LatentState {
  return new Float32Array(v);
}

/**
 * Centroid of a list of unit vectors, re-normalised.
 * Caller may pass an empty array; result is a canonical unit vector.
 */
export function centroid(vectors: readonly LatentState[]): LatentState {
  if (vectors.length === 0) {
    const z = new Float32Array(1);
    z[0] = 1;
    return z;
  }
  const dim = vectors[0].length;
  const out = new Float32Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  const invN = 1 / vectors.length;
  for (let i = 0; i < dim; i++) out[i] *= invN;
  return normalise(out);
}
