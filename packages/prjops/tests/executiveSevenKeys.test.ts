import { describe, it, expect } from "vitest";
import {
  assessProjectSevenKeys,
  buildSevenKeysMonthlySnapshot,
  computeExecutiveSevenKeys,
  type ExecutiveProjectInput,
} from "../src/lib/executiveSevenKeys.js";

function project(overrides: Partial<ExecutiveProjectInput> = {}): ExecutiveProjectInput {
  return {
    projectId: "PRJ-0001",
    name: "案件A",
    progressPct: 90,
    highSeverityOpenIssueCount: 0,
    isOverdue: false,
    scopeChangeCount: 0,
    averageReviewWaitHours: 12,
    activeContributorCount: 3,
    ...overrides,
  };
}

function rag(result: ReturnType<typeof assessProjectSevenKeys>, keyId: string) {
  return result.keys.find((key) => key.keyId === keyId)?.rag;
}

describe("assessProjectSevenKeys [REQ-038, SPEC-INT-065, AC-038-1]", () => {
  it("正典7キーをプロジェクト毎に返し、予算指標を含めない", () => {
    const result = assessProjectSevenKeys(project());
    expect(result.keys.map((key) => key.keyId)).toEqual(["K1", "K2", "K3", "K4", "K5", "K6", "K7"]);
    expect(JSON.stringify(result)).not.toContain("budget");
  });

  it("定性質問票が欠落したキーは推測せずgreyにする", () => {
    const result = assessProjectSevenKeys(project({ questionnaire: undefined }));
    expect(rag(result, "K1")).toBe("grey");
    expect(rag(result, "K2")).toBe("grey");
    expect(rag(result, "K7")).toBe("grey");
  });

  it("GitHub由来のスケジュール・スコープ・チーム・リスク信号をRAG化する", () => {
    const result = assessProjectSevenKeys(
      project({
        isOverdue: true,
        scopeChangeCount: 5,
        averageReviewWaitHours: 80,
        activeContributorCount: 1,
        highSeverityOpenIssueCount: 2,
      }),
    );
    expect(rag(result, "K3")).toBe("red");
    expect(rag(result, "K4")).toBe("red");
    expect(rag(result, "K5")).toBe("red");
    expect(rag(result, "K6")).toBe("red");
  });

  it("AC-038-1: 高重大度リスクなしでリスク質問票も無いK6はgreyにする", () => {
    const result = assessProjectSevenKeys(project({ highSeverityOpenIssueCount: 0, questionnaire: undefined }));
    expect(rag(result, "K6")).toBe("grey");
  });
});

describe("computeExecutiveSevenKeys [REQ-038]", () => {
  it("複数プロジェクトの7キーマトリクスを返す", () => {
    const result = computeExecutiveSevenKeys([project({ projectId: "PRJ-0001" }), project({ projectId: "PRJ-0002" })]);
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]!.keys).toHaveLength(7);
  });
});

describe("buildSevenKeysMonthlySnapshot [AC-038-1]", () => {
  it("前月RAGとの差分から改善/悪化キーを返す", () => {
    const previous = assessProjectSevenKeys(project({ progressPct: 90, highSeverityOpenIssueCount: 0 }));
    const snapshot = buildSevenKeysMonthlySnapshot(
      project({ progressPct: 50, highSeverityOpenIssueCount: 1 }),
      "2026-07",
      previous,
    );
    expect(snapshot.worsenedKeys).toEqual(expect.arrayContaining(["K3", "K6"]));
  });
});
