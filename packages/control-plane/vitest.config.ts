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
      // replayProbe は workflow sandbox（webpack bundle）内でのみ実行され、
      // V8 coverage に計上されない。行使は tests/replay.test.ts の replay が保証する。
      exclude: ["src/workflows/replayProbe.ts"],
      thresholds: {
        lines: 85,
        statements: 82,
        functions: 83,
        branches: 74,
      },
    },
  },
});
