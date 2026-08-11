/**
 * packages/server/src/db/ledgerEvidenceRepos.ts
 *
 * 根拠: FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:PRD-003 / FinalArch:PRD-005 / ADR-0020。
 * 証跡系 ledger（policy_decisions / model_invocations / tool_invocations /
 * meeting_artifacts）の追記中心リポジトリ。判定・実行の正本はそれぞれ
 * OPA bundle / LiteLLM / agentgateway / 会議 SoR にあり、ここは監査可能な写し。
 */
import { sanitizeSecrets, type PgQueryable } from "@aiops/shared";

/**
 * JSON 値の全 string leaf（key 含む）を sanitizeSecrets で redact する。
 * 直列化後の文字列に regex を当てると閉じ引用符まで消費して JSON を壊し得るため、
 * 構造を保ったまま値単位で redact する。
 */
function sanitizeJsonDeep(value: unknown): unknown {
  if (typeof value === "string") return sanitizeSecrets(value).sanitized;
  if (Array.isArray(value)) return value.map(sanitizeJsonDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        sanitizeSecrets(key).sanitized,
        sanitizeJsonDeep(entry),
      ]),
    );
  }
  return value;
}

export class PolicyDecisionsRepo {
  constructor(private readonly db: PgQueryable) {}

  async record(decision: {
    decisionId: string;
    workflowId: string | null;
    actorId: string;
    action: string;
    resource: unknown;
    inputHash: string;
    policyBundleVersion: string;
    decision: "allow" | "deny" | "require_approval";
    reasons: unknown[];
    obligations: unknown[];
    traceId: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO policy_decisions (
         decision_id, workflow_id, actor_id, action, resource, input_hash,
         policy_bundle_version, decision, reasons, obligations, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        decision.decisionId,
        decision.workflowId,
        decision.actorId,
        decision.action,
        JSON.stringify(decision.resource),
        decision.inputHash,
        decision.policyBundleVersion,
        decision.decision,
        JSON.stringify(decision.reasons),
        JSON.stringify(decision.obligations),
        decision.traceId,
      ],
    );
  }
}

export class ModelInvocationsRepo {
  constructor(private readonly db: PgQueryable) {}

  async record(invocation: {
    invocationId: string;
    workflowId: string | null;
    modelAlias: string;
    providerBinding: string;
    providerModelRevision: string;
    routeReason: string;
    classification: string;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: string | null;
    latencyMs: number | null;
    status: string;
    errorClass: string | null;
    traceId: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO model_invocations (
         invocation_id, workflow_id, model_alias, provider_binding, provider_model_revision,
         route_reason, classification, input_tokens, output_tokens, cost_usd,
         latency_ms, status, error_class, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        invocation.invocationId,
        invocation.workflowId,
        invocation.modelAlias,
        invocation.providerBinding,
        invocation.providerModelRevision,
        invocation.routeReason,
        invocation.classification,
        invocation.inputTokens,
        invocation.outputTokens,
        invocation.costUsd,
        invocation.latencyMs,
        invocation.status,
        invocation.errorClass,
        invocation.traceId,
      ],
    );
  }
}

export class ToolInvocationsRepo {
  constructor(private readonly db: PgQueryable) {}

  async record(invocation: {
    invocationId: string;
    workflowId: string | null;
    serverId: string;
    serverVersion: string;
    toolName: string;
    riskLevel: "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
    resourceScope: unknown;
    policyDecisionId: string | null;
    approvalId: string | null;
    latencyMs: number | null;
    status: string;
    errorClass: string | null;
    traceId: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO tool_invocations (
         invocation_id, workflow_id, server_id, server_version, tool_name, risk_level,
         resource_scope, policy_decision_id, approval_id, latency_ms, status, error_class, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        invocation.invocationId,
        invocation.workflowId,
        invocation.serverId,
        invocation.serverVersion,
        invocation.toolName,
        invocation.riskLevel,
        JSON.stringify(invocation.resourceScope),
        invocation.policyDecisionId,
        invocation.approvalId,
        invocation.latencyMs,
        invocation.status,
        invocation.errorClass,
        invocation.traceId,
      ],
    );
  }
}

export class MeetingArtifactsRepo {
  constructor(private readonly db: PgQueryable) {}

  /**
   * (m365_meeting_id, source_version) で冪等。既存版があれば挿入せず false。
   * extraction / publication_status は Wispr/M365 由来の外部テキストを含み得るため、
   * DB 保存前に sanitizeSecrets を必ず通す（AGENTS.md 多層防御 (a)）。
   */
  async record(artifact: {
    meetingArtifactId: string;
    m365MeetingId: string;
    wisprMeetingId: string | null;
    projectId: string | null;
    sourceVersion: string;
    correlationConfidence: string | null;
    extraction: unknown;
    publicationStatus: unknown;
    traceId: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO meeting_artifacts (
         meeting_artifact_id, m365_meeting_id, wispr_meeting_id, project_id, source_version,
         correlation_confidence, extraction, review_status, publication_status, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
       ON CONFLICT (m365_meeting_id, source_version) DO NOTHING`,
      [
        artifact.meetingArtifactId,
        artifact.m365MeetingId,
        artifact.wisprMeetingId,
        artifact.projectId,
        artifact.sourceVersion,
        artifact.correlationConfidence,
        JSON.stringify(sanitizeJsonDeep(artifact.extraction)),
        JSON.stringify(sanitizeJsonDeep(artifact.publicationStatus)),
        artifact.traceId,
      ],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async updateReviewStatus(
    meetingArtifactId: string,
    reviewStatus: "pending" | "approved" | "rejected" | "partial",
  ): Promise<void> {
    await this.db.query(`UPDATE meeting_artifacts SET review_status = $2 WHERE meeting_artifact_id = $1`, [
      meetingArtifactId,
      reviewStatus,
    ]);
  }
}
