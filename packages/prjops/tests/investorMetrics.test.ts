import { describe, it, expect } from "vitest";
import { INVESTOR_METRIC_DEFINITIONS, buildInvestorReport } from "../src/lib/investorMetrics.js";

describe("investorMetrics [REQ-039, SPEC-INT-066, AC-039-1]", () => {
  it("SPEC-INT-066: ILPA 2019ベースの定義テーブルを公開する", () => {
    expect(INVESTOR_METRIC_DEFINITIONS.map((metric) => metric.id)).toContain("revenue");
    expect(INVESTOR_METRIC_DEFINITIONS.every((metric) => metric.version === "ILPA-2019")).toBe(true);
  });

  it("AC-039-1: 財務KPIを持分加重し、GitHub由来の異種合算は明細で返す", () => {
    const report = buildInvestorReport(
      [
        {
          projectId: "PRJ-0001",
          name: "会社A",
          revenue: 100,
          ebitda: 20,
          ownershipPct: 50,
          milestoneDelayDays: 2,
          highSeverityOpenIssueCount: 1,
        },
        {
          projectId: "PRJ-0002",
          name: "会社B",
          revenue: 200,
          ebitda: 20,
          ownershipPct: 50,
          milestoneDelayDays: 9,
          highSeverityOpenIssueCount: 0,
        },
      ],
      {},
    );
    expect(report.kpis.find((metric) => metric.metricId === "revenue")?.value).toBe(150);
    expect(report.kpis.find((metric) => metric.metricId === "high_severity_open_issues")).toBeUndefined();
    expect(report.milestones.map((row) => row.delayDays)).toEqual([2, 9]);
    expect(report.risks).toHaveLength(1);
  });

  it("target/variance/trendを履歴入力から決定的に算出する", () => {
    const report = buildInvestorReport(
      [
        {
          projectId: "PRJ-0001",
          name: "会社A",
          revenue: 100,
          ebitda: 20,
          milestoneDelayDays: 0,
          highSeverityOpenIssueCount: 0,
        },
      ],
      {},
      {
        targets: { revenue: 80 },
        history: [
          {
            companies: [
              { projectId: "PRJ-0001", revenue: 100, ownershipPct: 50 },
              { projectId: "PRJ-0002", revenue: 200, ownershipPct: 25 },
            ],
          },
          {
            companies: [
              { projectId: "PRJ-0001", revenue: 160, ownershipPct: 50 },
              { projectId: "PRJ-0002", revenue: 240, ownershipPct: 25 },
            ],
          },
        ],
      },
    );
    expect(report.kpis.find((metric) => metric.metricId === "revenue")).toMatchObject({
      value: 100,
      target: 80,
      variance: 20,
      trend: [100, 140],
    });
  });
});
