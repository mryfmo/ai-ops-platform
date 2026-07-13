/**
 * packages/prjops/src/agents/AGT03_analyzer.ts
 *
 * 根拠: REQ-007 ステータス自動判定 / REQ-008 重要度スコアリング / SPEC-INT-001, 032
 *
 * 判定計算そのもの（judgeStatus, evaluateEscalationTrigger）はLLMを使わない純粋関数
 * （lib/statusJudge.ts, lib/severityProposal.ts、いずれもオフライン検証済み）。
 * LLMは「重要度引き上げ提案の理由文生成」（SPEC-INT-001の(c)）のみに用いる。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { isFreeOfKnownSecrets, sanitizeForLlmInput, sanitizeSecrets } from "@aiops/shared/secretSanitizer.js";
import {
  judgeStatus,
  selfReportDiffersFromJudged,
  type StatusJudgeInput,
  type StatusColor,
} from "../lib/statusJudge.js";
import { evaluateEscalationTrigger, type EscalationTriggerInput } from "../lib/severityProposal.js";
import { sanitizeNarrativeWithFallback } from "../lib/narrativeSanitizer.js";

const REASON_TOOL_SCHEMA = {
  type: "object",
  properties: {
    reason_ja: { type: "string" },
    reason_en: { type: "string" },
  },
  required: ["reason_ja", "reason_en"],
} as const;

function parseEscalationReason(raw: unknown): { reason_ja: string; reason_en: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("E-GEN01: invalid escalation reason");
  const value = raw as Record<string, unknown>;
  if (typeof value.reason_ja !== "string" || typeof value.reason_en !== "string") {
    throw new Error("E-GEN01: invalid escalation reason");
  }
  return { reason_ja: value.reason_ja, reason_en: value.reason_en };
}

const FALLBACK_REASON_JA = "影響記述が重要度引き上げ条件に合致し、複数組織への影響が確認されたためです。";
const FALLBACK_REASON_EN = "The described impact meets the escalation condition and affects multiple organizations.";

export interface AnalyzerDependencies {
  llmClient: AnthropicStructuredClient;
  auditLog: AuditLogWriter;
  traceId: string;
}

export interface ProjectJudgementRequest extends StatusJudgeInput {
  projectId: string;
  selfStatus: StatusColor;
}

export interface ProjectJudgementResult {
  projectId: string;
  machineColor: StatusColor;
  selfColor: StatusColor;
  diverges: boolean;
  planLinePct: number;
  gapPoints: number;
}

/** REQ-007: プロジェクト1件のステータス判定（決定的計算のみ、LLM不使用） */
export function analyzeProjectStatus(req: ProjectJudgementRequest): ProjectJudgementResult {
  const judged = judgeStatus(req);
  return {
    projectId: req.projectId,
    machineColor: judged.color,
    selfColor: req.selfStatus,
    diverges: selfReportDiffersFromJudged(req.selfStatus, judged.color),
    planLinePct: judged.planLinePct,
    gapPoints: judged.gapPoints,
  };
}

/** REQ-008: 課題・リスクの重要度引き上げ提案（トリガー判定は決定的、理由文のみLLM生成）。
 *  提案はSPEC-EXT-036の通知（該当PRF-02へAGT-03提案時に送信）としてTeamsへ届けられる。 */
export async function proposeEscalationIfNeeded(
  trigger: EscalationTriggerInput,
  issueId: string,
  deps: AnalyzerDependencies,
): Promise<{ proposed: boolean; reasonJa?: string; reasonEn?: string }> {
  const evaluation = evaluateEscalationTrigger(trigger);
  if (!evaluation.shouldPropose) {
    return { proposed: false };
  }

  const safeImpactDescription = sanitizeForLlmInput(trigger.impactDescription).sanitized;

  const result = await deps.llmClient.call<{ reason_ja: string; reason_en: string }>({
    agent: "AGT-03",
    purpose: "severity_escalation_reason",
    system:
      "あなたはPMOの重要度判定アシスタントです。与えられた課題の影響記述と検出キーワードから、" +
      "重要度を「高」へ引き上げるべき理由を日本語・英語それぞれ1〜2文で簡潔に説明してください。数値の創作は禁止です。",
    user: `影響記述: ${safeImpactDescription}\n検出キーワード: ${evaluation.matchedKeywords.join(", ")}\n影響企業数: ${
      trigger.affectedOrganizationIds.length
    }`,
    toolName: "emit_escalation_reason",
    toolDescription: "重要度引き上げ提案の理由文を返す",
    inputSchema: REASON_TOOL_SCHEMA,
    parse: parseEscalationReason,
    maxAttempts: 2,
  });
  const sanitizedReasonJa = sanitizeNarrativeWithFallback(
    sanitizeSecrets(result.value.reason_ja).sanitized,
    "ja",
    FALLBACK_REASON_JA,
  );
  const sanitizedReasonEn = sanitizeNarrativeWithFallback(
    sanitizeSecrets(result.value.reason_en).sanitized,
    "en",
    FALLBACK_REASON_EN,
  );
  const reasonJa = isFreeOfKnownSecrets(sanitizedReasonJa) ? sanitizedReasonJa : FALLBACK_REASON_JA;
  const reasonEn = isFreeOfKnownSecrets(sanitizedReasonEn) ? sanitizedReasonEn : FALLBACK_REASON_EN;
  const fallbackApplied = reasonJa === FALLBACK_REASON_JA || reasonEn === FALLBACK_REASON_EN;

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-03",
    action: "propose_escalation",
    basis: "REQ-008 AC-008-1",
    detail: {
      issueId,
      matchedKeywords: evaluation.matchedKeywords,
      affectsMultipleOrganizations: evaluation.affectsMultipleOrganizations,
      fallbackApplied,
      reason_ja: reasonJa,
    },
    at: new Date().toISOString(),
  });

  return { proposed: true, reasonJa, reasonEn };
}
