# Session Log

Append-only. Format: one block per session action. Newest at bottom.

---

## 2026-11-05T14:40:00Z — claude
Created initial `.agent/` structure with STATE, LOG, DECISIONS, HANDOFF templates.
Verified environment: node v22.23.4, npm 10.9.9, git 2.34.1.
Ready to begin M1.1.

## 2026-11-05T15:20:00Z — claude
Implemented M1 end-to-end: Vite+TS scaffold, LatentState + Agent + Swarm + CoherenceMetric,
LocalTransport + GossipProtocol (push + anti-entropy), CachedTrajectory + bake script,
Three.js scene with NodeMesh / EdgeLines / EdgePulse / CoherenceWave / Controls / ForceLayout,
HUD, main.ts, index.html.
Also: README with §0 disclaimer, MIT LICENSE, GitHub Pages workflow.
Local verification: 18/18 tests pass, tsc clean, vite build 140 KB gzipped, preview server
serves all assets 200 OK.
Reduced TICK_COUNT 10000→500 (DECISION 2) because 10000 would make trajectories.bin 192 MiB,
over GitHub Pages' 100 MB file cap and far over the perf-score target.
Added vitest.config.ts so tests at repo root are found despite vite.config `root: "src"`.
Added src/types/d3-force-3d.d.ts as there is no @types/d3-force-3d on npm.
Dev environment detail: npm install was slow on the mounted Windows FS and left a partial
@types/three on first attempt. Workaround: ran `npm install` in $HOME/scratch-choir and
symlinked node_modules during the session; removed the symlink before stopping so the user's
Windows view is clean. No commit, no push: those are the user's actions.

## 2026-11-05T16:24:48Z — codex
Started the initial public release at `geoabrahamdev/Choir`. Repaired the malformed npm
lockfile, made lint cross-platform, added the live Pages URL to README, and created the
0.1.0 changelog. Fresh verification: `npm ci`, `npm run bake`, 18/18 tests, build, and lint
all pass. Created an empty `main` base and prepared `feat/initial-m1` for the release PR.
