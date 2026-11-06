/**
 * Starfield — one Points object with STAR_COUNT soft-coloured particles
 * scattered on a shell at RADIUS. Static, no updates per frame. §10.5.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  type Scene
} from "three";

const STAR_COUNT = 2000;
const RADIUS = 700;

export class Starfield {
  readonly points: Points;

  constructor(scene: Scene, baseColour = 0xe8edf5) {
    const geo = new BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const colours = new Float32Array(STAR_COUNT * 3);
    const base = new Color(baseColour);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform sample on sphere of radius RADIUS (slight inner shell too).
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = RADIUS * (0.8 + Math.random() * 0.2);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      // Slight brightness variance; keep hue close to base.
      const b = 0.35 + Math.random() * 0.55;
      colours[i * 3 + 0] = base.r * b;
      colours[i * 3 + 1] = base.g * b;
      colours[i * 3 + 2] = base.b * b;
    }
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colours, 3));
    // Big bounding sphere so three doesn't frustum-cull on camera moves.
    geo.boundingSphere = null;

    const mat = new PointsMaterial({
      size: 0.9,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
}
