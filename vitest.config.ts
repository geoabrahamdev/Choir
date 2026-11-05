import { defineConfig } from "vitest/config";

// Tests live at repo root, not inside Vite's `root: "src"`.
// This config is picked up ahead of vite.config.ts by vitest.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 10000
  }
});
