import { describe, expect, it } from "vitest";
import { Agent } from "../src/core/Agent.js";
import { makeRng, random } from "../src/core/LatentState.js";
import { WebLLMEngine } from "../src/inference/WebLLMEngine.js";

function makeAgent(id: string, seed: number): Agent {
  return new Agent({
    id,
    personality: random(32, makeRng(seed)),
    latent: random(32, makeRng(seed + 1)),
    driftNoise: 0,
    seed
  });
}

describe("WebLLMEngine scheduling", () => {
  it("deduplicates agents and runs only one completion at a time", async () => {
    const engine = new WebLLMEngine();
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const resolvers: Array<(value: { choices: [] }) => void> = [];
    const fakeEngine = {
      chat: {
        completions: {
          create: () => {
            calls++;
            active++;
            maxActive = Math.max(maxActive, active);
            return new Promise<{ choices: [] }>((resolve) => {
              resolvers.push((value) => {
                active--;
                resolve(value);
              });
            });
          }
        }
      }
    };
    Object.assign(engine as object, { engine: fakeEngine });

    const agents = [makeAgent("a", 1), makeAgent("b", 2), makeAgent("c", 3)];
    for (let tick = 0; tick < 20; tick++) {
      for (const agent of agents) engine.nextState(agent, tick);
    }
    await Promise.resolve();
    expect(calls).toBe(1);

    for (let completed = 0; completed < agents.length; completed++) {
      resolvers.shift()?.({ choices: [] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(calls).toBe(agents.length);
    expect(maxActive).toBe(1);
    engine.dispose();
  });
});
