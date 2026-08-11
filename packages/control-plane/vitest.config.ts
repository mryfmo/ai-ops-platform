// 根拠: FinalArch:CON-001 / ADR-0020
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 85,
        statements: 82,
        functions: 83,
        branches: 74,
      },
    },
  },
});
