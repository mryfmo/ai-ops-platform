/**
 * 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 /
 * FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003。
 * Workbench は scoped presentation read model。SoR/workflow/action/approval の正本値は保存せず live join する。
 */
import { sanitizeSecrets, type PgQueryable } from "@aiops/shared";

export type WorkbenchKind = "project" | "repository" | "meeting" | "incident";
export type WorkbenchSourceSystem = "github" | "sharepoint" | "confluence" | "temporal";

export interface WorkbenchRecipient {
  readonly profile: string;
  readonly scopeMode: "project" | "global";
  readonly projects: readonly string[];
}

export interface WorkbenchSourceRef {
  sourceRefId: string;
  sourceSystem: WorkbenchSourceSystem;
  sourceType: string;
  externalId: string;
  canonicalUrl: string;
}

export interface WorkbenchRunRef {
  workflowId: string;
  runId: string;
  workflowType: string;
  status: string;
  currentStep: string | null;
  updatedAt: string;
}

export interface WorkbenchPendingActionRef {
  operationId: string;
  approvalId: string;
  workflowId: string;
  actionStatus: string;
  approvalStatus: string;
}

export interface WorkbenchWorkspace {
  workspaceId: string;
  kind: WorkbenchKind;
  projectId: string;
  ownerUserId: string;
  createdAt: string;
  sources: WorkbenchSourceRef[];
  runs: WorkbenchRunRef[];
  pendingActions: WorkbenchPendingActionRef[];
}

export interface CreateWorkbenchWorkspace {
  workspaceId: string;
  kind: WorkbenchKind;
  projectId: string;
  ownerUserId: string;
}

export interface AddWorkbenchSource {
  sourceRefId: string;
  workspaceId: string;
  sourceSystem: WorkbenchSourceSystem;
  sourceType: string;
  externalId: string;
  canonicalUrl: string;
}

export class WorkbenchForbiddenError extends Error {
  constructor() {
    super("Workbench scope is forbidden");
    this.name = "WorkbenchForbiddenError";
  }
}

function queryScope(recipient: WorkbenchRecipient): { global: boolean; projectIds: string[] } {
  if (recipient.scopeMode === "global" && recipient.profile === "PRF-G" && recipient.projects.length === 0) {
    return { global: true, projectIds: [] };
  }
  if (
    recipient.scopeMode === "project" &&
    ["PRF-M", "PRF-L", "PRF-G"].includes(recipient.profile) &&
    recipient.projects.length > 0 &&
    recipient.projects.every((projectId) => typeof projectId === "string" && projectId.length > 0)
  ) {
    return { global: false, projectIds: [...new Set(recipient.projects)].sort() };
  }
  throw new WorkbenchForbiddenError();
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

function timestamp(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function safeStoredMetadata(value: string): string {
  const result = sanitizeSecrets(value);
  if (result.redactionCount > 0) throw new TypeError("Workbench reference metadata contains a secret");
  return result.sanitized;
}

function toWorkspace(row: Record<string, unknown>): WorkbenchWorkspace {
  return {
    workspaceId: String(row.workspace_id),
    kind: String(row.kind) as WorkbenchKind,
    projectId: String(row.project_id),
    ownerUserId: String(row.owner_user_id),
    createdAt: timestamp(row.created_at),
    sources: records(row.sources).map((source) => ({
      sourceRefId: String(source.sourceRefId),
      sourceSystem: String(source.sourceSystem) as WorkbenchSourceSystem,
      sourceType: String(source.sourceType),
      externalId: String(source.externalId),
      canonicalUrl: String(source.canonicalUrl),
    })),
    runs: records(row.runs).map((run) => ({
      workflowId: String(run.workflowId),
      runId: String(run.runId),
      workflowType: String(run.workflowType),
      status: String(run.status),
      currentStep: nullableString(run.currentStep),
      updatedAt: timestamp(run.updatedAt),
    })),
    pendingActions: records(row.pending_actions).map((action) => ({
      operationId: String(action.operationId),
      approvalId: String(action.approvalId),
      workflowId: String(action.workflowId),
      actionStatus: String(action.actionStatus),
      approvalStatus: String(action.approvalStatus),
    })),
  };
}

export class WorkbenchRepo {
  constructor(private readonly db: PgQueryable) {}

  async createWorkspace(input: CreateWorkbenchWorkspace): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO workbench_workspaces (workspace_id, kind, project_id, owner_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id) DO NOTHING`,
      [input.workspaceId, input.kind, safeStoredMetadata(input.projectId), safeStoredMetadata(input.ownerUserId)],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async addSource(input: AddWorkbenchSource): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO workbench_workspace_sources (
         source_ref_id, workspace_id, source_system, source_type, external_id, canonical_url
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, source_system, external_id) DO NOTHING`,
      [
        input.sourceRefId,
        input.workspaceId,
        input.sourceSystem,
        safeStoredMetadata(input.sourceType),
        safeStoredMetadata(input.externalId),
        safeStoredMetadata(input.canonicalUrl),
      ],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async linkRun(workspaceId: string, workflowId: string): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO workbench_workspace_runs (workspace_id, workflow_id)
       SELECT w.workspace_id, r.workflow_id
       FROM workbench_workspaces w
       JOIN workflow_runs r ON r.workflow_id = $2 AND r.project_id = w.project_id
       WHERE w.workspace_id = $1
       ON CONFLICT (workspace_id, workflow_id) DO NOTHING`,
      [workspaceId, workflowId],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async linkPendingAction(workspaceId: string, operationId: string): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO workbench_pending_actions (workspace_id, operation_id, approval_id)
       SELECT w.workspace_id, a.operation_id, a.approval_id
       FROM workbench_workspaces w
       JOIN action_ledger a ON a.operation_id = $2 AND a.approval_id IS NOT NULL
       JOIN approvals approval ON approval.approval_id = a.approval_id
                              AND approval.project_id = w.project_id
       JOIN workbench_workspace_runs linked ON linked.workspace_id = w.workspace_id
                                            AND linked.workflow_id = a.workflow_id
       WHERE w.workspace_id = $1
       ON CONFLICT (workspace_id, operation_id) DO NOTHING`,
      [workspaceId, operationId],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async findByIdFor(recipient: WorkbenchRecipient, workspaceId: string): Promise<WorkbenchWorkspace | null> {
    const scope = queryScope(recipient);
    const result = await this.db.query(
      `SELECT w.workspace_id, w.kind, w.project_id, w.owner_user_id, w.created_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'sourceRefId', s.source_ref_id,
             'sourceSystem', s.source_system,
             'sourceType', s.source_type,
             'externalId', s.external_id,
             'canonicalUrl', s.canonical_url
           ) ORDER BY s.linked_at, s.source_ref_id)
           FROM workbench_workspace_sources s WHERE s.workspace_id = w.workspace_id
         ), '[]'::jsonb) AS sources,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'workflowId', r.workflow_id,
             'runId', r.run_id,
             'workflowType', r.workflow_type,
             'status', r.status,
             'currentStep', r.current_step,
             'updatedAt', r.updated_at
           ) ORDER BY linked.linked_at, r.workflow_id)
           FROM workbench_workspace_runs linked
           JOIN workflow_runs r ON r.workflow_id = linked.workflow_id
           WHERE linked.workspace_id = w.workspace_id
         ), '[]'::jsonb) AS runs,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'operationId', action.operation_id,
             'approvalId', approval.approval_id,
             'workflowId', action.workflow_id,
             'actionStatus', action.status,
             'approvalStatus', approval.status
           ) ORDER BY linked.linked_at, action.operation_id)
           FROM workbench_pending_actions linked
           JOIN action_ledger action ON action.operation_id = linked.operation_id
           JOIN approvals approval ON approval.approval_id = linked.approval_id
           WHERE linked.workspace_id = w.workspace_id
         ), '[]'::jsonb) AS pending_actions
       FROM workbench_workspaces w
       WHERE ($1::boolean OR w.project_id = ANY($2::text[]))
         AND w.workspace_id = $3::uuid
       LIMIT 1`,
      [scope.global, scope.projectIds, workspaceId],
    );
    return result.rows[0] ? toWorkspace(result.rows[0]) : null;
  }
}
