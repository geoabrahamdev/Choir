# Choir

An interactive 3D metaphor for emergent coherence in a peer-to-peer swarm of software agents. **Not a scientific claim.**

→ [Live demo](https://geoabrahamdev.github.io/Choir/)

## This is not a consciousness experiment

Choir visualises what a toy gossip protocol *looks like* when 150 tiny software agents reach agreement on a shared vector state. It is an artistic metaphor and a technical demo — nothing more. It does not model, demonstrate, or prove consciousness, non-local effects, souls, telepathy, or any metaphysical claim. If the visuals feel evocative, that's the point; please don't read anything scientific into them.

## How it works

**Agents and latent states.** Each of 150 agents owns a 32-dimensional unit vector called its *latent state*. The vector drifts slightly on every tick, biased toward the agent's fixed personality seed, so each agent has its own tendency.

**Gossip protocol.** Every 500 ms each agent picks a few random peers and pushes them its current `(id, version, latent)`. A receiver that sees a newer version blends a tiny 5 % of the incoming vector into its own state, then forwards nothing (push-only, with a slow anti-entropy pass every 5 s to repair whatever was dropped). This is the push-based epidemic protocol from the gossip literature, nothing more.

**Coherence metric.** We compute the mean cosine similarity between every agent's latent and the swarm centroid, mapped to `[0, 1]`. When it crosses 0.8 a glowing wave pulses out from the centre of the cluster. Everything you see — colours, edges, pulses, the wave — is driven by these numbers.

## Tech stack

- TypeScript + Vite
- Three.js (WebGL, `UnrealBloomPass`)
- `d3-force-3d` for the force-directed layout
- Vitest for unit tests
- GitHub Actions + GitHub Pages for deployment

No React, no backend, no analytics, no accounts. The gossip simulation runs entirely in your tab.

## Local development

Prereqs: Node.js ≥ 20, a modern browser (Chrome / Edge / Firefox).

```bash
npm install
npm run bake        # one-off — generates public/embeddings/trajectories.bin
npm run dev         # http://localhost:5173
npm test            # unit tests
npm run build       # production bundle into dist/
```

To preview the production build locally:

```bash
npm run build
CHOIR_BASE=/ npm run preview
```

## Roadmap

- **M1** *(preview)*: single-tab swarm with cached latent trajectories and local gossip. The current build settles near 70% coherence in normal runs, below the planned 80% acceptance threshold.
- **M2** *(preview)*: fresnel node shader, starfield, auto-orbit, tuned bloom, and a 1.2 s ease-out coherence wave. The planned `demo.mp4` is not yet included, and the wave highlight changes brightness rather than hue.
- **M3** *(experimental)*: PeerJS transport, live-mode swarm, and a Local/Live HUD toggle are implemented. Transport cleanup and peer removal have unit coverage, but fresh visitors do not currently discover one another because the static bootstrap list is empty; cross-browser convergence remains unverified.
- **M4** *(experimental, opt-in)*: the Advanced panel can lazy-load WebLLM on supported WebGPU browsers through a bounded, single-completion queue. Sustained inference throughput and the planned semantic/personality dynamics have not yet passed acceptance testing.

This release exposes the M2–M4 preview paths for testing; it does not claim those milestones are acceptance-complete.

## Live P2P — how it finds peers

Choir uses the public PeerJS broker for signaling and a tiny bootstrap list to discover peers. On each boot the client:

1. Registers a random id `choir-<8 hex>` with the PeerJS broker.
2. Fetches `public/bootstrap-peers.json` (plus any peer ids remembered in `localStorage` from previous visits). The checked-in bootstrap list is currently empty.
3. Dials up to 12 of them; whoever answers becomes a peer and goes into the gossip mesh.
4. If signaling isn't reachable within 10 s, the app falls back to Local with a small HUD note.

This is experimental scaffolding, not working public discovery yet: two fresh browsers stay isolated until at least one reachable peer id is seeded. It also relies on PeerJS's free signaling tier and may be rate-limited. See §11 of `docs/IMPLEMENTATION_PLAN.md` for the Cloudflare Worker + `peerjs-server` fallback plan.


## License

MIT. See [LICENSE](./LICENSE).
