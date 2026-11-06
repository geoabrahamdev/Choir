/**
 * CoherenceWave — radial bloom from the centroid when coherence crosses
 * COHERENCE_WAVE_THRESHOLD. §9.M1.17 + §10.6 (1.2s ease-out cubic +
 * callback to NodeMesh for the brief hue-shift on nearby nodes).
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
const MAX_RADIUS = 110;

export interface WaveTickInfo {
  /** Current radius of the wave shell. */
  radius: number;
  /** Thickness of the "nodes hit" band around the shell. */
  thickness: number;
  /** 0..1 life fraction (0 = just spawned, 1 = done). */
  t: number;
}

export class CoherenceWave {
  private readonly mesh: Mesh;
  private readonly mat: MeshBasicMaterial;
  private startMs = -Infinity;
  private centre = { x: 0, y: 0, z: 0 };
  private lastReportedRadius = 0;

  constructor(scene: Scene) {
    const geo = new SphereGeometry(1, 48, 24);
    this.mat = new MeshBasicMaterial({
      color: new Color(CONFIG.COLOURS.COHERENCE),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2 // DoubleSide — inside of shell visible from inside.
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  trigger(nowMs: number, centre: { x: number; y: number; z: number }): void {
    this.startMs = nowMs;
    this.centre = { ...centre };
    this.lastReportedRadius = 0;
    this.mesh.position.set(centre.x, centre.y, centre.z);
    this.mesh.visible = true;
  }

  /** Returns WaveTickInfo per-frame while a wave is live, else null. */
  update(nowMs: number): WaveTickInfo | null {
    if (!this.mesh.visible) return null;
    const age = nowMs - this.startMs;
    if (age > DURATION_MS) {
      this.mesh.visible = false;
      return null;
    }
    const t = age / DURATION_MS;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const radius = eased * MAX_RADIUS;
    this.mesh.scale.setScalar(radius + 0.01);
    this.mat.opacity = (1 - t) * 0.42;
    const info: WaveTickInfo = {
      radius,
      thickness: Math.max(3, (radius - this.lastReportedRadius) * 1.4 + 4),
      t
    };
    this.lastReportedRadius = radius;
    return info;
  }

  getCentre(): { x: number; y: number; z: number } {
    return this.centre;
  }
}
