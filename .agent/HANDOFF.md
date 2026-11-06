# Handoff — Next Session Start Here

last_written: 2026-11-06T00:00:00Z
last_agent: codex

## Where we are
M2 visual polish and experimental M3/M4 paths are implemented locally. They are being released as a preview because the full M2–M4 acceptance criteria are not yet met. M1 remains live at https://geoabrahamdev.github.io/Choir/.

## Last successful action
`rm -rf dist && npx vite build` →
  main            143.46 KB gz
  RTCTransport     25.43 KB gz   (lazy)
  WebLLMEngine      1.14 KB gz   (lazy)
  @mlc-ai/web-llm 2174    KB gz  (lazy)
All 18 unit tests green. `npx tsc --noEmit` clean.

## What to do next (exact)

**Release sequence:**
1. Restore GitHub CLI authentication with `gh auth login` if it is still expired.
2. Push `codex/m2-m4-preview`, create a PR that lists the known acceptance gaps, and merge only after clean CI.
3. Wait for the GitHub Pages workflow and smoke-test the deployed URL.
4. Verify M2 visuals, confirm that Live mode reports its current waiting state without crashing, and only preflight Advanced mode unless a large model download is intentional.

**Do not mark M3 complete by manually copying a transient browser id.** Implement a stable discovery service or durable rendezvous peer, then test fresh browsers and disconnect cleanup.

**If something breaks on the next session:**
1. `ls node_modules` — if it's a symlink to scratch, remove it with `rm node_modules` and let `npm install` repopulate; if it's a real directory with 76-byte phantom entries, request delete permission and `rm -rf node_modules`.
2. `npm ci --no-audit --no-fund` (fast fresh install; respects package-lock.json).
3. `npm run bake` (regenerates trajectories.bin — unchanged by M2-M4; only needed if you delete `public/embeddings/trajectories.bin`).
4. `npm test && npm run build`.

## Blocked / unresolved
- bootstrap-peers.json is intentionally empty — first Live-mode visitor on the public URL has no one to dial. See `.agent/DECISIONS.md` #5.
- M2's demo.mp4 screen capture (§10.8) is left to Geo — needs a real browser.
- LiveSwarm teardown, peer removal, invalid latent rejection, bounded WebLLM scheduling, and active mesh count now have regression tests; signaling/NAT and fresh-browser discovery still need multi-browser tests.
- WebLLM's output-quality property (§12 acceptance "qualitatively different dynamics") needs a GPU to verify.

## Environment state next session must know
- `.agent/` has 4 files; don't re-create.
- `node_modules` is currently a real directory in the mount (not a symlink). It has all needed deps including peerjs, simple-peer, @mlc-ai/web-llm.
- `public/embeddings/trajectories.bin` exists (9.58 MiB).
- `public/coi-serviceworker.js` is vendored — leave it in place; it's harmless even if WebLLM is never enabled.
- `public/bootstrap-peers.json` exists but is empty — treat as intentional, not a bug.
- `dist/` is gitignored; delete freely.
