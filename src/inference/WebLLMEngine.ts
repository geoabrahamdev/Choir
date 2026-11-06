/**
 * WebLLMEngine — M4 InferenceEngine backed by @mlc-ai/web-llm.
 * §9.M4.2 of IMPLEMENTATION_PLAN.
 *
 * Ships only when the user explicitly opts in: this module is lazy-
 * imported and only then imports `@mlc-ai/web-llm`. If the dep is
 * absent, or WebGPU is unavailable, the caller falls back to
 * CachedTrajectory (see settings UI in main.ts).
 *
 * How we turn the LLM into a latent trajectory:
 *   - Build a short "thought prompt" from an agent's recent neighbour
 *     thoughts (stringified from CONFIG.CAPTIONS for now; this is a
 *     metaphor piece, not a real assistant).
 *   - Have the engine compute a logits vector from a single forward
 *     pass; take the softmax of logits of `PROJ_SOURCE_DIM` candidate
 *     tokens as a dense feature, and project to LATENT_DIM via a
 *     deterministic random projection matrix seeded in config.
 *   - Return that as the next latent, re-normalised to unit length.
 *
 * Note: web-llm's public API around raw logits varies by version, so
 * we use `engine.chat.completions.create` with log_probs=true and
 * hash the top-K token probabilities into the LATENT_DIM space. This
 * is intentionally rough — the plan calls for qualitatively different
 * dynamics, not a semantic benchmark.
 */

import { CONFIG } from "../app/config.js";
import { normalise, type LatentState } from "../core/LatentState.js";
import type { Agent } from "../core/Agent.js";
import type { InferenceEngine } from "./InferenceEngine.js";

const PROJECTION_SEED = 0xc4017a;
const TOP_LOGPROBS = 20;
const PROMPT_TEMPLATE = (hintIdx: number): string => {
  const captions = CONFIG.CAPTIONS as readonly string[];
  const hint = captions[hintIdx % captions.length];
  return `Describe a thought like this: ${hint}. Keep it one short line.`;
};

export interface WebLLMEngineOptions {
  modelId?: string;
  onProgress?: (text: string, pct: number) => void;
}

function makeProjection(outDim: number, inDim: number, seed: number): Float32Array {
  // Deterministic LCG, independent of RNG in LatentState so the matrix is stable.
  let state = seed | 0 || 1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) | 0;
    return ((state >>> 0) & 0x7fffffff) / 0x7fffffff;
  };
  const m = new Float32Array(outDim * inDim);
  for (let i = 0; i < m.length; i++) {
    // Gaussian via Box-Muller (half quality, enough for a projection).
    const u = Math.max(rand(), 1e-6);
    const v = rand();
    m[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  return m;
}

export class WebLLMEngine implements InferenceEngine {
  private engine: unknown = null;
  private projection: Float32Array;
  private inDim = TOP_LOGPROBS;
  private modelId: string;
  private onProgress: (text: string, pct: number) => void;
  private readyPromise: Promise<void> | null = null;
  private queue: Array<{ agent: Agent; tick: number }> = [];
  private scheduledAgentIds = new Set<string>();
  private draining = false;
  private active = true;

  constructor(opts: WebLLMEngineOptions = {}) {
    this.modelId = opts.modelId ?? "Phi-3-mini-4k-instruct-q4f16_1-MLC";
    this.onProgress = opts.onProgress ?? (() => {});
    this.projection = makeProjection(
      CONFIG.LATENT_DIM,
      this.inDim,
      PROJECTION_SEED
    );
  }

  get agentCapacity(): number {
    return CONFIG.AGENT_COUNT_SINGLE_TAB;
  }

  ready(): Promise<void> {
    if (!this.readyPromise) this.readyPromise = this.load();
    return this.readyPromise;
  }

  private async load(): Promise<void> {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      throw new Error("WebLLMEngine: WebGPU not available");
    }
    if (typeof SharedArrayBuffer === "undefined" || !crossOriginIsolated) {
      throw new Error("WebLLMEngine: page is not cross-origin isolated");
    }
    // Dynamic import so a vanilla build without this dep still works.
    let mod: unknown;
    try {
      mod = await import(/* @vite-ignore */ "@mlc-ai/web-llm");
    } catch (err) {
      throw new Error("WebLLMEngine: @mlc-ai/web-llm not installed: " + String(err));
    }
    const CreateMLCEngine =
      (mod as { CreateMLCEngine?: (id: string, opts?: unknown) => Promise<unknown> })
        .CreateMLCEngine;
    if (!CreateMLCEngine) throw new Error("WebLLMEngine: CreateMLCEngine missing");
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: (p: { text: string; progress: number }) => {
        this.onProgress(p.text, p.progress ?? 0);
      }
    });
  }

  nextState(agent: Agent, tick: number): LatentState {
    // nextState is synchronous, while WebLLM is not. Keep one bounded,
    // deduplicated FIFO and process a single completion at a time so the
    // 120 ms swarm tick cannot enqueue thousands of GPU jobs per second.
    if (
      this.active &&
      this.engine &&
      !this.scheduledAgentIds.has(agent.id) &&
      this.queue.length < this.agentCapacity
    ) {
      this.scheduledAgentIds.add(agent.id);
      this.queue.push({ agent, tick });
      void this.drainQueue();
    }
    return agent.latent;
  }

  dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.queue.length = 0;
    this.scheduledAgentIds.clear();
    const engine = this.engine as { unload?: () => void | Promise<void> } | null;
    this.engine = null;
    try {
      const unloadResult = engine?.unload?.();
      if (unloadResult) void Promise.resolve(unloadResult).catch(() => {});
    } catch { /* best-effort GPU cleanup */ }
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.active && this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;
        try {
          await this.kickInference(item.agent, item.tick);
        } finally {
          this.scheduledAgentIds.delete(item.agent.id);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async kickInference(agent: Agent, tick: number): Promise<void> {
    if (!this.engine) return Promise.resolve();
    const engine = this.engine as {
      chat: {
        completions: {
          create: (p: unknown) => Promise<{
            choices: Array<{
              logprobs?: {
                content?: Array<{ top_logprobs?: Array<{ logprob: number }> }>;
              };
            }>;
          }>;
        };
      };
    };
    const prompt = PROMPT_TEMPLATE(tick + agent.id.charCodeAt(0));
    try {
      const r = await engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1,
        logprobs: true,
        top_logprobs: TOP_LOGPROBS
      });
      if (!this.active) return;
      const content = r.choices[0]?.logprobs?.content?.[0];
      const top = content?.top_logprobs;
      if (!top) return;
      const vec = new Float32Array(this.inDim);
      for (let i = 0; i < Math.min(top.length, this.inDim); i++) {
        vec[i] = Math.exp(top[i].logprob);
      }
      const latent = this.applyProjection(vec);
      if (this.active) agent.setLatent(latent);
    } catch {
      // Inference failures leave the last valid latent in place.
    }
  }

  private applyProjection(input: Float32Array): LatentState {
    const outDim = CONFIG.LATENT_DIM;
    const inDim = this.inDim;
    const out = new Float32Array(outDim);
    for (let i = 0; i < outDim; i++) {
      let s = 0;
      for (let j = 0; j < inDim; j++) s += this.projection[i * inDim + j] * input[j];
      out[i] = s;
    }
    return normalise(out);
  }
}
