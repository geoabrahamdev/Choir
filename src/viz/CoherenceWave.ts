/**
 * CoherenceWave — radial bloom from the centroid when coherence crosses
 * COHERENCE_WAVE_THRESHOLD. §9.M1.17.
 *
 * Implemented as a transparent sphere shell that expands and fades.
 * Only one wave at a time (cheap, and visually enough).
 */

import {
  AdditiveBlending,
  Color,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Scene
} from "three";
import { CONFIG } from "../app/config.js";

const DURATION_MS = 1200;
const MAX_RADIUS = 80;

export class CoherenceWave {
  private readonly mesh: Mesh;
  private readonly mat: MeshBasicMaterial;
  private startMs = -Infinity;

  constructor(scene: Scene) {
    const geo = new SphereGeometry(1, 32, 16);
    this.mat = new MeshBasicMaterial({
      color: new Color(CONFIG.COLOURS.COHERENCE),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  trigger(nowMs: number, centre: { x: number; y: number; z: number }): void {
    this.startMs = nowMs;
    this.mesh.position.set(centre.x, centre.y, centre.z);
    this.mesh.visible = true;
  }

  update(nowMs: number): void {
    if (!this.mesh.visible) return;
    const age = nowMs - this.startMs;
    if (age > DURATION_MS) {
      this.mesh.visible = false;
      return;
    }
    // ease-out cubic
    const t = age / DURATION_MS;
    const eased = 1 - Math.pow(1 - t, 3);
    const r = eased * MAX_RADIUS;
    this.mesh.scale.setScalar(r + 0.01);
    this.mat.opacity = (1 - t) * 0.35;
  }
}
