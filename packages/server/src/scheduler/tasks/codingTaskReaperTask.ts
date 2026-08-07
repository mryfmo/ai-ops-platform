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
 * そこで実行状態を観測してから判断する。ただし個別の run は特定できない。
 * workflow_dispatch は run ID を返さず、dispatch の ref は `main`（ワークフロー定義の
 * あるブランチ）であって、ジョブが自前で作る `agent/<task_id>` は run に紐づかないため、
 * ブランチ名も相関キーにならない。観測できる粒度は「coding-task.yml の、confirmed_at
 * 以降の workflow_dispatch 実行」までである。
 *
 * この粗さは安全側へ倒して使う。未完了の run が1つでもあれば、それが当該タスクのもので
 * ある可能性を排除できないので回収しない。回収を遅らせるだけで、誤って終端させない。
 * 逆に「未完了ゼロ」なら当該タスクの run も（存在するなら）完了しているので回収してよい。
 *
 * 観測できないときは回収しない。破壊的なのは回収する側なので、GitHub 未設定・API 失敗・
 * リポジトリ未解決はすべて running のまま残す方向へ倒し、理由を監査に記録する。
 *
 * lib/agents分離（CLAUDE.md原則1）: 回収可否の判定は純粋関数として
 * `src/lib/codingTaskReap.ts` に置き、本ファイルは台帳・GitHub・監査の結線に徹する。
 */
import type { ScheduledTask } from "../scheduler.js";
import type { CodingTasksRepo } from "../../db/codingTasksRepo.js";
import type { AuditLogWriter, WorkflowRunListing } from "@aiops/shared";
import { sanitizeSecrets } from "@aiops/shared";
import { classifyStaleRun, runLookbackSince } from "../../lib/codingTaskReap.js";

/**
 * GitHub Actions 側の上限（coding-task.yml の timeout-minutes: 30）を超える値にする。
 * 実行中のジョブを誤って failed にしないため、既定は倍の余裕を取る。
 */
export const DEFAULT_CODING_TASK_TIMEOUT_MINUTES = 60;

/** 観測対象のワークフロー。confirm ルートの dispatch 先と一致させること。 */
export const CODING_TASK_WORKFLOW_FILE = "coding-task.yml";

export interface CodingTaskReaperGithubClient {
  listWorkflowRuns(
    owner: string,
    repo: string,
    input: { workflowFileName: string; event?: string; createdSince?: string },
  ): Promise<WorkflowRunListing>;
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

        let listing: WorkflowRunListing;
        try {
          listing = await githubClient.listWorkflowRuns(scope.githubOwner, scope.githubRepo, {
            workflowFileName: CODING_TASK_WORKFLOW_FILE,
            event: "workflow_dispatch",
            // DBとGitHubの時計ずれで当該runが下限を下回るのを防ぐため手前へ広げる。
            createdSince: runLookbackSince(task.confirmedAt),
          });
        } catch (error) {
          await audit("coding_task_reap_skipped_unobservable", {
            reason: "workflow run lookup failed",
            taskId: task.taskId,
            error: sanitizeSecrets(String(error)).sanitized,
          });
          continue;
        }

        const decision = classifyStaleRun(listing);
        if (!decision.reap) {
          if (decision.reason === "observation_incomplete") {
            await audit("coding_task_reap_skipped_unobservable", {
              reason: "workflow run listing was truncated before all runs were inspected",
              taskId: task.taskId,
              inspected: listing.runs.length,
            });
          }
          continue;
        }

        // 影響行数を見てから監査する。findStaleRunning 以降に callback が着地した、
        // あるいは別リビジョンが先に回収した場合、追記専用の監査へ嘘を残さない。
        const { updated } = await deps.codingTasksRepo.markDispatchFailed(task.taskId);
        if (!updated) continue;

        await audit("coding_task_reaped_stale_running", {
          taskId: task.taskId,
          projectId: task.projectId,
          confirmedAt: task.confirmedAt,
          timeoutMinutes,
          observed: decision.reason,
          conclusions: decision.conclusions,
        });
      }
    },
  };
}
