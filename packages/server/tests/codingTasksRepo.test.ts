/**
 * packages/server/tests/codingTasksRepo.test.ts
 *
 * 根拠: ADR-0006（coding_tasks台帳のCRUD。状態機械 queued → running → pr_created | failed | cancelled は
 *   runbooks/coding-task-failure.md と一致させる）
 */
import { describe, it, expect } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function makeMockDb(rows: Array<Record<string, unknown>> = []) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows };
    },
  };
  return { db, calls };
}

const SAMPLE_ROW = {
  task_id: "task-1",
  project_id: "PJ-001",
  requested_by: "USER:PRF-02",
  source: "teams",
  instruction: "テストを直して",
  agent: "claude-code",
  status: "queued",
  workflow_run_id: null,
  pr_url: null,
  branch: null,
  trace_id: "trace-1",
  manifest: '{"schema_version":"1.0"}\n',
  manifest_sha256: "a".repeat(64),
  confirmed_at: null,
  created_at: "2026-07-07T00:00:00.000Z",
  updated_at: "2026-07-07T00:00:00.000Z",
};
const INSERT_TASK_ID = "11111111-1111-4111-8111-111111111111";

describe("CodingTasksRepo (ADR-0006)", () => {
  it("insert: status='queued'固定でINSERTし、RETURNINGされた行をドメイン型で返す", async () => {
    const { db, calls } = makeMockDb([SAMPLE_ROW]);
    const repo = new CodingTasksRepo(db);
    const result = await repo.insert({
      taskId: INSERT_TASK_ID,
      projectId: "PJ-001",
      requestedBy: "USER:PRF-02",
      source: "teams",
      instruction: "テストを直して",
      agent: "claude-code",
      traceId: "trace-1",
      confirmTokenHash: "hash-abc",
    });
    expect(calls[0]!.text).toContain("INSERT INTO coding_tasks");
    expect(calls[0]!.text).toContain("'queued'");
    expect(calls[0]!.params?.slice(0, 8)).toEqual([
      INSERT_TASK_ID,
      "PJ-001",
      "USER:PRF-02",
      "teams",
      "テストを直して",
      "claude-code",
      "trace-1",
      "hash-abc",
    ]);
    expect(calls[0]!.params?.[8]).toEqual(expect.stringContaining('"schema_version":"1.0"'));
    expect(calls[0]!.params?.[9]).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.taskId).toBe("task-1");
    expect(result.status).toBe("queued");
    expect(result.confirmedAt).toBeNull();
  });

  it("findById: 見つかればドメイン型へマッピングする", async () => {
    const { db } = makeMockDb([SAMPLE_ROW]);
    const repo = new CodingTasksRepo(db);
    const task = await repo.findById("task-1");
    expect(task).toEqual({
      taskId: "task-1",
      projectId: "PJ-001",
      requestedBy: "USER:PRF-02",
      source: "teams",
      instruction: "テストを直して",
      agent: "claude-code",
      status: "queued",
      workflowRunId: null,
      prUrl: null,
      branch: null,
      traceId: "trace-1",
      manifest: '{"schema_version":"1.0"}\n',
      manifestSha256: "a".repeat(64),
      confirmedAt: null,
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
    });
  });

  it("findById: 見つからなければnull", async () => {
    const { db } = makeMockDb([]);
    const repo = new CodingTasksRepo(db);
    expect(await repo.findById("missing")).toBeNull();
  });

  it("markConfirmedAndDispatched: confirmed_at設定+status='running'へ更新する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new CodingTasksRepo(db);
    await repo.markConfirmedAndDispatched("task-1", { workflowRunId: 999 });
    expect(calls[0]!.text).toContain("SET status = 'running'");
    expect(calls[0]!.text).toContain("confirmed_at = now()");
    expect(calls[0]!.params).toEqual(["task-1", 999]);
  });

  it("markConfirmedAndDispatched: workflowRunId省略時はnullを渡す", async () => {
    const { db, calls } = makeMockDb();
    const repo = new CodingTasksRepo(db);
    await repo.markConfirmedAndDispatched("task-1");
    expect(calls[0]!.params).toEqual(["task-1", null]);
  });

  it("updateFromCallback: pr_created状態への遷移とPR情報の更新", async () => {
    const { db, calls } = makeMockDb();
    const repo = new CodingTasksRepo(db);
    await repo.updateFromCallback("task-1", {
      status: "pr_created",
      prUrl: "https://github.com/acme/widget/pull/42",
      branch: "agent/task-1",
      workflowRunId: 1234,
    });
    expect(calls[0]!.text).toContain("SET status = $2");
    expect(calls[0]!.params).toEqual([
      "task-1",
      "pr_created",
      "https://github.com/acme/widget/pull/42",
      "agent/task-1",
      1234,
    ]);
  });

  it("updateFromCallback: failed状態への遷移", async () => {
    const { db, calls } = makeMockDb();
    const repo = new CodingTasksRepo(db);
    await repo.updateFromCallback("task-1", { status: "failed" });
    expect(calls[0]!.params).toEqual(["task-1", "failed", null, null, null]);
  });
});
