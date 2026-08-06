/**
 * packages/server/src/scheduler/tasks/codingTaskReaperTask.ts
 *
 * 根拠: ADR-0006（coding_tasks台帳の状態管理）/ DevOps:REQ-028（外部作用の監査記録）。
 *   coding-task.yml の callback は `curl -sS` で送られ、-f もリトライも無い。サーバが
 *   5xx を返しても、あるいはサーバへ到達できなくても、ジョブは成功扱いで終わる。
 *   その結果 coding_tasks が running のまま永久に残り、回収する経路はどこにも無かった
 *   （workflow_run webhook のハンドラは監査追記のみで台帳を更新しない）。
 *   本タスクは timeout を過ぎた running を failed へ終端させ、必ず監査へ記録する。
 *
 * lib/agents分離（CLAUDE.md原則1）: 判定は「confirmed_at が閾値より古いか」のみで、
 *   SQL側の述語として表現している。本ファイルは台帳の読込と結果反映に徹する。
 */
import type { ScheduledTask } from "../scheduler.js";
import type { CodingTasksRepo } from "../../db/codingTasksRepo.js";
import type { AuditLogWriter } from "@aiops/shared";

/**
 * GitHub Actions 側の上限（coding-task.yml の timeout-minutes: 30）を超える値にする。
 * 実行中のジョブを誤って failed にしないため、既定は倍の余裕を取る。
 */
export const DEFAULT_CODING_TASK_TIMEOUT_MINUTES = 60;

export interface CodingTaskReaperTaskDeps {
  codingTasksRepo: CodingTasksRepo;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  /** running のまま許容する分数。未指定なら DEFAULT_CODING_TASK_TIMEOUT_MINUTES。 */
  timeoutMinutes?: number;
}

export function createCodingTaskReaperTask(deps: CodingTaskReaperTaskDeps): ScheduledTask {
  const timeoutMinutes = deps.timeoutMinutes ?? DEFAULT_CODING_TASK_TIMEOUT_MINUTES;
  return {
    name: "coding-task-reaper-5m",
    intervalMs: 300_000,
    async run(): Promise<void> {
      const stale = await deps.codingTasksRepo.findStaleRunning(timeoutMinutes);
      for (const task of stale) {
        await deps.codingTasksRepo.markDispatchFailed(task.taskId);
        await deps.auditLog.append({
          trace_id: deps.traceIdProvider(),
          actor: "SERVER",
          action: "coding_task_reaped_stale_running",
          basis: "ADR-0006",
          detail: { taskId: task.taskId, projectId: task.projectId, timeoutMinutes },
          at: new Date().toISOString(),
        });
      }
    },
  };
}
