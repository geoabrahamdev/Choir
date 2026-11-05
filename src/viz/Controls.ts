/**
 * Controls — OrbitControls by default, "F" key toggles a trivial fly
 * camera. §9.M1.18.
 *
 * The fly camera is intentionally simple: WASD + QE for altitude,
 * mouse drag to look. Enough to let a user explore without pulling in
 * another dep.
 */

import { Euler, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class Controls {
  private orbit: OrbitControls;
  private flyEnabled = false;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private pointerLocked = false;
  private lastSpeed = 20;

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
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    dom.addEventListener("mousemove", (e) => this.onMouseMove(e));
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === dom;
    });
  }

  private toggleFly(): void {
    this.flyEnabled = !this.flyEnabled;
    this.orbit.enabled = !this.flyEnabled;
    if (this.flyEnabled) {
      this.dom.requestPointerLock?.();
    } else {
      document.exitPointerLock?.();
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.flyEnabled || !this.pointerLocked) return;
    const sens = 0.0025;
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    const max = Math.PI / 2 - 0.01;
    if (this.pitch > max) this.pitch = max;
    if (this.pitch < -max) this.pitch = -max;
  }

  update(deltaSec: number): void {
    if (this.flyEnabled) {
      // Apply yaw/pitch.
      this.camera.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, 0, "YXZ"));
      // WASD + QE motion.
      const dir = { x: 0, y: 0, z: 0 };
      if (this.keys.has("w")) dir.z -= 1;
      if (this.keys.has("s")) dir.z += 1;
      if (this.keys.has("a")) dir.x -= 1;
      if (this.keys.has("d")) dir.x += 1;
      if (this.keys.has("q")) dir.y -= 1;
      if (this.keys.has("e")) dir.y += 1;
      const speed = this.lastSpeed * (this.keys.has("shift") ? 3 : 1);
      if (dir.x || dir.y || dir.z) {
        const forward = { x: 0, y: 0, z: -1 };
        const right = { x: 1, y: 0, z: 0 };
        // Rotate basis by yaw.
        const cy = Math.cos(this.yaw);
        const sy = Math.sin(this.yaw);
        const fx = forward.x * cy + forward.z * sy;
        const fz = -forward.x * sy + forward.z * cy;
        const rx = right.x * cy + right.z * sy;
        const rz = -right.x * sy + right.z * cy;
        this.camera.position.x += (dir.x * rx + dir.z * fx) * speed * deltaSec;
        this.camera.position.z += (dir.x * rz + dir.z * fz) * speed * deltaSec;
        this.camera.position.y += dir.y * speed * deltaSec;
      }
    } else {
      this.orbit.update();
    }
  }

  dispose(): void {
    this.orbit.dispose();
  }
}
