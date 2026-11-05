/**
 * Swarm — owns the list of Agents, the GossipProtocol wiring, and the
 * InferenceEngine. §9.M1.11 of IMPLEMENTATION_PLAN.
 *
 * The viz subscribes to gossip events via onGossip() to draw edge
 * pulses. Swarm itself knows nothing about three.js — single
 * responsibility.
 */

import { CONFIG } from "../app/config.js";
import { Agent } from "./Agent.js";
import { coherence } from "./CoherenceMetric.js";
import { random, makeRng, type LatentState } from "./LatentState.js";
import type {
  GossipEvent,
  GossipEventHandler
} from "../network/GossipProtocol.js";
import { GossipProtocol } from "../network/GossipProtocol.js";
import type { PeerTransport } from "../network/PeerTransport.js";
import type { InferenceEngine } from "../inference/InferenceEngine.js";

export interface SwarmOptions {
  agentCount: number;
  latentDim: number;
  driftNoise: number;
  /** Build a fresh PeerTransport per agent id. */
  makeTransport: (id: string) => PeerTransport;
  inference: InferenceEngine | null;
  /** Deterministic seed for personalities. */
  seed?: number;
}

export class Swarm {
  readonly agents: Agent[] = [];
  readonly gossips: GossipProtocol[] = [];
  private tickCounter = 0;
  private eventHandlers: GossipEventHandler[] = [];

  constructor(private readonly opts: SwarmOptions) {
    this.build();
  }

  private build(): void {
    const { agentCount, latentDim, driftNoise, makeTransport, inference } = this.opts;
    const seed = this.opts.seed ?? 0xc401;
    for (let i = 0; i < agentCount; i++) {
      const id = `peer-${String(i).padStart(4, "0")}`;
      const personality = random(latentDim, makeRng(seed + i * 17));
      const initial = random(latentDim, makeRng(seed + 100_000 + i * 7));
      const agent = new Agent({
        id,
        personality,
        latent: initial,
        driftNoise,
        seed: seed + 50_000 + i
      });
      const transport = makeTransport(id);
      const proto = new GossipProtocol(agent, transport);
      proto.on((ev) => this.fireEvent(ev));
      this.agents.push(agent);
      this.gossips.push(proto);
      if (inference) {
        // Agents bind to baked slots sequentially.
        (inference as unknown as { bindAgent?: (a: Agent, s: number) => void }).bindAgent?.(
          agent,
          i % inference.agentCapacity
        );
      }
    }
  }

  start(): void {
    for (const g of this.gossips) g.start();
  }

  stop(): void {
    for (const g of this.gossips) g.stop();
  }

  /** One global tick: advance all agents' intrinsic drift. */
  tick(): void {
    this.tickCounter++;
    const inf = this.opts.inference;
    for (const a of this.agents) {
      let next: LatentState | null = null;
      if (inf) {
        try {
          next = inf.nextState(a, this.tickCounter);
        } catch {
          next = null;
        }
      }
      if (next) {
        // Blend baked trajectory as a "personal evolution"; the
        // gossip-driven blending still dominates the group behaviour.
        a.setLatent(next);
      } else {
        a.step();
      }
    }
  }

  getAgents(): readonly Agent[] {
    return this.agents;
  }

  coherence(): number {
    return coherence(this.agents);
  }

  onGossip(cb: GossipEventHandler): void {
    this.eventHandlers.push(cb);
  }

  private fireEvent(ev: GossipEvent): void {
    for (const h of this.eventHandlers) h(ev);
  }

  /** Default per-tab size from config. */
  static defaultAgentCount(): number {
    return CONFIG.AGENT_COUNT_SINGLE_TAB;
  }
}
