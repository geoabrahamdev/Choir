/**
 * InferenceEngine — abstract interface for "what is agent X's latent
 * state at tick T?". §9.M1.6 of IMPLEMENTATION_PLAN.
 *
 * M1 implementation: CachedTrajectory reads a pre-baked blob.
 * M4 implementation: WebLLMEngine runs a real model.
 *
 * The swarm never knows which backing engine it has; it just calls
 * nextState() per agent per tick.
 */

import type { Agent } from "../core/Agent.js";
import type { LatentState } from "../core/LatentState.js";

export interface InferenceEngine {
  /** Called once before any nextState() call. Return a promise. */
  ready(): Promise<void>;

  /**
   * Yield the latent vector this agent should "think" at this tick.
   * Must not mutate the agent; the swarm applies the result via
   * `agent.setLatent(v)` and bumps version.
   */
  nextState(agent: Agent, tick: number): LatentState;

  /** Agent-indexable count supported by this engine. */
  readonly agentCapacity: number;
}
