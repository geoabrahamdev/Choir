/**
 * main.ts — boot the swarm, boot the scene, start the render loop.
 * §9.M1.21 + §9.M3.{3,4,5}.
 *
 * Mode behaviour:
 *   - local: rebuild a single-tab Swarm with AGENT_COUNT_SINGLE_TAB agents
 *     routed through LocalTransport. (M1 behaviour.)
 *   - live:  spawn one local agent, connect to PeerJS, and let the
 *     LiveSwarm materialise remote placeholders as their gossip arrives.
 *     If signaling doesn't open our id within SIGNALING_TIMEOUT_MS,
 *     fall back to local with an inline HUD note.
 *
 * Switching modes tears down and rebuilds the swarm WITHOUT a page
 * reload; the viz objects (NodeMesh, EdgeLines, EdgePulse, Scene) are
 * reused, but the force layout and idx map are rebuilt because the
 * agent set changes.
 */

import "../styles/global.css";
import { CONFIG } from "./config.js";
import { Swarm } from "../core/Swarm.js";
import { LiveSwarm } from "../core/LiveSwarm.js";
import { coherence as computeCoherence } from "../core/CoherenceMetric.js";
import { createLocalNetwork } from "../network/LocalTransport.js";
import { CachedTrajectory } from "../inference/CachedTrajectory.js";
import { Scene } from "../viz/Scene.js";
import { NodeMesh } from "../viz/NodeMesh.js";
import { EdgeLines } from "../viz/EdgeLines.js";
import { EdgePulse } from "../viz/EdgePulse.js";
import { CoherenceWave } from "../viz/CoherenceWave.js";
import { Controls } from "../viz/Controls.js";
import { ForceLayout } from "../viz/ForceLayout.js";
import { Starfield } from "../viz/Starfield.js";
import { HUD, type SwarmMode } from "./HUD.js";
import { AdvancedPanel } from "./AdvancedPanel.js";
import type { Agent } from "../core/Agent.js";
import type { GossipEventHandler } from "../network/GossipProtocol.js";

/** The subset of Swarm / LiveSwarm that main.ts uses. */
interface SwarmLike {
  start(): void;
  stop(): void;
  tick(): void;
  getAgents(): readonly Agent[];
  onGossip(cb: GossipEventHandler): void;
}

async function boot(): Promise<void> {
  // Attempt to register coi-serviceworker so SharedArrayBuffer works for M4.
  // Harmless when WebLLM is never enabled.
  if ("serviceWorker" in navigator) {
    const swUrl = joinUrl(import.meta.env.BASE_URL || "/", "coi-serviceworker.js");
    const script = document.createElement("script");
    script.src = swUrl;
    document.head.appendChild(script);
  }
  const canvas = document.getElementById("three") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("#three canvas missing");

  resizeCanvas(canvas);
  window.addEventListener("resize", () => resizeCanvas(canvas));

  const base = import.meta.env.BASE_URL || "/";
  const trajUrl = joinUrl(base, CONFIG.TRAJECTORIES_URL);
  const bootstrapUrl = joinUrl(base, "bootstrap-peers.json");

  let inference: import("../inference/InferenceEngine.js").InferenceEngine | null =
    new CachedTrajectory(trajUrl);
  try {
    await inference.ready();
    console.info("[choir] trajectories loaded, capacity", inference.agentCapacity);
  } catch (err) {
    console.warn("[choir] trajectories unavailable, falling back to pure drift", err);
  }

  const scene = new Scene(canvas);
  new Starfield(scene.scene);
  // The viz will be sized to the largest swarm we expect to see
  // across mode switches — the single-tab count, same for live mode
  // (we'll add placeholder slots as needed).
  const MAX_NODES = CONFIG.MAX_RENDER_NODES;
  const nodeMesh = new NodeMesh(scene.scene, MAX_NODES);
  const edgeLines = new EdgeLines(scene.scene, CONFIG.COLOURS.ACCENT_2);
  const edgePulse = new EdgePulse(scene.scene, CONFIG.COLOURS.COHERENCE);
  const wave = new CoherenceWave(scene.scene);
  const controls = new Controls(scene.camera, canvas);
  const hud = new HUD();
  new AdvancedPanel({
    onEnable: async (progress) => {
      const { WebLLMEngine } = await import("../inference/WebLLMEngine.js");
      const next = new WebLLMEngine({ onProgress: progress });
      await next.ready();
      inference?.dispose?.();
      inference = next;
      await transitionSwarm(hud.getMode());
    },
    onDisable: async () => {
      const cached = new CachedTrajectory(trajUrl);
      try { await cached.ready(); } catch { /* fall through */ }
      inference?.dispose?.();
      inference = cached;
      await transitionSwarm(hud.getMode());
    }
  });

  // Mutable per-mode state.
  let swarm: SwarmLike | null = null;
  let layout: ForceLayout | null = null;
  let idToIdx = new Map<string, number>();
  let modeEpoch = 0;
  let pendingTransport: { close(): void } | null = null;
  let lastCoherence = 0;
  let lastWaveMs = -Infinity;
  const WAVE_COOLDOWN_MS = 4000;
  const DRIFT_INTERVAL_MS = 120;
  let lastDriftMs = performance.now();

  async function buildLocal(epoch: number): Promise<void> {
    const net = createLocalNetwork();
    const s = new Swarm({
      agentCount: CONFIG.AGENT_COUNT_SINGLE_TAB,
      latentDim: CONFIG.LATENT_DIM,
      driftNoise: CONFIG.DRIFT_NOISE,
      makeTransport: (id) => net.attach(id),
      inference
    });
    s.start();
    if (epoch !== modeEpoch) {
      s.stop();
      return;
    }
    rewireVizTo(s);
    hud.setNote(null);
  }

  async function buildLive(epoch: number): Promise<void> {
    hud.setNote("connecting…");
    const { RTCTransport } = await import("../network/RTCTransport.js");
    if (epoch !== modeEpoch) return;
    const transport = new RTCTransport({
      bootstrapUrl,
      onPeerCountChanged: () => {
        // peer count is derived from getAgents().length - 1 instead
        // (we also include ourselves). Nothing to do here.
      }
    });
    pendingTransport = transport;
    try {
      await transport.waitReady();
    } catch (err) {
      if (pendingTransport === transport) pendingTransport = null;
      if (epoch !== modeEpoch) {
        transport.close();
        return;
      }
      console.warn("[choir] live mode unavailable:", err);
      transport.close();
      hud.setNote("signaling unavailable — Local");
      hud.setMode("local", false);
      await buildLocal(epoch);
      return;
    }
    if (pendingTransport === transport) pendingTransport = null;
    if (epoch !== modeEpoch) {
      transport.close();
      return;
    }
    const s = new LiveSwarm({
      latentDim: CONFIG.LATENT_DIM,
      driftNoise: CONFIG.DRIFT_NOISE,
      transport,
      inference,
      onRosterChange: () => {
        if (epoch === modeEpoch && swarm === s) rebuildIdxAndLayout(s);
      }
    });
    s.start();
    if (epoch !== modeEpoch) {
      s.stop();
      return;
    }
    rewireVizTo(s);
    hud.setNote("live — waiting for peers");
  }

  async function transitionSwarm(mode: SwarmMode): Promise<void> {
    const epoch = ++modeEpoch;
    pendingTransport?.close();
    pendingTransport = null;
    try { swarm?.stop(); } catch { /* ignore */ }
    if (mode === "live") await buildLive(epoch);
    else await buildLocal(epoch);
  }

  function rewireVizTo(s: SwarmLike): void {
    swarm = s;
    rebuildIdxAndLayout(s);
    nodeMesh.initColours(s.getAgents());
    // Reset wave/pulse state when swarm changes.
    edgeLines.clear();
    edgePulse.clear();
    lastCoherence = 0;
    lastWaveMs = -Infinity;
    s.onGossip((ev) => {
      const from = idToIdx.get(ev.fromId);
      const to = idToIdx.get(ev.toId);
      if (from === undefined || to === undefined) return;
      if (ev.kind === "send") {
        const now = performance.now();
        edgeLines.addEdge(from, to, now);
        edgePulse.add(from, to, now);
      }
    });
  }

  function rebuildIdxAndLayout(s: SwarmLike): void {
    const agents = s.getAgents();
    idToIdx = new Map();
    agents.forEach((a, i) => idToIdx.set(a.id, i));
    layout = new ForceLayout(agents);
    // Re-init colours if the agent count changed — ensures remotes get a hue.
    nodeMesh.initColours(agents);
  }

  // Initial mode from HUD (which read localStorage).
  await transitionSwarm(hud.getMode());

  hud.onModeChange((m: SwarmMode) => {
    void transitionSwarm(m);
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const activeSwarm = swarm;
    const activeLayout = layout;
    if (!activeSwarm || !activeLayout) {
      requestAnimationFrame(frame);
      return;
    }

    if (now - lastDriftMs > DRIFT_INTERVAL_MS) {
      activeSwarm.tick();
      lastDriftMs = now;
    }

    activeLayout.tick();
    nodeMesh.updatePositions(activeLayout.nodes);
    edgeLines.update(now, activeLayout.nodes);
    edgePulse.update(now, activeLayout.nodes);

    const agents = activeSwarm.getAgents();
    const c = computeCoherence(agents);
    hud.setCoherence(c);
    hud.setPeerCount(agents.length);
    hud.frame(now);

    if (
      c > CONFIG.COHERENCE_WAVE_THRESHOLD &&
      lastCoherence <= CONFIG.COHERENCE_WAVE_THRESHOLD &&
      now - lastWaveMs > WAVE_COOLDOWN_MS
    ) {
      wave.trigger(now, activeLayout.centroid());
      lastWaveMs = now;
    }
    lastCoherence = c;
    const waveTick = wave.update(now);
    if (waveTick) {
      nodeMesh.pulseAt(
        wave.getCentre(),
        waveTick.radius + waveTick.thickness / 2,
        activeLayout.nodes,
        0.15
      );
    }
    nodeMesh.tickHighlight(dt);

    controls.update(dt);
    scene.render();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("beforeunload", () => {
    pendingTransport?.close();
    swarm?.stop();
    inference?.dispose?.();
  });
}

function resizeCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
}

function joinUrl(base: string, rel: string): string {
  if (!base.endsWith("/")) base += "/";
  if (rel.startsWith("/")) rel = rel.slice(1);
  return base + rel;
}

boot().catch((err) => {
  console.error("[choir] boot failed:", err);
});
