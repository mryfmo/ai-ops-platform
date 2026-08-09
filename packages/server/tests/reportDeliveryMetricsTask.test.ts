/** 根拠: ADR-0016 / AUD-OPS-002。rolling failure ratio gaugeの60秒更新を検証する。 */
import { describe, expect, it, vi } from "vitest";
import { MetricsRegistry } from "../src/observability/metrics.js";
import { createReportDeliveryMetricsTask } from "../src/scheduler/tasks/reportDeliveryMetricsTask.js";

describe("report delivery metrics task [ADR-0016 / DevOps:SPEC-INT-010 / AUD-OPS-002]", () => {
  it("DevOps:SPEC-INT-010 injected nowでratioを読み60秒ごとにgaugesへ反映する", async () => {
    const failureRatios = vi.fn().mockResolvedValue({ sevenDay: 0.025, threeDay: 0.05 });
    const metrics = new MetricsRegistry();
    const task = createReportDeliveryMetricsTask({ provider: { failureRatios }, metrics });
    const now = new Date("2026-08-09T12:00:00.000Z");

    await task.run(now);

    expect(task.intervalMs).toBe(60_000);
    expect(failureRatios).toHaveBeenCalledWith(now);
    const text = metrics.renderPrometheus();
    expect(text).toContain("aiops_report_delivery_failure_ratio_7d 0.025");
    expect(text).toContain("aiops_report_delivery_failure_ratio_3d 0.05");
  });

  it("DevOps:SPEC-INT-010 attemptなしは健全な0ではなくno-data sentinel -1を公開する", async () => {
    const metrics = new MetricsRegistry();
    const task = createReportDeliveryMetricsTask({
      provider: { failureRatios: async () => ({ sevenDay: null, threeDay: null }) },
      metrics,
    });

    await task.run(new Date("2026-08-09T12:00:00.000Z"));

    const text = metrics.renderPrometheus();
    expect(text).toContain("aiops_report_delivery_failure_ratio_7d -1");
    expect(text).toContain("aiops_report_delivery_failure_ratio_3d -1");
  });

  it("DevOps:SPEC-INT-010 refresh失敗時は古いratioをno-dataへ無効化して例外を再送出する", async () => {
    const metrics = new MetricsRegistry();
    metrics.setReportDeliveryFailureRatios({ sevenDay: 0.01, threeDay: 0.02 });
    const task = createReportDeliveryMetricsTask({
      provider: { failureRatios: async () => Promise.reject(new Error("database unavailable")) },
      metrics,
    });

    await expect(task.run(new Date("2026-08-09T12:00:00.000Z"))).rejects.toThrow("database unavailable");
    const text = metrics.renderPrometheus();
    expect(text).toContain("aiops_report_delivery_failure_ratio_7d -1");
    expect(text).toContain("aiops_report_delivery_failure_ratio_3d -1");
  });
});
