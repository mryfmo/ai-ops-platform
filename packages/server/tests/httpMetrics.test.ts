/**
 * packages/server/tests/httpMetrics.test.ts
 *
 * 根拠: ADR-0016 / DevOps:SPEC-INT-010。HTTP RED metricsのroute正規化と自己計測除外を検証する。
 */
import { InMemoryAuditLog } from "@aiops/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { buildApp, type AppDependencies } from "../src/http/app.js";
import { httpMetricsMiddleware } from "../src/observability/httpMetrics.js";
import { MetricsRegistry } from "../src/observability/metrics.js";

const METRICS_TOKEN = "test-metrics-token-of-at-least-32-chars";

function makeDeps(metrics: MetricsRegistry): AppDependencies {
  return {
    auditLog: new InMemoryAuditLog(),
    readiness: { isReady: async () => true },
    graph: {} as AppDependencies["graph"],
    github: {} as AppDependencies["github"],
    codingTasks: {} as AppDependencies["codingTasks"],
    xlsxImport: {} as AppDependencies["xlsxImport"],
    metrics,
    metricsToken: METRICS_TOKEN,
  };
}

describe("HTTP RED metrics [ADR-0016 / DevOps:SPEC-INT-010]", () => {
  it("matched route patternを記録しraw pathをlabelへ出さない", async () => {
    const metrics = new MetricsRegistry();
    const app = buildApp(makeDeps(metrics));

    const response = await app.request("/app/customer-secret-123");

    expect(response.status).toBe(503);
    const text = metrics.renderPrometheus();
    expect(text).toContain('aiops_http_requests_total{method="GET",route="/app/*",status="503"} 1');
    expect(text).toContain('aiops_http_request_duration_seconds_count{method="GET",route="/app/*"} 1');
    expect(text).not.toContain("customer-secret-123");
  });

  it("/healthzと/metricsを自己計測から除外し/readyzは計測する", async () => {
    const metrics = new MetricsRegistry();
    const app = buildApp(makeDeps(metrics));

    await app.request("/healthz");
    await app.request("/metrics", { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } });
    await app.request("/readyz");

    const text = metrics.renderPrometheus();
    expect(text).not.toContain('route="/healthz"');
    expect(text).not.toContain('route="/metrics"');
    expect(text).toContain('aiops_http_requests_total{method="GET",route="/readyz",status="200"} 1');
  });

  it("例外をHonoが変換した500応答も計測する", async () => {
    const metrics = new MetricsRegistry();
    const app = new Hono();
    app.use("*", httpMetricsMiddleware(metrics));
    app.get("/boom", () => {
      throw new Error("expected test error");
    });

    const response = await app.request("/boom");

    expect(response.status).toBe(500);
    expect(metrics.renderPrometheus()).toContain(
      'aiops_http_requests_total{method="GET",route="/boom",status="500"} 1',
    );
  });
});
