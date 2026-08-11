import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["**/e2e/**", "**/node_modules/**", "**/dist/**"],
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["packages/game-rules/src/**", "apps/worker-ping/src/**"],
    },
  },
});
