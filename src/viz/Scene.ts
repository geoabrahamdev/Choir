/**
 * Scene — Three.js renderer, camera, scene, bloom. §9.M1.13.
 *
 * Named imports only — see §17 trap #6.
 */

import {
  AmbientLight,
  Color,
  FogExp2,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector2,
  WebGLRenderer
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CONFIG } from "../app/config.js";

export class Scene {
  readonly scene = new ThreeScene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new Color(CONFIG.COLOURS.BG);
    this.scene.fog = new FogExp2(CONFIG.COLOURS.BG, 0.015);

    this.scene.add(new AmbientLight(0xffffff, 0.35));

    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.camera = new PerspectiveCamera(60, aspect, 0.1, 2000);
    this.camera.position.set(0, 0, 140);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new Vector2(canvas.clientWidth, canvas.clientHeight),
      /* strength */ 1.05,
      /* radius */ 0.55,
      /* threshold */ 0.18
    );
    this.composer.addPass(this.bloom);

    window.addEventListener("resize", () => this.resize(canvas));
  }

  resize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h || 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  render(): void {
    this.composer.render();
  }
}
