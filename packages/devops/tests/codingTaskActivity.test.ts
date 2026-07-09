/**
 * packages/devops/tests/codingTaskActivity.test.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4b「可視化は決定的集計のみ」。
 *   summarizeCodingTaskActivityの境界値（全件queued→completionSuccessRatePct=null、
 *   pr_created/failed混在、recentPullRequestsの10件制限・ソート順）を検証する。
 */
import { describe, it, expect } from "vitest";
import { summarizeCodingTaskActivity, type CodingTaskLike } from "../src/lib/codingTaskActivity.js";

function makeTask(overrides: Partial<CodingTaskLike> & { taskId: string }): CodingTaskLike {
  return {
    projectId: "PRJ-0001",
    status: "queued",
    agent: "claude-code",
    prUrl: null,
    branch: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("summarizeCodingTaskActivity（境界値: 全件queued）[ADR-0006 4b]", () => {
  it("全件queuedの場合、completionSuccessRatePctはnullになる（完了0件のため分母なし）", () => {
    const tasks = [makeTask({ taskId: "T1", status: "queued" }), makeTask({ taskId: "T2", status: "queued" })];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.countsByStatus).toEqual({ queued: 2, running: 0, pr_created: 0, failed: 0, cancelled: 0 });
    expect(result.totalCount).toBe(2);
    expect(result.completionSuccessRatePct).toBeNull();
    expect(result.recentPullRequests).toEqual([]);
  });

  it("全件runningの場合もcompletionSuccessRatePctはnullになる", () => {
    const tasks = [makeTask({ taskId: "T1", status: "running" })];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.completionSuccessRatePct).toBeNull();
  });

  it("空配列の場合はtotalCount=0、completionSuccessRatePct=nullを返す", () => {
    const result = summarizeCodingTaskActivity([]);
    expect(result.totalCount).toBe(0);
    expect(result.completionSuccessRatePct).toBeNull();
    expect(result.countsByStatus).toEqual({ queued: 0, running: 0, pr_created: 0, failed: 0, cancelled: 0 });
  });
});

describe("summarizeCodingTaskActivity（pr_created/failed混在）[ADR-0006 4b]", () => {
  it("完了3件中pr_created2件・failed1件なら完了成功率は約66.7%（queued/runningは分母外）", () => {
    const tasks = [
      makeTask({ taskId: "T1", status: "pr_created", prUrl: "https://github.com/org/repo/pull/1" }),
      makeTask({ taskId: "T2", status: "pr_created", prUrl: "https://github.com/org/repo/pull/2" }),
      makeTask({ taskId: "T3", status: "failed" }),
      makeTask({ taskId: "T4", status: "queued" }),
      makeTask({ taskId: "T5", status: "running" }),
    ];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.countsByStatus).toEqual({ queued: 1, running: 1, pr_created: 2, failed: 1, cancelled: 0 });
    expect(result.totalCount).toBe(5);
    expect(result.completionSuccessRatePct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("pr_created/failed/cancelledが1件ずつなら完了成功率は約33.3%", () => {
    const tasks = [
      makeTask({ taskId: "T1", status: "pr_created", prUrl: "https://github.com/org/repo/pull/1" }),
      makeTask({ taskId: "T2", status: "failed" }),
      makeTask({ taskId: "T3", status: "cancelled" }),
    ];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.completionSuccessRatePct).toBeCloseTo((1 / 3) * 100, 5);
  });

  it("完了件数が全てpr_createdなら100%になる", () => {
    const tasks = [
      makeTask({ taskId: "T1", status: "pr_created", prUrl: "https://github.com/org/repo/pull/1" }),
      makeTask({ taskId: "T2", status: "pr_created", prUrl: "https://github.com/org/repo/pull/2" }),
    ];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.completionSuccessRatePct).toBe(100);
  });
});

describe("summarizeCodingTaskActivity（recentPullRequestsの10件制限・ソート順）[ADR-0006 4b]", () => {
  it("pr_created以外のタスクはrecentPullRequestsに含まれない", () => {
    const tasks = [
      makeTask({ taskId: "T1", status: "pr_created", prUrl: "https://github.com/org/repo/pull/1" }),
      makeTask({ taskId: "T2", status: "failed" }),
      makeTask({ taskId: "T3", status: "running" }),
      makeTask({ taskId: "T4", status: "queued" }),
      makeTask({ taskId: "T5", status: "cancelled" }),
    ];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.recentPullRequests).toHaveLength(1);
    expect(result.recentPullRequests[0]!.taskId).toBe("T1");
  });

  it("createdAt降順（新しい順）に並ぶ", () => {
    const tasks = [
      makeTask({ taskId: "T1", status: "pr_created", prUrl: "u1", createdAt: "2026-07-01T00:00:00Z" }),
      makeTask({ taskId: "T2", status: "pr_created", prUrl: "u2", createdAt: "2026-07-03T00:00:00Z" }),
      makeTask({ taskId: "T3", status: "pr_created", prUrl: "u3", createdAt: "2026-07-02T00:00:00Z" }),
    ];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.recentPullRequests.map((p) => p.taskId)).toEqual(["T2", "T3", "T1"]);
  });

  it("pr_created件数が10件を超える場合、最新10件のみに絞られる", () => {
    const tasks: CodingTaskLike[] = Array.from({ length: 15 }, (_, i) =>
      makeTask({
        taskId: `T${i}`,
        status: "pr_created",
        prUrl: `https://github.com/org/repo/pull/${i}`,
        createdAt: new Date(Date.UTC(2026, 6, 1 + i)).toISOString(),
      }),
    );
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.recentPullRequests).toHaveLength(10);
    // 最新（i=14, 7/15）から10件分（i=14..5）が降順で並ぶはず
    expect(result.recentPullRequests[0]!.taskId).toBe("T14");
    expect(result.recentPullRequests[9]!.taskId).toBe("T5");
  });

  it("prUrlがnullのpr_createdタスクはrecentPullRequestsから除外される（データ不整合ケース防御）", () => {
    const tasks = [makeTask({ taskId: "T1", status: "pr_created", prUrl: null })];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.recentPullRequests).toEqual([]);
  });

  it("branchがnullでもtaskId/projectId/prUrl/createdAtは正しく含まれる", () => {
    const tasks = [
      makeTask({ taskId: "T1", status: "pr_created", prUrl: "https://github.com/org/repo/pull/1", branch: null }),
    ];
    const result = summarizeCodingTaskActivity(tasks);
    expect(result.recentPullRequests[0]).toEqual({
      taskId: "T1",
      projectId: "PRJ-0001",
      prUrl: "https://github.com/org/repo/pull/1",
      branch: null,
      createdAt: "2026-07-01T00:00:00Z",
    });
  });
});
