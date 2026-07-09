import { describe, it, expect } from "vitest";
import { INVESTOR_METRIC_DEFINITIONS, buildInvestorReport } from "../src/lib/investorMetrics.js";

describe("investorMetrics [REQ-039, SPEC-INT-066, AC-039-1]", () => {
  it("ILPA 2019ベースの定義テーブルを公開する", () => {
    expect(INVESTOR_METRIC_DEFINITIONS.map((metric) => metric.id)).toContain("revenue");
    expect(INVESTOR_METRIC_DEFINITIONS.every((metric) => metric.version === "ILPA-2019")).toBe(true);
  });

  it("算出可能なGitHub由来KPIと入力財務KPIを同じテーブルで返す", () => {
    const report = buildInvestorReport(
      [
        {
          projectId: "PRJ-0001",
          name: "会社A",
          revenue: 100,
          ebitda: 20,
          milestoneDelayDays: 2,
          highSeverityOpenIssueCount: 1,
        },
      ],
      {},
    );
    expect(report.kpis.find((metric) => metric.metricId === "revenue")?.value).toBe(100);
    expect(report.kpis.find((metric) => metric.metricId === "high_severity_open_issues")?.value).toBe(1);
    expect(report.risks).toHaveLength(1);
  });
});
