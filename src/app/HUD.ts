/**
 * HUD — dark-themed overlay. §9.M1.20 + §10.7 captions + §9.M3.3 toggle.
 *
 * Adds a Local/Live mode toggle whose choice persists in localStorage.
 * The toggle fires onModeChange so main.ts can tear down and rebuild
 * the swarm without a page reload. The HUD also shows a small note
 * area for mode messages (e.g. "signaling unavailable → Local").
 */

import { CONFIG } from "./config.js";

export type SwarmMode = "local" | "live";
export type ModeChangeHandler = (mode: SwarmMode) => void;

const LS_MODE = "choir.mode";

export class HUD {
  private coherenceEl: HTMLElement;
  private peersEl: HTMLElement;
  private fpsEl: HTMLElement;
  private captionEl: HTMLElement | null;
  private modeLocalBtn: HTMLButtonElement;
  private modeLiveBtn: HTMLButtonElement;
  private noteEl: HTMLElement;
  private lastFpsSampleMs = 0;
  private framesSinceSample = 0;
  private captionTimer: ReturnType<typeof setTimeout> | null = null;
  private captionIndex = 0;
  private modeHandlers: ModeChangeHandler[] = [];
  private currentMode: SwarmMode;

  constructor() {
    this.coherenceEl = this.require("hud-coherence");
    this.peersEl = this.require("hud-peers");
    this.fpsEl = this.require("hud-fps");
    this.captionEl = document.getElementById("caption");

    this.modeLocalBtn = this.require("hud-mode-local") as HTMLButtonElement;
    this.modeLiveBtn = this.require("hud-mode-live") as HTMLButtonElement;
    this.noteEl = this.require("hud-note");

    this.currentMode = this.readMode();
    this.reflectMode();

    this.modeLocalBtn.addEventListener("click", () => this.selectMode("local"));
    this.modeLiveBtn.addEventListener("click", () => this.selectMode("live"));

    this.captionTimer = setTimeout(() => this.rotateCaption(), 3000);
  }

  private require(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD: missing #${id}`);
    return el;
  }

  private readMode(): SwarmMode {
    try {
      const v = localStorage.getItem(LS_MODE);
      if (v === "live" || v === "local") return v;
    } catch { /* ignore */ }
    return "local";
  }

  private writeMode(m: SwarmMode): void {
    try { localStorage.setItem(LS_MODE, m); } catch { /* ignore */ }
  }

  getMode(): SwarmMode { return this.currentMode; }

  onModeChange(cb: ModeChangeHandler): void {
    this.modeHandlers.push(cb);
  }

  setMode(m: SwarmMode, persist = true): void {
    this.currentMode = m;
    if (persist) this.writeMode(m);
    this.reflectMode();
  }

  private selectMode(m: SwarmMode): void {
    if (this.currentMode === m) return;
    this.setMode(m);
    for (const h of this.modeHandlers) h(m);
  }

  private reflectMode(): void {
    this.modeLocalBtn.classList.toggle("active", this.currentMode === "local");
    this.modeLiveBtn.classList.toggle("active", this.currentMode === "live");
  }

  setNote(text: string | null): void {
    this.noteEl.textContent = text ?? "";
    this.noteEl.classList.toggle("visible", !!text);
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
