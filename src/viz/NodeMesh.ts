/**
 * NodeMesh — instanced spheres, one per agent. §9.M1.14.
 *
 * Per-instance colour derived from each agent's personality seed so
 * clusters show as colour groupings. Positions are mutated from the
 * force-layout tick (§M1.19); we just push the matrix buffer once
 * per frame.
 */

import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  type Scene
} from "three";
import { CONFIG } from "../app/config.js";
import type { Agent } from "../core/Agent.js";

export interface NodePosition {
  x: number;
  y: number;
  z: number;
}

export class NodeMesh {
  readonly mesh: InstancedMesh;
  private dummy = new Object3D();
  private colours: Color[];

  constructor(scene: Scene, agentCount: number) {
    const geo = new SphereGeometry(0.6, 10, 10);
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
    // Instanced colouring is enabled by passing per-instance colours.
    this.mesh = new InstancedMesh(geo, mat, agentCount);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.colours = new Array(agentCount);
    scene.add(this.mesh);
  }

  /** Call once after construction. */
  initColours(agents: readonly Agent[]): void {
    const base = new Color(CONFIG.COLOURS.NODE_BASE);
    for (let i = 0; i < agents.length; i++) {
      // Hash the first few personality dims into a hue offset.
      const p = agents[i].personality;
      const h = ((p[0] + p[1] + p[2]) * 0.5 + 0.5) % 1;
      const col = new Color().setHSL(h, 0.45, 0.72);
      // Mix 60% hued, 40% base — preserves the plan's palette feel.
      col.lerp(base, 0.4);
      this.colours[i] = col;
      this.mesh.setColorAt(i, col);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Push positions from the layout into the instance matrix buffer in a
   * single pass. Called once per frame. See §17 trap #1.
   */
  updatePositions(positions: readonly NodePosition[]): void {
    const n = Math.min(positions.length, this.mesh.count);
    for (let i = 0; i < n; i++) {
      const p = positions[i];
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  colourAt(idx: number): Color {
    return this.colours[idx];
  }
}
