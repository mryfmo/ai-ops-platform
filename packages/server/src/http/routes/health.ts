/**
 * packages/server/src/http/routes/health.ts
 *
 * 根拠: ADR-0005（コンテナ監視）。/healthzはプロセス生存、/readyzはDB接続等の依存先も確認する。
 */
import type { Hono } from "hono";

export interface ReadinessCheck {
  /** DB接続等の依存先が応答可能かを返す。例外は「not ready」として扱う */
  isReady(): Promise<boolean>;
}

export function registerHealthRoutes(app: Hono, readiness: ReadinessCheck): void {
  app.get("/healthz", (c) => c.json({ ok: true }));

  app.get("/readyz", async (c) => {
    try {
      const ready = await readiness.isReady();
      return ready ? c.json({ ready: true }) : c.json({ ready: false }, 503);
    } catch {
      return c.json({ ready: false }, 503);
    }
  });
}
