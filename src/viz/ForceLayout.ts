/**
 * ForceLayout — wraps d3-force-3d with Choir-specific forces.
 * §9.M1.19 of IMPLEMENTATION_PLAN.
 *
 * Forces:
 *   - charge (repulsion)
 *   - alignment attraction proportional to cosine similarity between
 *     agents' latent states — "similar thoughts drift closer"
 *
 * d3-force-3d expects node objects with mutable x,y,z; we keep them in
 * `NodeData[]` and pass-through to NodeMesh every frame.
 *
 * Note: we do NOT register pairwise alignment links as d3 'link' forces
 * because that would be O(N²) edges in d3's data structures. Instead we
 * run a custom force that samples K neighbours per tick, which keeps
 * the whole layout well under 2 ms for N=150.
 */

import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  type Simulation
} from "d3-force-3d";
import type { Agent } from "../core/Agent.js";
import { cosineSim } from "../core/LatentState.js";

export interface NodeData {
  index: number;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

const NEIGHBOUR_SAMPLE_K = 4;
const ALIGNMENT_STRENGTH = 0.08;

export class ForceLayout {
  readonly nodes: NodeData[];
  private sim: Simulation<NodeData, undefined>;
  private agents: readonly Agent[];
  private rng: () => number;

  constructor(agents: readonly Agent[], rng: () => number = Math.random) {
    this.agents = agents;
    this.rng = rng;
    this.nodes = agents.map((_, i) => {
      // Scatter on a sphere so the first frame isn't all at the origin.
      const r = 60 * Math.cbrt(this.rng());
      const theta = this.rng() * Math.PI * 2;
      const phi = Math.acos(2 * this.rng() - 1);
      return {
        index: i,
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi)
      };
    });

    this.sim = forceSimulation<NodeData>(this.nodes, 3)
      .alpha(0.3)
      .alphaDecay(0) // run forever
      .velocityDecay(0.3)
      .force("charge", forceManyBody().strength(-6).distanceMax(50))
      .force("center", forceCenter(0, 0, 0).strength(0.02));

    this.sim.stop(); // we call tick() ourselves.
  }

  /** Advance the layout by one physics tick. */
  tick(): void {
    // Run the custom alignment force before d3 tick, mutating velocities.
    this.applyAlignment();
    this.sim.tick();
  }

  private applyAlignment(): void {
    const n = this.nodes.length;
    for (let i = 0; i < n; i++) {
      const a = this.nodes[i];
      const latA = this.agents[i].latent;
      for (let s = 0; s < NEIGHBOUR_SAMPLE_K; s++) {
        const j = Math.floor(this.rng() * n);
        if (j === i) continue;
        const b = this.nodes[j];
        const latB = this.agents[j].latent;
        const sim = cosineSim(latA, latB); // [-1, 1]
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d2 = dx * dx + dy * dy + dz * dz + 1e-6;
        const invD = 1 / Math.sqrt(d2);
        // Positive sim → pull together; negative sim → push apart.
        const f = ALIGNMENT_STRENGTH * sim * invD;
        a.vx = (a.vx ?? 0) + dx * f;
        a.vy = (a.vy ?? 0) + dy * f;
        a.vz = (a.vz ?? 0) + dz * f;
      }
    }
  }

  centroid(): { x: number; y: number; z: number } {
    let x = 0,
      y = 0,
      z = 0;
    for (const n of this.nodes) {
      x += n.x;
      y += n.y;
      z += n.z;
    }
    const inv = 1 / this.nodes.length;
    return { x: x * inv, y: y * inv, z: z * inv };
  }
}
