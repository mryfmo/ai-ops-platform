import { describe, it, expect } from "vitest";
import {
  evaluateTh001StagingPromotion,
  evaluateTh002ApprovalTimer,
  isWithinTh004Sla,
  evaluateTh005Escalation,
} from "../src/lib/thresholds.js";

describe("evaluateTh001StagingPromotion [TH-001, AC-003a境界値]", () => {
  it("全条件充足で昇格可", () => {
    expect(
      evaluateTh001StagingPromotion({
        ciAllJobsSuccess: true,
        unitTestCoveragePct: 85,
        staticAnalysisCriticalCount: 0,
      }),
    ).toBe(true);
  });
  it("カバレッジ80.0%ちょうどは充足（境界値）", () => {
    expect(
      evaluateTh001StagingPromotion({
        ciAllJobsSuccess: true,
        unitTestCoveragePct: 80.0,
        staticAnalysisCriticalCount: 0,
      }),
    ).toBe(true);
  });
  it("カバレッジ79%は非充足", () => {
    expect(
      evaluateTh001StagingPromotion({
        ciAllJobsSuccess: true,
        unitTestCoveragePct: 79,
        staticAnalysisCriticalCount: 0,
      }),
    ).toBe(false);
  });
  it("CI失敗があれば非充足", () => {
    expect(
      evaluateTh001StagingPromotion({
        ciAllJobsSuccess: false,
        unitTestCoveragePct: 90,
        staticAnalysisCriticalCount: 0,
      }),
    ).toBe(false);
  });
  it("Critical指摘が1件でもあれば非充足", () => {
    expect(
      evaluateTh001StagingPromotion({
        ciAllJobsSuccess: true,
        unitTestCoveragePct: 90,
        staticAnalysisCriticalCount: 1,
      }),
    ).toBe(false);
  });
});

describe("evaluateTh002ApprovalTimer [TH-002]", () => {
  const requestedAt = "2026-07-01T09:00:00Z";
  it("29分経過はnone", () => {
    const now = new Date(Date.parse(requestedAt) + 29 * 60000);
    expect(evaluateTh002ApprovalTimer({ requestedAt, now, decided: false, alreadyEscalated: false })).toBe("none");
  });
  it("30分経過でマネージャーへエスカレーション", () => {
    const now = new Date(Date.parse(requestedAt) + 30 * 60000);
    expect(evaluateTh002ApprovalTimer({ requestedAt, now, decided: false, alreadyEscalated: false })).toBe(
      "escalated_to_manager",
    );
  });
  it("60分経過で期限切れ", () => {
    const now = new Date(Date.parse(requestedAt) + 60 * 60000);
    expect(evaluateTh002ApprovalTimer({ requestedAt, now, decided: false, alreadyEscalated: true })).toBe("expired");
  });
  it("既に承認/却下済みならnone", () => {
    const now = new Date(Date.parse(requestedAt) + 90 * 60000);
    expect(evaluateTh002ApprovalTimer({ requestedAt, now, decided: true, alreadyEscalated: true })).toBe("none");
  });
});

describe("isWithinTh004Sla [TH-004: 5分以内]", () => {
  it("5分ちょうどはSLA内", () => {
    expect(isWithinTh004Sla("2026-07-06T09:00:00Z", "2026-07-06T09:05:00Z")).toBe(true);
  });
  it("5分1秒はSLA外", () => {
    expect(isWithinTh004Sla("2026-07-06T09:00:00Z", "2026-07-06T09:05:01Z")).toBe(false);
  });
});

describe("evaluateTh005Escalation [TH-005: 10分でリーダー、20分でマネージャー]", () => {
  const notifiedAt = "2026-07-06T09:00:00Z";
  it("9分はnone", () => {
    const now = new Date(Date.parse(notifiedAt) + 9 * 60000);
    expect(evaluateTh005Escalation({ notifiedAt, now, acked: false })).toBe("none");
  });
  it("10分でリーダー", () => {
    const now = new Date(Date.parse(notifiedAt) + 10 * 60000);
    expect(evaluateTh005Escalation({ notifiedAt, now, acked: false })).toBe("leader");
  });
  it("20分でマネージャー", () => {
    const now = new Date(Date.parse(notifiedAt) + 20 * 60000);
    expect(evaluateTh005Escalation({ notifiedAt, now, acked: false })).toBe("manager");
  });
  it("Ack済みなら停止", () => {
    const now = new Date(Date.parse(notifiedAt) + 30 * 60000);
    expect(evaluateTh005Escalation({ notifiedAt, now, acked: true })).toBe("none");
  });
});
