/**
 * main.ts — boot the swarm, boot the scene, start the render loop.
 * §9.M1.21 of IMPLEMENTATION_PLAN.
 *
 * Cross-file contract summary:
 *   - Swarm drives logic on a 500 ms gossip timer + a fast render tick.
 *   - ForceLayout runs every frame.
 *   - Viz components subscribe to gossip events and animate.
 *   - HUD reflects coherence / peers / FPS.
 *
 * No globals leak outside this module. All tunables live in config.ts.
 */

import "../styles/global.css";
import { CONFIG } from "./config.js";
import { Swarm } from "../core/Swarm.js";
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
import { HUD } from "./HUD.js";

async function boot(): Promise<void> {
  const canvas = document.getElementById("three") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("#three canvas missing");

  // Size the canvas to the window.
  resizeCanvas(canvas);
  window.addEventListener("resize", () => resizeCanvas(canvas));

  // 1. Build InferenceEngine. The base path is Vite's BASE_URL.
  const base = import.meta.env.BASE_URL || "/";
  const trajUrl = joinUrl(base, CONFIG.TRAJECTORIES_URL);
  const inference = new CachedTrajectory(trajUrl);
  try {
    await inference.ready();
    console.info("[choir] trajectories loaded, capacity", inference.agentCapacity);
  } catch (err) {
    console.warn("[choir] trajectories unavailable, falling back to pure drift", err);
  }

  // 2. Build in-tab network.
  const net = createLocalNetwork();

  // 3. Build the swarm.
  const swarm = new Swarm({
    agentCount: CONFIG.AGENT_COUNT_SINGLE_TAB,
    latentDim: CONFIG.LATENT_DIM,
    driftNoise: CONFIG.DRIFT_NOISE,
    makeTransport: (id) => net.attach(id),
    inference
  });
  swarm.start();

  // 4. Build the scene.
  const scene = new Scene(canvas);
  const nodeMesh = new NodeMesh(scene.scene, swarm.getAgents().length);
  nodeMesh.initColours(swarm.getAgents());
  const edgeLines = new EdgeLines(scene.scene, CONFIG.COLOURS.ACCENT_2);
  const edgePulse = new EdgePulse(scene.scene, CONFIG.COLOURS.COHERENCE);
  const wave = new CoherenceWave(scene.scene);
  const controls = new Controls(scene.camera, canvas);
  const layout = new ForceLayout(swarm.getAgents());
  const hud = new HUD();

  // 5. Wire gossip → viz.
  const idToIdx = new Map<string, number>();
  swarm.getAgents().forEach((a, i) => idToIdx.set(a.id, i));
  swarm.onGossip((ev) => {
    const from = idToIdx.get(ev.fromId);
    const to = idToIdx.get(ev.toId);
    if (from === undefined || to === undefined) return;
    if (ev.kind === "send") {
      const now = performance.now();
      edgeLines.addEdge(from, to, now);
      edgePulse.add(from, to, now);
    }
  });

  // 6. Coherence tracker + wave trigger.
  let lastCoherence = 0;
  let lastWaveMs = -Infinity;
  const WAVE_COOLDOWN_MS = 4000;

  // 7. Advance agent drift periodically (every render tick cycle is
  // too fast — stick to ~120 ms so the baked trajectory plays at a
  // natural pace).
  const DRIFT_INTERVAL_MS = 120;
  let lastDriftMs = performance.now();

  // 8. Render loop.
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (now - lastDriftMs > DRIFT_INTERVAL_MS) {
      swarm.tick();
      lastDriftMs = now;
    }

    layout.tick();
    nodeMesh.updatePositions(layout.nodes);
    edgeLines.update(now, layout.nodes);
    edgePulse.update(now, layout.nodes);

    // Compute coherence occasionally — cheap, but no need to do it on
    // every frame.
    const c = computeCoherence(swarm.getAgents());
    hud.setCoherence(c);
    hud.setPeerCount(swarm.getAgents().length);
    hud.frame(now);

    if (
      c > CONFIG.COHERENCE_WAVE_THRESHOLD &&
      lastCoherence <= CONFIG.COHERENCE_WAVE_THRESHOLD &&
      now - lastWaveMs > WAVE_COOLDOWN_MS
    ) {
      wave.trigger(now, layout.centroid());
      lastWaveMs = now;
    }
    lastCoherence = c;
    wave.update(now);

    controls.update(dt);
    scene.render();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
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
