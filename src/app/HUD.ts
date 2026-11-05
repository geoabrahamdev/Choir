/**
 * HUD — dark-themed overlay with coherence, peer count, FPS.
 * §9.M1.20 of IMPLEMENTATION_PLAN.
 *
 * Also rotates the poetic caption from CONFIG.CAPTIONS after a 3s delay.
 * No analytics, no telemetry (§0, §12-non-goal).
 */

import { CONFIG } from "./config.js";

export class HUD {
  private coherenceEl: HTMLElement;
  private peersEl: HTMLElement;
  private fpsEl: HTMLElement;
  private captionEl: HTMLElement | null;
  private lastFpsSampleMs = 0;
  private framesSinceSample = 0;
  private captionTimer: ReturnType<typeof setTimeout> | null = null;
  private captionIndex = 0;

  constructor() {
    this.coherenceEl = this.require("hud-coherence");
    this.peersEl = this.require("hud-peers");
    this.fpsEl = this.require("hud-fps");
    this.captionEl = document.getElementById("caption");

    // Fade in first caption after 3s, then cycle every 10s.
    this.captionTimer = setTimeout(() => this.rotateCaption(), 3000);
  }

  private require(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD: missing #${id}`);
    return el;
  }

  setCoherence(c: number): void {
    this.coherenceEl.textContent = (c * 100).toFixed(1) + "%";
  }

  setPeerCount(n: number): void {
    this.peersEl.textContent = String(n);
  }

  frame(nowMs: number): void {
    this.framesSinceSample++;
    if (nowMs - this.lastFpsSampleMs >= 500) {
      const fps = Math.round(
        (this.framesSinceSample * 1000) / (nowMs - this.lastFpsSampleMs)
      );
      this.fpsEl.textContent = `${fps}`;
      this.framesSinceSample = 0;
      this.lastFpsSampleMs = nowMs;
    }
  }

  private rotateCaption(): void {
    if (!this.captionEl) return;
    const captions = CONFIG.CAPTIONS;
    const next = captions[this.captionIndex % captions.length];
    this.captionIndex++;
    this.captionEl.textContent = next;
    this.captionEl.classList.add("visible");
    this.captionTimer = setTimeout(() => {
      this.captionEl?.classList.remove("visible");
      this.captionTimer = setTimeout(() => this.rotateCaption(), 1500);
    }, 7000);
  }

  dispose(): void {
    if (this.captionTimer) clearTimeout(this.captionTimer);
  }
}
