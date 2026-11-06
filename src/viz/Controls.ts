/**
 * Controls — OrbitControls by default + "F" fly camera + idle auto-orbit.
 * §9.M1.18 + §10.4.
 *
 * Auto-orbit: after IDLE_MS of no user input, start rotating the orbit
 * camera's azimuth slowly (AUTO_ORBIT_RPS radians/sec). Any pointer or
 * key event cancels it instantly.
 */

import { Euler, Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const IDLE_MS = 4000;
const AUTO_ORBIT_RPS = 0.08; // rad/s

export class Controls {
  private orbit: OrbitControls;
  private flyEnabled = false;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private pointerLocked = false;
  private lastInputMs = performance.now();
  private flySpeed = 20;
  private autoOrbitPaused = false;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly dom: HTMLElement
  ) {
    this.orbit = new OrbitControls(camera, dom);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 20;
    this.orbit.maxDistance = 500;

    const euler = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
    this.yaw = euler.y;
    this.pitch = euler.x;

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "f") this.toggleFly();
      this.keys.add(e.key.toLowerCase());
      this.noteInput();
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
      this.noteInput();
    });
    dom.addEventListener("mousemove", (e) => this.onMouseMove(e));
    dom.addEventListener("mousedown", () => this.noteInput());
    dom.addEventListener("wheel", () => this.noteInput(), { passive: true });
    dom.addEventListener("touchstart", () => this.noteInput(), { passive: true });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === dom;
    });
  }

  private noteInput(): void {
    this.lastInputMs = performance.now();
  }

  /** Call to pause auto-orbit externally (e.g. HUD panel open). */
  setAutoOrbitPaused(paused: boolean): void {
    this.autoOrbitPaused = paused;
  }

  private toggleFly(): void {
    this.flyEnabled = !this.flyEnabled;
    this.orbit.enabled = !this.flyEnabled;
    if (this.flyEnabled) this.dom.requestPointerLock?.();
    else document.exitPointerLock?.();
  }

  private onMouseMove(e: MouseEvent): void {
    this.noteInput();
    if (!this.flyEnabled || !this.pointerLocked) return;
    const sens = 0.0025;
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    const max = Math.PI / 2 - 0.01;
    if (this.pitch > max) this.pitch = max;
    if (this.pitch < -max) this.pitch = -max;
  }

  update(deltaSec: number): void {
    const now = performance.now();
    if (this.flyEnabled) {
      this.camera.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, 0, "YXZ"));
      const dir = { x: 0, y: 0, z: 0 };
      if (this.keys.has("w")) dir.z -= 1;
      if (this.keys.has("s")) dir.z += 1;
      if (this.keys.has("a")) dir.x -= 1;
      if (this.keys.has("d")) dir.x += 1;
      if (this.keys.has("q")) dir.y -= 1;
      if (this.keys.has("e")) dir.y += 1;
      const speed = this.flySpeed * (this.keys.has("shift") ? 3 : 1);
      if (dir.x || dir.y || dir.z) {
        const cy = Math.cos(this.yaw);
        const sy = Math.sin(this.yaw);
        const fx = -sy;
        const fz = -cy;
        const rx = cy;
        const rz = -sy;
        this.camera.position.x += (dir.x * rx + dir.z * fx) * speed * deltaSec;
        this.camera.position.z += (dir.x * rz + dir.z * fz) * speed * deltaSec;
        this.camera.position.y += dir.y * speed * deltaSec;
      }
      return;
    }
    // Orbit path (default).
    this.orbit.update();
    if (!this.autoOrbitPaused && now - this.lastInputMs > IDLE_MS) {
      // Slowly orbit the target. Rotate the camera around the orbit target
      // in the horizontal plane without touching the user's zoom.
      const target = this.orbit.target;
      const offset = new Vector3().subVectors(this.camera.position, target);
      const yAxis = new Vector3(0, 1, 0);
      offset.applyAxisAngle(yAxis, AUTO_ORBIT_RPS * deltaSec);
      this.camera.position.copy(target).add(offset);
      this.camera.lookAt(target);
    }
  }

  dispose(): void {
    this.orbit.dispose();
  }
}
