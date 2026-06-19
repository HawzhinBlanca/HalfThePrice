import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
    // Money-path races must not be interleaved across files sharing rows.
    fileParallelism: false,
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/services/order.ts"],
      // Ratchet floor: the money path is currently proven at ~95% stmts.
      // CI fails if a change drops exactly-once coverage below this.
      thresholds: {
        statements: 90,
        functions: 100,
        lines: 90,
      },
    },
  },
});
