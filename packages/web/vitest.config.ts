/**
 * packages/web/vitest.config.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）
 * UIキットのユニットテスト設定。React Testing Library は使わず、
 * コンポーネント関数の戻り値（React要素のprops）を直接検証する軽量方式のため
 * environment は node のままとする。oxc.jsx.runtime: "automatic" は Next.js の
 * JSXトランスフォーム（React import不要）と揃えるための設定。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // 回帰検知用の下限。現状値から 5pt の余裕を取った値であり、目標値ではない。
      thresholds: {
        lines: 82,
        statements: 79,
        functions: 79,
        branches: 68,
      },
    },
  },
});
