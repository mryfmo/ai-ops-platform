import { describe, expect, it } from "vitest";
import {
  toBurndownChartData,
  toDoraChartData,
  toMetricBarData,
  toTimeseriesChartData,
} from "../src/components/charts/chartData";

describe("chartData (ADR-0009 / SPEC-INT-064 / AC-010-3)", () => {
  it("バーンダウンをRechartsのComposedChart用propsへ変換する", () => {
    expect(toBurndownChartData([{ weekLabel: "2026-W28", opened: 3, resolved: 2, remaining: 5 }])).toEqual([
      { label: "2026-W28", opened: 3, resolved: 2, remaining: 5 },
    ]);
  });

  it("時系列集計をchange-over-time用propsへ変換する", () => {
    const rows = toTimeseriesChartData({
      period: "week",
      baseDate: "2026-07-09",
      range: { start: "s", end: "e", label: "2026-W28" },
      buckets: [
        {
          bucket: { id: "2026-07-09", label: "07-09", start: "s", end: "e" },
          opened: 1,
          closed: 2,
          statusTransitions: 3,
          milestoneCompleted: 4,
          burndownRemaining: 5,
          deployments: 6,
        },
      ],
      totals: { opened: 1, closed: 2, statusTransitions: 3, milestoneCompleted: 4, deployments: 6 },
    });
    expect(rows[0]).toMatchObject({ label: "07-09", opened: 1, closed: 2, remaining: 5, deployments: 6 });
  });

  it("DORA 5をサービス単位trend propsへ変換する", () => {
    expect(
      toDoraChartData([
        {
          projectId: "svc-a",
          dora: {
            deploymentFrequencyPerWeek: 2,
            medianLeadTimeHours: 4,
            changeFailureRatePct: 5,
            deploymentReworkRatePct: 6,
            meanTimeToRestoreHours: 7,
          },
        },
      ]),
    ).toEqual([
      { projectId: "svc-a", deploymentFrequencyPerWeek: 2, changeFailureRatePct: 5, deploymentReworkRatePct: 6 },
    ]);
  });

  it("KPI横棒は未入力値を除外する", () => {
    expect(
      toMetricBarData([
        { label: "Revenue", value: 100 },
        { label: "EBITDA", value: null },
      ]),
    ).toEqual([{ label: "Revenue", value: 100 }]);
  });
});
