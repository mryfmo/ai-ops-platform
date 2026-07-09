import { describe, it, expect } from "vitest";
import { computePlanLinePct, judgeStatus, selfReportDiffersFromJudged } from "../src/lib/statusJudge.js";

describe("computePlanLinePct [REQ-007: 計画線=経過期間÷全期間×100]", () => {
  it("開始日時点は0%", () => {
    expect(computePlanLinePct("2026-01-01", "2026-01-11", "2026-01-01")).toBe(0);
  });
  it("終了日時点は100%", () => {
    expect(computePlanLinePct("2026-01-01", "2026-01-11", "2026-01-11")).toBe(100);
  });
  it("中間時点は比例配分される", () => {
    // 全期間10日、経過5日 = 50%
    expect(computePlanLinePct("2026-01-01", "2026-01-11", "2026-01-06")).toBe(50);
  });
  it("終了日超過後は100%にクランプされる", () => {
    expect(computePlanLinePct("2026-01-01", "2026-01-11", "2026-02-01")).toBe(100);
  });
});

describe("judgeStatus [REQ-007 境界値: 超過0日/1日]", () => {
  const base = {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    progressPct: 50,
    highSeverityOpenIssueCount: 0,
    overdueActionCount: 0,
  };

  it("asOfDate=endDate（超過0日）はまだRedにならない", () => {
    const result = judgeStatus({ ...base, asOfDate: "2026-01-31", progressPct: 100 });
    expect(result.isOverdue).toBe(false);
  });

  it("asOfDate=endDate+1日（超過1日）はRed", () => {
    const result = judgeStatus({ ...base, asOfDate: "2026-02-01", progressPct: 100 });
    expect(result.isOverdue).toBe(true);
    expect(result.color).toBe("red");
  });
});

describe("judgeStatus [REQ-007 境界値: ▲5.0/▲15.0ポイント]", () => {
  // 全期間30日(01-01〜01-31)、asOf=01-16 → 経過15日 → 計画線50%
  const mkInput = (progressPct: number, overdueActionCount = 0) => ({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    asOfDate: "2026-01-16",
    progressPct,
    highSeverityOpenIssueCount: 0,
    overdueActionCount,
  });

  it("gap=-4.99（境界未満）はGreen", () => {
    const r = judgeStatus(mkInput(45.01));
    expect(r.color).toBe("green");
  });

  it("gap=-5.0 ちょうどはYellow（計画線比▲5〜▲15ポイント）", () => {
    const r = judgeStatus(mkInput(45));
    expect(r.color).toBe("yellow");
  });

  it("gap=-14.99はYellow", () => {
    const r = judgeStatus(mkInput(35.01));
    expect(r.color).toBe("yellow");
  });

  it("gap=-15.0 ちょうどはRed（▲15ポイント以上）", () => {
    const r = judgeStatus(mkInput(35));
    expect(r.color).toBe("red");
  });

  it("gap=-15.01はRed", () => {
    const r = judgeStatus(mkInput(34.99));
    expect(r.color).toBe("red");
  });
});

describe("judgeStatus [REQ-007: 高重要度課題・期限超過アクション]", () => {
  const onTrack = {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    asOfDate: "2026-01-16",
    progressPct: 50, // gap=0、それ以外は正常
  };

  it("高重要度課題が1件以上あればRed（進捗が計画通りでも）", () => {
    const r = judgeStatus({ ...onTrack, highSeverityOpenIssueCount: 1, overdueActionCount: 0 });
    expect(r.color).toBe("red");
  });

  it("期限超過アクションが2件ならまだGreen", () => {
    const r = judgeStatus({ ...onTrack, highSeverityOpenIssueCount: 0, overdueActionCount: 2 });
    expect(r.color).toBe("green");
  });

  it("期限超過アクションが3件以上ならYellow", () => {
    const r = judgeStatus({ ...onTrack, highSeverityOpenIssueCount: 0, overdueActionCount: 3 });
    expect(r.color).toBe("yellow");
  });
});

describe("judgeStatus [AC-007-1: 決定性]", () => {
  it("同一入力は常に同一出力を返す", () => {
    const input = {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      asOfDate: "2026-01-16",
      progressPct: 40,
      highSeverityOpenIssueCount: 0,
      overdueActionCount: 1,
    };
    const results = Array.from({ length: 20 }, () => judgeStatus(input));
    const colors = new Set(results.map((r) => r.color));
    expect(colors.size).toBe(1);
  });
});

describe("selfReportDiffersFromJudged [AC-007-2]", () => {
  it("一致していればfalse", () => {
    expect(selfReportDiffersFromJudged("green", "green")).toBe(false);
  });
  it("乖離していればtrue", () => {
    expect(selfReportDiffersFromJudged("green", "red")).toBe(true);
  });
});
