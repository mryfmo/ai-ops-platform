/**
 * packages/server/src/http/app.ts
 *
 * 根拠: ADR-0005（常駐サーバの公開HTTP面）/ ADR-0006（コーディングタスク確認・callback面）
 *   - GET  /healthz, /readyz: コンテナ監視用
 *   - POST /webhooks/graph:   Graph change notification受信（clientState検証）
 *   - POST /webhooks/github:  GitHub webhook受信（署名検証）
 *   - /coding-tasks/:taskId/confirm (GET/POST): コーディングタスク確認・実行（人間の明示クリック必須）
 *   - POST /internal/coding-tasks/:taskId/callback: GitHub Actions（coding-task.yml）からの完了通知
 *   - /app/*:                 Next.js WebUIへのリバースプロキシ
 *
 * 設計: buildApp(deps) は副作用なしにHonoインスタンスを返す純粋ファクトリ。
 *   テストは app.request() でポートを開かずに全経路を検証する。
 */
import { Hono } from "hono";
import type { AuditLogWriter } from "@aiops/shared";
import { registerHealthRoutes, type ReadinessCheck } from "./routes/health.js";
import { registerGraphNotificationRoutes, type GraphNotificationDeps } from "./routes/graphNotifications.js";
import { registerGithubWebhookRoutes, type GithubWebhookDeps } from "./routes/githubWebhook.js";
import { registerCodingTaskRoutes, type CodingTaskRoutesDeps } from "./routes/codingTasks.js";
import { registerWebuiProxy, type WebuiProxyDeps } from "./routes/webuiProxy.js";
import { registerXlsxImportRoutes, type XlsxImportRoutesDeps } from "./routes/xlsxImport.js";
import { registerReportIngestRoutes, type ReportIngestDeps } from "./routes/reportIngest.js";
import { MetricsRegistry } from "../observability/metrics.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { verifyBearerToken } from "../lib/confirmToken.js";

export interface AppDependencies {
  auditLog: AuditLogWriter;
  readiness: ReadinessCheck;
  graph: GraphNotificationDeps;
  github: GithubWebhookDeps;
  codingTasks: CodingTaskRoutesDeps;
  xlsxImport: XlsxImportRoutesDeps;
  metrics?: MetricsRegistry;
  metricsToken?: string;
  reports?: ReportIngestDeps;
  webui?: WebuiProxyDeps; // 未指定時は /app/* を503にする（WebUI未起動の縮退運転）
}

export function buildApp(deps: AppDependencies): Hono {
  const app = new Hono();
  const metricsToken = deps.metricsToken;
  registerHealthRoutes(app, deps.readiness);
  if (metricsToken) {
    app.use("/metrics", async (c, next) => {
      if (!verifyBearerToken(c.req.header("Authorization") ?? "", metricsToken)) {
        return c.text("Unauthorized", 401, { "WWW-Authenticate": "Bearer" });
      }
      await next();
    });
  }
  registerMetricsRoutes(app, deps.metrics ?? new MetricsRegistry());
  registerGraphNotificationRoutes(app, deps.graph);
  registerGithubWebhookRoutes(app, deps.github);
  registerCodingTaskRoutes(app, deps.codingTasks);
  registerXlsxImportRoutes(app, deps.xlsxImport);
  registerReportIngestRoutes(app, deps.reports);
  registerWebuiProxy(app, deps.webui);
  return app;
}
