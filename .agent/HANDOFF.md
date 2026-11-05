# Handoff — Next Session Start Here

last_written: 2026-11-05T16:44:51Z
last_agent: codex

## Where we are
The M1 preview is public at `https://geoabrahamdev.github.io/Choir/` from
`main` in `https://github.com/geoabrahamdev/Choir`.

## Last successful action
Merged PR #1, completed GitHub Pages run `42066902475`, and production-tested the
live page: all assets returned 200, 150 peers rendered at ~131 FPS, and Lighthouse
scored 85 performance / 100 accessibility / 100 best practices.

## What to do next (exact)
1. Fix `Swarm.tick()` so baked trajectory updates do not overwrite accumulated gossip consensus.
2. Replace the full-store anti-entropy burst with digest/diff or batched exchange.
3. Add convergence, trajectory-loader failure, and deployed-browser smoke tests.
4. Add interaction instructions and a reduced-motion path.

## Blocked / unresolved
- Nothing blocks the deployed preview.
- Known product gap: coherence plateaus around 71–72% instead of remaining above the 80%
  wave threshold. The preview is live, but full M1 acceptance remains follow-up work.

## Environment state next session must know
- `.agent/` is fully populated. Do NOT re-create it.
- Local runtime currently uses Node v22.23.4 + npm 10.9.9; the deploy workflow uses Node 20.
- `public/embeddings/trajectories.bin` exists (9.58 MiB).
- `node_modules/` is present locally from a successful clean `npm ci` and is gitignored.
- `dist/` is not committed; `.gitignore` excludes it.
- GitHub repository: `https://github.com/geoabrahamdev/Choir`.
- Live site: `https://geoabrahamdev.github.io/Choir/`.
