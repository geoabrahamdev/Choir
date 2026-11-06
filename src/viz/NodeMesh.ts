/**
 * NodeMesh — instanced spheres, one per agent. §9.M1.14 + §10.2 fresnel.
 *
 * Replaces the M1 MeshBasicMaterial with a ShaderMaterial that computes
 * a fresnel term from the view direction and the vertex normal, so
 * sphere edges glow more than their centres. Works with InstancedMesh
 * because three sends `instanceMatrix` and `instanceColor` as
 * attributes on each instanced draw.
 *
 * We also push a per-instance highlight scalar via an InstancedBufferAttribute
 * so the coherence wave can momentarily brighten nodes it passes over.
 */

import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
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

const VERT = /* glsl */ `
  attribute float aHighlight;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vColor;
  varying float vHighlight;

  void main() {
    // instanceColor and instanceMatrix are provided by three for InstancedMesh.
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    vHighlight = aHighlight;

    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // View-space normal (approx: ignore non-uniform scale; we use uniform).
    mat3 nMat = mat3(modelViewMatrix * instanceMatrix);
    vNormalW = normalize(nMat * normal);
    vViewDir = normalize(-mv.xyz);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vColor;
  varying float vHighlight;

  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uRimStrength;

  void main() {
    float NdotV = clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0);
    // Fresnel: strong at grazing angles, weak head-on.
    float rim = pow(1.0 - NdotV, uRimPower);

    // Base: a little bit of body colour + rim glow in rim colour.
    vec3 body = vColor * 0.5;
    vec3 rimLit = mix(vColor, uRimColor, 0.55) * rim * uRimStrength;

    vec3 col = body + rimLit;
    // Highlight pulse from coherence wave passing over this node.
    col += vColor * vHighlight * 0.8;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class NodeMesh {
  readonly mesh: InstancedMesh;
  private dummy = new Object3D();
  private colours: Color[];
  private highlightAttr: InstancedBufferAttribute;
  private highlightDecay = 2.5; // per second
  private capacity: number;

  constructor(scene: Scene, agentCount: number) {
    this.capacity = agentCount;
    const geo = new SphereGeometry(0.8, 14, 14);
    const highlight = new Float32Array(agentCount);
    this.highlightAttr = new InstancedBufferAttribute(highlight, 1);
    this.highlightAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("aHighlight", this.highlightAttr);

    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uRimColor: { value: new Color(CONFIG.COLOURS.ACCENT_1) },
        uRimPower: { value: 2.2 },
        uRimStrength: { value: 1.6 }
      }
    });

    this.mesh = new InstancedMesh(geo, mat, agentCount);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.colours = new Array(agentCount);
    scene.add(this.mesh);
  }

  initColours(agents: readonly Agent[]): void {
    const activeCount = Math.min(agents.length, this.capacity);
    this.mesh.count = activeCount;
    (this.highlightAttr.array as Float32Array).fill(0);
    this.highlightAttr.needsUpdate = true;
    const base = new Color(CONFIG.COLOURS.NODE_BASE);
    for (let i = 0; i < activeCount; i++) {
      const p = agents[i].personality;
      const h = ((p[0] + p[1] + p[2]) * 0.5 + 0.5) % 1;
      const col = new Color().setHSL(h, 0.55, 0.72);
      col.lerp(base, 0.3);
      this.colours[i] = col;
      this.mesh.setColorAt(i, col);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  updatePositions(positions: readonly NodePosition[]): void {
    const n = Math.min(positions.length, this.capacity);
    this.mesh.count = n;
    for (let i = 0; i < n; i++) {
      const p = positions[i];
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Decay all highlights by dt seconds. */
  tickHighlight(dt: number): void {
    const arr = this.highlightAttr.array as Float32Array;
    const decay = Math.max(0, 1 - this.highlightDecay * dt);
    for (let i = 0; i < arr.length; i++) arr[i] *= decay;
    this.highlightAttr.needsUpdate = true;
  }

  /** Light up nodes within `radius` of `centre`. */
  pulseAt(
    centre: { x: number; y: number; z: number },
    radius: number,
    positions: readonly NodePosition[],
    amount = 1
  ): void {
    const arr = this.highlightAttr.array as Float32Array;
    const r2 = radius * radius;
    for (let i = 0; i < arr.length && i < positions.length; i++) {
      const p = positions[i];
      const dx = p.x - centre.x;
      const dy = p.y - centre.y;
      const dz = p.z - centre.z;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        arr[i] = Math.min(1, arr[i] + amount);
      }
    }
    this.highlightAttr.needsUpdate = true;
  }

  colourAt(idx: number): Color {
    return this.colours[idx];
  }
}
