# Project State

last_updated: 2026-11-06T00:00:00Z
last_agent: codex
current_milestone: M2-M4 preview release
current_task: release_candidate
status: in_progress

## Implemented preview paths
- M1 — single-tab swarm (shipped and live at https://geoabrahamdev.github.io/Choir/)
- M2 — visual polish code: fresnel shader, starfield, auto-orbit, bloom tune, and 1.2 s ease-out wave
- M3 — experimental P2P code: RTCTransport, LiveSwarm, Local/Live toggle, and signaling fallback
- M4 — experimental WebLLM code: lazy engine, Advanced panel, cross-origin-isolation service worker, and WebGPU preflight

## Pending acceptance work
- Add the planned M2 `demo.mp4` and implement a real hue shift for wave-near nodes.
- Provide working public peer discovery and add multi-browser M3 convergence tests.
- Add personality/recent-neighbour prompt context, a VRAM estimate, and M4 throughput/semantic tests.
- Recheck M1's stable 80% coherence target.

## Release status
- The current branch is suitable for a public preview, not a completed M2–M4 milestone claim.
- The release PR must disclose the remaining acceptance gaps and low M2–M4 automated coverage.

## Known gaps / tech-debt
- M2.8 asks for a demo.mp4 screen-capture in the repo root — that needs a real browser session with recording; impossible from the headless VM. Left to Geo.
- Direct two-browser testing leaves both Live-mode pages at one peer because the bootstrap list is empty.
- Remote placeholders are removed on transport departure, Live teardown closes RTC, and mode transitions use an epoch guard; multi-browser behavior remains to be proven.
- WebLLM inference now uses a bounded, deduplicated, single-completion queue; sustained real-model throughput remains unverified.
- WebLLM derives vectors from token log probabilities rather than hidden-state embeddings and does not yet include personality or recent neighbour thoughts in prompts.
- The static bootstrap-peers.json is empty — the first peer to bring up Live mode on the live URL will have no one to dial. Fix: add a GitHub Action (or a manual commit) that writes a known-stable peer id into the file after first successful connection, or set up a Cloudflare Worker as a long-lived bootstrap.
- Main bundle grew from 139.77 KB (M1) → 143.46 KB (M4) gzipped. §12 says "With Advanced mode off, bundle size identical to M3" — M3 was 142.66 KB; M4 is +0.8 KB for the AdvancedPanel UI. Within acceptable overhead for the opt-in UI shell.

## Environment state
- node v22.23.4, npm 10.9.9
- deps installed in the mount's node_modules; CI uses `npm ci`
- trajectories baked at public/embeddings/trajectories.bin (9.58 MiB)
- All 22 unit tests pass
- `npx tsc --noEmit` clean
- `npx vite build` succeeds; chunks: main 143 KB gz, RTCTransport 25 KB gz (lazy), WebLLM wrapper 1 KB gz (lazy) + @mlc-ai/web-llm 2174 KB gz (lazy, only downloaded if user opts in)
