# Choir — Implementation Plan

> A self-contained specification. The AI reading this file is the sole builder of the project and has no prior conversation context. Follow this document literally, in milestone order (M1 → M4). Do not skip phases. Do not invent features not listed.
>
> **Before writing any code, read §A (Agent handoff protocol).** You are one of possibly several AI sessions working on this project in sequence. The shared memory files in `.agent/` are how you inherit context from the previous session and leave context for the next one. Treat them as load-bearing, not decorative.

---

## A. Agent handoff protocol — shared memory for Codex ↔ Claude handoff

This project is likely to span multiple AI sessions (Codex and Claude, possibly alternating as token budgets run out). Each session starts with zero memory of previous sessions. The `.agent/` directory is the persistent, git-tracked shared memory that bridges them.

### A.1 Directory layout

Create at project root (alongside `src/`, `public/`, etc.):

```
.agent/
├── STATE.md          # current status snapshot — single source of truth
├── LOG.md            # append-only chronological journal
├── DECISIONS.md      # ADR-style record of non-obvious choices
└── HANDOFF.md        # "if you're starting fresh, read this first"
```

**`.agent/` is tracked in git. Do NOT gitignore it.** The whole point is that commits carry context forward. Vite will not include it in the production build because it is outside `src/` and `public/`.

### A.2 Session bootstrap (MANDATORY first step of every session)

Before reading any other file in the repo, the AI session must, in this order:

1. Read `.agent/HANDOFF.md` — this tells you where you are and what to do next.
2. Read `.agent/STATE.md` — the current status snapshot.
3. Read the last ~50 lines of `.agent/LOG.md` — recent activity context.
4. Skim `.agent/DECISIONS.md` — so you don't re-litigate settled choices.
5. Only then start work.

If `.agent/` does not exist yet, this is the very first session. Create the directory and the four files using the templates in §A.6 before any code.

### A.3 During-session discipline

- **Before starting a new task:** update `STATE.md` to reflect the task you're beginning. Set `current_task` and `status: in_progress`.
- **After finishing a task:** append one entry to `LOG.md` and update `STATE.md`. Mark the task done; set the next pending task.
- **When making a non-obvious choice** (picking between two valid approaches, workarounds, trade-offs): append to `DECISIONS.md`. Future sessions must not relitigate.
- **When stuck or blocked:** record the blocker in `STATE.md` under `blockers:` with enough detail that a fresh session could resume debugging.
- **Keep entries terse.** The point is enough context to resume, not a diary. Code is the source of truth for what the code does; `.agent/` is the source of truth for *why* and *what next*.

### A.4 Session end (MANDATORY last step)

Before stopping (whether by token exhaustion, user interrupt, or completion):

1. Rewrite `.agent/HANDOFF.md` fresh (do not append — fully rewrite). It must contain:
   - **Where we are:** current milestone and task.
   - **Last successful action.**
   - **What to do next:** the single immediate next action, specific enough that a fresh session can execute it with no ambiguity.
   - **Anything broken or unresolved.**
   - **Any state the next session must know** (env setup done, bake script run, deployed-URL exists, etc.).
2. Update `STATE.md` to reflect the final state of this session.
3. Commit `.agent/*` alongside any code changes with a message like `chore: session handoff — M1 task 7 complete`.

### A.5 Rules for logging and memory files

- Timestamp format: ISO-8601 UTC, e.g. `2026-11-05T14:23:00Z`.
- Agent self-identification: at the top of every LOG/DECISIONS entry, name yourself as `codex` or `claude` (so git blame + the log together are legible).
- Never delete from `LOG.md` or `DECISIONS.md`. They are append-only. If you need to supersede a decision, add a new entry that references and overrides the old one.
- `STATE.md` and `HANDOFF.md` are allowed to be rewritten in full — they are snapshots, not journals.
- Do not duplicate information between files. Use the right file for the content. If unsure: current status → STATE, chronology → LOG, rationale → DECISIONS, resume instructions → HANDOFF.
- Keep each file under 500 lines. When LOG.md exceeds that, archive the oldest half to `.agent/archive/LOG-YYYY-MM.md` and start fresh. Preserve the archive in git.

### A.6 Initial templates

On the first session, create these files with exactly this content.

**`.agent/STATE.md`:**

```markdown
# Project State

last_updated: 2026-11-05T00:00:00Z
last_agent: claude
current_milestone: M1
current_task: 1  # §9 task number
status: not_started  # one of: not_started | in_progress | blocked | milestone_complete

## Completed tasks (this milestone)
- (none yet)

## Pending tasks (this milestone)
- M1.1 Scaffold Vite + TypeScript project
- M1.2 Write global.css with palette variables
- M1.3 LatentState.ts with unit tests
- M1.4 Agent.ts
- M1.5 bake-trajectories.ts script
- M1.6 InferenceEngine.ts interface
- M1.7 CachedTrajectory.ts
- M1.8 PeerTransport.ts interface
- M1.9 LocalTransport.ts
- M1.10 GossipProtocol.ts
- M1.11 Swarm.ts
- M1.12 CoherenceMetric.ts
- M1.13 Three.js Scene.ts
- M1.14 NodeMesh.ts
- M1.15 EdgeLines.ts
- M1.16 EdgePulse.ts
- M1.17 CoherenceWave.ts
- M1.18 Controls.ts
- M1.19 Force layout integration
- M1.20 HUD.ts
- M1.21 main.ts
- M1.22 index.html
- M1 acceptance: all criteria in §9 pass

## Blockers
- (none)

## Environment state
- node_installed: unknown
- deps_installed: false
- trajectories_baked: false
- tests_passing: unknown
- deployed_to_pages: false
- live_url: null
```

**`.agent/LOG.md`:**

```markdown
# Session Log

Append-only. Format: one block per session action. Newest at bottom.

---

## 2026-11-05T00:00:00Z — claude
Created initial `.agent/` structure with STATE, LOG, DECISIONS, HANDOFF templates.
Ready to begin M1.1.
```

**`.agent/DECISIONS.md`:**

```markdown
# Decision Log

ADR-style record of non-obvious choices. Append-only. Newest at bottom.

Format:
### <seq>. <short title> — <date> — <agent>
**Context:** what situation forced a choice
**Decision:** what we chose
**Alternatives considered:** what else was on the table
**Consequences:** what this commits us to

---

### 1. Fake latent states in M1 — 2026-11-05 — claude
**Context:** Shipping M1 requires a working swarm but WebLLM in-browser inference is heavy and brittle.
**Decision:** M1 uses pre-baked trajectory vectors from `trajectories.bin`. Real LLM inference deferred to optional M4.
**Alternatives considered:** Run a tiny model in M1; use random drift only.
**Consequences:** `InferenceEngine` interface exists so swap is clean later. M1 visual is identical to what M4 will show, which is the point.
```

**`.agent/HANDOFF.md`:**

```markdown
# Handoff — Next Session Start Here

last_written: 2026-11-05T00:00:00Z
last_agent: claude

## Where we are
Project just scaffolded. Nothing built yet. First code task is M1.1 (scaffold Vite + TS).

## Last successful action
Created `.agent/` directory and the four template files.

## What to do next (exact)
1. Run `npm create vite@latest . -- --template vanilla-ts` in the project root (if not already a Vite project).
2. Install deps listed in §4 of IMPLEMENTATION_PLAN.md: `npm i three d3-force-3d && npm i -D vitest tsx @types/three eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin`.
3. Create the exact folder structure in §5 (empty files are fine — just scaffold).
4. Then start M1.2 (global.css).
5. Update STATE.md after each task completes.

## Blocked / unresolved
Nothing.

## Environment state next session must know
- `.agent/` is now initialised — do NOT re-create it, just update.
- No code written yet.
- No npm install run yet.
```

### A.7 When tokens are running low

If you notice you are approaching token exhaustion mid-task:

1. **Stop what you're doing immediately** — do not start a new file.
2. Commit whatever code is in a working-or-skipable state (half-finished files with clear `// TODO: next session resume here` markers are OK).
3. Rewrite `HANDOFF.md` with the exact resume point and any gotchas the next session needs.
4. Append a final `LOG.md` entry noting the early termination.
5. End the session.

Never leave broken code with no handoff note — the next session will waste tokens figuring out what happened.

### A.8 Integrity rule

If you find `.agent/` files contradict each other (e.g. STATE says M1.5 done but LOG has no entry for it), **trust the code, then LOG, then DECISIONS, then STATE, then HANDOFF**. Fix the inconsistency explicitly in a LOG entry before continuing work.

---

## 0. Framing rules (NON-NEGOTIABLE — violating these invalidates the project)

- This project is an **artistic and technical demo**. It is NOT a scientific claim.
- Project is a **visual metaphor** for emergent coherence in a swarm of software agents. It does **not** model, simulate, demonstrate, or prove consciousness, non-locality, souls, telepathy, or any metaphysical claim.
- All user-facing copy (page title, meta description, HUD text, tooltips, README, repo description) must obey these rules:
  - **Allowed words:** "metaphor", "toy model", "visualization", "simulation of gossip protocol", "emergent coherence", "distributed agents", "swarm".
  - **Forbidden words in UI/README:** "consciousness", "non-local", "soul", "telepathy", "proves", "demonstrates awareness", "mind-field", "quantum consciousness", "noetic".
  - If a label needs to be evocative, use lines like *"what if agreement looked like this?"* or *"a toy choir of tiny minds"*. Never present the demo as scientific evidence.

If you are tempted to add poetic consciousness framing in README or UI, stop and reread this section.

---

## 1. What you are building

**Choir** — a single-page web application, deployed to GitHub Pages, that visualizes a peer-to-peer swarm of software agents reaching consensus via a gossip protocol, rendered as a live 3D force-directed graph.

Three ways a visitor experiences it:

1. **Opened in one tab (Phase M1-M2 behaviour):** 100-200 *simulated* agents inside that tab exchange small vector "latent states" via an in-browser gossip protocol. The 3D viz shows nodes clustering and edges pulsing as they converge.
2. **Opened on multiple devices or tabs (Phase M3 behaviour):** Real browsers discover each other through a WebRTC signaling server; a real P2P swarm forms across the internet. Each browser is one node.
3. **Advanced mode (Phase M4, opt-in):** Instead of pre-computed latent vectors, each node runs an actual small LLM in-browser (via WebLLM) and gossips real embeddings. Falls back gracefully to pre-computed mode if hardware can't support it.

---

## 2. Non-goals (do NOT build these)

- No central application server. (A WebRTC signaling server is OK and is **not** the application server.)
- No user login, no accounts, no database.
- No analytics beyond GitHub's default Pages hit counter.
- No React, no Vue, no SvelteKit. Vanilla TypeScript only. (Three.js and small utility libs are fine.)
- No real LLM inference in M1, M2, or M3.
- No UI text that violates Section 0.

---

## 3. Prerequisites (document in README)

- Node.js ≥ 20 LTS
- npm (or pnpm — pick one and stick with it; the examples below assume npm)
- A GitHub account with Pages enabled on the target repo
- A modern browser: Chrome 113+, Edge 113+, or Firefox 110+ (WebGPU only required for M4)
- For M4 only: a GPU with ≥ 4 GB VRAM and a WebGPU-enabled browser

---

## 4. Technology stack

Pin these versions in `package.json` to the latest minor at install time:

| Layer | Package | Purpose |
|---|---|---|
| Language | `typescript` ^5.4 | Type safety |
| Build & dev server | `vite` ^5.2 | Fast HMR, small bundles |
| 3D rendering | `three` ^0.162 | WebGL rendering |
| Physics layout | `d3-force-3d` ^3.0 | Force-directed graph simulation in 3D |
| WebRTC (M3+) | `simple-peer` ^9.11 | Lean WebRTC data channel API |
| Signaling (M3+) | `peerjs` ^1.5 | Free-tier signaling + peer discovery |
| LLM (M4 only, lazy) | `@mlc-ai/web-llm` latest | In-browser LLM inference |
| Testing | `vitest` ^1.4 | Unit tests |
| Linting | `eslint` ^8 + `@typescript-eslint` | Consistency |

No React. No Tailwind (use plain CSS with CSS variables for the dark theme). No state management library (the Swarm class is the state).

---

## 5. Repository layout (create exactly this structure)

```
choir/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
│   ├── embeddings/
│   │   └── trajectories.bin        # pre-baked latent vectors (generated, see §9)
│   └── favicon.svg
├── src/
│   ├── core/
│   │   ├── Agent.ts                # one node: id, personality, latentState, step()
│   │   ├── Swarm.ts                # collection of Agents + tick loop
│   │   ├── LatentState.ts          # vector type + math (cosine sim, blend, drift)
│   │   └── CoherenceMetric.ts      # computes swarm-wide agreement score ∈ [0,1]
│   ├── network/
│   │   ├── PeerTransport.ts        # abstract interface — send(peerId, msg), onMessage()
│   │   ├── LocalTransport.ts       # in-tab fake network with simulated latency/loss
│   │   ├── RTCTransport.ts         # real WebRTC via simple-peer + PeerJS signaling
│   │   └── GossipProtocol.ts       # push-based epidemic protocol, anti-entropy
│   ├── inference/
│   │   ├── InferenceEngine.ts      # abstract interface — step(input) -> LatentState
│   │   ├── CachedTrajectory.ts     # M1 — loads trajectories.bin, returns next vector
│   │   └── WebLLMEngine.ts         # M4 — real inference, lazy-loaded
│   ├── viz/
│   │   ├── Scene.ts                # Three.js scene, camera, renderer, fog, bloom
│   │   ├── NodeMesh.ts             # instanced spheres with per-node colour/glow
│   │   ├── EdgeLines.ts            # buffer-geometry edge rendering
│   │   ├── EdgePulse.ts            # travelling-light effect on a gossip event
│   │   ├── CoherenceWave.ts        # full-graph bloom when coherence spikes
│   │   └── Controls.ts             # 6DoF fly camera or orbit fallback
│   ├── app/
│   │   ├── main.ts                 # entry: boot swarm, boot viz, wire HUD
│   │   ├── HUD.ts                  # dark-themed overlay: coherence, peers, FPS
│   │   └── config.ts               # all tunable constants in one place
│   ├── styles/
│   │   └── global.css              # dark theme variables + reset
│   └── index.html
├── test/
│   ├── gossip.test.ts
│   ├── coherence.test.ts
│   └── latent.test.ts
├── scripts/
│   └── bake-trajectories.ts        # node script that generates trajectories.bin
├── .gitignore
├── .eslintrc.cjs
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 6. Core concepts explained (for your own grounding before writing code)

### 6.1 Agent

An **Agent** is a tiny software actor with:
- a stable `id` (e.g. `peer-0001`)
- a "personality" seed that biases its vector drift
- a current **latent state** — a fixed-size float vector (default: 32 dimensions)
- a `step()` method that updates its latent state each tick, blending its own drift with vectors received from peers

### 6.2 Latent state

Just a `Float32Array` of length `LATENT_DIM` (default 32). Operations:
- **cosine similarity** — how aligned two vectors are, ∈ [-1, 1]
- **blend(a, b, α)** — `a·(1-α) + b·α`, then re-normalise to unit length
- **drift(v, personalityBias, noise)** — nudge `v` toward personality, add small gaussian noise

Keep dimension low (32) for Phase 1-3 speed. M4 uses real LLM embeddings (768+).

### 6.3 Gossip protocol (push-based epidemic)

Every `GOSSIP_INTERVAL_MS` (default 500ms):
1. Each agent picks `FANOUT` random peers (default 3).
2. Sends them its current `(id, version, latentState)`.
3. On receipt, a peer compares `version`; if newer than what it has stored for that id, it stores the new state and blends a small fraction (`BLEND_ALPHA`, default 0.05) into its own latent state.

**Anti-entropy pass** every `ANTI_ENTROPY_MS` (default 5s): each agent picks one random peer and exchanges a summary of all `(id, version)` pairs it holds; whichever side is missing or stale pulls the newer state. This guarantees eventual consistency even with message loss.

### 6.4 Coherence metric

A scalar ∈ [0, 1] indicating how aligned the swarm is.

```
coherence = mean(cos_sim(latentState_i, centroid)) for all agents i
centroid = normalize(mean(latentState_i))
```

Visualized in the HUD as a glowing meter; when it crosses a threshold (default 0.8), trigger a `CoherenceWave` effect.

### 6.5 Force-directed graph layout

Three forces run every frame:
- **Repulsion** between every pair of nodes (prevents clumping on one point).
- **Attraction** along currently-active gossip edges (recent gossip = taut line).
- **Alignment attraction** proportional to cosine similarity (similar latent → closer in 3D).

`d3-force-3d` provides these primitives; configure and run its tick in a Three.js animation loop.

---

## 7. Visual design direction

- **Palette:** background `#05070C` (near-black with a cool bias), node base `#E8EDF5`, accent blues `#4FC3F7` → `#6EA8FE`, coherence highlight `#A78BFA`, warning amber `#F5B358`. No pure white, no pure black.
- **Nodes:** ~4px screen-radius glowing spheres, instanced mesh for performance. Each node's hue slightly offset by its personality seed, so clusters become naturally coloured.
- **Edges:** thin additive-blended lines, opacity scaled by time-since-last-gossip (fade out over ~1.5s).
- **Edge pulse on gossip event:** a bright bead travels from sender → receiver in ~400ms, additive blended.
- **Coherence wave:** when `coherence` crosses threshold, dispatch a radial bloom pulse from the centroid outward; nodes emit a brief flash as the wave passes them.
- **Camera:** OrbitControls by default; "F" key toggles a 6DoF fly camera.
- **No UI chrome** on initial load except a tiny bottom-right HUD (coherence %, peer count, FPS). Everything else fades in on hover near the edges.

Typography: single system-ui stack. One monospace accent for numbers in HUD (`ui-monospace, Menlo, Consolas, monospace`).

---

## 8. Configuration constants (put all in `src/app/config.ts`)

```ts
export const CONFIG = {
  LATENT_DIM: 32,
  AGENT_COUNT_SINGLE_TAB: 150,
  GOSSIP_INTERVAL_MS: 500,
  FANOUT: 3,
  BLEND_ALPHA: 0.05,
  ANTI_ENTROPY_MS: 5000,
  DRIFT_NOISE: 0.02,
  COHERENCE_WAVE_THRESHOLD: 0.8,
  MAX_RENDER_NODES: 500,
  WEB_RTC_SIGNALING_HOST: "0.peerjs.com", // free tier; swap later
  WEB_RTC_SIGNALING_PORT: 443,
  WEB_RTC_SIGNALING_PATH: "/",
} as const;
```

All tuning happens here. Do not hardcode these elsewhere.

---

## 9. Milestone M1 — Single-tab swarm with faked latent states

**Goal:** A GitHub Pages URL you can open in one tab and see a pretty, converging 3D swarm. No real networking yet.

### M1 tasks (in order)

1. Scaffold the Vite + TypeScript project with the exact folder layout in §5.
2. Write `src/styles/global.css` with the palette variables from §7 and a CSS reset.
3. Write `src/core/LatentState.ts` with pure functions `random(dim)`, `blend(a, b, α)`, `cosineSim(a, b)`, `drift(v, bias, noise)`. All operate on `Float32Array`. 100% unit tested.
4. Write `src/core/Agent.ts` — class with `id: string`, `personality: Float32Array`, `latent: Float32Array`, `version: number`, `step()` method applying drift.
5. Write `scripts/bake-trajectories.ts` — a Node script that generates `public/embeddings/trajectories.bin`:
   - For `AGENT_COUNT_SINGLE_TAB` agents, generate `TICK_COUNT` (e.g. 10000) latent vectors, each one a small drift from the previous, biased toward one of ~6 cluster centroids. Write as raw Float32 little-endian: `[agent_idx (uint16)][tick (uint32)][vec_floats × LATENT_DIM]` repeated.
   - Add npm script: `"bake": "tsx scripts/bake-trajectories.ts"`.
6. Write `src/inference/InferenceEngine.ts` as an interface: `nextState(agent: Agent, tick: number): Float32Array`.
7. Write `src/inference/CachedTrajectory.ts` implementing that interface: fetches `trajectories.bin` once at startup, indexes by `[agent_idx, tick]`.
8. Write `src/network/PeerTransport.ts` as an interface: `send(toId, msg)`, `onMessage(cb)`, `peers(): string[]`.
9. Write `src/network/LocalTransport.ts` implementing it: in-memory routing between agents in the same tab, with configurable simulated latency (e.g. 20-80ms uniform) and 2% drop rate.
10. Write `src/network/GossipProtocol.ts` — ties agents to a transport, runs the push-gossip loop, blends received states into local latent as described in §6.3. Emits an event on every message sent and received (the viz subscribes).
11. Write `src/core/Swarm.ts` — owns the list of Agents, the GossipProtocol, the InferenceEngine. Exposes `tick()`, `getAgents()`, subscribes to gossip events.
12. Write `src/core/CoherenceMetric.ts` — pure function `coherence(agents): number`.
13. Write `src/viz/Scene.ts` — Three.js scene setup: perspective camera, ambient light, bloom post-process via `UnrealBloomPass`.
14. Write `src/viz/NodeMesh.ts` — one `InstancedMesh` for all agents; per-instance colour from personality; updates position from a force-layout tick.
15. Write `src/viz/EdgeLines.ts` — a single `LineSegments` with buffer geometry; edges added on gossip events, fade out over 1.5s.
16. Write `src/viz/EdgePulse.ts` — for each active gossip event, animate a small additive sprite from source to target.
17. Write `src/viz/CoherenceWave.ts` — on coherence threshold crossing, spawn an expanding sphere shell with additive material and fade out.
18. Write `src/viz/Controls.ts` — OrbitControls default, keybind "F" to toggle a trivial fly camera.
19. Hook force layout: use `d3-force-3d` with charge, link, and a custom alignment force driven by cosine sim.
20. Write `src/app/HUD.ts` — DOM overlay element with coherence %, peer count, FPS (use `stats.js` if small, else roll your own).
21. Write `src/app/main.ts` — boot the swarm, boot the scene, start the render loop, wire HUD.
22. Write `src/index.html` with a dark background and `<div id="hud">`, `<canvas id="three">`.

### M1 acceptance criteria

- `npm run dev` opens a page showing ~150 nodes moving smoothly at 60fps on mid-range hardware.
- Coherence starts near 0, climbs over ~30-60 seconds, and stabilises above 0.8.
- When coherence crosses 0.8, a visible wave effect plays.
- Edge pulses are visibly travelling on each gossip tick.
- `npm test` passes all unit tests for LatentState, CoherenceMetric, and GossipProtocol (test the protocol with LocalTransport and assert eventual consistency).
- Lighthouse performance score ≥ 85 on desktop.
- No forbidden words from §0 anywhere in UI or README.

---

## 10. Milestone M2 — Visual polish

**Goal:** Make it beautiful enough to post on X.

### M2 tasks

1. Add `UnrealBloomPass` with tuned strength/threshold/radius (start 0.8 / 0.2 / 0.4, iterate).
2. Replace flat node colour with a subtle fresnel shader so edges of each sphere glow.
3. Add exponential fog that hides distant nodes gracefully.
4. Make the camera slowly auto-orbit while idle; any user input cancels it.
5. Add a soft starfield background (one `Points` object, 2000 points).
6. Smooth out the coherence wave: ease-out cubic, 1.2s duration, trigger a brief hue shift on nearby nodes.
7. Add a one-line poetic caption fade-in after 3 seconds on the page (from a rotating list in `config.ts`). Example lines (all compliant with §0): "a small choir of 150 tiny minds", "watching agreement emerge, from nothing", "no server. just whispers." Must not violate §0.
8. Record a 20s screen capture; drop as `demo.mp4` in the repo root (add to .gitignore if large; link from README).

### M2 acceptance criteria

- Anyone who looks at it for 10 seconds wants to share it.
- Still runs ≥ 50fps on integrated graphics.
- No new npm dependencies beyond what M1 added (bloom and shaders come with three).

---

## 11. Milestone M3 — Real P2P across browsers

**Goal:** Multiple browsers find each other and gossip for real.

### M3 tasks

1. Add `simple-peer` and `peerjs` dependencies.
2. Write `src/network/RTCTransport.ts` implementing `PeerTransport`:
   - Use PeerJS to acquire a short random ID and join a global "choir" room (PeerJS doesn't have rooms natively — simulate by having a known rendezvous peer OR use a tiny DHT-like approach: on connect, each peer asks the broker for 5 recent IDs and dials them).
   - Pragmatic alternative: use `peerjs` with a shared known prefix and a small bootstrap list stored in `localStorage` + refreshed from a static JSON file served from GitHub Pages (e.g. `public/bootstrap-peers.json`, updated manually or via a GitHub Action).
   - On open data-channel: register with GossipProtocol as a peer.
   - Serialise latent vectors as compact binary (not JSON) to keep message size minimal (~128 bytes for a 32-dim vector).
3. Add a toggle in HUD: **Local sim / Live network**. Default to Local on first visit; remember preference in `localStorage`.
4. When Live is on:
   - Reduce local simulated agents to 1 (this browser's own node).
   - Spawn remote-peer agent placeholders as their states arrive via gossip.
   - Show real peer count and geographic roughness (optional: pull peer IP's rough region via a free service, but **only with explicit opt-in** — don't ship this if it adds friction).
5. Graceful degradation:
   - If signaling fails after 10s, fall back silently to Local mode with a small HUD note.
   - If NAT traversal fails for a specific peer, skip them.

### M3 acceptance criteria

- Open the GitHub Pages URL on 2 devices on different networks. Within 15 seconds they discover each other, you see cross-browser gossip edges, and both coherence meters converge together.
- Closing one browser causes the other's peer count to drop within 30s.
- No crash when signaling is down; the app falls back cleanly.

### M3 known traps

- **NAT traversal failure (~20% of users)** without a TURN server. Accept this. Have the app degrade to Local mode visibly when peers can't be reached, rather than showing errors.
- **PeerJS free tier rate limits.** If the project takes off, swap to a Cloudflare Worker running `peerjs-server`. Keep the transport interface stable so this is one file change.
- **GitHub Pages serves no custom headers.** Fine for M3. Becomes a problem for M4 (see §12).

---

## 12. Milestone M4 — Opt-in real LLM inference (OPTIONAL, ship M1-M3 first)

**Goal:** Users with capable hardware can enable real WebLLM inference. Each node runs a small LLM; latent states become real embeddings from that model.

### M4 tasks

1. Add `@mlc-ai/web-llm` as a **lazy** import. Do not include it in the main bundle.
2. Write `src/inference/WebLLMEngine.ts` implementing `InferenceEngine`:
   - Lazy-loads a small quantised model (start with **Phi-3-mini-4k-instruct-q4f16_1** or **TinyLlama-1.1B-Chat-v1.0-q4f16_1**).
   - On each `nextState(agent, tick)`, embeds a short prompt derived from the agent's personality + recent neighbour thoughts, extracts the last hidden state, projects to `LATENT_DIM` via a fixed random projection matrix (deterministic from a seed in `config.ts`).
3. Handle the SharedArrayBuffer requirement — WebLLM needs cross-origin isolation (`COOP: same-origin`, `COEP: require-corp`). GitHub Pages doesn't send these headers. Workaround: register a service worker that injects them. There is a known pattern using `coi-serviceworker` — use it.
4. Add a settings panel: **Advanced mode (requires WebGPU)**. Show a VRAM estimate; require explicit click to download the model (~500MB-2GB depending on choice). Cache in IndexedDB so subsequent visits are instant.
5. Fall back to CachedTrajectory engine if WebGPU is unavailable or download fails.

### M4 acceptance criteria

- With Advanced mode off, bundle size identical to M3.
- With Advanced mode on and model cached, a node produces real embeddings at ≥ 1 state/sec on a mid-range laptop GPU.
- Coherence dynamics *qualitatively differ* from the cached mode (real embeddings cluster around actual semantic topics the prompts bias toward).

---

## 13. Testing

- `test/latent.test.ts` — assert `cosineSim(v,v)===1`, `blend(a,b,0)===a`, normalisation preserves unit length, drift is bounded.
- `test/coherence.test.ts` — identical agents → coherence=1; uniformly random → coherence≈0.
- `test/gossip.test.ts` — spin up N agents on LocalTransport, run for simulated T seconds, assert `|version_max - version_min| < ε` (eventual consistency).

Vitest config: Node environment for core tests; jsdom for viz tests (keep viz tests minimal — one test that the scene builds without throwing).

---

## 14. GitHub Actions deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run bake   # regenerates trajectories.bin
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Configure `vite.config.ts` with `base: "/<repo-name>/"` so asset paths work on GitHub Pages.

---

## 15. `package.json` scripts (exact)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "bake": "tsx scripts/bake-trajectories.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint 'src/**/*.ts'"
  }
}
```

---

## 16. README.md requirements (what to write in the repo's README)

The README must:

- Start with a one-sentence honest description. Example: *"An interactive 3D metaphor for emergent coherence in a peer-to-peer swarm of software agents. Not a scientific claim."*
- Link to the live demo (GitHub Pages URL).
- One screenshot or short gif.
- 3-paragraph "How it works" section covering: agents + latent states, gossip protocol, coherence metric.
- **A visible "This is not a consciousness experiment" disclaimer section**, 2-3 lines, phrased plainly. Put it before any poetic language.
- Tech stack list.
- Local dev instructions: `npm install && npm run bake && npm run dev`.
- License (MIT).

**Do not** describe the project with any §0 forbidden word in the README.

---

## 17. Known traps (save yourself the debugging)

1. **Three.js `InstancedMesh` matrix updates are expensive if done naively.** Batch: update the matrix buffer once per frame, then set `instanceMatrix.needsUpdate = true`. Do not call `setMatrixAt` inside a tight loop with intermediate flag toggles.
2. **d3-force-3d expects node objects with `x,y,z` properties it will mutate.** Keep a parallel array of three.js matrices synced from these every frame.
3. **GitHub Pages caches aggressively.** Add a build-time hash to `trajectories.bin` filename or version it in the URL to avoid stale caches during iteration.
4. **PeerJS free signaling will rate-limit you if the project goes viral.** Have a Cloudflare Worker fallback ready. Keep `RTCTransport` the only file that knows the signaling endpoint.
5. **WebRTC in Safari** has a different ICE behaviour; test on Safari in M3 or skip Safari officially.
6. **Bundle size.** Target < 500 KB gzipped for M1-M3 main bundle. Three.js can balloon — import named modules (`import { Scene } from "three"`) rather than `import * as THREE`.
7. **SharedArrayBuffer headers** — do not attempt M4 without the service-worker header shim.

---

## 18. Pre-flight checks before committing any code

Per the operator's standing preferences, every piece of code you emit must pass:

1. **Simplicity first:** do not reach for a complex pattern when a plain function will do. No dependency injection frameworks. No decorators. No observables unless the viz truly needs them. Classes only where state and identity actually warrant them (Agent, Swarm, Scene, Transport implementations).
2. **Impact analysis:** before adding any dependency or any new abstraction, ask: what does this break downstream? Larger bundle? Harder tests? Mobile perf?
3. **Historical cross-check:** before using an approach, consider known failure modes. Example: naïve O(N²) force simulation dies past ~1000 nodes — cap `MAX_RENDER_NODES` and document it.
4. **SOLID, modular:** each file in §5 has one responsibility. Don't let `main.ts` know about d3-force internals; don't let `Agent.ts` import anything from `/viz`.

---

## 19. Delivery order (do not deviate)

1. Scaffold + `package.json` + `tsconfig.json` + `vite.config.ts` + `.gitignore` + `.eslintrc.cjs` + empty folders.
2. `config.ts`, `global.css`, `index.html`.
3. Core math + Agent + Swarm + tests.
4. LocalTransport + GossipProtocol + tests.
5. CachedTrajectory + the bake script.
6. Three.js Scene + NodeMesh + EdgeLines (static first, no movement).
7. Force layout integration.
8. Edge pulses + coherence wave + HUD.
9. Deployment workflow — ship M1 to GitHub Pages before starting M2.
10. M2 polish.
11. M3 — RTCTransport + toggle + fallback.
12. M4 (optional).

At each milestone end, commit, deploy, and stop. Verify the live URL before beginning the next milestone.

---

## 20. If you are unsure

Ask the operator (Geo) before:

- Adding any dependency not listed in §4.
- Introducing any state container (Redux, Zustand, stores).
- Changing the folder structure in §5.
- Adding any user-facing text that could violate §0.
- Enabling any analytics, telemetry, or third-party script.
- Splitting the project into multiple apps/packages.
- Changing the `.agent/` protocol in §A.

---

## 21. Reminder on `.agent/` protocol

The `.agent/` protocol in §A is not optional. It is the only mechanism by which work can safely resume across AI sessions. Every session must:

1. Read `.agent/HANDOFF.md` + `STATE.md` + recent `LOG.md` + `DECISIONS.md` before touching any code.
2. Update `STATE.md` and append `LOG.md` as work progresses.
3. Rewrite `HANDOFF.md` and commit `.agent/*` before ending the session.

If this is your first session and `.agent/` does not exist, create it from the templates in §A.6 as your very first action.

End of plan.
