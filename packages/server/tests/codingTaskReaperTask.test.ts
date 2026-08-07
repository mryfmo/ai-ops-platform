/**
 * packages/server/tests/codingTaskReaperTask.test.ts
 *
 * 根拠: ADR-0006 / DevOps:REQ-028。callback喪失でrunningのまま滞留したcoding_tasksを
 *   回収し、必ず監査に残すこと、および実行中のジョブを経過時間だけで終端させないことを検証する。
 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog, type PgQueryable, type WorkflowRunSummary } from "@aiops/shared";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import {
  classifyStaleRun,
  CODING_TASK_WORKFLOW_FILE,
  createCodingTaskReaperTask,
  DEFAULT_CODING_TASK_TIMEOUT_MINUTES,
} from "../src/scheduler/tasks/codingTaskReaperTask.js";

interface HarnessOptions {
  runs?: WorkflowRunSummary[];
  runsError?: Error;
  omitGithubClient?: boolean;
  unmappedProject?: boolean;
  updateRowCount?: number;
}

function makeHarness(staleRows: Array<Record<string, unknown>>, options: HarnessOptions = {}) {
  const calls: Array<{ text: string; params: unknown[] | undefined }> = [];
  const lookups: Array<{ owner: string; repo: string; input: Record<string, unknown> }> = [];
  const db: PgQueryable = {
    query: async (text, params) => {
      calls.push({ text, params });
      if (text.trim().startsWith("SELECT")) return { rows: staleRows };
      return { rows: [], rowCount: options.updateRowCount ?? 1 };
    },
  };
  const auditLog = new InMemoryAuditLog();
  const task = createCodingTaskReaperTask({
    codingTasksRepo: new CodingTasksRepo(db),
    auditLog,
    traceIdProvider: () => "trace-reaper",
    resolveRepoForProject: async () => (options.unmappedProject ? null : { githubOwner: "o", githubRepo: "r" }),
    githubClient: options.omitGithubClient
      ? undefined
      : {
          listWorkflowRuns: async (owner, repo, input) => {
            lookups.push({ owner, repo, input });
            if (options.runsError) throw options.runsError;
            return options.runs ?? [];
          },
        },
  });
  return { task, calls, auditLog, lookups };
}

const AT = new Date("2026-08-05T00:00:00.000Z");
const updateCalls = (calls: Array<{ text: string }>) => calls.filter((c) => c.text.includes("SET status = 'failed'"));

describe("coding task reaper [ADR-0006 / DevOps:REQ-028]", () => {
  it("実行が観測されないtimeout超過タスクをfailedへ終端し監査に残す", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runs: [],
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)[0]!.params).toEqual(["t-1"]);
    const logs = await h.auditLog.readAll();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe("coding_task_reaped_stale_running");
    expect(logs[0]!.detail).toMatchObject({ taskId: "t-1", projectId: "PJ-001", observed: "no_run_observed" });
  });

  it("完了済みrunだけならcallback喪失として回収し、conclusionを監査に残す", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runs: [{ id: 9, status: "completed", conclusion: "success" }],
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)).toHaveLength(1);
    const logs = await h.auditLog.readAll();
    expect(logs[0]!.detail).toMatchObject({ observed: "all_runs_completed", conclusions: ["success"] });
  });

  it("runner待ちでqueuedのままのrunがあれば回収しない（経過時間で終端させない）", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runs: [{ id: 9, status: "queued", conclusion: null }],
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)).toHaveLength(0);
    expect(await h.auditLog.readAll()).toHaveLength(0);
  });

  it("ワークフローとconfirmed_at以降で観測する（dispatchのrefはmainで作業ブランチは紐づかない）", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runs: [],
    });

    await h.task.run(AT);

    expect(h.lookups).toEqual([
      {
        owner: "o",
        repo: "r",
        input: {
          workflowFileName: CODING_TASK_WORKFLOW_FILE,
          event: "workflow_dispatch",
          createdSince: "2026-08-04T00:00:00.000Z",
        },
      },
    ]);
  });

  it("GitHubクライアントが無ければ観測不能として回収せず理由を監査に残す", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      omitGithubClient: true,
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)).toHaveLength(0);
    const logs = await h.auditLog.readAll();
    expect(logs[0]!.action).toBe("coding_task_reap_skipped_unobservable");
  });

  it("run照会が失敗しても回収せず、例外文字列はサニタイズして監査する", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runsError: new Error("token ghp_0123456789abcdefghijklmnopqrstuvwxyzAB rejected"),
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)).toHaveLength(0);
    const detail = (await h.auditLog.readAll())[0]!.detail as { error: string };
    expect(detail.error).not.toContain("ghp_0123456789abcdefghijklmnopqrstuvwxyzAB");
    expect(detail.error).toContain("REDACTED");
  });

  it("リポジトリ未対応のprojectは回収せず理由を監査に残す", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      unmappedProject: true,
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)).toHaveLength(0);
    expect((await h.auditLog.readAll())[0]!.action).toBe("coding_task_reap_skipped_unobservable");
  });

  it("更新が0行なら監査に書かない（追記専用ログへ嘘を残さない）", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runs: [],
      updateRowCount: 0,
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)).toHaveLength(1);
    expect(await h.auditLog.readAll()).toHaveLength(0);
  });

  it("対象が無ければ何も更新せず監査も書かない", async () => {
    const h = makeHarness([]);

    await h.task.run(AT);

    expect(h.calls.filter((c) => !c.text.trim().startsWith("SELECT"))).toHaveLength(0);
    expect(await h.auditLog.readAll()).toHaveLength(0);
  });

  it("既定のtimeoutはActions側の上限(30分)より長い", () => {
    expect(DEFAULT_CODING_TASK_TIMEOUT_MINUTES).toBeGreaterThan(30);
  });

  it("failedへの更新はrunningの行だけを対象にする（遅延callbackとの競合対策）", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001", confirmed_at: "2026-08-04T00:00:00.000Z" }], {
      runs: [],
    });

    await h.task.run(AT);

    expect(updateCalls(h.calls)[0]!.text).toContain("status = 'running'");
  });
});

describe("classifyStaleRun [ADR-0006]", () => {
  it("完了していないrunが1件でもあれば回収しない", () => {
    expect(
      classifyStaleRun([
        { id: 1, status: "completed", conclusion: "failure" },
        { id: 2, status: "in_progress", conclusion: null },
      ]),
    ).toEqual({ reap: false, reason: "still_executing" });
  });

  it("run皆無はdispatchが実体化しなかったとみなす", () => {
    expect(classifyStaleRun([])).toEqual({ reap: true, reason: "no_run_observed", conclusions: [] });
  });

  it("conclusion欠落はunknownとして記録する", () => {
    expect(classifyStaleRun([{ id: 1, status: "completed", conclusion: null }])).toEqual({
      reap: true,
      reason: "all_runs_completed",
      conclusions: ["unknown"],
    });
  });
});
