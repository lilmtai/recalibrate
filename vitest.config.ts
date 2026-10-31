import { defineConfig } from "vitest/config";

// Unit tests for the pure planning logic in src/lib (no browser needed).
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
