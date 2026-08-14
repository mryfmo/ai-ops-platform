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
      // 以下は workflow sandbox（webpack bundle）内でのみ実行され、V8 coverage に
      // 計上されない。行使は tests/replay.test.ts・tests/approvalReplay.test.ts・
      // tests/jitHealthReplay.test.ts の
      // recorded-history replay が保証する（純粋判定は lib/ 側で直接テスト済み）。
      exclude: [
        "src/workflows/replayProbe.ts",
        "src/workflows/approval.ts",
        "src/workflows/codingTask.ts",
        "src/workflows/jitHealth.ts",
        "src/workflows/entry.ts",
      ],
      thresholds: {
        lines: 85,
        statements: 82,
        functions: 83,
        branches: 74,
      },
    },
  },
});
