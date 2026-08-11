import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/e2e/**/*.test.ts"],
    testTimeout: 30000,
  },
});
