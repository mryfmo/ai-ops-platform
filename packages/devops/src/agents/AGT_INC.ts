/**
 * packages/devops/src/agents/AGT_INC.ts
 *
 * 根拠: DevOps:REQ-015 一次切り分けの自動化 / DevOps:REQ-016 時限エスカレーション / DevOps:REQ-017 誤検知の抑制
 *   DevOps:SPEC-INT-030
 *
 * 分類（severity_candidate等）はLLM（PROMPT-INC-01）、TH-005エスカレーション・TH-006誤検知判定は
 * 決定的ロジック（lib/thresholds.ts, lib/falsePositiveRule.ts、いずれもオフライン検証済み）。
 * Sev1は候補提示のみで、人間の宣言操作なしに確定しない（AC-015c）。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import { isAbsoluteHttpsUrl, type ChannelRef, type GraphClient } from "@aiops/shared/clients/graphClient.js";
import type { GitHubClient } from "@aiops/shared/clients/githubClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { sanitizeForLlmInput, sanitizeSecrets, isFreeOfKnownSecrets } from "@aiops/shared/secretSanitizer.js";
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

/** DevOps:SPEC-INT-030手順2: アラート本文＋メトリクス＋類似インシデントからLLMで重大度候補を分類する */
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
    // メトリクス・類似インシデントも外部由来。中央ゲートで最終的にはsanitizeされるが、
    // 局所でも通す（CLAUDE.md原則4(b)）。
    user:
      `アラート: ${sanitized}\n` +
      `メトリクス: ${sanitizeForLlmInput(recentMetricsSummary).sanitized}\n` +
      `類似インシデント: ${sanitizeForLlmInput(similarIncidentsSummary).sanitized}`,
    toolName: "emit_incident_classification",
    toolDescription: "インシデント分類結果を返す",
    inputSchema: CLASSIFICATION_SCHEMA,
    parse: (raw) => raw as IncidentClassification,
    maxAttempts: 2,
  });
  return result.value;
}

/** 秘密が残った場合に本文の代わりに出す固定文（AGT-03 の FALLBACK_REASON と同趣旨）。 */
const RATIONALE_FALLBACK = "根拠テキストは出力前検査で除去されました。詳細は監査ログを参照してください。";
const PROJECT_FALLBACK = "unknown";

/**
 * LLM 由来テキストを公開出力へ載せる前に通す。sanitizeSecrets で既知パターンを伏せ、
 * それでも検出が残るなら本文自体を捨てる。伏字にしきれない形が残るより、
 * 情報を落とす方が安全な方向である。
 */
function redactedOrFallback(text: string, fallback: string): string {
  const redacted = sanitizeSecrets(text).sanitized;
  return isFreeOfKnownSecrets(redacted) ? redacted : fallback;
}

/** DevOps:REQ-015: TH-004 SLA内に起票・通知する（AC-015c: sev1は候補としてのみ扱う） */
export async function triageAndNotify(
  classification: IncidentClassification,
  owner: string,
  repo: string,
  channel: ChannelRef,
  deps: IncDependencies,
): Promise<{ issueUrl: string; effectiveSeverity: string }> {
  const effectiveSeverity = classification.severity_candidate === "sev1" ? "sev2" : classification.severity_candidate;
  const labelSuffix = classification.severity_candidate === "sev1" ? " (Sev1候補)" : "";

  // rationale / affected_projects は LLM 出力であり、prompt injection されたアラート本文から
  // 秘密風文字列が復元され得る。Issue は公開度が高い出力先なので、出力前にサニタイズし、
  // それでも既知パターンが残る場合は本文を落とす（AGT-03 と同じ層(c)の扱い。所見 ADV-SEC-008）。
  const safeRationale = redactedOrFallback(classification.rationale, RATIONALE_FALLBACK);
  const safeProjects = classification.affected_projects.map((project) => redactedOrFallback(project, PROJECT_FALLBACK));

  const issue = await deps.githubClient.createIssue({
    owner,
    repo,
    title: `[${effectiveSeverity.toUpperCase()}][${safeProjects[0] ?? "unknown"}] ${safeRationale.slice(0, 40)}${labelSuffix}`,
    body: `重大度候補: ${classification.severity_candidate}\n影響プロジェクト: ${safeProjects.join(", ")}\n根拠: ${safeRationale}`,
    labels: ["incident", effectiveSeverity, "auto-triaged"],
  });
  const issueUrl = issue.htmlUrl.trim();
  if (!isAbsoluteHttpsUrl(issueUrl)) throw new Error("Incident review requires a valid HTTPS issue URL");

  if (classification.severity_candidate === "sev1") {
    await deps.graphClient.sendAdaptiveCard({
      target: channel,
      card: {
        body: [
          { type: "TextBlock", text: "Sev1候補が検出されました", weight: "bolder" },
          { type: "TextBlock", text: safeRationale },
        ],
        actions: [],
        openUrlActions: [{ title: "GitHub Issueで確認", url: issueUrl }],
      },
    });
  } else {
    await deps.graphClient.sendAdaptiveCard({
      target: channel,
      card: {
        body: [
          {
            type: "TextBlock",
            text: `${effectiveSeverity.toUpperCase()} インシデントを起票しました: ${issueUrl}`,
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
    basis: "DevOps:REQ-015",
    detail: { severityCandidate: classification.severity_candidate, effectiveSeverity, issueUrl },
    at: new Date().toISOString(),
  });

  return { issueUrl, effectiveSeverity };
}

/** DevOps:REQ-016: TH-005エスカレーション判定（決定的ロジックへの委譲。SPEC-EXT-016 エスカレーション通知） */
export function evaluateEscalation(input: Th005Input) {
  return evaluateTh005Escalation(input);
}

/** DevOps:REQ-017: TH-006誤検知候補判定（決定的ロジックへの委譲、DevOps:SPEC-INT-030手順5: LLM不使用。
 *  候補化時はSPEC-EXT-017 誤検知候補の確認依頼を当番メンバーへ送付する） */
export function evaluateFalsePositiveCandidate(input: Th006Input) {
  return evaluateTh006FalsePositiveCandidate(input);
}
