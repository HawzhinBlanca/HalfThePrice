import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/verification.ts", "src/cap-estimator.ts"],
      thresholds: {
        statements: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
