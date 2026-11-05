/**
 * GossipProtocol — push-based epidemic protocol with anti-entropy.
 * §6.3 + §9.M1.10 of IMPLEMENTATION_PLAN.
 *
 * Every GOSSIP_INTERVAL_MS:
 *   each agent picks FANOUT random peers and sends them
 *   (id, version, latent). Receivers blend BLEND_ALPHA into their own
 *   latent and remember the (id, version, latent) in a per-agent store.
 *
 * Every ANTI_ENTROPY_MS:
 *   each agent exchanges a (id→version) digest with one random peer and
 *   pulls any missing/newer states. Guarantees eventual consistency.
 *
 * Emits a `send` event on every message dispatched and `recv` on every
 * message blended, so the viz can draw edge pulses.
 */

import { CONFIG } from "../app/config.js";
import type { Agent } from "../core/Agent.js";
import type { LatentState } from "../core/LatentState.js";
import type {
  GossipMessage,
  PeerTransport
} from "./PeerTransport.js";

export interface GossipEvent {
  kind: "send" | "recv";
  fromId: string;
  toId: string;
  tick: number;
}
export type GossipEventHandler = (ev: GossipEvent) => void;

interface PeerStateRecord {
  version: number;
  latent: LatentState;
}

export interface GossipOptions {
  gossipIntervalMs?: number;
  fanout?: number;
  blendAlpha?: number;
  antiEntropyMs?: number;
  rng?: () => number;
}

export class GossipProtocol {
  private store = new Map<string, PeerStateRecord>();
  private handlers: GossipEventHandler[] = [];
  private tickCounter = 0;
  private gossipTimer: ReturnType<typeof setInterval> | null = null;
  private antiEntropyTimer: ReturnType<typeof setInterval> | null = null;
  private opts: Required<GossipOptions>;
  /** Bound transport msg handler, so we can detach cleanly. */
  private inboundBound: (msg: GossipMessage, via: string) => void;

  constructor(
    private readonly agent: Agent,
    private readonly transport: PeerTransport,
    opts: GossipOptions = {}
  ) {
    this.opts = {
      gossipIntervalMs: opts.gossipIntervalMs ?? CONFIG.GOSSIP_INTERVAL_MS,
      fanout: opts.fanout ?? CONFIG.FANOUT,
      blendAlpha: opts.blendAlpha ?? CONFIG.BLEND_ALPHA,
      antiEntropyMs: opts.antiEntropyMs ?? CONFIG.ANTI_ENTROPY_MS,
      rng: opts.rng ?? Math.random
    };
    this.inboundBound = (msg, via) => this.onInbound(msg, via);
    this.transport.onMessage(this.inboundBound);
  }

  on(cb: GossipEventHandler): void {
    this.handlers.push(cb);
  }

  /** Start the gossip loop. Safe to call multiple times. */
  start(): void {
    if (this.gossipTimer === null) {
      this.gossipTimer = setInterval(() => this.pushRound(), this.opts.gossipIntervalMs);
    }
    if (this.antiEntropyTimer === null) {
      this.antiEntropyTimer = setInterval(
        () => this.antiEntropyRound(),
        this.opts.antiEntropyMs
      );
    }
  }

  stop(): void {
    if (this.gossipTimer !== null) {
      clearInterval(this.gossipTimer);
      this.gossipTimer = null;
    }
    if (this.antiEntropyTimer !== null) {
      clearInterval(this.antiEntropyTimer);
      this.antiEntropyTimer = null;
    }
  }

  /** Expose the local store to Swarm / tests. Read-only view. */
  getKnownPeers(): ReadonlyMap<string, PeerStateRecord> {
    return this.store;
  }

  /**
   * Manual single tick (used by tests). Normally start() drives this
   * on a timer, but we expose it so tests can be deterministic.
   */
  pushRound(): void {
    this.tickCounter++;
    const peers = this.transport.peers();
    if (peers.length === 0) return;
    const targets = this.sample(peers, this.opts.fanout);
    const msg: GossipMessage = {
      fromId: this.agent.id,
      version: this.agent.version,
      latent: this.agent.latent
    };
    for (const to of targets) {
      this.transport.send(to, msg);
      this.fire({
        kind: "send",
        fromId: this.agent.id,
        toId: to,
        tick: this.tickCounter
      });
    }
  }

  /** Public for tests. */
  antiEntropyRound(): void {
    const peers = this.transport.peers();
    if (peers.length === 0) return;
    const peer = peers[Math.floor(this.opts.rng() * peers.length)];
    // Simplest anti-entropy: push our full store as a sequence of
    // messages. Real production would exchange a digest first and only
    // push missing/stale; with 150 agents this is fine.
    for (const [peerId, rec] of this.store) {
      this.transport.send(peer, {
        fromId: peerId,
        version: rec.version,
        latent: rec.latent
      });
    }
    // Also push our own.
    this.transport.send(peer, {
      fromId: this.agent.id,
      version: this.agent.version,
      latent: this.agent.latent
    });
  }

  private onInbound(msg: GossipMessage, via: string): void {
    // Ignore echoes of our own state back to us.
    if (msg.fromId === this.agent.id) return;

    const existing = this.store.get(msg.fromId);
    if (existing && existing.version >= msg.version) return; // stale

    // Keep a copy so later mutations by the sender don't alias.
    const copy = new Float32Array(msg.latent);
    this.store.set(msg.fromId, { version: msg.version, latent: copy });

    // Blend a small fraction into our own latent.
    this.agent.absorb(copy, this.opts.blendAlpha);

    this.fire({
      kind: "recv",
      fromId: msg.fromId,
      toId: this.agent.id,
      tick: this.tickCounter
    });
    // Suppress unused-param warning in strict mode.
    void via;
  }

  private sample<T>(arr: T[], k: number): T[] {
    const n = arr.length;
    if (k >= n) return arr.slice();
    // Reservoir-ish: Fisher-Yates partial.
    const copy = arr.slice();
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.opts.rng() * (n - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, k);
  }

  private fire(ev: GossipEvent): void {
    for (const h of this.handlers) h(ev);
  }
}
