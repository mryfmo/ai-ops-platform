/**
 * packages/server/src/db/approvalsRepo.ts
 *
 * 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / AUD-OPM-001。
 * pending→approved|rejectedだけをDB CASで許可し、成立した状態遷移だけを追記監査する。
 */
import { sanitizeSecrets, validateReasonRequirement, type AuditLogWriter, type PgQueryable } from "@aiops/shared";

export type ApprovalType = "change" | "report" | "jit_grant";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalDecision = Exclude<ApprovalStatus, "pending">;

export interface ApprovalRecord {
  approvalId: string;
  approvalType: ApprovalType;
  targetId: string;
  projectId: string | null;
  status: ApprovalStatus;
  requestedBy: string;
  approverTenantId: string | null;
  approverObjectId: string | null;
  decidedAt: string | null;
  reason: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface CreateApprovalInput {
  approvalType: ApprovalType;
  targetId: string;
  projectId?: string;
  requestedBy: string;
  traceId: string;
}

export interface DecideApprovalInput {
  decision: ApprovalDecision;
  reason?: string;
  approverTenantId: string;
  approverObjectId: string;
  traceId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APPROVAL_TYPES = new Set<ApprovalType>(["change", "report", "jit_grant"]);
export const APPROVAL_REASON_MAX_LENGTH = 2_000;

export interface ApprovalTransactionContext {
  db: PgQueryable;
  auditLog: AuditLogWriter;
}

export type ApprovalTransactionRunner = <T>(work: (context: ApprovalTransactionContext) => Promise<T>) => Promise<T>;

export class ApprovalNotFoundError extends Error {
  constructor(approvalId: string) {
    super(`Approval ${approvalId} was not found`);
    this.name = "ApprovalNotFoundError";
  }
}

export class ApprovalAlreadyDecidedError extends Error {
  constructor(
    approvalId: string,
    public readonly status: ApprovalStatus,
  ) {
    super(`Approval ${approvalId} is already ${status}`);
    this.name = "ApprovalAlreadyDecidedError";
  }
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Invalid approval ${field}`);
  return trimmed;
}

function requiredUuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new Error(`Invalid approval ${field}`);
  return value;
}

function toApprovalRecord(row: Record<string, unknown>): ApprovalRecord {
  return {
    approvalId: String(row.approval_id),
    approvalType: row.approval_type as ApprovalType,
    targetId: String(row.target_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    status: row.status as ApprovalStatus,
    requestedBy: String(row.requested_by),
    approverTenantId: row.approver_tenant_id == null ? null : String(row.approver_tenant_id),
    approverObjectId: row.approver_object_id == null ? null : String(row.approver_object_id),
    decidedAt: row.decided_at == null ? null : new Date(String(row.decided_at)).toISOString(),
    reason: row.reason == null ? null : String(row.reason),
    deliveredAt: row.delivered_at == null ? null : new Date(String(row.delivered_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

const COLUMNS = `approval_id, approval_type, target_id, project_id, status, requested_by,
  approver_tenant_id, approver_object_id, decided_at, reason, delivered_at, created_at`;

export class ApprovalsRepo {
  constructor(
    private readonly db: PgQueryable,
    private readonly runTransaction: ApprovalTransactionRunner,
  ) {}

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    if (!APPROVAL_TYPES.has(input.approvalType)) throw new Error("Invalid approval type");
    const targetId = requiredText(input.targetId, "target_id");
    const projectId = input.projectId === undefined ? null : requiredText(input.projectId, "project_id");
    const requestedBy = requiredText(input.requestedBy, "requested_by");
    return this.runTransaction(async ({ db, auditLog }) => {
      const result = await db.query(
        `INSERT INTO approvals (approval_type, target_id, project_id, requested_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (approval_type, target_id) WHERE status = 'pending' DO NOTHING
         RETURNING ${COLUMNS}`,
        [input.approvalType, targetId, projectId, requestedBy],
      );
      if (!result.rows[0]) {
        const existing = await db.query(
          `SELECT ${COLUMNS}
           FROM approvals
           WHERE approval_type = $1 AND target_id = $2 AND status = 'pending'`,
          [input.approvalType, targetId],
        );
        if (!existing.rows[0]) throw new Error("Pending approval conflict could not be resolved");
        const approval = toApprovalRecord(existing.rows[0]);
        if (approval.projectId !== projectId) throw new Error("Pending approval project mismatch");
        return approval;
      }
      const approval = toApprovalRecord(result.rows[0]);
      await auditLog.append({
        trace_id: input.traceId,
        actor: requestedBy,
        action: "approval_create",
        basis: "DevOps:SPEC-EXT-010/AUD-OPM-001",
        detail: {
          approvalId: approval.approvalId,
          approvalType: approval.approvalType,
          targetId: approval.targetId,
          projectId: approval.projectId,
          status: approval.status,
        },
        at: new Date().toISOString(),
      });
      return approval;
    });
  }

  async listPending(approvalTypes: ApprovalType[]): Promise<ApprovalRecord[]> {
    if (approvalTypes.length === 0 || approvalTypes.some((type) => !APPROVAL_TYPES.has(type))) {
      throw new Error("Invalid approval type filter");
    }
    const result = await this.db.query(
      `SELECT ${COLUMNS}
       FROM approvals
       WHERE status = 'pending'
         AND delivered_at IS NOT NULL
         AND approval_type = ANY($1::text[])
       ORDER BY created_at, approval_id`,
      [approvalTypes],
    );
    return result.rows.map(toApprovalRecord);
  }

  async getById(approvalId: string): Promise<ApprovalRecord | null> {
    requiredUuid(approvalId, "approval_id");
    const result = await this.db.query(
      `SELECT ${COLUMNS}
       FROM approvals
       WHERE approval_id = $1::uuid AND delivered_at IS NOT NULL`,
      [approvalId],
    );
    return result.rows[0] ? toApprovalRecord(result.rows[0]) : null;
  }

  async markDelivered(approvalId: string, traceId: string): Promise<ApprovalRecord> {
    requiredUuid(approvalId, "approval_id");
    return this.runTransaction(async ({ db, auditLog }) => {
      const result = await db.query(
        `UPDATE approvals
         SET delivered_at = now()
         WHERE approval_id = $1::uuid AND status = 'pending' AND delivered_at IS NULL
         RETURNING ${COLUMNS}`,
        [approvalId],
      );
      if (!result.rows[0]) {
        const existing = await db.query(`SELECT ${COLUMNS} FROM approvals WHERE approval_id = $1::uuid`, [approvalId]);
        if (!existing.rows[0]) throw new ApprovalNotFoundError(approvalId);
        const approval = toApprovalRecord(existing.rows[0]);
        if (approval.status !== "pending") throw new ApprovalAlreadyDecidedError(approvalId, approval.status);
        return approval;
      }
      const approval = toApprovalRecord(result.rows[0]);
      await auditLog.append({
        trace_id: traceId,
        actor: "AGT-CHG",
        action: "approval_delivered",
        basis: "DevOps:SPEC-EXT-010/AUD-OPM-001",
        detail: { approvalId, approvalType: approval.approvalType, targetId: approval.targetId },
        at: new Date().toISOString(),
      });
      return approval;
    });
  }

  async decide(approvalId: string, input: DecideApprovalInput): Promise<ApprovalRecord> {
    requiredUuid(approvalId, "approval_id");
    requiredUuid(input.approverTenantId, "approver_tenant_id");
    requiredUuid(input.approverObjectId, "approver_object_id");
    if (input.decision !== "approved" && input.decision !== "rejected") throw new Error("Invalid approval decision");
    const rawReason = input.reason?.trim() || undefined;
    if (rawReason && rawReason.length > APPROVAL_REASON_MAX_LENGTH) throw new Error("Invalid approval reason");
    const reason = rawReason ? sanitizeSecrets(rawReason).sanitized : undefined;
    if (input.decision === "rejected") validateReasonRequirement("approval_reject", reason);

    return this.runTransaction(async ({ db, auditLog }) => {
      const result = await db.query(
        `UPDATE approvals
         SET status = $2, approver_tenant_id = $3::uuid, approver_object_id = $4::uuid,
             decided_at = now(), reason = $5
         WHERE approval_id = $1::uuid AND status = 'pending'
         RETURNING ${COLUMNS}`,
        [approvalId, input.decision, input.approverTenantId, input.approverObjectId, reason ?? null],
      );
      if (!result.rows[0]) {
        const existing = await db.query("SELECT status FROM approvals WHERE approval_id = $1::uuid", [approvalId]);
        const status = existing.rows[0]?.status as ApprovalStatus | undefined;
        if (!status) throw new ApprovalNotFoundError(approvalId);
        throw new ApprovalAlreadyDecidedError(approvalId, status);
      }

      const approval = toApprovalRecord(result.rows[0]);
      await auditLog.append({
        trace_id: input.traceId,
        actor: `ENTRA:${input.approverTenantId}:${input.approverObjectId}`,
        action: input.decision === "approved" ? "approval_approve" : "approval_reject",
        basis: "DevOps:SPEC-EXT-010/DevOps:REQ-028/AUD-OPM-001",
        detail: {
          approvalId,
          approvalType: approval.approvalType,
          targetId: approval.targetId,
          projectId: approval.projectId,
          approverTenantId: input.approverTenantId,
          approverObjectId: input.approverObjectId,
          ...(reason ? { reason } : {}),
        },
        reason,
        at: new Date().toISOString(),
      });
      return approval;
    });
  }
}
