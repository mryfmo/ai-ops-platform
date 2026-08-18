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
  targetSha: string | null;
  status: ApprovalStatus;
  requestedBy: string;
  approverTenantId: string | null;
  approverObjectId: string | null;
  decidedAt: string | null;
  reason: string | null;
  deliveredAt: string | null;
  dispatchedAt: string | null;
  payloadHash: string | null;
  expectedVersion: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApprovalInput {
  approvalType: ApprovalType;
  targetId: string;
  projectId?: string;
  targetSha?: string;
  requestedBy: string;
  traceId: string;
}

export interface ApprovedDeployClaim {
  approvalId: string;
  deployId: string | null;
  projectId: string | null;
  commitSha: string | null;
  repositories: Array<{ owner: string; repo: string }>;
}

export type ApprovedDeployClaimReceipt =
  { readonly kind: "created"; readonly claim: ApprovedDeployClaim } | { readonly kind: "stale" };

export interface DecideApprovalInput {
  decision: ApprovalDecision;
  reason?: string;
  approverTenantId: string;
  approverObjectId: string;
  expectedVersion: number;
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

export class ApprovalStaleVersionError extends Error {
  constructor(
    approvalId: string,
    public readonly expectedVersion: number,
  ) {
    super(`Approval ${approvalId} does not match version ${expectedVersion}`);
    this.name = "ApprovalStaleVersionError";
  }
}

export class ApprovalExpiredError extends Error {
  constructor(approvalId: string) {
    super(`Approval ${approvalId} has expired`);
    this.name = "ApprovalExpiredError";
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
    targetSha: row.target_sha == null ? null : String(row.target_sha),
    status: row.status as ApprovalStatus,
    requestedBy: String(row.requested_by),
    approverTenantId: row.approver_tenant_id == null ? null : String(row.approver_tenant_id),
    approverObjectId: row.approver_object_id == null ? null : String(row.approver_object_id),
    decidedAt: row.decided_at == null ? null : new Date(String(row.decided_at)).toISOString(),
    reason: row.reason == null ? null : String(row.reason),
    deliveredAt: row.delivered_at == null ? null : new Date(String(row.delivered_at)).toISOString(),
    dispatchedAt: row.dispatched_at == null ? null : new Date(String(row.dispatched_at)).toISOString(),
    payloadHash: row.payload_hash == null ? null : String(row.payload_hash),
    expectedVersion: row.expected_version == null ? null : Number(row.expected_version),
    expiresAt: row.expires_at == null ? null : new Date(String(row.expires_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

const COLUMNS = `approval_id, approval_type, target_id, project_id, target_sha, status, requested_by,
  approver_tenant_id, approver_object_id, decided_at, reason, delivered_at, dispatched_at, payload_hash,
  expected_version, expires_at, created_at`;

export class ApprovalsRepo {
  constructor(
    private readonly db: PgQueryable,
    private readonly runTransaction: ApprovalTransactionRunner,
  ) {}

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    if (!APPROVAL_TYPES.has(input.approvalType)) throw new Error("Invalid approval type");
    const targetId = requiredText(input.targetId, "target_id");
    const projectId = input.projectId === undefined ? null : requiredText(input.projectId, "project_id");
    const targetSha = input.targetSha === undefined ? null : requiredText(input.targetSha, "target_sha");
    if (targetSha !== null && !/^[0-9a-f]{40}$/.test(targetSha)) throw new Error("Invalid approval target_sha");
    const requestedBy = requiredText(input.requestedBy, "requested_by");
    return this.runTransaction(async ({ db, auditLog }) => {
      const superseded = await db.query(
        `UPDATE approvals
         SET project_id = $3, target_sha = $4, requested_by = $5,
             expected_version = COALESCE(expected_version, 0) + 1,
             expires_at = now() + interval '60 minutes'
         WHERE approval_type = $1
           AND target_id = $2
           AND status = 'pending'
           AND (expires_at IS NULL OR expires_at <= now())
         RETURNING ${COLUMNS}`,
        [input.approvalType, targetId, projectId, targetSha, requestedBy],
      );
      if (superseded.rows[0]) {
        const approval = toApprovalRecord(superseded.rows[0]);
        await auditLog.append({
          trace_id: input.traceId,
          actor: requestedBy,
          action: "approval_supersede",
          basis: "DevOps:REQ-010/DevOps:SPEC-EXT-010/AUD-OPM-001",
          detail: {
            approvalId: approval.approvalId,
            approvalType: approval.approvalType,
            targetId: approval.targetId,
            projectId: approval.projectId,
            targetSha: approval.targetSha,
            status: approval.status,
            version: approval.expectedVersion,
          },
          at: new Date().toISOString(),
        });
        return approval;
      }
      const result = await db.query(
        `INSERT INTO approvals (
           approval_type, target_id, project_id, target_sha, requested_by, expected_version, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, 1, now() + interval '60 minutes')
         ON CONFLICT (approval_type, target_id) WHERE status = 'pending' DO NOTHING
         RETURNING ${COLUMNS}`,
        [input.approvalType, targetId, projectId, targetSha, requestedBy],
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
        if (approval.projectId !== projectId || approval.targetSha !== targetSha) {
          throw new Error("Pending approval target mismatch");
        }
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
          targetSha: approval.targetSha,
          status: approval.status,
        },
        at: new Date().toISOString(),
      });
      return approval;
    });
  }

  /** AC-010a: approved changeだけをCASで一度消費し、repo mappingは全候補を返して呼出側で一意性を強制する。 */
  async claimNextApprovedChange(traceId: string): Promise<ApprovedDeployClaim | null> {
    requiredUuid(traceId, "dispatch trace_id");
    return this.runTransaction(async ({ db, auditLog }) => {
      const result = await db.query(
        `WITH candidate AS (
         SELECT approval_id
         FROM approvals
         WHERE approval_type = 'change'
           AND status = 'approved'
           AND dispatched_at IS NULL
         ORDER BY decided_at, approval_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       ), mappings AS (
         SELECT candidate.approval_id,
                COALESCE(
                  jsonb_agg(jsonb_build_object('owner', pc.github_owner, 'repo', pc.github_repo))
                    FILTER (WHERE pc.github_owner IS NOT NULL AND btrim(pc.github_owner) <> ''
                              AND pc.github_repo IS NOT NULL AND btrim(pc.github_repo) <> ''),
                  '[]'::jsonb
                ) AS repo_mappings
         FROM candidate
         LEFT JOIN project_channels pc
           ON pc.project_id = (SELECT project_id FROM approvals WHERE approval_id = candidate.approval_id)
          AND pc.ingestion = 'active'
          AND pc.closed_at IS NULL
         GROUP BY candidate.approval_id
       ), claimed AS (
         UPDATE approvals
         SET dispatched_at = now()
         FROM candidate
         WHERE approvals.approval_id = candidate.approval_id
           AND approvals.dispatched_at IS NULL
         RETURNING approvals.*
       ), work_item AS (
         INSERT INTO deployments (
           project_id, github_owner, github_repo, commit_sha, env, state, trace_id
         )
         SELECT claimed.project_id,
                mappings.repo_mappings->0->>'owner',
                mappings.repo_mappings->0->>'repo',
                claimed.target_sha,
                'prod',
                'approved',
                $1::uuid
         FROM claimed
         JOIN mappings USING (approval_id)
         WHERE claimed.project_id IS NOT NULL
           AND claimed.target_sha IS NOT NULL
           AND jsonb_array_length(mappings.repo_mappings) = 1
         RETURNING deploy_id
       )
       SELECT claimed.*, mappings.repo_mappings,
              (SELECT deploy_id FROM work_item) AS deploy_id
       FROM claimed
       JOIN mappings USING (approval_id)`,
        [traceId],
      );
      const row = result.rows[0];
      if (!row) return null;
      const mappings = Array.isArray(row.repo_mappings) ? row.repo_mappings : [];
      const claim = {
        approvalId: String(row.approval_id),
        deployId: row.deploy_id == null ? null : String(row.deploy_id),
        projectId: row.project_id == null ? null : String(row.project_id),
        commitSha: row.target_sha == null ? null : String(row.target_sha),
        repositories: mappings.map((mapping) => {
          const record = mapping as Record<string, unknown>;
          return { owner: String(record["owner"] ?? ""), repo: String(record["repo"] ?? "") };
        }),
      } satisfies ApprovedDeployClaim;
      await auditLog.append({
        trace_id: traceId,
        actor: "AGT-DEP",
        action: "approval_dispatch_claim",
        basis: "DevOps:REQ-010 / AC-010a",
        detail: {
          approvalId: claim.approvalId,
          projectId: claim.projectId,
          targetShaAvailable: claim.commitSha !== null,
          repositoryMappingCount: claim.repositories.length,
          workItemCreated: claim.deployId !== null,
        },
        at: new Date().toISOString(),
      });
      return claim;
    });
  }

  /** P3-T13: Temporal/legacy cutover が同じ dispatched_at CAS authority を共有する union receipt。 */
  async claimNextApprovedChangeReceipt(traceId: string): Promise<ApprovedDeployClaimReceipt> {
    const claim = await this.claimNextApprovedChange(traceId);
    return claim === null ? { kind: "stale" } : { kind: "created", claim };
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
         AND expires_at > now()
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
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new Error("Invalid approval expected_version");
    }
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
         WHERE approval_id = $1::uuid
           AND status = 'pending'
           AND expected_version = $6
           AND expires_at > now()
         RETURNING ${COLUMNS}`,
        [
          approvalId,
          input.decision,
          input.approverTenantId,
          input.approverObjectId,
          reason ?? null,
          input.expectedVersion,
        ],
      );
      if (!result.rows[0]) {
        const existing = await db.query(
          `SELECT status, expected_version, expires_at IS NULL OR expires_at <= now() AS expired
           FROM approvals WHERE approval_id = $1::uuid`,
          [approvalId],
        );
        const row = existing.rows[0];
        if (!row) throw new ApprovalNotFoundError(approvalId);
        const status = row.status as ApprovalStatus;
        if (status !== "pending") throw new ApprovalAlreadyDecidedError(approvalId, status);
        const currentVersion = row.expected_version == null ? null : Number(row.expected_version);
        if (currentVersion !== input.expectedVersion) {
          throw new ApprovalStaleVersionError(approvalId, input.expectedVersion);
        }
        if (row.expired === true) throw new ApprovalExpiredError(approvalId);
        throw new ApprovalStaleVersionError(approvalId, input.expectedVersion);
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
          version: input.expectedVersion,
          ...(reason ? { reason } : {}),
        },
        reason,
        at: new Date().toISOString(),
      });
      return approval;
    });
  }
}
