import { describe, expect, it } from "vitest";
import { LiveSwarm } from "../src/core/LiveSwarm.js";
import type {
  GossipMessage,
  MessageHandler,
  PeerTransport
} from "../src/network/PeerTransport.js";

class FakeTransport implements PeerTransport {
  private messages = new Set<MessageHandler>();
  private leaves = new Set<(peerId: string) => void>();
  closed = false;

  send(): void {}
  peers(): string[] { return []; }
  localId(): string { return "choir-00000001"; }
  onMessage(cb: MessageHandler): () => void {
    this.messages.add(cb);
    return () => this.messages.delete(cb);
  }
  onPeerLeave(cb: (peerId: string) => void): () => void {
    this.leaves.add(cb);
    return () => this.leaves.delete(cb);
  }
  close(): void { this.closed = true; }

  emit(msg: GossipMessage, via = msg.fromId): void {
    for (const cb of this.messages) cb(msg, via);
  }
  leave(id: string): void {
    for (const cb of this.leaves) cb(id);
  }
}

function message(id: string, value = 0.1): GossipMessage {
  return {
    fromId: id,
    version: 1,
    latent: new Float32Array(32).fill(value)
  };
}

describe("LiveSwarm lifecycle", () => {
  it("removes departed peers and closes its owned transport", () => {
    const transport = new FakeTransport();
    let rosterChanges = 0;
    const swarm = new LiveSwarm({
      latentDim: 32,
      driftNoise: 0,
      transport,
      inference: null,
      onRosterChange: () => rosterChanges++
    });

    transport.emit(message("choir-00000002"));
    expect(swarm.getAgents()).toHaveLength(2);
    transport.leave("choir-00000002");
    expect(swarm.getAgents()).toHaveLength(1);

    swarm.stop();
    expect(transport.closed).toBe(true);
    transport.emit(message("choir-00000003"));
    expect(swarm.getAgents()).toHaveLength(1);
    expect(rosterChanges).toBe(2);
  });

  it("rejects non-finite remote latent values", () => {
    const transport = new FakeTransport();
    const swarm = new LiveSwarm({
      latentDim: 32,
      driftNoise: 0,
      transport,
      inference: null
    });
    const invalid = message("choir-00000002");
    invalid.latent[3] = Number.NaN;
    transport.emit(invalid);
    expect(swarm.getAgents()).toHaveLength(1);
    swarm.stop();
  });
});
