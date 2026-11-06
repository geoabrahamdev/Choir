import { describe, expect, it } from "vitest";
import { Scene } from "three";
import { Agent } from "../src/core/Agent.js";
import { makeRng, random } from "../src/core/LatentState.js";
import { NodeMesh } from "../src/viz/NodeMesh.js";

function agents(count: number): Agent[] {
  return Array.from({ length: count }, (_, i) => new Agent({
    id: `agent-${i}`,
    personality: random(32, makeRng(i + 1)),
    latent: random(32, makeRng(i + 100)),
    driftNoise: 0,
    seed: i
  }));
}

describe("NodeMesh active instance count", () => {
  it("hides stale instances when switching to a smaller swarm", () => {
    const mesh = new NodeMesh(new Scene(), 500);
    mesh.initColours(agents(150));
    expect(mesh.mesh.count).toBe(150);
    mesh.initColours(agents(1));
    expect(mesh.mesh.count).toBe(1);
  });
});
