# Changelog

All notable changes to Choir are documented in this file.

## [0.1.0] - 2026-11-05

### Added

- Interactive 3D single-tab swarm with 150 simulated software agents.
- Gossip-driven edges and travelling pulses, cached latent trajectories, force layout, coherence HUD, bloom, fog, and fly/orbit controls.
- Unit and integration coverage for latent math, coherence calculation, and local gossip behavior.
- GitHub Pages deployment workflow and local build, test, lint, and trajectory-bake commands.

### Fixed

- Regenerated the npm lockfile so clean `npm ci` installs and CI deployments succeed.
- Made the lint command work consistently on Windows and Unix shells.
