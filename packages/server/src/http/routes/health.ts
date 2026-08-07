/**
 * packages/server/src/http/routes/health.ts
 *
 * 根拠: ADR-0005（コンテナ監視）。/healthzはプロセス生存、/readyzはDB接続等の依存先も確認する。
 */
import type { Hono } from "hono";

export interface ReadinessCheck {
  /** DB接続等の依存先が応答可能かを返す。例外は「not ready」として扱う */
  isReady(): Promise<boolean>;
  /**
   * 無効化されている任意機能の一覧（所見 ADV-INT-052 / ADV-INT-007）。
   *
   * 縮退があっても ready は落とさない。readiness probe を落とすと、意図的に機能を
   * 無効化した構成が起動できなくなるためである。可観測にすることが目的であり、
   * 判断は監視側の閾値に委ねる。
   */
  degradedCapabilities?(): string[];
}

export function createReadinessCheck(deps: {
  checkDependencies(): Promise<void>;
  isFailsafeActive(): boolean;
  isShuttingDown(): boolean;
  degradedCapabilities?(): string[];
}): ReadinessCheck {
  return {
    async isReady(): Promise<boolean> {
      if (deps.isShuttingDown() || deps.isFailsafeActive()) return false;
      await deps.checkDependencies();
      return true;
    },
    degradedCapabilities: deps.degradedCapabilities,
  };
}

export function registerHealthRoutes(app: Hono, readiness: ReadinessCheck): void {
  app.get("/healthz", (c) => c.json({ ok: true }));

  app.get("/readyz", async (c) => {
    // 依存確認が失敗しても、直前まで観測できていた縮退情報はレスポンスへ残す。
    let degraded: string[] = [];
    try {
      degraded = readiness.degradedCapabilities?.() ?? [];
      const ready = await readiness.isReady();
      degraded = readiness.degradedCapabilities?.() ?? [];
      // 縮退の一覧を本文へ載せる。従来は必須 env だけの最小構成——Teams コマンド・ingest・
      // 配信・snapshot が全部無効——でも 200 だけが返り、運用からは健全に見えていた。
      return ready ? c.json({ ready: true, degraded }) : c.json({ ready: false, degraded }, 503);
    } catch {
      return c.json({ ready: false, degraded }, 503);
    }
  });
}
