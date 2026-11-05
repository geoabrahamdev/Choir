/**
 * Agent — one node in the swarm. §6.1 of IMPLEMENTATION_PLAN.
 *
 * Holds identity, a personality seed vector that biases its drift,
 * a current latent state, and a monotonic version used by the gossip
 * protocol for freshness comparison.
 *
 * Agent must not import from /viz or /network. SOLID: single responsibility.
 */

import { drift, makeRng, type LatentState } from "./LatentState.js";

export interface AgentOptions {
  id: string;
  /** Unit vector the agent tends to drift toward. */
  personality: LatentState;
  /** Initial latent state (unit). */
  latent: LatentState;
  /** Gaussian noise amplitude per step (see CONFIG.DRIFT_NOISE). */
  driftNoise: number;
  /** Optional RNG seed — defaults to a hash of id. */
  seed?: number;
}

/** Fast FNV-1a 32-bit hash of a string — used to seed per-agent RNG. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Agent {
  readonly id: string;
  readonly personality: LatentState;
  latent: LatentState;
  version: number;
  readonly driftNoise: number;
  private rng: () => number;

  constructor(opts: AgentOptions) {
    this.id = opts.id;
    this.personality = opts.personality;
    this.latent = opts.latent;
    this.version = 0;
    this.driftNoise = opts.driftNoise;
    this.rng = makeRng(opts.seed ?? hashId(opts.id));
  }

  /** Apply one drift tick, bump version. Returns the new latent vector. */
  step(): LatentState {
    this.latent = drift(this.latent, this.personality, this.driftNoise, this.rng);
    this.version++;
    return this.latent;
  }

  /**
   * Replace this agent's latent with an externally supplied vector
   * (e.g. a baked trajectory sample) and bump version.
   */
  setLatent(next: LatentState): void {
    this.latent = next;
    this.version++;
  }

  /** Blend an incoming peer latent into this agent (gossip protocol). */
  absorb(peerLatent: LatentState, alpha: number): void {
    // Delegate to blend; blend normalises.
    // We import lazily via a cheap inline to avoid a circular import.
    const inv = 1 - alpha;
    let sum = 0;
    const out = new Float32Array(this.latent.length);
    for (let i = 0; i < this.latent.length; i++) {
      out[i] = this.latent[i] * inv + peerLatent[i] * alpha;
      sum += out[i] * out[i];
    }
    const n = Math.sqrt(sum);
    if (n > 1e-12) {
      const invN = 1 / n;
      for (let i = 0; i < out.length; i++) out[i] *= invN;
    }
    this.latent = out;
    this.version++;
  }
}
