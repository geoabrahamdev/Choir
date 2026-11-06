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

### 2. TICK_COUNT reduced from 10000 to 500 — 2026-11-05 — claude
**Context:** §9.M1.5 says "TICK_COUNT (e.g. 10000)" — at 150 agents × 10000 ticks × 32 float32 dims + record headers, trajectories.bin = ~192 MiB. GitHub Pages file-size limit is 100 MB per file and warns above 50 MB; downloading 192 MB on first page-load kills the Lighthouse ≥85 target in §9 acceptance.
**Decision:** TICK_COUNT=500 (CONFIG.TICK_COUNT). CachedTrajectory wraps `tick mod TICK_COUNT`, so the swarm can still run indefinitely. File size ≈ 9.65 MiB uncompressed, well under Pages caps, and gzip typically halves it.
**Alternatives considered:** keep 10000 and host on an external CDN (adds infra); drop to float16 (halves size but doubles loader complexity); reduce to 200 (less headroom, more noticeable wrap).
**Consequences:** All agents share a looping drift pattern of ~250 s (500 × GOSSIP_INTERVAL_MS). The visual metaphor is unaffected — convergence still happens in ≤60 s. Noted "e.g." in spec means 10000 was illustrative, not binding.

### 3. Vitest config file separate from Vite config — 2026-11-05 — claude
**Context:** vite.config.ts sets `root: "src"` so index.html is beside the TS modules. Vitest inherits that and then discovers no tests under src/ — ours live under test/ at repo root.
**Decision:** Add vitest.config.ts with `include: ["test/**/*.test.ts"]` and `environment: "node"`. It takes precedence over vite.config.ts for test discovery.
**Alternatives considered:** Move tests under src/__tests__ (uglier); mirror vite config's root (would hide the test dir).
**Consequences:** Tests and runtime config stay decoupled. `npm test` just works.

### 4. Local d3-force-3d types shim — 2026-11-05 — claude
**Context:** d3-force-3d has no @types/d3-force-3d on npm; strict TS otherwise flags implicit any.
**Decision:** Hand-write a minimal ambient module declaration at src/types/d3-force-3d.d.ts covering only the surface used by ForceLayout: forceSimulation, forceManyBody, forceCenter, Simulation.alpha/alphaDecay/velocityDecay/force/tick/stop, and SimulationNode.
**Alternatives considered:** `declare module 'd3-force-3d';` (untyped `any`); fork the upstream types.
**Consequences:** Type-check stays strict. If we start using more of d3-force-3d (e.g. link force, collide force — already stubbed), just extend this file.

### 5. Bootstrap list over rendezvous peer — 2026-11-05 — claude
**Context:** §11 offers two signaling strategies: a known rendezvous peer that acts as a tiny directory, or a static bootstrap-peers.json served from GitHub Pages plus localStorage caching.
**Decision:** Chose the bootstrap-peers.json + localStorage approach. The file lives at public/bootstrap-peers.json and starts empty.
**Alternatives considered:** A hardcoded rendezvous peer would centralise discovery on whichever tab is running at that id — brittle, and a single point of failure for a project whose point is being decentralised. A Cloudflare Worker running peerjs-server is the right production fix; deferred until PeerJS rate-limits bite.
**Consequences:** Cold start on a quiet URL discovers nobody. Fix: once a stable instance exists, add its id to bootstrap-peers.json. localStorage then carries forward across visits. RTCTransport is the only file that knows the signaling endpoint — swap is a one-file change.

### 6. Lazy-load RTCTransport and WebLLMEngine — 2026-11-05 — claude
**Context:** PeerJS pulls ~25 KB gz; @mlc-ai/web-llm is 2 MB gz + a 500 MB-2 GB model download. Local-mode users and non-Advanced users shouldn't pay those costs.
**Decision:** Both are imported via dynamic `import()` only when the user flips the HUD toggle / clicks "advanced → on". Main bundle stays at 143 KB gz regardless.
**Alternatives considered:** Eager import with tree-shaking (wouldn't help; Peer is a side-effectful module); split via manualChunks (equivalent but more config).
**Consequences:** First Live-mode click costs an extra ~25 KB network round-trip. First Advanced-mode click costs ~500 MB model download — explicitly disclosed in the Advanced panel before confirming.

### 7. @mlc-ai/web-llm in optionalDependencies — 2026-11-05 — claude
**Context:** M4 is explicitly optional per §12. Users who clone Choir shouldn't have a 14 MB install dependency they can't use if they don't have WebGPU.
**Decision:** Put @mlc-ai/web-llm in optionalDependencies and have WebLLMEngine's dynamic import catch "module not found" and throw a friendly error that the Advanced panel surfaces to the user.
**Alternatives considered:** Regular dependency (forces install cost on everyone); peerDependency (cleaner npm semantics but worse UX — npm install succeeds silently with an uninstalled peer).
**Consequences:** `npm ci` by default WILL install @mlc-ai/web-llm (optionalDependencies are installed unless they fail to build). Setting `npm ci --omit=optional` skips it. CI could use that to keep the deploy slim if Advanced-mode functionality isn't exercised on the deployed URL.
