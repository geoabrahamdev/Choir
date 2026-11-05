import { describe, it, expect } from "vitest";
import { Agent } from "../src/core/Agent.js";
import { random, cosineSim, makeRng } from "../src/core/LatentState.js";
import { createLocalNetwork } from "../src/network/LocalTransport.js";
import { GossipProtocol } from "../src/network/GossipProtocol.js";

const DIM = 32;

function makeSwarm(n: number, drop = 0, seedBase = 1000): {
  agents: Agent[];
  protos: GossipProtocol[];
} {
  const net = createLocalNetwork({
    latencyMinMs: 1,
    latencyMaxMs: 3,
    dropRate: drop,
    rng: makeRng(seedBase)
  });
  const agents: Agent[] = [];
  const protos: GossipProtocol[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p-${String(i).padStart(3, "0")}`;
    const personality = random(DIM, makeRng(seedBase + i * 7));
    const latent = random(DIM, makeRng(seedBase + 10_000 + i * 3));
    const a = new Agent({
      id,
      personality,
      latent,
      driftNoise: 0,
      seed: seedBase + i
    });
    const t = net.attach(id);
    const g = new GossipProtocol(a, t, {
      gossipIntervalMs: 50,
      antiEntropyMs: 500,
      fanout: 3,
      blendAlpha: 0.05,
      rng: makeRng(seedBase + 50_000 + i)
    });
    agents.push(a);
    protos.push(g);
  }
  return { agents, protos };
}

/** Drive protos deterministically: R push rounds + one anti-entropy. */
async function drive(protos: GossipProtocol[], rounds: number): Promise<void> {
  for (let r = 0; r < rounds; r++) {
    for (const p of protos) p.pushRound();
    // Let setTimeout deliveries fire.
    await new Promise((res) => setTimeout(res, 10));
  }
  // Several anti-entropy passes to close any gaps (eventual consistency).
  for (let k = 0; k < 3; k++) {
    for (const p of protos) p.antiEntropyRound();
    await new Promise((res) => setTimeout(res, 30));
  }
}

describe("GossipProtocol", () => {
  it("reaches eventual consistency on each agent's own version", async () => {
    const { agents, protos } = makeSwarm(12, 0);
    await drive(protos, 40);

    // Every agent should know about most other agents.
    // (We don't demand 100% in 15 rounds + one anti-entropy; the
    // reasonable bar is: for each agent A, the number of other agents
    // whose state A has seen is at least N-1.)
    for (let i = 0; i < agents.length; i++) {
      const known = protos[i].getKnownPeers();
      expect(known.size).toBeGreaterThanOrEqual(agents.length - 1);
    }
  });

  it("blends received states into local latent (coherence rises)", async () => {
    const { agents, protos } = makeSwarm(12, 0, 2000);

    // Snapshot initial pairwise cosine similarity.
    const avgInitial = avgPairwiseCosine(agents.map((a) => a.latent));

    await drive(protos, 25);

    const avgFinal = avgPairwiseCosine(agents.map((a) => a.latent));

    // Blending should push agents toward each other. Final coherence
    // must be strictly higher than the initial random baseline.
    expect(avgFinal).toBeGreaterThan(avgInitial);
  });

  it("tolerates message loss and still converges", async () => {
    const { agents, protos } = makeSwarm(10, 0.2, 3000);
    await drive(protos, 25);
    for (let i = 0; i < agents.length; i++) {
      const known = protos[i].getKnownPeers();
      // With 20% loss over 25 rounds + anti-entropy, every peer must be known.
      expect(known.size).toBeGreaterThanOrEqual(agents.length - 1);
    }
  });
});

function avgPairwiseCosine(vs: Float32Array[]): number {
  let n = 0;
  let s = 0;
  for (let i = 0; i < vs.length; i++) {
    for (let j = i + 1; j < vs.length; j++) {
      s += cosineSim(vs[i], vs[j]);
      n++;
    }
  }
  return n === 0 ? 0 : s / n;
}
