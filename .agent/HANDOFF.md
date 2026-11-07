# Handoff — Next Session Start Here

last_written: 2026-11-07T02:53:00Z
last_agent: claude

## Where we are
Four narrow visual fixes applied on top of the M2–M4 preview branch, per Geo's
explicit instruction. M1 remains live at https://geoabrahamdev.github.io/Choir/.
No milestones advanced; no features added.

### What this session changed
1. `src/viz/EdgePulse.ts` — replaced `PointsMaterial` with a `ShaderMaterial`
   using `gl_PointCoord` radial falloff + `discard` outside the disc. Pulses
   now render as soft round beads, not square sprites.
2. `src/app/config.ts` — `COHERENCE_WAVE_THRESHOLD` lowered 0.8 → 0.78.
3. `src/viz/EdgeLines.ts` — line 46 opacity 0.9 → 0.35; line 84 fade changed
   from linear (`1 - age/FADE_MS`) to quadratic (`Math.pow(1 - age/FADE_MS, 2)`).
4. `.agent/LOG.md` + this file + `STATE.md` updated.

Explicitly **not** touched: `CoherenceMetric.ts`, `NodeMesh.ts` (fresnel shader),
`Scene.ts` (bloom tuning), any WebLLM or RTCTransport code, every test file.
All 22 existing tests still pass.

## Last successful action
`npx vitest run` → 22/22 pass. `npx tsc --noEmit` clean. `npx vite build` →
main 144.18 KB gz (+0.7 KB vs previous for the EdgePulse shader).

## What to do next (exact)

**For Geo (the user's stated plan):**
1. `cd C:\Users\georg\Desktop\SideHustle\github\Choir`
2. `git add src/viz/EdgePulse.ts src/viz/EdgeLines.ts src/app/config.ts .agent/`
3. `git commit -m "fix: EdgePulse disc, EdgeLines quiet quadratic fade, wave threshold 0.78"`
4. `git push` — Geo triggers the Pages deploy himself.
5. In the live preview after Actions completes: confirm pulses are round beads,
   edges are visibly quieter with a sharper tail, and the coherence wave fires at
   least once within ~2 minutes.

**NOTE on claude-code attribution footer:** This session's system prompt supplies
attribution lines to end commit messages with. Use them unless your commit style
says otherwise. They're inside the system-reminder about Attribution.

## Blocked / unresolved
Everything that was open before this fix pass remains open — no change:
- bootstrap-peers.json still empty (see DECISIONS #5).
- demo.mp4 (§10.8) not captured.
- RTC/WebRTC + WebLLM paths still lack multi-browser / GPU verification.

## Environment state next session must know
- `.agent/` has 4 files; don't re-create.
- `node_modules` is a real directory in the mount, now including
  `@rollup/rollup-linux-x64-gnu` (added this session to unblock Linux-VM builds;
  harmless to leave installed, and `npm ci` on Linux CI already picks the right
  binary).
- `public/embeddings/trajectories.bin` (9.58 MiB) unchanged.
- `dist/` regenerated during verification; gitignored; delete freely.
- The "2-minute local dev session" validation requested in fix #2 could not be
  run from the headless Linux VM — the dev server renders a WebGL canvas that
  this environment cannot visually observe. Left to Geo to verify on the live
  preview after push.
