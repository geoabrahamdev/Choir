/**
 * CoherenceMetric — pure function. §6.4 + §9.M1.12 of IMPLEMENTATION_PLAN.
 *
 * coherence(agents) = mean(cosineSim(latent_i, centroid)) for all i,
 * where centroid = normalise(mean(latent_i)).
 *
 * Result is squashed from the natural [-1,1] range into [0,1] because
 * the HUD + wave threshold are easier to reason about as a percentage.
 */

import { centroid, cosineSim, type LatentState } from "./LatentState.js";
import type { Agent } from "./Agent.js";

export function coherenceFromLatents(latents: readonly LatentState[]): number {
  if (latents.length === 0) return 0;
  const c = centroid(latents);
  let s = 0;
  for (const v of latents) s += cosineSim(v, c);
  const mean = s / latents.length; // in [-1, 1]
  // Map to [0, 1] with the same monotonicity.
  return Math.max(0, Math.min(1, (mean + 1) * 0.5));
}

export function coherence(agents: readonly Agent[]): number {
  if (agents.length === 0) return 0;
  const latents = agents.map((a) => a.latent);
  return coherenceFromLatents(latents);
}
