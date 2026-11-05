# Handoff — Next Session Start Here

last_written: 2026-11-05T16:24:48Z
last_agent: codex

## Where we are
M1 is implemented locally and is being published through the initial release PR from
`feat/initial-m1` into `main` at `https://github.com/geoabrahamdev/Choir`.

## Last successful action
Repaired the lockfile and passed fresh release checks: clean `npm ci`, trajectory bake,
18/18 tests, TypeScript/Vite build, and ESLint.

## What to do next (exact)
1. Commit and push `feat/initial-m1`.
2. Create and merge the release PR into `main` after CI passes.
3. Enable GitHub Pages with the Actions workflow and wait for deployment.
4. Test `https://geoabrahamdev.github.io/Choir/` in a real browser, including console,
   visible gossip pulses, coherence behavior, and load performance.

## Blocked / unresolved
- Nothing blocks the release workflow.
- Known product gap from audit: coherence plateaus around 72% instead of crossing the 80%
  wave threshold. Publish the current snapshot as requested, then address this in M1 follow-up.

## Environment state next session must know
- `.agent/` is fully populated. Do NOT re-create it.
- Local runtime currently uses Node v24 + npm 11; the deploy workflow uses Node 20.
- `public/embeddings/trajectories.bin` exists (9.58 MiB).
- `node_modules/` is present locally from a successful clean `npm ci` and is gitignored.
- `dist/` is not committed; `.gitignore` excludes it.
- GitHub repository: `https://github.com/geoabrahamdev/Choir`.
