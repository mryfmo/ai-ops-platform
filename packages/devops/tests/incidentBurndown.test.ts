/**
 * packages/devops/tests/incidentBurndown.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。マネージャー層（PRF-G）バーンダウンチャートの
 *   週次集計境界値（期間またぎ、resolved_at null等）を検証する。
 */
import { describe, it, expect } from "vitest";
import {
  computeIncidentBurndown,
  countRemainingIncidents,
  countTotalIncidentsInPeriod,
  type IncidentBurndownInput,
} from "../src/lib/incidentBurndown.js";

describe("computeIncidentBurndown [ADR-0005: 週次バーンダウン集計]", () => {
  it("期間が不正（endがstart以前）なら空配列を返す", () => {
    expect(computeIncidentBurndown([], "2026-02-01", "2026-01-01")).toEqual([]);
    expect(computeIncidentBurndown([], "2026-01-01", "2026-01-01")).toEqual([]);
  });

  it("1週間ぴったりの期間は1バケットになる", () => {
    const result = computeIncidentBurndown([], "2026-01-01", "2026-01-08");
    expect(result).toHaveLength(1);
    expect(result[0]!.weekLabel).toBe("2026-01-01");
  });

  it("detected_atが1週目、resolved_atがnull（未解決）のincidentはremainingに積み上がる", () => {
    const incidents: IncidentBurndownInput[] = [{ detectedAt: "2026-01-02T00:00:00Z", resolvedAt: null }];
    const result = computeIncidentBurndown(incidents, "2026-01-01", "2026-01-15");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 1, resolved: 0, remaining: 1 });
    expect(result[1]).toEqual({ weekLabel: "2026-01-08", opened: 0, resolved: 0, remaining: 1 });
  });

  it("期間をまたいでopenした週の翌週にresolveされた場合、remainingが減少する", () => {
    const incidents: IncidentBurndownInput[] = [
      { detectedAt: "2026-01-02T00:00:00Z", resolvedAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computeIncidentBurndown(incidents, "2026-01-01", "2026-01-15");
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 1, resolved: 0, remaining: 1 });
    expect(result[1]).toEqual({ weekLabel: "2026-01-08", opened: 0, resolved: 1, remaining: 0 });
  });

  it("期間外のdetected_at/resolved_atはどのバケットにも計上されない", () => {
    const incidents: IncidentBurndownInput[] = [
      { detectedAt: "2025-12-01T00:00:00Z", resolvedAt: "2025-12-05T00:00:00Z" },
    ];
    const result = computeIncidentBurndown(incidents, "2026-01-01", "2026-01-08");
    expect(result[0]).toEqual({ weekLabel: "2026-01-01", opened: 0, resolved: 0, remaining: 0 });
  });

  it("remainingは0を下回らない（resolvedの計上がopenedを超えるケースの防御）", () => {
    const incidents: IncidentBurndownInput[] = [
      { detectedAt: "2026-01-02T00:00:00Z", resolvedAt: "2026-01-03T00:00:00Z" },
      { detectedAt: "2026-01-02T00:00:00Z", resolvedAt: "2026-01-03T00:00:00Z" },
    ];
    const result = computeIncidentBurndown(incidents, "2026-01-01", "2026-01-08");
    expect(result[0]!.remaining).toBe(0);
  });
});

describe("countTotalIncidentsInPeriod [ADR-0005: 総チケット数=期間内の全incidents件数]", () => {
  it("期間内のdetected_atのみをカウントする", () => {
    const incidents: IncidentBurndownInput[] = [
      { detectedAt: "2026-01-02T00:00:00Z", resolvedAt: null },
      { detectedAt: "2025-12-01T00:00:00Z", resolvedAt: null },
    ];
    expect(countTotalIncidentsInPeriod(incidents, "2026-01-01", "2026-01-08")).toBe(1);
  });

  it("periodEnd自体は含まない（半開区間）", () => {
    const incidents: IncidentBurndownInput[] = [{ detectedAt: "2026-01-08T00:00:00Z", resolvedAt: null }];
    expect(countTotalIncidentsInPeriod(incidents, "2026-01-01", "2026-01-08")).toBe(0);
  });
});

describe("countRemainingIncidents [ADR-0005: 残チケット数=resolved_at IS NULL]", () => {
  it("resolved_atがnullの件数のみを返す", () => {
    const incidents: IncidentBurndownInput[] = [
      { detectedAt: "2026-01-02T00:00:00Z", resolvedAt: null },
      { detectedAt: "2026-01-02T00:00:00Z", resolvedAt: "2026-01-03T00:00:00Z" },
    ];
    expect(countRemainingIncidents(incidents)).toBe(1);
  });

  it("0件のときは0", () => {
    expect(countRemainingIncidents([])).toBe(0);
  });
});
