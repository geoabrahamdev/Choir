/**
 * All tunable constants for Choir live here. §8 of IMPLEMENTATION_PLAN.
 * Do not hardcode any of these elsewhere.
 */
export const CONFIG = {
  LATENT_DIM: 32,
  AGENT_COUNT_SINGLE_TAB: 150,
  GOSSIP_INTERVAL_MS: 500,
  FANOUT: 3,
  BLEND_ALPHA: 0.05,
  ANTI_ENTROPY_MS: 5000,
  DRIFT_NOISE: 0.02,
  COHERENCE_WAVE_THRESHOLD: 0.78,
  MAX_RENDER_NODES: 500,
  WEB_RTC_SIGNALING_HOST: "0.peerjs.com",
  WEB_RTC_SIGNALING_PORT: 443,
  WEB_RTC_SIGNALING_PATH: "/",
  /** Baked trajectory file path, served from public/ at base URL. */
  TRAJECTORIES_URL: "embeddings/trajectories.bin",
  /** Number of ticks encoded in trajectories.bin — must match bake script. */
  TICK_COUNT: 500,
  /** Number of cluster centroids the bake script uses. */
  CLUSTER_COUNT: 6,
  /** Local simulated transport: latency uniform [min, max] ms. */
  LOCAL_LATENCY_MIN_MS: 20,
  LOCAL_LATENCY_MAX_MS: 80,
  /** Local simulated transport: message drop rate [0,1]. */
  LOCAL_DROP_RATE: 0.02,
  /** Poetic captions — all must respect §0 forbidden-words rule. */
  CAPTIONS: [
    "a small choir of 150 tiny minds",
    "watching agreement emerge, from nothing",
    "no server. just whispers.",
    "what if agreement looked like this?",
    "a toy model of a distributed swarm"
  ] as const,
  /** Palette, mirrored from CSS variables in global.css §7. */
  COLOURS: {
    BG: 0x05070c,
    NODE_BASE: 0xe8edf5,
    ACCENT_1: 0x4fc3f7,
    ACCENT_2: 0x6ea8fe,
    COHERENCE: 0xa78bfa,
    WARNING: 0xf5b358
  }
} as const;

export type Config = typeof CONFIG;
