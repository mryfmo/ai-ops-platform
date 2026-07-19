/**
 * packages/web/tests/reportData/agentActivityData.test.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4b。CLAUDE.md設計原則6
 *   （権限フィルタはデータ取得側で強制）の検証: モックPgQueryableにスコープ外プロジェクトの
 *   coding_tasksを含めても、buildAgentActivitySummaryの結果にスコープ外データが
 *   一切漏れないことを確認する。
 */
import { describe, it, expect, vi } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import type { DevOpsVisibilityContext } from "@aiops/devops";
import { buildAgentActivitySummary } from "../../src/server/reportData/agentActivityData";

interface FakeRow {
  task_id: string;
  project_id: string;
  status: string;
  agent: string;
  pr_url: string | null;
  branch: string | null;
  created_at: string;
}

function fakeDb(rows: FakeRow[]): PgQueryable {
  const query = vi.fn(async (text: string) => {
    if (text.includes("FROM coding_tasks")) return { rows: rows as unknown as Record<string, unknown>[] };
    throw new Error(`unexpected query: ${text}`);
  });
  return { query };
}

const leaderCtx: DevOpsVisibilityContext = {
  recipientUserId: "U1",
  recipientAssignedProjectIds: ["PRJ-0001"],
  scopeMode: "project",
};

const managerCtx: DevOpsVisibilityContext = {
  recipientUserId: "U9",
  recipientAssignedProjectIds: [],
  scopeMode: "global",
};

describe("buildAgentActivitySummary（PRF-G: 全プロジェクト横断）", () => {
  it("スコープ内外を問わず全てのcoding_tasksが集計対象になる", async () => {
    const db = fakeDb([
      {
        task_id: "T1",
        project_id: "PRJ-0001",
        status: "pr_created",
        agent: "claude-code",
        pr_url: "https://github.com/org/repo/pull/1",
        branch: "agent/T1",
        created_at: "2026-07-01T00:00:00Z",
      },
      {
        task_id: "T2",
        project_id: "PRJ-0002",
        status: "failed",
        agent: "droid",
        pr_url: null,
        branch: "agent/T2",
        created_at: "2026-07-02T00:00:00Z",
      },
    ]);
    const result = await buildAgentActivitySummary(db, "PRF-G", managerCtx);
    expect(result.totalCount).toBe(2);
    expect(result.countsByStatus.pr_created).toBe(1);
    expect(result.countsByStatus.failed).toBe(1);
    expect(result.recentPullRequests).toHaveLength(1);
    expect(result.recentPullRequests[0]!.taskId).toBe("T1");
  });
});

describe("buildAgentActivitySummary（PRF-L: 権限フィルタ適用確認）", () => {
  it("担当外プロジェクト（PRJ-0002）のcoding_tasksが集計・PR一覧に混入しない", async () => {
    const db = fakeDb([
      {
        task_id: "T1",
        project_id: "PRJ-0001",
        status: "pr_created",
        agent: "claude-code",
        pr_url: "https://github.com/org/repo/pull/1",
        branch: "agent/T1",
        created_at: "2026-07-01T00:00:00Z",
      },
      {
        task_id: "T2",
        project_id: "PRJ-0002",
        status: "pr_created",
        agent: "claude-code",
        pr_url: "https://github.com/org/repo/pull/2",
        branch: "agent/T2",
        created_at: "2026-07-02T00:00:00Z",
      },
    ]);
    const result = await buildAgentActivitySummary(db, "PRF-L", leaderCtx);
    expect(result.totalCount).toBe(1);
    expect(result.recentPullRequests).toHaveLength(1);
    expect(result.recentPullRequests[0]!.taskId).toBe("T1");
    expect(result.recentPullRequests.some((p) => p.taskId === "T2")).toBe(false);
  });

  it("該当タスクが無い場合はtotalCount=0、completionSuccessRatePct=nullを返す", async () => {
    const db = fakeDb([
      {
        task_id: "T1",
        project_id: "PRJ-0002",
        status: "pr_created",
        agent: "claude-code",
        pr_url: "https://github.com/org/repo/pull/1",
        branch: "agent/T1",
        created_at: "2026-07-01T00:00:00Z",
      },
    ]);
    const result = await buildAgentActivitySummary(db, "PRF-L", leaderCtx);
    expect(result.totalCount).toBe(0);
    expect(result.completionSuccessRatePct).toBeNull();
  });
});
