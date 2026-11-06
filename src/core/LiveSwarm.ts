/**
 * LiveSwarm — the swarm variant used when HUD mode == "live".
 * §9.M3.4 of IMPLEMENTATION_PLAN.
 *
 * In live mode this browser owns exactly ONE local agent; every other
 * agent is a thin placeholder for a remote peer we've seen gossip
 * from. Remote placeholders have no local drift — their latent is
 * only ever the vector we most recently received from that peer.
 *
 * All the viz APIs (getAgents, onGossip, coherence, tick) match
 * Swarm so main.ts can treat them interchangeably.
 */

import { Agent } from "./Agent.js";
import { coherence as computeCoherence } from "./CoherenceMetric.js";
import { random, makeRng, type LatentState } from "./LatentState.js";
import { CONFIG } from "../app/config.js";
import { GossipProtocol } from "../network/GossipProtocol.js";
import type {
  GossipEvent,
  GossipEventHandler
} from "../network/GossipProtocol.js";
import type { GossipMessage, PeerTransport } from "../network/PeerTransport.js";
import type { InferenceEngine } from "../inference/InferenceEngine.js";

export interface LiveSwarmOptions {
  latentDim: number;
  driftNoise: number;
  transport: PeerTransport;
  /** Optional CachedTrajectory for the local agent's drift. */
  inference: InferenceEngine | null;
  seed?: number;
  /** Called whenever a remote agent is created or removed. */
  onRosterChange?: () => void;
}

export class LiveSwarm {
  readonly local: Agent;
  readonly remote = new Map<string, Agent>();
  private gossip: GossipProtocol;
  private events: GossipEventHandler[] = [];
  private tickCounter = 0;
  private inference: InferenceEngine | null;
  private driftNoise: number;
  private onRosterChange: () => void;
  private transport: PeerTransport;
  private unsubscribeInbound: () => void;
  private unsubscribePeerLeave: () => void;
  private stopped = false;

  constructor(opts: LiveSwarmOptions) {
    const seed = opts.seed ?? 0xc401;
    const localId = opts.transport.localId();
    this.local = new Agent({
      id: localId,
      personality: random(opts.latentDim, makeRng(seed + 1)),
      latent: random(opts.latentDim, makeRng(seed + 2)),
      driftNoise: opts.driftNoise,
      seed
    });
    this.inference = opts.inference;
    this.transport = opts.transport;
    this.driftNoise = opts.driftNoise;
    this.onRosterChange = opts.onRosterChange ?? (() => {});

    // Bind local to a baked slot if inference accepts one.
    if (this.inference) {
      (this.inference as unknown as { bindAgent?: (a: Agent, s: number) => void }).bindAgent?.(
        this.local,
        0
      );
    }

    this.gossip = new GossipProtocol(this.local, opts.transport);
    this.gossip.on((ev) => this.fire(ev));

    // Observe inbound gossip so we materialise remote placeholders.
    this.unsubscribeInbound = opts.transport.onMessage((msg) => this.onInbound(msg));
    this.unsubscribePeerLeave = opts.transport.onPeerLeave?.((peerId) => {
      if (this.remote.delete(peerId)) this.onRosterChange();
    }) ?? (() => {});
  }

  start(): void { this.gossip.start(); }
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.gossip.dispose();
    this.unsubscribeInbound();
    this.unsubscribePeerLeave();
    this.transport.close?.();
    if (this.remote.size > 0) {
      this.remote.clear();
      this.onRosterChange();
    }
  }

  getAgents(): readonly Agent[] {
    const out: Agent[] = [this.local];
    for (const a of this.remote.values()) out.push(a);
    return out;
  }

  coherence(): number { return computeCoherence(this.getAgents()); }

  onGossip(cb: GossipEventHandler): void { this.events.push(cb); }

  tick(): void {
    this.tickCounter++;
    // Only the local agent drifts; remotes update only on inbound.
    const inf = this.inference;
    if (inf) {
      try {
        const next = inf.nextState(this.local, this.tickCounter);
        if (next) this.local.setLatent(next);
        else this.local.step();
      } catch {
        this.local.step();
      }
    } else {
      this.local.step();
    }
  }

  private onInbound(msg: GossipMessage): void {
    if (this.stopped || msg.fromId === this.local.id) return;
    if (!Number.isSafeInteger(msg.version) || msg.version < 0) return;
    if (msg.latent.length !== this.local.latent.length) return;
    for (const value of msg.latent) if (!Number.isFinite(value)) return;
    let a = this.remote.get(msg.fromId);
    if (!a) {
      if (this.remote.size >= CONFIG.MAX_RENDER_NODES - 1) return;
      a = this.makeRemote(msg.fromId, msg.latent);
      this.remote.set(msg.fromId, a);
      this.onRosterChange();
    } else {
      a.setLatent(new Float32Array(msg.latent));
    }
  }

  private makeRemote(id: string, latent: LatentState): Agent {
    const seed = hashString(id);
    return new Agent({
      id,
      personality: random(latent.length, makeRng(seed + 1)),
      latent: new Float32Array(latent),
      driftNoise: this.driftNoise,
      seed
    });
  }

  private fire(ev: GossipEvent): void {
    for (const h of this.events) h(ev);
  }
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
