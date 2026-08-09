import { describe, expect, it } from "vitest";
import { MetricsRegistry } from "../src/observability/metrics.js";

describe("MetricsRegistry (A-2 / A-13)", () => {
  it("events queue gaugeはdrain後に既知statusを0へ戻す", () => {
    const metrics = new MetricsRegistry();
    metrics.setEventQueue([{ status: "queued", depth: 2, oldestAgeSeconds: 301 }]);
    expect(metrics.renderPrometheus()).toContain('aiops_events_queue_oldest_age_seconds{status="queued"} 301');

    metrics.setEventQueue([]);
    const text = metrics.renderPrometheus();
    expect(text).toContain('aiops_events_queue_depth{status="queued"} 0');
    expect(text).toContain('aiops_events_queue_oldest_age_seconds{status="queued"} 0');
    expect(text).toContain('aiops_events_queue_depth{status="delayed"} 0');
    expect(text).toContain('aiops_events_queue_depth{status="dispatched"} 0');
    expect(text).toContain('aiops_events_queue_depth{status="dead"} 0');
  });

  it("HTTP REDをmethod・正規化route・status別に公開する [ADR-0016 / DevOps:SPEC-INT-010]", () => {
    const metrics = new MetricsRegistry();

    metrics.recordHttpRequest("GET", "/projects/:projectId", 200, 0.125);

    const text = metrics.renderPrometheus();
    expect(text).toContain('aiops_http_requests_total{method="GET",route="/projects/:projectId",status="200"} 1');
    expect(text).toContain('aiops_http_request_duration_seconds_count{method="GET",route="/projects/:projectId"} 1');
    expect(text).toContain('aiops_http_request_duration_seconds_sum{method="GET",route="/projects/:projectId"} 0.125');
  });
});
