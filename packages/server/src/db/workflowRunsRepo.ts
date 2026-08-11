/**
 * packages/server/src/db/workflowRunsRepo.ts
 *
 * 根拠: FinalArch:FR-CP-001 / FinalArch:CON-003 / ADR-0020。
 * workflow の read model。実行履歴の正本は Temporal（P3-T01）で、本テーブルは
 * UI/照会用の投影。更新は version CAS で楽観制御する。
 */
import type { PgQueryable } from "@aiops/shared";

export type WorkflowRunStatus = "accepted" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface WorkflowRunStart {
  workflowId: string;
  runId: string;
  workflowType: string;
  businessKey: string;
  projectId: string | null;
  traceId: string;
  correlationId: string;
  startedAt: string;
}

export class WorkflowRunsRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * workflow 開始の投影。同一 (workflow_id, run_id) の replay は no-op（false）。
   * 別 run_id は意図的な新 run 置換として全状態を一貫リセットする
   * （status/step/waiting/completed_at/trace/correlation/project/started_at）。
   */
  async recordStart(run: WorkflowRunStart): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO workflow_runs (
         workflow_id, run_id, workflow_type, business_key, project_id,
         status, version, trace_id, correlation_id, started_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'accepted', 0, $6, $7, $8, now())
       ON CONFLICT (workflow_id) DO UPDATE SET
         run_id = EXCLUDED.run_id,
         status = 'accepted',
         current_step = NULL,
         waiting_reason = NULL,
         completed_at = NULL,
         project_id = EXCLUDED.project_id,
         trace_id = EXCLUDED.trace_id,
         correlation_id = EXCLUDED.correlation_id,
         started_at = EXCLUDED.started_at,
         version = workflow_runs.version + 1,
         updated_at = now()
       WHERE workflow_runs.run_id <> EXCLUDED.run_id`,
      [
        run.workflowId,
        run.runId,
        run.workflowType,
        run.businessKey,
        run.projectId,
        run.traceId,
        run.correlationId,
        run.startedAt,
      ],
    );
    return (result.rowCount ?? 0) === 1;
  }

  /** version CAS 付き状態遷移。競合時は false（呼び出し側が再読して再試行）。 */
  async transition(
    workflowId: string,
    expectedVersion: number,
    status: WorkflowRunStatus,
    currentStep: string | null,
    waitingReason: string | null,
  ): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE workflow_runs SET
         status = $3,
         current_step = $4,
         waiting_reason = $5,
         version = version + 1,
         updated_at = now(),
         completed_at = CASE WHEN $3 IN ('completed', 'failed', 'cancelled') THEN now() ELSE completed_at END
       WHERE workflow_id = $1 AND version = $2`,
      [workflowId, expectedVersion, status, currentStep, waitingReason],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async findById(workflowId: string): Promise<Record<string, unknown> | null> {
    const result = await this.db.query(`SELECT * FROM workflow_runs WHERE workflow_id = $1`, [workflowId]);
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }
}
