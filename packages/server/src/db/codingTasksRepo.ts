/**
 * packages/server/src/db/codingTasksRepo.ts
 *
 * 根拠: ADR-0006（AIコーディングタスク台帳。Teams/WebUI発の指示→確認→GitHub Actions実行→
 *   PR作成までの状態追跡）。coding_tasksテーブル定義は packages/devops/src/db/schema.sql、
 *   状態機械（queued → running → pr_created | failed | cancelled）は
 *   runbooks/coding-task-failure.md と一致させること。
 *   confirmed_at / confirm_token_hash 列は本タスクでのMIGRATIONS追加（誤発火防止の確認フロー用）。
 *
 * 設計: 既存 packages/server/src/db/projectChannelsRepo.ts 等と同じく PgQueryable
 *   （@aiops/shared）を注入し、pg.Poolへの直接依存を持たずネットワークなしでテストできる形にする。
 */
import type { PgQueryable } from "@aiops/shared";

export type CodingTaskStatus = "queued" | "running" | "pr_created" | "failed" | "cancelled";
export type CodingTaskSource = "teams" | "webui";
export type CodingTaskAgent = "claude-code" | "droid";

export interface CodingTaskRecord {
  taskId: string;
  projectId: string;
  requestedBy: string;
  source: CodingTaskSource;
  instruction: string;
  agent: CodingTaskAgent;
  status: CodingTaskStatus;
  workflowRunId: number | null;
  prUrl: string | null;
  branch: string | null;
  traceId: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertCodingTaskInput {
  taskId: string;
  projectId: string;
  requestedBy: string;
  source: CodingTaskSource;
  instruction: string;
  agent: CodingTaskAgent;
  traceId: string;
  /** confirmToken.tsで生成したトークンのハッシュ（平文トークンはDBに保存しない） */
  confirmTokenHash: string;
}

export interface MarkConfirmedAndDispatchedInput {
  workflowRunId?: number | null;
}

export interface UpdateFromCallbackInput {
  status: Extract<CodingTaskStatus, "pr_created" | "failed" | "cancelled">;
  prUrl?: string | null;
  branch?: string | null;
  workflowRunId?: number | null;
}

function toCodingTaskRecord(r: Record<string, unknown>): CodingTaskRecord {
  return {
    taskId: String(r.task_id),
    projectId: String(r.project_id),
    requestedBy: String(r.requested_by),
    source: r.source as CodingTaskSource,
    instruction: String(r.instruction),
    agent: r.agent as CodingTaskAgent,
    status: r.status as CodingTaskStatus,
    workflowRunId: r.workflow_run_id === null || r.workflow_run_id === undefined ? null : Number(r.workflow_run_id),
    prUrl: r.pr_url ? String(r.pr_url) : null,
    branch: r.branch ? String(r.branch) : null,
    traceId: String(r.trace_id),
    confirmedAt: r.confirmed_at ? new Date(String(r.confirmed_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

export class CodingTasksRepo {
  constructor(private readonly db: PgQueryable) {}

  /** status='queued'固定でINSERTする（確認前。ADR-0006「人間の明示クリック必須」）。 */
  async insert(input: InsertCodingTaskInput): Promise<CodingTaskRecord> {
    const res = await this.db.query(
      `INSERT INTO coding_tasks
         (task_id, project_id, requested_by, source, instruction, agent, status, trace_id, confirm_token_hash)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7, $8)
       RETURNING task_id, project_id, requested_by, source, instruction, agent, status,
                 workflow_run_id, pr_url, branch, trace_id, confirmed_at, created_at, updated_at`,
      [
        input.taskId,
        input.projectId,
        input.requestedBy,
        input.source,
        input.instruction,
        input.agent,
        input.traceId,
        input.confirmTokenHash,
      ],
    );
    return toCodingTaskRecord(res.rows[0]!);
  }

  async findById(taskId: string): Promise<CodingTaskRecord | null> {
    const res = await this.db.query(
      `SELECT task_id, project_id, requested_by, source, instruction, agent, status,
              workflow_run_id, pr_url, branch, trace_id, confirmed_at, created_at, updated_at
       FROM coding_tasks WHERE task_id = $1`,
      [taskId],
    );
    const row = res.rows[0];
    return row ? toCodingTaskRecord(row) : null;
  }

  /** 確認クリック成立時: confirmed_atを刻み、status='running'へ遷移する（workflow_dispatch成功後に呼ぶ）。 */
  async markConfirmedAndDispatched(taskId: string, input: MarkConfirmedAndDispatchedInput = {}): Promise<void> {
    await this.db.query(
      `UPDATE coding_tasks
       SET status = 'running', confirmed_at = now(), workflow_run_id = $2, updated_at = now()
       WHERE task_id = $1`,
      [taskId, input.workflowRunId ?? null],
    );
  }

  /**
   * 確認クリックをDB側で原子的に確保する（ADR-0006「誤発火防止」）。
   *
   * ルート側の findById → status 判定 → dispatchWorkflow はチェックと更新が分かれており、
   * 同一トークンで confirm を並行送信すると両方が判定を通過して二重 dispatch し得る。
   * coding-task.yml の concurrency はキャンセルせずキューするため、2本目も実行され
   * 同名ブランチへのpushで衝突する。dispatch より前にここで確保し、更新行が無ければ
   * 既に他が確保済みとして扱う。
   */
  async claimForDispatch(taskId: string): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE coding_tasks
       SET status = 'running', confirmed_at = now(), updated_at = now()
       WHERE task_id = $1 AND status = 'queued' AND confirmed_at IS NULL
       RETURNING task_id`,
      [taskId],
    );
    return res.rows.length > 0;
  }

  /**
   * running のタスクを failed で終端させる（queuedへ戻さない。理由はルート側コメント参照）。
   *
   * 影響行数を返すのは、呼び出し側が「実際に遷移した場合だけ監査へ追記する」ためである。
   * 監査ログは追記専用（CLAUDE.md原則5）なので、遷移していないのに書いた記録は訂正できない。
   */
  async markDispatchFailed(taskId: string): Promise<{ updated: boolean }> {
    const res = await this.db.query(
      `UPDATE coding_tasks
       SET status = 'failed', updated_at = now()
       WHERE task_id = $1 AND status = 'running'`,
      [taskId],
    );
    return { updated: (res.rowCount ?? 0) > 0 };
  }

  /**
   * timeout を過ぎても running のまま残っているタスクを回収候補として返す（callback喪失対策）。
   * confirmed_at は呼び出し側が Actions の run 一覧を時刻で絞るために使う。
   */
  async findStaleRunning(
    olderThanMinutes: number,
  ): Promise<Array<{ taskId: string; projectId: string; confirmedAt: string }>> {
    const res = await this.db.query(
      `SELECT task_id, project_id, confirmed_at FROM coding_tasks
       WHERE status = 'running' AND confirmed_at IS NOT NULL
         AND confirmed_at < now() - ($1 || ' minutes')::interval`,
      [String(olderThanMinutes)],
    );
    return res.rows.map((r) => ({
      taskId: String(r["task_id"]),
      projectId: String(r["project_id"]),
      confirmedAt: new Date(r["confirmed_at"] as string | Date).toISOString(),
    }));
  }

  /**
   * GitHub Actions側からのcallback受信時: pr_created/failed/cancelledへ遷移する。
   * security-reviewer指摘(高): `WHERE status = 'running'`を追加し、未確認(queued)タスクへの
   * 偽装完了報告や、確定済みタスクへの多重callbackによる上書きをDB層でも拒否する
   * （HTTPルート側の事前チェックとあわせた多層防御。競合状態下でも原子的に保護する）。
   * 影響行数0（対象なし/既に遷移済み）はルート側で監査ログに記録する。
   */
  async updateFromCallback(taskId: string, input: UpdateFromCallbackInput): Promise<{ updated: boolean }> {
    const res = await this.db.query(
      `UPDATE coding_tasks
       SET status = $2, pr_url = $3, branch = $4, workflow_run_id = COALESCE($5, workflow_run_id), updated_at = now()
       WHERE task_id = $1 AND status = 'running'`,
      [taskId, input.status, input.prUrl ?? null, input.branch ?? null, input.workflowRunId ?? null],
    );
    return { updated: (res.rowCount ?? 0) > 0 };
  }
}
