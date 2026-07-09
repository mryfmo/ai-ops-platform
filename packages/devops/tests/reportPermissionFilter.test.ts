import { describe, it, expect } from "vitest";
import {
  isProjectInScope,
  filterOwnPrsForMember,
  aggregateStalePrsByTaskType,
  isActiveRecipient,
  type DevOpsVisibilityContext,
} from "../src/lib/reportPermissionFilter.js";

const ctx: DevOpsVisibilityContext = { recipientUserId: "U-010", recipientAssignedProjectIds: ["PRJ-001"] };

describe("isProjectInScope [REQ-021/022/023]", () => {
  it("PRF-Gは全プロジェクトが対象", () => {
    expect(isProjectInScope("PRF-G", "PRJ-999", ctx)).toBe(true);
  });
  it("PRF-Lは担当プロジェクトのみ", () => {
    expect(isProjectInScope("PRF-L", "PRJ-001", ctx)).toBe(true);
    expect(isProjectInScope("PRF-L", "PRJ-002", ctx)).toBe(false);
  });
});

describe("filterOwnPrsForMember [REQ-021 AC-021b]", () => {
  it("自分がauthorまたはreviewerのPRのみ残る", () => {
    const prs = [
      { id: "PR-1", authorUserId: "U-010" },
      { id: "PR-2", authorUserId: "U-020", reviewerUserId: "U-010" },
      { id: "PR-3", authorUserId: "U-020" },
    ];
    const filtered = filterOwnPrsForMember(prs, "U-010");
    expect(filtered.map((p) => p.id)).toEqual(["PR-1", "PR-2"]);
  });
});

describe("aggregateStalePrsByTaskType [SPEC-EXT-022(5): 個人名を含まない集計]", () => {
  it("48時間以上滞留したものをタスク種別別に集計する", () => {
    const prs = [
      { taskType: "レビュー待ち", authorUserId: "U-010", hoursStale: 50 },
      { taskType: "レビュー待ち", authorUserId: "U-020", hoursStale: 60 },
      { taskType: "承認待ち", authorUserId: "U-030", hoursStale: 10 },
    ];
    const result = aggregateStalePrsByTaskType(prs);
    expect(result).toEqual([{ taskType: "レビュー待ち", count: 2 }]);
  });
  it("結果オブジェクトに個人名(authorUserId)フィールドを含まない", () => {
    const prs = [{ taskType: "レビュー待ち", authorUserId: "U-010", hoursStale: 50 }];
    const result = aggregateStalePrsByTaskType(prs);
    expect(Object.keys(result[0] ?? {})).toEqual(["taskType", "count"]);
  });
});

describe("isActiveRecipient [REQ-024 AC-024a]", () => {
  const recipients = [
    { userId: "U-010", profile: "PRF-M" as const, email: "a@example.com", active: true },
    { userId: "U-020", profile: "PRF-M" as const, email: "b@example.com", active: false },
  ];
  it("activeな受信者はtrue", () => {
    expect(isActiveRecipient(recipients, "U-010")).toBe(true);
  });
  it("非activeな受信者はfalse（名簿から削除された宛先には配信しない）", () => {
    expect(isActiveRecipient(recipients, "U-020")).toBe(false);
  });
  it("名簿に存在しない場合もfalse", () => {
    expect(isActiveRecipient(recipients, "U-999")).toBe(false);
  });
});
