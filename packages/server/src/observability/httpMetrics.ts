/**
 * packages/server/src/observability/httpMetrics.ts
 *
 * 根拠: ADR-0016 / DevOps:SPEC-INT-010。Honoのmatched routeだけをHTTP RED metricsへ記録する。
 */
import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";
import type { MetricsRegistry } from "./metrics.js";

const EXCLUDED_ROUTES = new Set(["/healthz", "/metrics"]);

/**
 * PromQL:
 * - 99.9% availability = 1 - sum(rate(aiops_http_requests_total{status=~"5.."}[30d]))
 *   / sum(rate(aiops_http_requests_total[30d]))
 * - p95 = histogram_quantile(0.95, sum by (le, route) (rate(aiops_http_request_duration_seconds_bucket[5m])))
 * KQL (AppMetrics.Sum is the interval delta for counters and histogram buckets):
 * - 5xx / availability:
 *   AppMetrics | where Name == "aiops_http_requests_total"
 *   | extend status=tostring(Properties.status), route=tostring(Properties.route)
 *   | summarize total=sum(Sum), failures=sumif(Sum, status matches regex "^5[0-9]{2}$") by route
 *   | extend availability=1.0 - failures / total, meets_99_9=availability >= 0.999
 * - p95:
 *   let b = AppMetrics | where Name == "aiops_http_request_duration_seconds_bucket"
 *     | extend route=tostring(Properties.route), le=tostring(Properties.le)
 *     | summarize cumulative=sum(Sum) by route, le;
 *   b | summarize total=max(cumulative) by route | join kind=inner b on route
 *     | where le != "+Inf" and cumulative >= total * 0.95
 *     | summarize p95_seconds=min(todouble(le)) by route
 */
export function httpMetricsMiddleware(metrics: MetricsRegistry): MiddlewareHandler {
  return async (context, next) => {
    const startedAt = performance.now();
    await next();

    const matchedRoute = routePath(context, -1);
    const route = matchedRoute === "*" || matchedRoute === "" ? "unmatched" : matchedRoute;
    if (EXCLUDED_ROUTES.has(route)) return;

    metrics.recordHttpRequest(context.req.method, route, context.res.status, (performance.now() - startedAt) / 1_000);
  };
}
