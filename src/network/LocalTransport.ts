/**
 * LocalTransport — in-memory PeerTransport for M1. §9.M1.9.
 *
 * All agents share a single central router. Latency is uniform random in
 * [latencyMinMs, latencyMaxMs], drop rate = dropRate ∈ [0,1].
 * Messages are scheduled with setTimeout; in a test environment with
 * fake timers, advance time to drain them.
 */

import { CONFIG } from "../app/config.js";
import type {
  GossipMessage,
  MessageHandler,
  PeerTransport
} from "./PeerTransport.js";

export interface LocalTransportOptions {
  latencyMinMs?: number;
  latencyMaxMs?: number;
  dropRate?: number;
  rng?: () => number;
}

/**
 * The LocalRouter owns all handlers. Each agent registers its own
 * LocalTransportEndpoint pointing to the router. Keeps send/receive
 * symmetric and the registry centralised.
 */
class LocalRouter {
  private handlers = new Map<string, MessageHandler[]>();
  private ids = new Set<string>();
  private opts: Required<LocalTransportOptions>;

  constructor(opts: LocalTransportOptions = {}) {
    this.opts = {
      latencyMinMs: opts.latencyMinMs ?? CONFIG.LOCAL_LATENCY_MIN_MS,
      latencyMaxMs: opts.latencyMaxMs ?? CONFIG.LOCAL_LATENCY_MAX_MS,
      dropRate: opts.dropRate ?? CONFIG.LOCAL_DROP_RATE,
      rng: opts.rng ?? Math.random
    };
  }

  register(id: string): void {
    this.ids.add(id);
    if (!this.handlers.has(id)) this.handlers.set(id, []);
  }

  unregister(id: string): void {
    this.ids.delete(id);
    this.handlers.delete(id);
  }

  listen(id: string, cb: MessageHandler): void {
    const list = this.handlers.get(id);
    if (!list) throw new Error(`LocalRouter: ${id} not registered`);
    list.push(cb);
  }

  send(fromId: string, toId: string, msg: GossipMessage): void {
    if (!this.handlers.has(toId)) return; // target gone
    // Drop?
    if (this.opts.rng() < this.opts.dropRate) return;
    const latency =
      this.opts.latencyMinMs +
      this.opts.rng() * (this.opts.latencyMaxMs - this.opts.latencyMinMs);
    setTimeout(() => {
      const list = this.handlers.get(toId);
      if (!list) return;
      for (const cb of list) cb(msg, fromId);
    }, latency);
  }

  idsExcept(id: string): string[] {
    const out: string[] = [];
    for (const i of this.ids) if (i !== id) out.push(i);
    return out;
  }
}

/** One endpoint = one agent's transport. */
export class LocalTransport implements PeerTransport {
  constructor(
    private readonly id: string,
    private readonly router: LocalRouter
  ) {
    router.register(id);
  }

  send(toId: string, msg: GossipMessage): void {
    this.router.send(this.id, toId, msg);
  }

  onMessage(cb: MessageHandler): void {
    this.router.listen(this.id, cb);
  }

  peers(): string[] {
    return this.router.idsExcept(this.id);
  }

  localId(): string {
    return this.id;
  }
}

/** Build a single router for a tab's worth of transports. */
export function createLocalNetwork(opts?: LocalTransportOptions): {
  attach: (id: string) => LocalTransport;
  router: { peerCount: () => number };
} {
  const router = new LocalRouter(opts);
  return {
    attach: (id: string) => new LocalTransport(id, router),
    router: {
      peerCount: () => router.idsExcept("__none__").length
    }
  };
}
