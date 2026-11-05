/**
 * bake-trajectories.ts — generate public/embeddings/trajectories.bin.
 *
 * §9.M1.5 of IMPLEMENTATION_PLAN.
 *
 * For AGENT_COUNT_SINGLE_TAB agents we generate TICK_COUNT latent vectors
 * each, where each vector is a small drift from the previous one biased
 * toward one of CLUSTER_COUNT cluster centroids.
 *
 * File layout (little-endian):
 *   Header (16 bytes):
 *     magic       uint32   = 0x43484f49  ("CHOI")
 *     version     uint16   = 1
 *     latent_dim  uint16
 *     agent_count uint32
 *     tick_count  uint32
 *   Body:
 *     repeated (agent_count × tick_count) times:
 *       agent_idx uint16
 *       tick      uint32
 *       vec       float32 × latent_dim
 *
 * Total body bytes = agent_count * tick_count * (2 + 4 + 4 * latent_dim)
 *
 * The runtime loader in CachedTrajectory.ts must read the same layout.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CONFIG } from "../src/app/config.js";
import {
  random,
  drift,
  makeRng,
  normalise,
  blend,
  type LatentState
} from "../src/core/LatentState.js";

const OUT_PATH = "public/embeddings/trajectories.bin";

const AGENT_COUNT = CONFIG.AGENT_COUNT_SINGLE_TAB;
const TICK_COUNT = CONFIG.TICK_COUNT;
const DIM = CONFIG.LATENT_DIM;
const CLUSTERS = CONFIG.CLUSTER_COUNT;

const MAGIC = 0x43484f49; // "CHOI" little-endian
const VERSION = 1;
const HEADER_BYTES = 16;
const RECORD_BYTES = 2 + 4 + 4 * DIM;

function main(): void {
  console.log(
    `[bake] ${AGENT_COUNT} agents × ${TICK_COUNT} ticks × ${DIM} dim → ${OUT_PATH}`
  );


  // 1. Cluster centroids: CLUSTERS unit vectors, roughly orthogonal.
  //    To make them distinct, we generate CLUSTERS random vectors and
  //    accept them — in 32-D random unit vectors are nearly orthogonal.
  const centroids: LatentState[] = [];
  for (let c = 0; c < CLUSTERS; c++) {
    centroids.push(random(DIM, makeRng(0xc0 + c * 17)));
  }

  // 2. Per-agent personalities: a personal bias vector that's a soft
  //    blend of one assigned cluster centroid with a touch of noise,
  //    so cluster membership is visible but not identical.
  const agentCluster = new Uint8Array(AGENT_COUNT);
  const personalities: LatentState[] = new Array(AGENT_COUNT);
  for (let a = 0; a < AGENT_COUNT; a++) {
    const c = a % CLUSTERS;
    agentCluster[a] = c;
    const noise = random(DIM, makeRng(0xa000 + a));
    personalities[a] = blend(centroids[c], noise, 0.25);
  }

  // 3. Allocate output buffer.
  const totalBytes = HEADER_BYTES + AGENT_COUNT * TICK_COUNT * RECORD_BYTES;
  const buf = new ArrayBuffer(totalBytes);
  const view = new DataView(buf);

  // Header
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, DIM, true);
  view.setUint32(8, AGENT_COUNT, true);
  view.setUint32(12, TICK_COUNT, true);

  // Body
  // We fill agent-by-agent for cache coherence during bake.
  // In practice, downstream loader is random-access by (agent, tick).
  let offset = HEADER_BYTES;
  const scratch = new Float32Array(DIM);

  for (let a = 0; a < AGENT_COUNT; a++) {
    const agentRng = makeRng(0xd000 + a);
    // Start each agent at a random unit, nudged toward its personality.
    let cur = blend(random(DIM, agentRng), personalities[a], 0.3);
    cur = normalise(cur);

    for (let t = 0; t < TICK_COUNT; t++) {
      // Write record.
      view.setUint16(offset, a, true);
      offset += 2;
      view.setUint32(offset, t, true);
      offset += 4;
      for (let i = 0; i < DIM; i++) {
        view.setFloat32(offset, cur[i], true);
        offset += 4;
      }

      // Advance: small drift toward personality + gaussian noise.
      scratch.set(cur);
      cur = drift(scratch, personalities[a], CONFIG.DRIFT_NOISE, agentRng);
    }

    if ((a + 1) % 25 === 0) {
      console.log(`  baked agent ${a + 1}/${AGENT_COUNT}`);
    }
  }

  // Ensure directory exists.
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, Buffer.from(buf));
  // Also used for a quick sanity note in CI logs.
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`[bake] wrote ${OUT_PATH} (${mb} MiB, ${totalBytes} bytes)`);
}

main();
