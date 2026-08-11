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
  deploymentId: string | null;
  traceId: string;
}

export class ActionLedgerRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * 操作の計画を冪等に記録する。true = 新規計画、false = 既存の同一冪等キーに合流。
   * approval / deployment の authority 参照は workflow と同一 project のもののみ許す
   * （cross-project anchor は挿入 0 行 → RangeError。NULL project は厳密一致のみ許可 =
   * fail-closed）。
   */
  async plan(op: PlannedOperation): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO action_ledger (
         operation_id, workflow_id, system, operation, resource_key,
         input_hash, status, approval_id, deployment_id, trace_id
       )
       SELECT $1, w.workflow_id, $3, $4, $5, $6, 'planned', $7, $8, $9
         FROM workflow_runs w
        WHERE w.workflow_id = $2
          AND ($7::uuid IS NULL OR EXISTS (
                SELECT 1 FROM approvals a
                 WHERE a.approval_id = $7 AND a.project_id IS NOT DISTINCT FROM w.project_id))
          AND ($8::uuid IS NULL OR EXISTS (
                SELECT 1 FROM deployments d
                 WHERE d.deploy_id = $8 AND d.project_id IS NOT DISTINCT FROM w.project_id))
       ON CONFLICT (system, operation, resource_key, input_hash) DO NOTHING`,
      [
        op.operationId,
        op.workflowId,
        op.system,
        op.operation,
        op.resourceKey,
        op.inputHash,
        op.approvalId,
        op.deploymentId,
        op.traceId,
      ],
    );
    if ((result.rowCount ?? 0) === 1) return true;
    const existing = await this.findByIdempotencyKey(op.system, op.operation, op.resourceKey, op.inputHash);
    if (existing) {
      const sameScope =
        existing.workflow_id === op.workflowId &&
        ((existing.approval_id as string | null) ?? null) === op.approvalId &&
        ((existing.deployment_id as string | null) ?? null) === op.deploymentId;
      if (!sameScope) {
        throw new RangeError(
          "action plan rejected: idempotency key already claimed by a different workflow/authority scope",
        );
      }
      return false;
    }
    throw new RangeError(
      "action plan rejected: unknown workflow or cross-project authority reference (approval/deployment)",
    );
  }

  /**
   * 実行権の claim。planned/approved/failed の行を一撃の条件付き UPDATE で applying へ
   * 遷移させ、勝者だけが true を得る（重複 worker の同時実行を直列化。applying への
   * 遷移はこのメソッド以外から行えない）。unknown は claim 対象外 — 直前の
   * 非冪等書き込みが成功していた可能性があるため、resolveUnknown による照合を経る。
   */
  async claimExecution(operationId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE action_ledger SET
         status = 'applying',
         attempt_count = attempt_count + 1,
         updated_at = now()
       WHERE operation_id = $1 AND status IN ('planned', 'approved', 'failed')`,
      [operationId],
    );
    return (result.rowCount ?? 0) === 1;
  }

  /**
   * unknown の照合結果の記録（reconciler / 運用者の明示操作専用）。
   * 外部側の実結果を確認した上で applied / failed のどちらかへ確定させる。
   * 照合の根拠・証跡は本テーブルに書かず、既存の監査境界
   * （AuditLogWriter.append — sanitizeSecrets 済み・追記専用）で呼び出し側が記録する。
   */
  async resolveUnknown(operationId: string, resolved: "applied" | "failed"): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE action_ledger SET
         status = $2,
         last_error_class = CASE WHEN $2 = 'failed' THEN 'reconciled_failed' ELSE NULL END,
         updated_at = now()
       WHERE operation_id = $1 AND status = 'unknown'`,
      [operationId, resolved],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async updateStatus(
    operationId: string,
    status: Exclude<ActionLedgerStatus, "applying">,
    fields: { externalId?: string | null; externalVersion?: string | null; lastErrorClass?: string | null } = {},
  ): Promise<void> {
    if ((status as ActionLedgerStatus) === "applying") {
      throw new RangeError("applying へは claimExecution を使う（同時実行の直列化のため）");
    }
    await this.db.query(
      `UPDATE action_ledger SET
         status = $2,
         external_id = COALESCE($3, external_id),
         external_version = COALESCE($4, external_version),
         last_error_class = $5,
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
