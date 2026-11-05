import { describe, it, expect } from "vitest";
import {
  coherenceFromLatents,
  coherence
} from "../src/core/CoherenceMetric.js";
import { Agent } from "../src/core/Agent.js";
import { random, makeRng } from "../src/core/LatentState.js";

const DIM = 32;

describe("CoherenceMetric", () => {
  it("identical latents produce coherence 1", () => {
    const v = random(DIM, makeRng(1));
    const latents = Array.from({ length: 20 }, () => new Float32Array(v));
    expect(coherenceFromLatents(latents)).toBeCloseTo(1, 5);
  });

  it("many random latents produce coherence near 0.5", () => {
    // random unit vectors in high dimension average cosine ≈ 0, which maps to 0.5.
    const latents = Array.from({ length: 200 }, (_, i) =>
      random(DIM, makeRng(2000 + i))
    );
    const c = coherenceFromLatents(latents);
    expect(c).toBeGreaterThan(0.40);
    expect(c).toBeLessThan(0.60);
  });

  it("works on an Agent[] input", () => {
    const agents: Agent[] = [];
    const common = random(DIM, makeRng(42));
    for (let i = 0; i < 10; i++) {
      agents.push(
        new Agent({
          id: `a-${i}`,
          personality: common,
          latent: new Float32Array(common),
          driftNoise: 0
        })
      );
    }
    expect(coherence(agents)).toBeCloseTo(1, 5);
  });

  it("empty input returns 0", () => {
    expect(coherenceFromLatents([])).toBe(0);
    expect(coherence([])).toBe(0);
  });
});
