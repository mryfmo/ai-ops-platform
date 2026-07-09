/**
 * packages/web/vitest.config.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）
 * UIキットのユニットテスト設定。React Testing Library は使わず、
 * コンポーネント関数の戻り値（React要素のprops）を直接検証する軽量方式のため
 * environment は node のままとする。jsx: "automatic" は Next.js の
 * JSXトランスフォーム（React import不要）と揃えるための設定。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
