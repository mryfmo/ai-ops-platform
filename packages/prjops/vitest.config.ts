import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      // 回帰検知用の下限。現状値から 5pt の余裕を取った値であり、目標値ではない。
      thresholds: {
        lines: 90,
        statements: 89,
        functions: 92,
        branches: 80,
      },
    },
  },
});
