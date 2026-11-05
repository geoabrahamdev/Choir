# Project State

last_updated: 2026-11-05T16:24:48Z
last_agent: codex
current_milestone: M1
current_task: publish M1 through GitHub PR and deploy to Pages
status: in_progress

## Completed tasks (this milestone)
- M1.1 Scaffolded Vite + TS project (hand-written: package.json, tsconfig.json, vite.config.ts, .eslintrc.cjs, .gitignore). Also added vitest.config.ts because tests live at repo root while vite.config has `root: "src"`.
- M1.2 global.css with palette variables + reset + HUD + caption styles (§7).
- M1.3 LatentState.ts with random/normalise/blend/drift/cosineSim/centroid/clone + 11 unit tests.
- M1.4 Agent.ts with id, personality, latent, version, step(), absorb(), setLatent().
- M1.5 scripts/bake-trajectories.ts — generates public/embeddings/trajectories.bin at 9.58 MiB (see DECISION 2).
- M1.6 InferenceEngine.ts interface.
- M1.7 CachedTrajectory.ts — fetches trajectories.bin, binds agents to baked slots, wraps modulo tick_count.
- M1.8 PeerTransport.ts interface.
- M1.9 LocalTransport.ts with LocalRouter + configurable latency & drop rate.
- M1.10 GossipProtocol.ts — push-based + anti-entropy, emits send/recv events, 3 integration tests.
- M1.11 Swarm.ts — owns agents + gossips + inference binding.
- M1.12 CoherenceMetric.ts — coherence(agents) → [0,1], 4 tests.
- M1.13 Scene.ts — WebGLRenderer + PerspectiveCamera + UnrealBloomPass + FogExp2.
- M1.14 NodeMesh.ts — InstancedMesh with per-instance HSL colouring from personality.
- M1.15 EdgeLines.ts — LineSegments with per-vertex colours; linear fade over 1.5s.
- M1.16 EdgePulse.ts — Points with bell-curve brightness travelling source → target over 400 ms.
- M1.17 CoherenceWave.ts — ease-out cubic sphere expansion from centroid.
- M1.18 Controls.ts — OrbitControls default + F-key fly camera (WASD + QE + pointer lock).
- M1.19 ForceLayout.ts — d3-force-3d with charge + custom alignment force (O(N·K) neighbour sampling).
- M1.20 HUD.ts — coherence, peer count, FPS; rotating captions from CONFIG.CAPTIONS.
- M1.21 main.ts — wires everything; drift tick every 120 ms, render loop with coherence + wave trigger.
- M1.22 index.html — canvas + HUD + caption, dark theme.
- Deployment workflow (.github/workflows/deploy.yml) + README.md with mandatory §0 disclaimer + MIT LICENSE.
- Local types shim for d3-force-3d (no @types/d3-force-3d published).
- M1 RELEASE TOOLING VERIFIED LOCALLY:
    * `npx vitest run` → 18/18 tests pass.
    * `npx tsc --noEmit` → clean.
    * `npx vite build` → 538 KB raw / 139.77 KB gzipped (target <500 KB gzipped; §17 trap #6 passes).
    * `npx vite preview` → serves index.html 200 OK and trajectories.bin 200 OK at ~10 MB.
    * No forbidden §0 words in src/ UI; README mentions them only in the mandated "This is not a consciousness experiment" disclaimer per §16.
- M1 ACCEPTANCE GAPS:
    * Normal browser runs begin around 59% coherence and settle around 72%, below the intended 80% threshold.
    * The coherence wave implementation exists, but normal runs do not reliably reach its trigger.
    * Best measured local Lighthouse performance score is 83, below the plan target of 85.

## Pending tasks (this milestone)
- Push the M1 implementation through a feature PR and merge it to `main`.
- Enable GitHub Pages, wait for the deploy workflow, and verify the live URL.

## Blockers
- (none)

## Environment state
- node_installed: true (v22.23.4)
- npm_installed: true (10.9.9)
- deps_installed: true (`npm ci` succeeds from the regenerated lockfile)
- trajectories_baked: true (public/embeddings/trajectories.bin, 10 050 016 bytes)
- tests_passing: true (18/18; build and lint also pass)
- deployed_to_pages: false
- live_url: null
