/**
 * packages/server/src/db/actionLedgerRepo.ts
 *
 * 根拠: FinalArch:CON-003 / ADR-0020 / DELTA-03。
 * 外部副作用の冪等 ledger。(system, operation, resource_key, input_hash) の一意制約で
 * 二重実行を防ぐ。承認を要する操作は既存 approvals(approval_id) を参照する
 * （承認の並行正本を作らない）。
 */
import type { PgQueryable } from "@aiops/shared";

export type ActionLedgerStatus =
  | "planned"
  | "approval_pending"
  | "approved"
  | "applying"
  | "applied"
  | "rejected"
  | "failed"
  | "unknown"
  | "compensated";

export interface PlannedOperation {
  operationId: string;
  workflowId: string;
  system: string;
  operation: string;
  resourceKey: string;
  inputHash: string;
  approvalId: string | null;
  traceId: string;
}

export class ActionLedgerRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * 操作の計画を冪等に記録する。既に同一冪等キーの行があれば挿入せず false を返す
   * （呼び出し側は既存 operation の状態に合流する）。
   */
  async plan(op: PlannedOperation): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO action_ledger (
         operation_id, workflow_id, system, operation, resource_key,
         input_hash, status, approval_id, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7, $8)
       ON CONFLICT (system, operation, resource_key, input_hash) DO NOTHING`,
      [op.operationId, op.workflowId, op.system, op.operation, op.resourceKey, op.inputHash, op.approvalId, op.traceId],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async updateStatus(
    operationId: string,
    status: ActionLedgerStatus,
    fields: { externalId?: string | null; externalVersion?: string | null; lastErrorClass?: string | null } = {},
  ): Promise<void> {
    await this.db.query(
      `UPDATE action_ledger SET
         status = $2,
         external_id = COALESCE($3, external_id),
         external_version = COALESCE($4, external_version),
         last_error_class = $5,
         attempt_count = attempt_count + CASE WHEN $2 = 'applying' THEN 1 ELSE 0 END,
         updated_at = now()
       WHERE operation_id = $1`,
      [operationId, status, fields.externalId ?? null, fields.externalVersion ?? null, fields.lastErrorClass ?? null],
    );
  }

  async findByIdempotencyKey(
    system: string,
    operation: string,
    resourceKey: string,
    inputHash: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.db.query(
      `SELECT * FROM action_ledger
        WHERE system = $1 AND operation = $2 AND resource_key = $3 AND input_hash = $4`,
      [system, operation, resourceKey, inputHash],
    );
    return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
  }
}
