/**
 * EdgeLines — one LineSegments geometry holding every active gossip
 * edge. Edges fade over FADE_MS. §9.M1.15.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  type Scene
} from "three";
import type { NodePosition } from "./NodeMesh.js";

interface ActiveEdge {
  from: number;
  to: number;
  startMs: number;
}

const FADE_MS = 1500;
const MAX_EDGES = 2048;

export class EdgeLines {
  readonly mesh: LineSegments;
  private geometry: BufferGeometry;
  private positions: Float32Array;
  private colours: Float32Array;
  private edges: ActiveEdge[] = [];
  private edgeColour: Color;

  constructor(scene: Scene, edgeColour = 0x6ea8fe) {
    this.edgeColour = new Color(edgeColour);
    this.geometry = new BufferGeometry();
    this.positions = new Float32Array(MAX_EDGES * 2 * 3);
    this.colours = new Float32Array(MAX_EDGES * 2 * 3);
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new BufferAttribute(this.colours, 3));
    this.geometry.setDrawRange(0, 0);

    const mat = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.mesh = new LineSegments(this.geometry, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Register a new gossip event between nodes. */
  addEdge(fromIdx: number, toIdx: number, nowMs: number): void {
    if (this.edges.length >= MAX_EDGES) this.edges.shift();
    this.edges.push({ from: fromIdx, to: toIdx, startMs: nowMs });
  }

  /**
   * Rebuild the visible edge list from positions + current time.
   * Expired edges are dropped. Call once per frame.
   */
  update(nowMs: number, nodes: readonly NodePosition[]): void {
    const kept: ActiveEdge[] = [];
    let vertexIdx = 0;
    const posAttr = this.geometry.getAttribute("position") as BufferAttribute;
    const colAttr = this.geometry.getAttribute("color") as BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    for (const e of this.edges) {
      const age = nowMs - e.startMs;
      if (age > FADE_MS) continue;
      const a = nodes[e.from];
      const b = nodes[e.to];
      if (!a || !b) continue;
      const alpha = 1 - age / FADE_MS; // linear fade

      const base = vertexIdx * 3;
      posArr[base + 0] = a.x;
      posArr[base + 1] = a.y;
      posArr[base + 2] = a.z;
      posArr[base + 3] = b.x;
      posArr[base + 4] = b.y;
      posArr[base + 5] = b.z;

      // Scale colour by alpha (additive blend handles the brightness).
      const r = this.edgeColour.r * alpha;
      const g = this.edgeColour.g * alpha;
      const b2 = this.edgeColour.b * alpha;
      colArr[base + 0] = r;
      colArr[base + 1] = g;
      colArr[base + 2] = b2;
      colArr[base + 3] = r;
      colArr[base + 4] = g;
      colArr[base + 5] = b2;

      vertexIdx += 2;
      kept.push(e);
      if (vertexIdx >= MAX_EDGES * 2) break;
    }

    this.edges = kept;
    this.geometry.setDrawRange(0, vertexIdx);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
