# Handoff — Next Session Start Here

last_written: 2026-11-07T03:35:00Z
last_agent: claude

## Where we are
README.md fully rewritten into a 420-line document that takes a reader from
zero context ("what am I looking at?") through the deep internals (the gossip
protocol maths, the transport + inference-engine interface split, the
rendering pipeline). Two Mermaid diagrams are included — GitHub renders them
natively in the README view.

Importantly, the new README **documents the coherence-ceiling misdiagnosis**
from the last two tuning sessions. Under "Known limitations" it states plainly
that raising `BLEND_ALPHA` does not lift the equilibrium — the ceiling is set
by `CLUSTER_COUNT` in the baked trajectories and by `Swarm.tick()` overwriting
the gossip-blended latent on every tick. Future readers (and future AI
sessions) will not repeat the mistake.

### What this session changed
- `README.md` — full rewrite, 420 lines, with two Mermaid diagrams.
- `.agent/LOG.md` + `STATE.md` + this file updated.

Nothing else touched. No code change. No test change. Not re-running `npx
vitest run` because this diff is documentation-only and cannot affect runtime
behaviour.

## Last successful action
`grep` scan for §0 forbidden words passes — only the required disclaimer
paragraph contains them.

## What to do next (exact)

Push and merge, same pattern as the last two patches. The commit is going
straight to `main` (no feature branch this time, since the previous commits
also went to `main`).

```powershell
cd C:\Users\georg\Desktop\SideHustle\github\Choir

# Should show README + the three .agent/* updates:
git status --short

git add README.md .agent/LOG.md .agent/STATE.md .agent/HANDOFF.md
git commit -m "docs: full README rewrite (beginner→advanced, Mermaid diagrams)"
git push origin main
```

That push fires the Pages deploy. The README is rendered on the GitHub repo
page immediately; the live site content itself does not change (the README is
not part of the Vite build).

## Blocked / unresolved
Unchanged since the previous handoff. The coherence-ceiling issue is now
documented but not fixed. Suggested fixes (NOT applied this session — docs
only):

1. `CLUSTER_COUNT: 6 → 2` in `src/app/config.ts`, then `npm run bake`.
2. Change `src/core/Swarm.ts` `tick()`:
   `a.setLatent(next)` → `a.setLatent(blend(a.latent, next, 0.3))`.

Either one meaningfully raises equilibrium coherence. (1) is lower risk, (2)
is more interesting. Do one at a time.

## Environment state next session must know
- `.agent/` has 4 files; don't re-create.
- `node_modules` is a real directory in the mount with
  `@rollup/rollup-linux-x64-gnu` installed for Linux-VM builds.
- `public/embeddings/trajectories.bin` (9.58 MiB) unchanged.
- No build run this session — documentation-only change.
