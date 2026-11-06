/**
 * AdvancedPanel — opt-in UI for M4 WebLLM mode. §9.M4.4.
 *
 * Renders a small collapsed panel below the HUD. On "Enable advanced
 * mode" the user is told what will download, must click once more to
 * confirm, and the panel reports progress. On success it swaps the
 * inference engine via the onEnable callback.
 */

export interface AdvancedPanelOptions {
  onEnable: (progress: (text: string, pct: number) => void) => Promise<void>;
  /** Called whenever the user explicitly disables advanced mode. */
  onDisable: () => void | Promise<void>;
}

export class AdvancedPanel {
  private root: HTMLElement;
  private toggleBtn: HTMLButtonElement;
  private statusEl: HTMLElement;
  private progressEl: HTMLElement;
  private enabled = false;
  private opts: AdvancedPanelOptions;

  constructor(opts: AdvancedPanelOptions) {
    this.opts = opts;
    this.root = this.build();
    document.body.appendChild(this.root);
    this.toggleBtn = this.root.querySelector(".adv-toggle") as HTMLButtonElement;
    this.statusEl = this.root.querySelector(".adv-status") as HTMLElement;
    this.progressEl = this.root.querySelector(".adv-progress") as HTMLElement;
    this.toggleBtn.addEventListener("click", () => this.onToggleClick());
    this.updateUi();
  }

  private build(): HTMLElement {
    const div = document.createElement("div");
    div.id = "adv-panel";
    div.innerHTML = `
      <div class="adv-head">
        <span class="adv-title">advanced</span>
        <button type="button" class="adv-toggle">off</button>
      </div>
      <div class="adv-status">
        Opt-in real LLM inference in-browser. Requires WebGPU + ~500 MB download.
      </div>
      <div class="adv-progress"></div>
    `;
    return div;
  }

  private updateUi(): void {
    this.toggleBtn.textContent = this.enabled ? "on" : "off";
    this.toggleBtn.classList.toggle("active", this.enabled);
  }

  private async onToggleClick(): Promise<void> {
    if (this.enabled) {
      this.enabled = false;
      this.updateUi();
      this.toggleBtn.disabled = true;
      this.statusEl.textContent = "returning to cached trajectories…";
      try {
        await this.opts.onDisable();
        this.statusEl.textContent = "advanced disabled; using cached trajectories.";
        this.progressEl.textContent = "";
      } catch (err) {
        this.statusEl.textContent = `could not disable advanced mode: ${String(err)}`;
      } finally {
        this.toggleBtn.disabled = false;
        this.updateUi();
      }
      return;
    }
    // Pre-flight checks.
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      this.statusEl.textContent = "WebGPU not available in this browser.";
      return;
    }
    if (typeof SharedArrayBuffer === "undefined" || !crossOriginIsolated) {
      this.statusEl.textContent =
        "Page is not cross-origin isolated. Try a hard reload — the service worker needs to take over.";
      return;
    }
    this.toggleBtn.disabled = true;
    this.statusEl.textContent = "loading model (first run ~500 MB, cached after)…";
    this.progressEl.textContent = "";
    try {
      await this.opts.onEnable((text, pct) => {
        const p = Math.round(pct * 100);
        this.progressEl.textContent = `${text} — ${p}%`;
      });
      this.enabled = true;
      this.statusEl.textContent = "advanced mode is on.";
    } catch (err) {
      this.statusEl.textContent = `could not enable advanced mode: ${String(err)}`;
    } finally {
      this.toggleBtn.disabled = false;
      this.updateUi();
    }
  }
}
