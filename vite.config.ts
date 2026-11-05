import { defineConfig } from "vite";

// GitHub Pages serves this repo at /Choir/ — see §14 of IMPLEMENTATION_PLAN.
// Override with CHOIR_BASE env for custom deployments.
const base = process.env.CHOIR_BASE ?? "/Choir/";

export default defineConfig({
  base,
  root: "src",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022"
  },
  server: {
    port: 5173,
    host: true
  }
});
