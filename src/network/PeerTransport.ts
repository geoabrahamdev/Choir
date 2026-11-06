/**
 * PeerTransport — abstract message channel between agents.
 * §9.M1.8 of IMPLEMENTATION_PLAN.
 *
 * Two implementations:
 *   - LocalTransport: in-memory routing within one tab (M1).
 *   - RTCTransport : real WebRTC across browsers (M3).
 *
 * GossipProtocol uses this interface only. Swapping transports must
 * change no other file.
 */

import type { LatentState } from "../core/LatentState.js";

/** One gossip message. Kept small: push-based, carries a full snapshot. */
export interface GossipMessage {
  /** Agent id of the originator (the latent belongs to this agent). */
  fromId: string;
  /** Monotonic version of that agent when the snapshot was taken. */
  version: number;
  /** Unit-length latent vector. Length = CONFIG.LATENT_DIM. */
  latent: LatentState;
}

export type MessageHandler = (msg: GossipMessage, viaPeerId: string) => void;

export interface PeerTransport {
  /** Non-blocking fire-and-forget. */
  send(toId: string, msg: GossipMessage): void;
  /** Register a handler for inbound messages. Returns an unsubscribe function. */
  onMessage(cb: MessageHandler): () => void;
  /** Register for transport-level peer departures when supported. */
  onPeerLeave?(cb: (peerId: string) => void): () => void;
  /** Current reachable peer ids (excluding self). */
  peers(): string[];
  /** Local peer id (one-per-transport). */
  localId(): string;
  /** Permanently release transport resources when supported. */
  close?(): void;
}
