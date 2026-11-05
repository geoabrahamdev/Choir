/**
 * CachedTrajectory — M1 InferenceEngine. Loads trajectories.bin from
 * /public and indexes it by (agentIdx, tick). §9.M1.7.
 *
 * File layout matches scripts/bake-trajectories.ts:
 *   Header (16 bytes):
 *     magic uint32 = 0x43484f49, version uint16=1, latent_dim uint16,
 *     agent_count uint32, tick_count uint32
 *   Body (per record):
 *     agent_idx uint16, tick uint32, vec float32×latent_dim
 *
 * Tick index wraps modulo tick_count so the swarm can run indefinitely.
 */

import type { Agent } from "../core/Agent.js";
import type { LatentState } from "../core/LatentState.js";
import type { InferenceEngine } from "./InferenceEngine.js";

const MAGIC = 0x43484f49;
const VERSION = 1;
const HEADER_BYTES = 16;

export class CachedTrajectory implements InferenceEngine {
  private buf: ArrayBuffer | null = null;
  private view: DataView | null = null;
  private latentDim = 0;
  private agentCount = 0;
  private tickCount = 0;
  /** Byte stride of one record. */
  private recordBytes = 0;
  /** Byte offset of first record. */
  private bodyOffset = HEADER_BYTES;
  /** Map agent.id → fixed integer index into the baked table. */
  private idToIdx = new Map<string, number>();
  private readyPromise: Promise<void> | null = null;

  constructor(private readonly url: string) {}

  /** agentCapacity is only valid after ready(). */
  get agentCapacity(): number {
    return this.agentCount;
  }

  ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.load();
    }
    return this.readyPromise;
  }

  private async load(): Promise<void> {
    const res = await fetch(this.url);
    if (!res.ok) {
      throw new Error(`CachedTrajectory: fetch ${this.url} failed: ${res.status}`);
    }
    this.buf = await res.arrayBuffer();
    this.view = new DataView(this.buf);
    const magic = this.view.getUint32(0, true);
    if (magic !== MAGIC) {
      throw new Error(`CachedTrajectory: bad magic 0x${magic.toString(16)}`);
    }
    const ver = this.view.getUint16(4, true);
    if (ver !== VERSION) {
      throw new Error(`CachedTrajectory: unsupported version ${ver}`);
    }
    this.latentDim = this.view.getUint16(6, true);
    this.agentCount = this.view.getUint32(8, true);
    this.tickCount = this.view.getUint32(12, true);
    this.recordBytes = 2 + 4 + 4 * this.latentDim;

    const expected = HEADER_BYTES + this.agentCount * this.tickCount * this.recordBytes;
    if (this.buf.byteLength < expected) {
      throw new Error(
        `CachedTrajectory: truncated — have ${this.buf.byteLength}, need ${expected}`
      );
    }
  }

  /**
   * Bind an Agent to a fixed integer slot in the baked table.
   * Call once per agent, in order, before first nextState().
   */
  bindAgent(agent: Agent, slot: number): void {
    if (slot < 0 || slot >= this.agentCount) {
      throw new RangeError(`bindAgent: slot ${slot} out of range (cap ${this.agentCount})`);
    }
    this.idToIdx.set(agent.id, slot);
  }

  nextState(agent: Agent, tick: number): LatentState {
    if (!this.view) {
      throw new Error("CachedTrajectory: nextState called before ready()");
    }
    const slot = this.idToIdx.get(agent.id);
    if (slot === undefined) {
      throw new Error(`CachedTrajectory: agent ${agent.id} was not bindAgent()'d`);
    }
    const t = ((tick % this.tickCount) + this.tickCount) % this.tickCount;
    const perAgentStride = this.tickCount * this.recordBytes;
    const recOffset = this.bodyOffset + slot * perAgentStride + t * this.recordBytes;
    // Skip the (agent_idx uint16, tick uint32) header of the record.
    const vecOffset = recOffset + 6;
    const out = new Float32Array(this.latentDim);
    for (let i = 0; i < this.latentDim; i++) {
      out[i] = this.view.getFloat32(vecOffset + i * 4, true);
    }
    return out;
  }
}
