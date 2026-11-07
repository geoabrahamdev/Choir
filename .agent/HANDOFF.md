# Handoff — Next Session Start Here

last_written: 2026-11-07T03:10:00Z
last_agent: claude

## Where we are
One-line tuning change on top of yesterday's visual-fix merge. The previous
four-fix patch (EdgePulse disc, EdgeLines quiet quadratic, wave threshold 0.78)
is already merged to `main` and live. M1 remains live at
https://geoabrahamdev.github.io/Choir/.

### What this session changed
- `src/app/config.ts` — `BLEND_ALPHA: 0.05 → 0.07`.
- `.agent/LOG.md` + `STATE.md` + this file updated.

Nothing else was touched: no viz file, no transport, no inference, no test. All
22 existing tests still pass.

## Rationale
With the wave threshold now at 0.78, the swarm needs to reach that band
reliably in 30–60 s. The old `BLEND_ALPHA=0.05` had the swarm plateauing near
0.75–0.78 on some seeds; nudging to 0.07 pulls received peer state in faster,
which should settle the equilibrium in the **76–80 %** band and make the wave
fire more consistently without destroying the per-agent personality drift.

## Rollback path if the swarm visually collapses
If BLEND_ALPHA=0.07 makes the swarm converge too aggressively (all nodes pile
onto one point, the clustering by personality disappears, or coherence pegs at
100 %), restore some per-agent drift headroom by bumping noise, not by
lowering the alpha again:

```
src/app/config.ts:  DRIFT_NOISE: 0.02 → 0.025
```

That restores the per-agent wobble that keeps the swarm visually alive while
keeping the faster gossip blend. Do NOT also revert BLEND_ALPHA in the same
step — change one knob at a time so you can see which one did what.

## Last successful action
`npx vitest run` → **22 / 22 pass**. (No build or `tsc --noEmit` run this
session — the only change is a numeric constant inside a typed `as const`
object, which can't introduce a type error.)

## What to do next (exact)

Geo pushes this manually, same pattern as the last patch:

```powershell
cd C:\Users\georg\Desktop\SideHustle\github\Choir

# Should show one modified file + the three .agent/* updates:
git status --short

# Stage ONLY what this session touched:
git add src/app/config.ts .agent/LOG.md .agent/STATE.md .agent/HANDOFF.md

git commit -m "tune: BLEND_ALPHA 0.05 -> 0.07 (target equilibrium 76-80%)"
git push origin main
```

The `on: push: branches: [main]` trigger in `.github/workflows/deploy.yml`
kicks off the Pages deploy — Geo controls when by choosing when to push.

Within ~1–2 min of the Action completing, observe the live preview:
- Coherence should climb into 76–80 % within 30–60 s.
- The purple wave should fire at least once within the first 2 min.
- The swarm should still look like a lively cluster, not a single pinpoint.

If any of those three fails: see "Rollback path" above.

## Blocked / unresolved
Unchanged since the last HANDOFF:
- `public/bootstrap-peers.json` still empty (DECISIONS #5).
- `demo.mp4` (§10.8) not captured.
- RTC/WebRTC + WebLLM paths still lack multi-browser / GPU verification.

## Environment state next session must know
- `.agent/` has 4 files; don't re-create.
- `node_modules` is a real directory in the mount with
  `@rollup/rollup-linux-x64-gnu` installed for Linux-VM builds.
- `public/embeddings/trajectories.bin` (9.58 MiB) unchanged — the baked
  trajectories are drift patterns, independent of `BLEND_ALPHA`, so no re-bake
  is needed.
- Visual verification was not done from the Linux VM (no WebGL surface); the
  76–80 % equilibrium is a predicted range, not a measured one.
