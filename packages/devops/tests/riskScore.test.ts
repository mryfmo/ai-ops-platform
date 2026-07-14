import { describe, it, expect } from "vitest";
import { buildHolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";
import {
  factorA_changedLines,
  factorB_sensitivePaths,
  factorD_testResult,
  factorE_offHours,
  calculateRiskScore,
} from "../src/lib/riskScore.js";

const cal = buildHolidayCalendar([]);

describe("factorA_changedLines [DevOps:SPEC-INT-021 A]", () => {
  it("0行は0", () => {
    expect(factorA_changedLines(0)).toBe(0);
  });
  it("1000行は50（線形）", () => {
    expect(factorA_changedLines(1000)).toBe(50);
  });
  it("2000行は100", () => {
    expect(factorA_changedLines(2000)).toBe(100);
  });
  it("2000行超は100でクランプ", () => {
    expect(factorA_changedLines(5000)).toBe(100);
  });
});

describe("factorB_sensitivePaths [DevOps:SPEC-INT-021 B]", () => {
  it("/infra/を含めば100", () => {
    expect(factorB_sensitivePaths(["src/infra/deploy.ts"])).toBe(100);
  });
  it("/migrations/を含めば100", () => {
    expect(factorB_sensitivePaths(["db/migrations/001.sql"])).toBe(100);
  });
  it("/auth/を含めば100", () => {
    expect(factorB_sensitivePaths(["src/auth/login.ts"])).toBe(100);
  });
  it("該当なしなら0", () => {
    expect(factorB_sensitivePaths(["src/ui/button.tsx"])).toBe(0);
  });
});

describe("factorD_testResult [DevOps:SPEC-INT-021 D]", () => {
  it("失敗0・カバレッジ80%以上は0", () => {
    expect(factorD_testResult(0, 80)).toBe(0);
    expect(factorD_testResult(0, 95)).toBe(0);
  });
  it("失敗0・カバレッジ80%未満は不足分を線形評価する", () => {
    expect(factorD_testResult(0, 70)).toBe(20);
    expect(factorD_testResult(0, 79.9)).toBeCloseTo(0.2);
  });
  it("カバレッジ大幅不足は100でクランプする", () => {
    expect(factorD_testResult(0, 20)).toBe(100);
  });
  it("テスト失敗が1件でもあれば100（カバレッジ問わず）", () => {
    expect(factorD_testResult(1, 95)).toBe(100);
  });
});

describe("factorE_offHours [DevOps:SPEC-INT-021 E: 平日19:00〜翌9:00・土日]", () => {
  it("平日日中は0", () => {
    expect(factorE_offHours(cal, "2026-07-06", "12:00")).toBe(0);
  });
  it("平日19:00以降は100", () => {
    expect(factorE_offHours(cal, "2026-07-06", "19:00")).toBe(100);
  });
  it("土日は100", () => {
    expect(factorE_offHours(cal, "2026-07-04", "12:00")).toBe(100);
  });
});

describe("calculateRiskScore [AC-011a: 決定性, AC-011b: 70以上で高リスク]", () => {
  const baseInput = {
    changedLinesCount: 0,
    changedFilePaths: ["src/ui/x.tsx"],
    recentFailureRatePct: 0,
    testFailedCount: 0,
    coveragePct: 90,
    deployScheduledDateJst: "2026-07-06",
    deployScheduledTimeJst: "12:00",
  };

  it("全て低リスク要因なら低スコア", () => {
    const r = calculateRiskScore(cal, baseInput);
    expect(r.score).toBe(0);
    expect(r.isHighRisk).toBe(false);
  });

  it("/infra/変更＋営業時間外の複合スコアが正しく合成される", () => {
    const r = calculateRiskScore(cal, {
      ...baseInput,
      changedFilePaths: ["src/infra/deploy.ts"],
      deployScheduledTimeJst: "22:00",
    });
    // B=100*0.25=25, E=100*0.1=10, 他0 → 35点
    expect(r.score).toBe(35);
  });

  it("全要因が最大なら100点で高リスク", () => {
    const r = calculateRiskScore(cal, {
      changedLinesCount: 5000,
      changedFilePaths: ["src/infra/x.ts"],
      recentFailureRatePct: 100,
      testFailedCount: 3,
      coveragePct: 10,
      deployScheduledDateJst: "2026-07-04",
      deployScheduledTimeJst: "12:00",
    });
    expect(r.score).toBe(100);
    expect(r.isHighRisk).toBe(true);
  });

  it("スコア70ちょうどはisHighRisk=true（境界値）", () => {
    const r = calculateRiskScore(cal, {
      changedLinesCount: 0,
      changedFilePaths: ["src/auth/x.ts"],
      recentFailureRatePct: 100,
      testFailedCount: 1,
      coveragePct: 10,
      deployScheduledDateJst: "2026-07-04",
      deployScheduledTimeJst: "12:00",
    });
    expect(r.score).toBe(70);
    expect(r.isHighRisk).toBe(true);
  });

  it("同一入力は常に同一スコアを返す（決定性）", () => {
    const scores = new Set(Array.from({ length: 10 }, () => calculateRiskScore(cal, baseInput).score));
    expect(scores.size).toBe(1);
  });
});
