/**
 * packages/server/src/http/app.ts
 *
 * 根拠: ADR-0005（常駐サーバの公開HTTP面）/ ADR-0006（コーディングタスク確認・callback面）
 *   - GET  /healthz, /readyz: コンテナ監視用
 *   - POST /webhooks/graph:   Graph change notification受信（clientState検証）
 *   - POST /webhooks/github:  GitHub webhook受信（署名検証）
 *   - POST /webhooks/jira:    Jira webhook受信（認証 + PJ mapping + 最小metadata化）
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
import { registerJiraWebhookRoutes, type JiraWebhookDeps } from "./routes/jiraWebhook.js";
import { registerCodingTaskRoutes, type CodingTaskRoutesDeps } from "./routes/codingTasks.js";
import { registerWebuiProxy, type WebuiProxyDeps } from "./routes/webuiProxy.js";
import { registerXlsxImportRoutes, type XlsxImportRoutesDeps } from "./routes/xlsxImport.js";
import { registerReportIngestRoutes, type ReportIngestDeps } from "./routes/reportIngest.js";
import { registerApprovalRoutes, type ApprovalRoutesDeps } from "./routes/approvals.js";
import { registerMcpOpsRoutes, type McpOpsRoutesDeps } from "./routes/mcpOps.js";
import { registerM365DelegatedRoutes, type M365DelegatedRoutesDeps } from "./routes/m365Delegated.js";
import { registerWorkbenchRoutes, type WorkbenchRoutesDeps } from "./routes/workbench.js";
import { MetricsRegistry } from "../observability/metrics.js";
import { httpMetricsMiddleware } from "../observability/httpMetrics.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { verifyBearerToken } from "../lib/confirmToken.js";

export interface AppDependencies {
  auditLog: AuditLogWriter;
  readiness: ReadinessCheck;
  graph: GraphNotificationDeps;
  github: GithubWebhookDeps;
  jira?: JiraWebhookDeps;
  codingTasks: CodingTaskRoutesDeps;
  xlsxImport: XlsxImportRoutesDeps;
  metrics?: MetricsRegistry;
  metricsToken?: string;
  reports?: ReportIngestDeps;
  webui?: WebuiProxyDeps; // 未指定時は /app/* を503にする（WebUI未起動の縮退運転）
  approvals?: ApprovalRoutesDeps;
  mcpOps?: McpOpsRoutesDeps;
  m365Delegated?: M365DelegatedRoutesDeps;
  workbench?: WorkbenchRoutesDeps;
}

export function buildApp(deps: AppDependencies): Hono {
  const app = new Hono();
  const metrics = deps.metrics ?? new MetricsRegistry();
  const metricsToken = deps.metricsToken;
  app.use("*", httpMetricsMiddleware(metrics));
  app.use("/coding-tasks/:taskId/confirm", async (c, next) => {
    await next();
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
  });
  registerHealthRoutes(app, deps.readiness);
  // METRICS_TOKEN 未設定時は /metrics を**無効化**する。従来は認証ミドルウェア自体が
  // 登録されず、設定漏れ 1 つで queue 深度・タスク失敗・配信結果といった内部運用情報が
  // 匿名公開されていた（所見 ADV-OPS-006 / ADV-SEC-011 / ADV-DYN-001。06章 D7c で 200 を実観測）。
  // ADR-0016 構成では PUBLIC_BASE_URL 配下が Front Door 経由で公開されるため、
  // 「未設定なら公開」ではなく「未設定なら無効（disabled+audit）」へ倒す。
  app.use("/metrics", async (c, next) => {
    if (!metricsToken) {
      return c.text("Metrics endpoint is disabled: METRICS_TOKEN is not configured", 503);
    }
    if (!verifyBearerToken(c.req.header("Authorization") ?? "", metricsToken)) {
      return c.text("Unauthorized", 401, { "WWW-Authenticate": "Bearer" });
    }
    await next();
  });
  registerMetricsRoutes(app, metrics);
  registerGraphNotificationRoutes(app, deps.graph);
  registerGithubWebhookRoutes(app, deps.github);
  registerJiraWebhookRoutes(app, deps.jira);
  registerCodingTaskRoutes(app, deps.codingTasks);
  registerXlsxImportRoutes(app, deps.xlsxImport);
  registerReportIngestRoutes(app, deps.reports);
  registerApprovalRoutes(app, deps.approvals);
  registerMcpOpsRoutes(app, deps.mcpOps);
  registerM365DelegatedRoutes(app, deps.m365Delegated);
  registerWorkbenchRoutes(app, deps.workbench);
  registerWebuiProxy(app, deps.webui);
  return app;
}
