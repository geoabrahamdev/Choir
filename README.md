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

- **M1** *(this preview)*: single-tab swarm with pre-baked latent states, local gossip, and the 3D visualization. The current build reaches roughly 72% steady-state coherence in normal runs, so the intended 80% wave threshold remains follow-up work.
- **M2**: visual polish — fresnel glow, starfield, auto-orbit, bloom tune.
- **M3**: real peer-to-peer over WebRTC — open the demo on two devices and watch them actually find each other.
- **M4** *(optional)*: opt-in real LLM inference in the browser via WebLLM.

## License

MIT. See [LICENSE](./LICENSE).
