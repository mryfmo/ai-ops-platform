/**
 * packages/server/src/scheduler/tasks/codingTaskReaperTask.ts
 *
 * 根拠: ADR-0006（coding_tasks台帳の状態管理）/ DevOps:REQ-028（外部作用の監査記録）。
 *   coding-task.yml の callback は `curl -sS` で送られ、-f もリトライも無い。サーバが
 *   5xx を返しても、あるいはサーバへ到達できなくても、ジョブは成功扱いで終わる。
 *   その結果 coding_tasks が running のまま永久に残り、回収する経路はどこにも無かった
 *   （workflow_run webhook のハンドラは監査追記のみで台帳を更新しない）。
 *
 * 経過時間だけで failed にしてはならない。confirmed_at は dispatch 時刻であって実行開始
 * 時刻ではなく、runner 枯渇や Actions 障害でジョブが queued のまま待つ間も進む。時間だけ
 * を根拠に終端させると、後から実際に走って PR を作ったジョブの callback が
 * `WHERE status = 'running'` に弾かれ、台帳と現実が食い違ったまま固定される。
 *
 * そこで実行状態を観測してから判断する。coding-task.yml がブランチを `agent/<task_id>` に
 * 固定しているため、ブランチ名が唯一の決定的な相関キーになる（workflow_dispatch は
 * run ID を返さないので dispatch 時点では追跡できない）。
 *
 * 観測できないときは回収しない。破壊的なのは回収する側なので、GitHub 未設定・API 失敗・
 * リポジトリ未解決はすべて running のまま残す方向へ倒し、理由を監査に記録する。
 *
 * lib/agents分離（CLAUDE.md原則1）: 観測結果から回収可否を決める判定は純粋関数
 * `classifyStaleRun()` に置き、本ファイルは台帳・GitHub・監査の結線に徹する。
 */
import type { ScheduledTask } from "../scheduler.js";
import type { CodingTasksRepo } from "../../db/codingTasksRepo.js";
import type { AuditLogWriter, WorkflowRunSummary } from "@aiops/shared";
import { sanitizeSecrets } from "@aiops/shared";

/**
 * GitHub Actions 側の上限（coding-task.yml の timeout-minutes: 30）を超える値にする。
 * 実行中のジョブを誤って failed にしないため、既定は倍の余裕を取る。
 */
export const DEFAULT_CODING_TASK_TIMEOUT_MINUTES = 60;

/** GitHub が run を完了扱いにするまでの status 値。これ以外は実行中/待機中とみなす。 */
const COMPLETED_RUN_STATUS = "completed";

export type StaleRunDecision =
  | { reap: false; reason: "still_executing" }
  | { reap: true; reason: "no_run_observed" | "all_runs_completed"; conclusions: string[] };

/**
 * 観測した run 一覧から回収可否を決める。
 *
 * 1件でも完了していない run があれば実行中とみなして回収しない（runner 待ちを含む）。
 * run が1件も無い場合は dispatch が実体化しなかったということなので回収する。
 */
export function classifyStaleRun(runs: WorkflowRunSummary[]): StaleRunDecision {
  if (runs.some((run) => run.status !== COMPLETED_RUN_STATUS)) return { reap: false, reason: "still_executing" };
  if (runs.length === 0) return { reap: true, reason: "no_run_observed", conclusions: [] };
  return {
    reap: true,
    reason: "all_runs_completed",
    conclusions: runs.map((run) => run.conclusion ?? "unknown"),
  };
}

export interface CodingTaskReaperGithubClient {
  listWorkflowRunsForBranch(owner: string, repo: string, branch: string): Promise<WorkflowRunSummary[]>;
}

export interface CodingTaskReaperTaskDeps {
  codingTasksRepo: CodingTasksRepo;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  /** taskIdのprojectIdから対象GitHubリポジトリを解決する（未登録ならnull） */
  resolveRepoForProject(projectId: string): Promise<{ githubOwner: string; githubRepo: string } | null>;
  /** 未設定なら観測不能として一切回収しない。 */
  githubClient?: CodingTaskReaperGithubClient;
  /** running のまま許容する分数。未指定なら DEFAULT_CODING_TASK_TIMEOUT_MINUTES。 */
  timeoutMinutes?: number;
}

export function createCodingTaskReaperTask(deps: CodingTaskReaperTaskDeps): ScheduledTask {
  const timeoutMinutes = deps.timeoutMinutes ?? DEFAULT_CODING_TASK_TIMEOUT_MINUTES;

  const audit = async (action: string, detail: Record<string, unknown>): Promise<void> => {
    await deps.auditLog.append({
      trace_id: deps.traceIdProvider(),
      actor: "SERVER",
      action,
      basis: "ADR-0006",
      detail,
      at: new Date().toISOString(),
    });
  };

  return {
    name: "coding-task-reaper-5m",
    intervalMs: 300_000,
    async run(): Promise<void> {
      const stale = await deps.codingTasksRepo.findStaleRunning(timeoutMinutes);
      if (stale.length === 0) return;

      const githubClient = deps.githubClient;
      if (!githubClient) {
        await audit("coding_task_reap_skipped_unobservable", {
          reason: "GitHub client is not configured",
          candidates: stale.length,
          timeoutMinutes,
        });
        return;
      }

      for (const task of stale) {
        const scope = await deps.resolveRepoForProject(task.projectId);
        if (!scope) {
          await audit("coding_task_reap_skipped_unobservable", {
            reason: "project has no GitHub repository mapping",
            taskId: task.taskId,
            projectId: task.projectId,
          });
          continue;
        }

        const branch = `agent/${task.taskId}`;
        let runs: WorkflowRunSummary[];
        try {
          runs = await githubClient.listWorkflowRunsForBranch(scope.githubOwner, scope.githubRepo, branch);
        } catch (error) {
          await audit("coding_task_reap_skipped_unobservable", {
            reason: "workflow run lookup failed",
            taskId: task.taskId,
            branch,
            error: sanitizeSecrets(String(error)).sanitized,
          });
          continue;
        }

        const decision = classifyStaleRun(runs);
        if (!decision.reap) continue;

        // 影響行数を見てから監査する。findStaleRunning 以降に callback が着地した、
        // あるいは別リビジョンが先に回収した場合、追記専用の監査へ嘘を残さない。
        const { updated } = await deps.codingTasksRepo.markDispatchFailed(task.taskId);
        if (!updated) continue;

        await audit("coding_task_reaped_stale_running", {
          taskId: task.taskId,
          projectId: task.projectId,
          branch,
          timeoutMinutes,
          observed: decision.reason,
          conclusions: decision.conclusions,
        });
      }
    },
  };
}
