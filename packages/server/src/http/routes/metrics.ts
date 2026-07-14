/**
 * packages/server/src/http/routes/metrics.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-010。Prometheus scrape用のmetrics endpoint。
 */
import type { Hono } from "hono";
import type { MetricsRegistry } from "../../observability/metrics.js";

export function registerMetricsRoutes(app: Hono, metrics: MetricsRegistry): void {
  app.get("/metrics", (c) => c.text(metrics.renderPrometheus(), 200, { "Content-Type": "text/plain; version=0.0.4" }));
}
