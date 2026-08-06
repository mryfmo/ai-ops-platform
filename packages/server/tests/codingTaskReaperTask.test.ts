/**
 * packages/server/tests/codingTaskReaperTask.test.ts
 *
 * 根拠: ADR-0006 / DevOps:REQ-028。callback喪失でrunningのまま滞留したcoding_tasksを
 *   回収し、必ず監査に残すことを検証する。
 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog, type PgQueryable } from "@aiops/shared";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import {
  createCodingTaskReaperTask,
  DEFAULT_CODING_TASK_TIMEOUT_MINUTES,
} from "../src/scheduler/tasks/codingTaskReaperTask.js";

function makeHarness(staleRows: Array<Record<string, unknown>>) {
  const calls: Array<{ text: string; params: unknown[] | undefined }> = [];
  const db: PgQueryable = {
    query: async (text, params) => {
      calls.push({ text, params });
      if (text.trim().startsWith("SELECT")) return { rows: staleRows };
      return { rows: [], rowCount: 1 };
    },
  };
  const auditLog = new InMemoryAuditLog();
  const task = createCodingTaskReaperTask({
    codingTasksRepo: new CodingTasksRepo(db),
    auditLog,
    traceIdProvider: () => "trace-reaper",
  });
  return { task, calls, auditLog };
}

describe("coding task reaper [ADR-0006 / DevOps:REQ-028]", () => {
  it("timeoutを過ぎたrunningをfailedへ終端し監査に残す", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001" }]);

    await h.task.run(new Date("2026-08-05T00:00:00.000Z"));

    const update = h.calls.find((c) => c.text.includes("SET status = 'failed'"));
    expect(update).toBeDefined();
    expect(update!.params).toEqual(["t-1"]);
    const logs = await h.auditLog.readAll();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe("coding_task_reaped_stale_running");
    expect(logs[0]!.detail).toMatchObject({ taskId: "t-1", projectId: "PJ-001" });
  });

  it("対象が無ければ何も更新せず監査も書かない", async () => {
    const h = makeHarness([]);

    await h.task.run(new Date("2026-08-05T00:00:00.000Z"));

    expect(h.calls.filter((c) => !c.text.trim().startsWith("SELECT"))).toHaveLength(0);
    expect(await h.auditLog.readAll()).toHaveLength(0);
  });

  it("既定のtimeoutはActions側の上限(30分)より長い", () => {
    expect(DEFAULT_CODING_TASK_TIMEOUT_MINUTES).toBeGreaterThan(30);
  });

  it("failedへの更新はrunningの行だけを対象にする（遅延callbackとの競合対策）", async () => {
    const h = makeHarness([{ task_id: "t-1", project_id: "PJ-001" }]);

    await h.task.run(new Date("2026-08-05T00:00:00.000Z"));

    const update = h.calls.find((c) => c.text.includes("SET status = 'failed'"));
    expect(update!.text).toContain("status = 'running'");
  });
});
