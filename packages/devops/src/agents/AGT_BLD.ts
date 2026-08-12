/**
 * packages/devops/src/agents/AGT_BLD.ts
 *
 * 根拠: DevOps:REQ-001 ビルド失敗の自動一次調査 / DevOps:REQ-002 修正案の自動生成 / SPEC-INT-011
 *
 * 注意: 本ファイルは注入された AnthropicStructuredClient（分類。transport は shared の
 * gateway factory 経由 — FinalArch:LLM-001）と Claude Agent SDK（shared の
 * claudeAgentClient 経由の診断修正案生成。provider-native 経路のため server 側は
 * P2-T06-007 で fail-closed — gateway 移行まで配線されない）に依存するため、
 * ネットワーク遮断のオフライン検証環境では実行できない（README参照）。
 * 分類のconfidence閾値処理（手順6）はLLM出力後の決定的な後処理であり、それ単体はテスト可能。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import { sanitizeForLlmInput } from "@aiops/shared/secretSanitizer.js";
import { generateReadOnlyDiffSuggestion } from "@aiops/shared/clients/claudeAgentClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { applyConfidenceGuard, type ClassificationResult } from "../lib/buildClassification.js";

export type { BuildFailureClassification, ClassificationResult } from "../lib/buildClassification.js";

const CLASSIFICATION_TOOL_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["test_failure", "compile_error", "dependency", "infra_timeout", "unknown"],
    },
    failed_job: { type: "string" },
    failed_step: { type: "string" },
    log_excerpt: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["classification", "failed_job", "failed_step", "log_excerpt", "confidence"],
} as const;

export interface BldDependencies {
  llmClient: AnthropicStructuredClient;
  auditLog: AuditLogWriter;
  traceId: string;
}

/** SPEC-INT-011手順3: 分類プロンプト(PROMPT-BLD-01)でログを分類する */
export async function classifyBuildFailure(logText: string, deps: BldDependencies): Promise<ClassificationResult> {
  const sanitized = sanitizeForLlmInput(logText).sanitized.slice(0, 20000);
  const result = await deps.llmClient.call<ClassificationResult>({
    agent: "AGT-BLD",
    purpose: "build_failure_classification",
    system:
      "あなたはCI/CDビルド失敗のトリアージアシスタントです。与えられたログから失敗原因を" +
      "test_failure|compile_error|dependency|infra_timeout|unknown の5分類のいずれかに分類し、" +
      "該当ジョブ名・ステップ名・ログ抜粋(最大20行)・確信度(0.0-1.0)を返してください。",
    user: sanitized,
    toolName: "emit_classification",
    toolDescription: "ビルド失敗の分類結果を返す",
    inputSchema: CLASSIFICATION_TOOL_SCHEMA,
    parse: (raw) => raw as ClassificationResult,
    maxAttempts: 2,
  });

  const guarded = applyConfidenceGuard(result.value);

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-BLD",
    action: "classify",
    basis: "DevOps:REQ-001",
    detail: { classification: guarded.classification, confidence: guarded.confidence },
    at: new Date().toISOString(),
  });

  return guarded;
}

/** SPEC-INT-011手順4: test_failure/compile_errorの場合のみClaude Codeで修正diffを生成（read-only、AC-002b） */
export async function generateFixSuggestionIfApplicable(
  classification: ClassificationResult,
  repoCheckoutPath: string,
  deps: BldDependencies,
): Promise<string | null> {
  if (classification.classification !== "test_failure" && classification.classification !== "compile_error") {
    return null;
  }
  const result = await generateReadOnlyDiffSuggestion({
    repoCheckoutPath,
    failedJob: classification.failed_job,
    failedStep: classification.failed_step,
    logExcerpt: classification.log_excerpt,
    classification: classification.classification,
    promptVersion: "PROMPT-BLD-01@v1",
  });

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-BLD",
    action: "generate_fix_suggestion",
    basis: "DevOps:REQ-002 AC-002b",
    detail: { hasDiff: result.diffText !== null },
    at: new Date().toISOString(),
  });

  return result.diffText;
}
