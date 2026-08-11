/**
 * packages/server/src/db/agentRunsRepo.ts
 *
 * 根拠: ADR-0027 / FinalArch:GOV-005 / ADR-0020。AI コーディングタスクの実行台帳。
 * one-writer 契約（writer <> reviewer は DB CHECK でも強制）。task_id で冪等。
 */
import type { PgQueryable } from "@aiops/shared";

export interface AgentRunStart {
  agentRunId: string;
  workflowId: string | null;
  taskId: string;
  writer: string;
  reviewer: string;
  allowedPaths: string[];
  acceptanceGateIds: string[];
  traceId: string;
}

export class AgentRunsRepo {
  constructor(private readonly db: PgQueryable) {}

  /** task_id で冪等に開始を記録。既存 task は挿入せず false。 */
  async recordStart(run: AgentRunStart): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO agent_runs (
         agent_run_id, workflow_id, task_id, writer, reviewer,
         allowed_paths, acceptance_gate_ids, execution_evidence, status, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, 'started', $8)
       ON CONFLICT (task_id) DO NOTHING`,
      [
        run.agentRunId,
        run.workflowId,
        run.taskId,
        run.writer,
        run.reviewer,
        JSON.stringify(run.allowedPaths),
        JSON.stringify(run.acceptanceGateIds),
        run.traceId,
      ],
    );
    return (result.rowCount ?? 0) === 1;
  }

  /** 進捗と証跡の追記更新（execution_evidence は JSONB 配列へ append）。 */
  async recordProgress(
    taskId: string,
    status: string,
    fields: { branch?: string; commitSha?: string; pullRequestUrl?: string; evidence?: unknown } = {},
  ): Promise<void> {
    await this.db.query(
      `UPDATE agent_runs SET
         status = $2,
         branch = COALESCE($3, branch),
         commit_sha = COALESCE($4, commit_sha),
         pull_request_url = COALESCE($5, pull_request_url),
         execution_evidence = CASE WHEN $6::jsonb IS NULL THEN execution_evidence
                                   ELSE execution_evidence || $6::jsonb END,
         updated_at = now()
       WHERE task_id = $1`,
      [
        taskId,
        status,
        fields.branch ?? null,
        fields.commitSha ?? null,
        fields.pullRequestUrl ?? null,
        fields.evidence === undefined ? null : JSON.stringify([fields.evidence]),
      ],
    );
  }
}
