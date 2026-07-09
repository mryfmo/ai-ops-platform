/**
 * packages/prjops/tests/executiveSevenKeys.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。経営層（PRF-04）セブンキーのうち
 *   決定的算出項目（1: ポートフォリオ健康度, 2: 進捗達成率, 3: 高リスク課題件数,
 *   5: スケジュール遵守率）の境界値と、指標4（予算消化率）のnullケースを検証する。
 */
import { describe, it, expect } from "vitest";
import {
  computeExecutiveSevenKeysNumeric,
  computeHighRiskIssueCount,
  computeProgressAchievementPct,
  computeScheduleAdherencePct,
  type ExecutiveProjectInput,
} from "../src/lib/executiveSevenKeys.js";

function project(overrides: Partial<ExecutiveProjectInput> = {}): ExecutiveProjectInput {
  return {
    projectId: "PRJ-0001",
    color: "green",
    progressPct: 50,
    highSeverityOpenIssueCount: 0,
    isOverdue: false,
    ...overrides,
  };
}

describe("computeProgressAchievementPct [ADR-0005 指標2: 進捗達成率]", () => {
  it("0件のときは0", () => {
    expect(computeProgressAchievementPct([])).toBe(0);
  });

  it("単純平均を返す", () => {
    const projects = [project({ progressPct: 40 }), project({ progressPct: 60 })];
    expect(computeProgressAchievementPct(projects)).toBe(50);
  });
});

describe("computeHighRiskIssueCount [ADR-0005 指標3: 高リスク課題件数]", () => {
  it("0件のときは0", () => {
    expect(computeHighRiskIssueCount([])).toBe(0);
  });

  it("全プロジェクトのhighSeverityOpenIssueCountを合算する", () => {
    const projects = [project({ highSeverityOpenIssueCount: 2 }), project({ highSeverityOpenIssueCount: 3 })];
    expect(computeHighRiskIssueCount(projects)).toBe(5);
  });
});

describe("computeScheduleAdherencePct [ADR-0005 指標5: スケジュール遵守率]", () => {
  it("0件のときは100（該当なし=遵守とみなす）", () => {
    expect(computeScheduleAdherencePct([])).toBe(100);
  });

  it("全件遵守なら100%", () => {
    const projects = [project({ isOverdue: false }), project({ isOverdue: false })];
    expect(computeScheduleAdherencePct(projects)).toBe(100);
  });

  it("全件超過なら0%", () => {
    const projects = [project({ isOverdue: true }), project({ isOverdue: true })];
    expect(computeScheduleAdherencePct(projects)).toBe(0);
  });

  it("2件中1件超過なら50%", () => {
    const projects = [project({ isOverdue: true }), project({ isOverdue: false })];
    expect(computeScheduleAdherencePct(projects)).toBe(50);
  });
});

describe("computeExecutiveSevenKeysNumeric [ADR-0005: セブンキー数値4項目の集約]", () => {
  it("色分布を正しく集計する", () => {
    const projects = [
      project({ color: "green" }),
      project({ color: "green" }),
      project({ color: "yellow" }),
      project({ color: "red" }),
    ];
    const result = computeExecutiveSevenKeysNumeric(projects);
    expect(result.colorDistribution).toEqual({ green: 2, yellow: 1, red: 1 });
  });

  it("指標4（予算消化率）は常にnull（データ未整備の暫定実装）", () => {
    const result = computeExecutiveSevenKeysNumeric([project()]);
    expect(result.budgetConsumptionPct).toBeNull();
  });

  it("0件（対象プロジェクトなし）でも例外を投げず既定値を返す", () => {
    const result = computeExecutiveSevenKeysNumeric([]);
    expect(result).toEqual({
      colorDistribution: { green: 0, yellow: 0, red: 0 },
      progressAchievementPct: 0,
      highRiskIssueCount: 0,
      budgetConsumptionPct: null,
      scheduleAdherencePct: 100,
    });
  });
});
