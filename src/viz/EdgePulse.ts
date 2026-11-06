/**
 * EdgePulse — a short-lived additive sprite travels from source to
 * target on every gossip event. §9.M1.16.
 *
 * Implemented as a single BufferGeometry Points with per-vertex alpha
 * fade. For MAX_PULSES=512 this is cheap.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  type Scene
} from "three";
import type { NodePosition } from "./NodeMesh.js";

interface ActivePulse {
  from: number;
  to: number;
  startMs: number;
}

const DURATION_MS = 400;
const MAX_PULSES = 512;

export class EdgePulse {
  readonly points: Points;
  private geometry: BufferGeometry;
  private positions: Float32Array;
  private colours: Float32Array;
  private pulses: ActivePulse[] = [];
  private pulseColour: Color;

  constructor(scene: Scene, colour = 0xa78bfa) {
    this.pulseColour = new Color(colour);
    this.geometry = new BufferGeometry();
    this.positions = new Float32Array(MAX_PULSES * 3);
    this.colours = new Float32Array(MAX_PULSES * 3);
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new BufferAttribute(this.colours, 3));
    this.geometry.setDrawRange(0, 0);

    const mat = new PointsMaterial({
      size: 1.4,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.points = new Points(this.geometry, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  add(fromIdx: number, toIdx: number, nowMs: number): void {
    if (this.pulses.length >= MAX_PULSES) this.pulses.shift();
    this.pulses.push({ from: fromIdx, to: toIdx, startMs: nowMs });
  }

  clear(): void {
    this.pulses = [];
    this.geometry.setDrawRange(0, 0);
  }

  update(nowMs: number, nodes: readonly NodePosition[]): void {
    const kept: ActivePulse[] = [];
    const posAttr = this.geometry.getAttribute("position") as BufferAttribute;
    const colAttr = this.geometry.getAttribute("color") as BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    let idx = 0;

    for (const p of this.pulses) {
      const age = nowMs - p.startMs;
      if (age > DURATION_MS) continue;
      const a = nodes[p.from];
      const b = nodes[p.to];
      if (!a || !b) continue;
      const t = age / DURATION_MS; // 0..1
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t;
      // Bell curve: bright at the midpoint.
      const alpha = 1 - Math.abs(0.5 - t) * 2;
      const base = idx * 3;
      posArr[base + 0] = x;
      posArr[base + 1] = y;
      posArr[base + 2] = z;
      colArr[base + 0] = this.pulseColour.r * alpha;
      colArr[base + 1] = this.pulseColour.g * alpha;
      colArr[base + 2] = this.pulseColour.b * alpha;
      idx++;
      kept.push(p);
      if (idx >= MAX_PULSES) break;
    }

    this.pulses = kept;
    this.geometry.setDrawRange(0, idx);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
