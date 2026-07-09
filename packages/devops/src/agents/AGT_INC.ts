/**
 * packages/devops/src/agents/AGT_INC.ts
 *
 * 根拠: REQ-015 一次切り分けの自動化 / REQ-016 時限エスカレーション / REQ-017 誤検知の抑制
 *   SPEC-INT-030
 *
 * 分類（severity_candidate等）はLLM（PROMPT-INC-01）、TH-005エスカレーション・TH-006誤検知判定は
 * 決定的ロジック（lib/thresholds.ts, lib/falsePositiveRule.ts、いずれもオフライン検証済み）。
 * Sev1は候補提示のみで、人間の宣言操作なしに確定しない（AC-015c）。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import type { GraphClient } from "@aiops/shared/clients/graphClient.js";
import type { GitHubClient } from "@aiops/shared/clients/githubClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { sanitizeForLlmInput } from "@aiops/shared/secretSanitizer.js";
import { evaluateTh005Escalation, type Th005Input } from "../lib/thresholds.js";
import { evaluateTh006FalsePositiveCandidate, type Th006Input } from "../lib/falsePositiveRule.js";

export type SeverityCandidate = "sev1" | "sev2" | "sev3" | "sev4";

export interface IncidentClassification {
  severity_candidate: SeverityCandidate;
  affected_projects: string[];
  rationale: string;
}

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    severity_candidate: { type: "string", enum: ["sev1", "sev2", "sev3", "sev4"] },
    affected_projects: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
  },
  required: ["severity_candidate", "affected_projects", "rationale"],
} as const;

export interface IncDependencies {
  llmClient: AnthropicStructuredClient;
  graphClient: Pick<GraphClient, "sendAdaptiveCard">;
  githubClient: Pick<GitHubClient, "createIssue">;
  auditLog: AuditLogWriter;
  traceId: string;
}

/** SPEC-INT-030手順2: アラート本文＋メトリクス＋類似インシデントからLLMで重大度候補を分類する */
export async function classifyIncident(
  alertText: string,
  recentMetricsSummary: string,
  similarIncidentsSummary: string,
  deps: IncDependencies,
): Promise<IncidentClassification> {
  const sanitized = sanitizeForLlmInput(alertText).sanitized;
  const result = await deps.llmClient.call<IncidentClassification>({
    agent: "AGT-INC",
    purpose: "incident_classification",
    system:
      "あなたはSREのインシデント一次切り分けアシスタントです。アラート内容・直近メトリクス・" +
      "過去90日の類似インシデントから、重大度候補(sev1-4)、影響プロジェクト、判断根拠を返してください。" +
      "sev1(全面停止/データ漏えい疑い)は候補提示に留め、人間が確定させます。",
    user: `アラート: ${sanitized}\nメトリクス: ${recentMetricsSummary}\n類似インシデント: ${similarIncidentsSummary}`,
    toolName: "emit_incident_classification",
    toolDescription: "インシデント分類結果を返す",
    inputSchema: CLASSIFICATION_SCHEMA,
    parse: (raw) => raw as IncidentClassification,
    maxAttempts: 2,
  });
  return result.value;
}

/** REQ-015: TH-004 SLA内に起票・通知する（AC-015c: sev1は候補としてのみ扱う） */
export async function triageAndNotify(
  classification: IncidentClassification,
  owner: string,
  repo: string,
  channelId: string,
  deps: IncDependencies,
): Promise<{ issueUrl: string; effectiveSeverity: string }> {
  const effectiveSeverity = classification.severity_candidate === "sev1" ? "sev2" : classification.severity_candidate;
  const labelSuffix = classification.severity_candidate === "sev1" ? " (Sev1候補)" : "";

  const issue = await deps.githubClient.createIssue({
    owner,
    repo,
    title: `[${effectiveSeverity.toUpperCase()}][${classification.affected_projects[0] ?? "unknown"}] ${classification.rationale.slice(0, 40)}${labelSuffix}`,
    body: `重大度候補: ${classification.severity_candidate}\n影響プロジェクト: ${classification.affected_projects.join(", ")}\n根拠: ${classification.rationale}`,
    labels: ["incident", effectiveSeverity, "auto-triaged"],
  });

  if (classification.severity_candidate === "sev1") {
    await deps.graphClient.sendAdaptiveCard({
      channelOrChatId: channelId,
      card: {
        body: [
          { type: "TextBlock", text: "Sev1候補が検出されました", weight: "bolder" },
          { type: "TextBlock", text: classification.rationale },
        ],
        actions: [
          { title: "Sev1として宣言", id: "declare_sev1" },
          { title: "Sev2に降格", id: "downgrade_sev2" },
          { title: "誤検知", id: "false_positive" },
        ],
      },
    });
  } else {
    await deps.graphClient.sendAdaptiveCard({
      channelOrChatId: channelId,
      card: {
        body: [
          {
            type: "TextBlock",
            text: `${effectiveSeverity.toUpperCase()} インシデントを起票しました: ${issue.htmlUrl}`,
          },
        ],
        actions: [],
      },
    });
  }

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-INC",
    action: "triage",
    basis: "REQ-015",
    detail: { severityCandidate: classification.severity_candidate, effectiveSeverity, issueUrl: issue.htmlUrl },
    at: new Date().toISOString(),
  });

  return { issueUrl: issue.htmlUrl, effectiveSeverity };
}

/** REQ-016: TH-005エスカレーション判定（決定的ロジックへの委譲。SPEC-EXT-016 エスカレーション通知） */
export function evaluateEscalation(input: Th005Input) {
  return evaluateTh005Escalation(input);
}

/** REQ-017: TH-006誤検知候補判定（決定的ロジックへの委譲、SPEC-INT-030手順5: LLM不使用。
 *  候補化時はSPEC-EXT-017 誤検知候補の確認依頼を当番メンバーへ送付する） */
export function evaluateFalsePositiveCandidate(input: Th006Input) {
  return evaluateTh006FalsePositiveCandidate(input);
}
