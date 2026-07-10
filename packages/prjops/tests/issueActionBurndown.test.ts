/**
 * packages/prjops/tests/issueActionBurndown.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。マネージャー層（PRF-03）バーンダウンチャートの
 *   週次集計境界値（期間またぎ、closed_at null等）を検証する。
 *   packages/devops/tests/incidentBurndown.test.ts と同一の集計方式を踏襲する。
 */
import { describe, it, expect } from "vitest";
import {
  computeIssueActionBurndown,
  countRemainingItems,
  type IssueActionBurndownInput,
} from "../src/lib/issueActionBurndown.js";

describe("computeIssueActionBurndown [ADR-0005: 週次バーンダウン集計]", () => {
  it("期間が不正（endがstart以前）なら空配列を返す", () => {
    expect(computeIssueActionBurndown([], "2026-02-01", "2026-01-01")).toEqual([]);
  });

  it("1週間ぴったりの期間は1バケットになる", () => {
    const result = computeIssueActionBurndown([], "2026-01-01", "2026-01-08");
    expect(result).toHaveLength(1);
    expect(result[0]!.weekLabel).toBe("2026-01-01");
  });

  it("createdAtが1週目、closedAtがnull（未完了）のitemはremainingに積み上がる", () => {
    const items: IssueActionBurndownInput[] = [{ createdAt: "2026-01-02T00:00:00Z", closedAt: null }];
    const result = computeIssueActionBurndown(items, "2026-01-01", "2026-01-15");
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 1, resolved: 0, remaining: 1 });
    expect(result[1]).toEqual({ weekLabel: "2026-01-08", opened: 0, resolved: 0, remaining: 1 });
  });

  it("翌週にcloseされた場合、remainingが減少する", () => {
    const items: IssueActionBurndownInput[] = [{ createdAt: "2026-01-02T00:00:00Z", closedAt: "2026-01-10T00:00:00Z" }];
    const result = computeIssueActionBurndown(items, "2026-01-01", "2026-01-15");
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 1, resolved: 0, remaining: 1 });
    expect(result[1]).toEqual({ weekLabel: "2026-01-08", opened: 0, resolved: 1, remaining: 0 });
  });

  it("期間外のcreatedAt/closedAtはどのバケットにも計上されない", () => {
    const items: IssueActionBurndownInput[] = [{ createdAt: "2025-12-01T00:00:00Z", closedAt: "2025-12-05T00:00:00Z" }];
    const result = computeIssueActionBurndown(items, "2026-01-01", "2026-01-08");
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 0, resolved: 0, remaining: 0 });
  });

  it("窓前にopenしたbacklogが窓内でcloseされてもremainingは正しく減る", () => {
    const items: IssueActionBurndownInput[] = [{ createdAt: "2025-12-20T00:00:00Z", closedAt: "2026-01-03T00:00:00Z" }];
    const result = computeIssueActionBurndown(items, "2026-01-01", "2026-01-08");
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 0, resolved: 1, remaining: 0 });
  });
});

describe("countRemainingItems [ADR-0005: 残チケット数=closedAt IS NULL]", () => {
  it("closedAtがnullの件数のみを返す", () => {
    const items: IssueActionBurndownInput[] = [
      { createdAt: "2026-01-02T00:00:00Z", closedAt: null },
      { createdAt: "2026-01-02T00:00:00Z", closedAt: "2026-01-03T00:00:00Z" },
    ];
    expect(countRemainingItems(items)).toBe(1);
  });

  it("0件のときは0", () => {
    expect(countRemainingItems([])).toBe(0);
  });

  it("periodEnd指定時は期間終端時点の未完了件数を返す", () => {
    expect(
      countRemainingItems(
        [
          { createdAt: "2025-12-20T00:00:00Z", closedAt: "2026-01-03T00:00:00Z" },
          { createdAt: "2026-01-02T00:00:00Z", closedAt: null },
        ],
        "2026-01-08",
      ),
    ).toBe(1);
  });
});
