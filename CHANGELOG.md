# Changelog

All notable changes to Choir are documented in this file.

## [0.2.0] - 2026-11-06

### Added

- Preview M2 visual polish with a fresnel node shader, starfield, auto-orbit, tuned bloom, and eased coherence wave.
- Experimental Local/Live switching with PeerJS transport and remote swarm placeholders for M3 testing.
- Experimental, opt-in WebLLM loading with WebGPU checks, progress UI, and GitHub Pages cross-origin-isolation support.

### Changed

- Lazy-load the RTC and WebLLM paths so the default local experience keeps a small initial bundle.
- Document the current M2–M4 acceptance gaps, including the empty public peer bootstrap and unverified sustained WebLLM inference.

### Fixed

- Bound Advanced-mode inference to a deduplicated single-completion queue instead of launching work on every agent tick.
- Close Live-mode transports safely, ignore stale mode transitions, remove departed peers, and reject invalid or unbounded remote state.
- Hide inactive mesh instances after mode switches and render the starfield outside scene fog.

## [0.1.0] - 2026-11-05

### Added

- Interactive 3D single-tab swarm with 150 simulated software agents.
- Gossip-driven edges and travelling pulses, cached latent trajectories, force layout, coherence HUD, bloom, fog, and fly/orbit controls.
- Unit and integration coverage for latent math, coherence calculation, and local gossip behavior.
- GitHub Pages deployment workflow and local build, test, lint, and trajectory-bake commands.

### Fixed

- Regenerated the npm lockfile so clean `npm ci` installs and CI deployments succeed.
- Made the lint command work consistently on Windows and Unix shells.
