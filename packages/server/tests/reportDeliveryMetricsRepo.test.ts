/** 根拠: ADR-0016 / AUD-OPS-002。永続化済み配信周期からrolling failure ratioを導出する。 */
import { describe, expect, it, vi } from "vitest";
import { ReportDeliveryMetricsRepo } from "../src/db/reportDeliveryMetricsRepo.js";

describe("ReportDeliveryMetricsRepo [ADR-0016 / AUD-OPS-002]", () => {
  it("injected nowから7d/3d境界を作りaudit queryを有界化する", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ sent_7d: "90", failed_7d: "10", sent_3d: "49", failed_3d: "1" }],
    });
    const repo = new ReportDeliveryMetricsRepo({ query });

    await expect(repo.failureRatios(new Date("2026-08-09T12:00:00.000Z"))).resolves.toEqual({
      sevenDay: 0.1,
      threeDay: 0.02,
    });
    expect(query.mock.calls[0]![0]).toContain("at >= $1 AND at <= $3");
    expect(query.mock.calls[0]![0]).toContain("retention_class = 'prjops_5y'");
    expect(query.mock.calls[0]![0]).toContain("report_delivery_cycle_failed");
    expect(query.mock.calls[0]![1]).toEqual([
      "2026-08-02T12:00:00.000Z",
      "2026-08-06T12:00:00.000Z",
      "2026-08-09T12:00:00.000Z",
    ]);
  });

  it("attemptがないwindowを成功率0と誤表示せずnullにする", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ sent_7d: "0", failed_7d: "0", sent_3d: "0", failed_3d: "0" }],
    });

    await expect(
      new ReportDeliveryMetricsRepo({ query }).failureRatios(new Date("2026-08-09T12:00:00.000Z")),
    ).resolves.toEqual({ sevenDay: null, threeDay: null });
  });
});
