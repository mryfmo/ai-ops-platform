/**
 * packages/server/src/db/mcpOpsRepo.ts
 *
 * 根拠: FinalArch:MCP-003 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11。
 * MCP operations は request-time recipient scope を SQL 取得時に強制し、raw tool content を選択しない。
 */
import { sanitizeSecrets, type PgQueryable } from "@aiops/shared";

export const MCP_OPS_WINDOW_HOURS = 24;

export interface McpOpsRecipient {
  readonly profile: string;
  readonly scopeMode: "project" | "global";
  readonly projects: readonly string[];
}

export interface McpOpsLedgerSummary {
  window: { hours: number; since: string };
  totalInvocations: number;
  usage: Array<{ serverId: string; toolName: string; riskLevel: string; status: string; count: number }>;
  policy: { totalDecisions: number; deniedDecisions: number; denyRatePct: number | null };
  denyReasons: Array<{ code: string; count: number }>;
  errors: Array<{ code: string; count: number }>;
}

export interface McpInvocationAudit {
  invocationId: string;
  workflowId: string | null;
  traceId: string;
  actorId: string;
  tool: { serverId: string; serverVersion: string; name: string; riskLevel: string };
  resource: { id: string; projectId?: string };
  policy: { decisionId: string; bundleVersion: string; decision: string };
  result: { status: string; errorClass: string | null; latencyMs: number | null };
  action: { operationId: string; status: string; errorClass: string | null } | null;
}

export class McpOpsForbiddenError extends Error {
  constructor() {
    super("MCP operations scope is forbidden");
    this.name = "McpOpsForbiddenError";
  }
}

interface QueryScope {
  global: boolean;
  projectIds: readonly string[];
}

function queryScope(recipient: McpOpsRecipient): QueryScope {
  if (recipient.profile === "PRF-G" && recipient.scopeMode === "global" && recipient.projects.length === 0) {
    return { global: true, projectIds: [] };
  }
  if (
    recipient.profile === "PRF-L" &&
    recipient.scopeMode === "project" &&
    recipient.projects.length > 0 &&
    recipient.projects.every((projectId) => typeof projectId === "string" && projectId.length > 0)
  ) {
    return { global: false, projectIds: [...new Set(recipient.projects)].sort() };
  }
  throw new McpOpsForbiddenError();
}

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new TypeError("MCP ops count must be a non-negative safe integer");
  return parsed;
}

function nullableCount(value: unknown): number | null {
  return value === null || value === undefined ? null : count(value);
}

function metadata(value: unknown): string {
  return sanitizeSecrets(String(value ?? "unknown")).sanitized;
}

function nullableMetadata(value: unknown): string | null {
  return value === null || value === undefined ? null : metadata(value);
}

const TOOL_SCOPE = "($1::boolean OR pd.resource ->> 'projectId' = ANY($2::text[]))";
const POLICY_SCOPE = "($1::boolean OR resource ->> 'projectId' = ANY($2::text[]))";

export class McpOpsRepo {
  constructor(
    private readonly db: PgQueryable,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summaryFor(recipient: McpOpsRecipient): Promise<McpOpsLedgerSummary> {
    const scope = queryScope(recipient);
    const since = new Date(this.now().getTime() - MCP_OPS_WINDOW_HOURS * 60 * 60 * 1_000).toISOString();
    const params = [scope.global, scope.projectIds, since];
    const [usageResult, decisionsResult, denyReasonsResult, errorsResult] = await Promise.all([
      this.db.query(
        `SELECT
           CASE WHEN ti.server_id ~ '^[a-z][a-z0-9-]{0,63}$' THEN ti.server_id ELSE 'redacted' END AS server_id,
           CASE WHEN ti.tool_name ~ '^[a-z][a-z0-9_]{0,63}$' THEN ti.tool_name ELSE 'redacted' END AS tool_name,
           CASE WHEN ti.risk_level IN ('L0','L1','L2','L3','L4','L5','L6') THEN ti.risk_level ELSE 'unknown' END AS risk_level,
           CASE WHEN ti.status IN ('succeeded','blocked','failed') THEN ti.status ELSE 'unknown' END AS status,
           count(*)::text AS invocation_count
         FROM tool_invocations ti
         LEFT JOIN policy_decisions pd ON pd.decision_id = ti.policy_decision_id
         WHERE ${TOOL_SCOPE} AND ti.invoked_at >= $3::timestamptz
         GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4`,
        params,
      ),
      this.db.query(
        `SELECT decision, count(*)::text AS decision_count
         FROM policy_decisions
         WHERE ${POLICY_SCOPE} AND decided_at >= $3::timestamptz
         GROUP BY decision ORDER BY decision`,
        params,
      ),
      this.db.query(
        `SELECT
           CASE WHEN reason.value ~ '^E-[A-Z0-9-]{1,62}$' THEN reason.value ELSE 'E-REDACTED' END AS code,
           count(*)::text AS decision_count
         FROM policy_decisions pd
         CROSS JOIN LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(pd.reasons) = 'array' THEN pd.reasons ELSE '[]'::jsonb END
         ) AS reason(value)
         WHERE pd.decision = 'deny' AND ${TOOL_SCOPE} AND pd.decided_at >= $3::timestamptz
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
      this.db.query(
        `SELECT
           CASE WHEN ti.error_class ~ '^E-[A-Z0-9-]{1,62}$' THEN ti.error_class ELSE 'E-REDACTED' END AS code,
           count(*)::text AS invocation_count
         FROM tool_invocations ti
         LEFT JOIN policy_decisions pd ON pd.decision_id = ti.policy_decision_id
         WHERE ti.error_class IS NOT NULL AND ${TOOL_SCOPE} AND ti.invoked_at >= $3::timestamptz
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
    ]);

    const usage = usageResult.rows.map((row) => ({
      serverId: metadata(row.server_id),
      toolName: metadata(row.tool_name),
      riskLevel: metadata(row.risk_level),
      status: metadata(row.status),
      count: count(row.invocation_count),
    }));
    const decisionCounts = new Map(
      decisionsResult.rows.map((row) => [metadata(row.decision), count(row.decision_count)] as const),
    );
    const totalDecisions = [...decisionCounts.values()].reduce((total, value) => total + value, 0);
    const deniedDecisions = decisionCounts.get("deny") ?? 0;
    return {
      window: { hours: MCP_OPS_WINDOW_HOURS, since },
      totalInvocations: usage.reduce((total, row) => total + row.count, 0),
      usage,
      policy: {
        totalDecisions,
        deniedDecisions,
        denyRatePct: totalDecisions === 0 ? null : Math.round((deniedDecisions / totalDecisions) * 1_000) / 10,
      },
      denyReasons: denyReasonsResult.rows.map((row) => ({
        code: metadata(row.code),
        count: count(row.decision_count),
      })),
      errors: errorsResult.rows.map((row) => ({ code: metadata(row.code), count: count(row.invocation_count) })),
    };
  }

  async findInvocation(recipient: McpOpsRecipient, invocationId: string): Promise<McpInvocationAudit | null> {
    const scope = queryScope(recipient);
    const result = await this.db.query(
      `SELECT
         ti.invocation_id, ti.workflow_id, ti.trace_id, pd.actor_id,
         CASE WHEN ti.server_id ~ '^[a-z][a-z0-9-]{0,63}$' THEN ti.server_id ELSE 'redacted' END AS server_id,
         ti.server_version,
         CASE WHEN ti.tool_name ~ '^[a-z][a-z0-9_]{0,63}$' THEN ti.tool_name ELSE 'redacted' END AS tool_name,
         ti.risk_level, pd.resource ->> 'id' AS resource_id, pd.resource ->> 'projectId' AS project_id,
         pd.decision_id, pd.policy_bundle_version, pd.decision,
         CASE WHEN ti.status IN ('succeeded','blocked','failed') THEN ti.status ELSE 'unknown' END AS status,
         CASE WHEN ti.error_class IS NULL THEN NULL
              WHEN ti.error_class ~ '^E-[A-Z0-9-]{1,62}$' THEN ti.error_class ELSE 'E-REDACTED' END AS error_class,
         ti.latency_ms, action.operation_id, action.status AS action_status,
         CASE WHEN action.last_error_class IS NULL THEN NULL
              WHEN action.last_error_class ~ '^E-[A-Z0-9-]{1,62}$' THEN action.last_error_class
              ELSE 'E-REDACTED' END AS action_error_class
       FROM tool_invocations ti
       JOIN policy_decisions pd ON pd.decision_id = ti.policy_decision_id
       LEFT JOIN LATERAL (
         SELECT al.operation_id, al.status, al.last_error_class
         FROM action_ledger al
         WHERE al.workflow_id = ti.workflow_id AND al.trace_id = ti.trace_id
           AND al.system = ti.server_id AND al.operation = ti.tool_name
         ORDER BY al.updated_at DESC, al.operation_id DESC LIMIT 1
       ) action ON true
       WHERE ${TOOL_SCOPE} AND ti.invocation_id = $3::uuid
       LIMIT 1`,
      [scope.global, scope.projectIds, invocationId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const projectId = nullableMetadata(row.project_id);
    const actionOperationId = nullableMetadata(row.operation_id);
    return {
      invocationId: metadata(row.invocation_id),
      workflowId: nullableMetadata(row.workflow_id),
      traceId: metadata(row.trace_id),
      actorId: metadata(row.actor_id),
      tool: {
        serverId: metadata(row.server_id),
        serverVersion: metadata(row.server_version),
        name: metadata(row.tool_name),
        riskLevel: metadata(row.risk_level),
      },
      resource: { id: metadata(row.resource_id), ...(projectId === null ? {} : { projectId }) },
      policy: {
        decisionId: metadata(row.decision_id),
        bundleVersion: metadata(row.policy_bundle_version),
        decision: metadata(row.decision),
      },
      result: {
        status: metadata(row.status),
        errorClass: nullableMetadata(row.error_class),
        latencyMs: nullableCount(row.latency_ms),
      },
      action:
        actionOperationId === null
          ? null
          : {
              operationId: actionOperationId,
              status: metadata(row.action_status),
              errorClass: nullableMetadata(row.action_error_class),
            },
    };
  }
}
