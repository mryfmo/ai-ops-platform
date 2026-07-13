/**
 * packages/prjops/src/agents/AGT02_collector.ts
 *
 * 根拠: REQ-004 マルチチャネル取り込み / REQ-005 自由文の構造化 / SPEC-INT-030
 *
 * パイプライン（SPEC-INT-030）:
 *   1. 受信 → 発信者をstakeholderマスタと突合。不一致は運用担当へ通知し破棄（E-ING01）。
 *   2. 対象PJ特定: 件名のPJ-nnn → 本文中のPJ-nnn → 発信者の担当PJが1件ならそれ、の優先順（E-ING02）。
 *   3. LLM構造化: 温度0、SPEC-INT-020スキーマへのJSON出力を強制。必須6項目の欠落判定はコードで実施。
 *   4. 欠落あり→聞き返し送信（上限3, REQ-005）。充足→YAMLコミット→受理通知。
 *      1件あたりの処理タイムアウトは10分、LLM呼び出しは最大2回。
 *
 * 注意: 本ファイルは @anthropic-ai/sdk に依存する（AnthropicStructuredClient経由）。
 * ネットワーク遮断のオフライン検証環境では実行できないため、このリポジトリのオフライン検証対象からは
 * 除外している（README/verification/VERIFICATION_REPORT.md参照）。決定的な完全性判定ロジック自体は
 * lib/freeTextValidation.ts に切り出し済みで、そちらはオフラインでも実行・検証済みである。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { isFreeOfKnownSecrets, sanitizeForLlmInput, sanitizeSecrets } from "@aiops/shared/secretSanitizer.js";
import {
  checkCompleteness,
  decideClarificationAction,
  formatClarificationMessage,
  type StructuredStatusUpdate,
  type ClarificationState,
} from "../lib/freeTextValidation.js";

// AGT-02が強制するツール入力スキーマ（SPEC-INT-020のstatus_updateスキーマに対応）
export const STRUCTURING_TOOL_SCHEMA = {
  type: "object",
  properties: {
    progress_pct: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    self_status: { type: ["string", "null"], enum: ["green", "yellow", "red", null] },
    achievements: { type: ["string", "null"] },
    plans: { type: ["string", "null"] },
    issues: { type: ["string", "null"] },
    risks: { type: ["string", "null"] },
  },
  required: ["progress_pct", "self_status", "achievements", "plans", "issues", "risks"],
} as const;

export interface IncomingReport {
  channel: "email" | "teams" | "github";
  senderIdentifier: string; // メールアドレス or TeamsユーザーID or GitHubユーザー名
  subject?: string;
  body: string;
  projectIdHintFromSender?: string; // 発信者の担当PJが1件のみの場合
}

export interface StakeholderLookup {
  findBySenderIdentifier(identifier: string): Promise<{ stakeholderId: string } | null>;
}

export interface CollectorDependencies {
  llmClient: AnthropicStructuredClient;
  auditLog: AuditLogWriter;
  traceId: string;
  stakeholderLookup: StakeholderLookup;
}

function parseStructuredStatusUpdate(raw: unknown): StructuredStatusUpdate {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("E-ING03: invalid structured status");
  const value = raw as Record<string, unknown>;
  const required = ["progress_pct", "self_status", "achievements", "plans", "issues", "risks"];
  if (!required.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error("E-ING03: invalid structured status");
  }
  if (
    value.progress_pct !== null &&
    (typeof value.progress_pct !== "number" ||
      !Number.isInteger(value.progress_pct) ||
      value.progress_pct < 0 ||
      value.progress_pct > 100)
  ) {
    throw new Error("E-ING03: invalid structured status");
  }
  if (
    value.self_status !== null &&
    (typeof value.self_status !== "string" || !["green", "yellow", "red"].includes(value.self_status))
  ) {
    throw new Error("E-ING03: invalid structured status");
  }
  for (const key of ["achievements", "plans", "issues", "risks"] as const) {
    if (value[key] !== null && typeof value[key] !== "string") throw new Error("E-ING03: invalid structured status");
  }
  const safeText = (key: "achievements" | "plans" | "issues" | "risks") => {
    if (value[key] === null) return null;
    const sanitized = sanitizeSecrets(value[key] as string).sanitized;
    if (!isFreeOfKnownSecrets(sanitized)) throw new Error("E-ING03: unsafe structured status");
    return sanitized;
  };
  return {
    progress_pct: value.progress_pct as number | null,
    self_status: value.self_status as StructuredStatusUpdate["self_status"],
    achievements: safeText("achievements"),
    plans: safeText("plans"),
    issues: safeText("issues"),
    risks: safeText("risks"),
  };
}

export type CollectorOutcome =
  | { kind: "accepted"; structured: StructuredStatusUpdate; projectId: string; stakeholderId: string } // SPEC-EXT-013/033 受理通知の送信対象
  | { kind: "clarify"; message: string; clarifyCount: number }
  | { kind: "escalate_incomplete"; lastPartial: StructuredStatusUpdate }
  | { kind: "rejected_unknown_sender" }
  | { kind: "rejected_unresolved_project" };

const PJ_ID_RE = /PJ-\d{3,}/;

/** SPEC-INT-030 手順2: 対象PJ特定（件名→本文→発信者の担当PJ、の優先順） */
export function resolveProjectId(report: IncomingReport): string | null {
  if (report.subject) {
    const m = report.subject.match(PJ_ID_RE);
    if (m) return m[0];
  }
  const mBody = report.body.match(PJ_ID_RE);
  if (mBody) return mBody[0];
  if (report.projectIdHintFromSender) return report.projectIdHintFromSender;
  return null;
}

/** SPEC-INT-030 手順3: LLM構造化を1回実行する（呼び出し側で最大2回のリトライ制御を行う） */
export async function structureFreeText(
  llmClient: AnthropicStructuredClient,
  reportBody: string,
): Promise<StructuredStatusUpdate> {
  const sanitized = sanitizeForLlmInput(reportBody).sanitized;
  const result = await llmClient.call<StructuredStatusUpdate>({
    agent: "AGT-02",
    purpose: "free_text_structuring",
    system:
      "あなたはPrjOps AI基盤の進捗報告構造化エンジンです。日本語・英語の自由文報告から、進捗率(0-100の整数)、" +
      "自己申告ステータス(green|yellow|red)、今週の実績、来週の予定、課題(なければ「なし」)、リスク(なければ「なし」)を抽出し、" +
      "指定されたツールスキーマに厳密に従ってJSONを出力してください。判定不能な項目はnullとしてください。",
    user: sanitized,
    toolName: "emit_structured_status_update",
    toolDescription: "抽出した進捗報告の構造化データを返す",
    inputSchema: STRUCTURING_TOOL_SCHEMA,
    parse: parseStructuredStatusUpdate,
    maxAttempts: 2, // SPEC-INT-030: LLM呼び出しは最大2回
    allowEscalation: true, // (a)自由文構造化のみ昇格対象（SPEC-INT-001）
  });
  return result.value;
}

/** REQ-004/005: 受信1件に対するAGT-02の処理本体 */
export async function ingestOne(
  report: IncomingReport,
  clarifyState: ClarificationState,
  deps: CollectorDependencies,
): Promise<CollectorOutcome> {
  // 手順1: 発信者突合
  // 権威的識別子は redaction で衝突させず、受信値のまま完全一致で照合する。
  const stakeholder = await deps.stakeholderLookup.findBySenderIdentifier(report.senderIdentifier);
  const sanitizedSenderIdentifier = sanitizeSecrets(report.senderIdentifier).sanitized;
  const safeSenderIdentifier = isFreeOfKnownSecrets(sanitizedSenderIdentifier)
    ? sanitizedSenderIdentifier
    : "***REDACTED:unknown***";
  if (!stakeholder) {
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-02",
      action: "reject_unknown_sender",
      basis: "SPEC-INT-030 E-ING01",
      detail: { senderIdentifier: safeSenderIdentifier },
      at: new Date().toISOString(),
    });
    return { kind: "rejected_unknown_sender" };
  }

  // 手順2: 対象PJ特定
  const projectId = resolveProjectId(report);
  if (!projectId) {
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-02",
      action: "reject_unresolved_project",
      basis: "SPEC-INT-030 E-ING02",
      detail: { senderIdentifier: safeSenderIdentifier },
      at: new Date().toISOString(),
    });
    return { kind: "rejected_unresolved_project" };
  }

  // 手順3: LLM構造化
  const structured = await structureFreeText(deps.llmClient, report.body);

  // 手順3後半: 完全性判定はコードで実施（LLMに判定させない）
  const completeness = checkCompleteness(structured);
  const decision = decideClarificationAction(completeness, clarifyState);

  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-02",
    action: "structure",
    basis: "REQ-005",
    detail: {
      projectId,
      stakeholderId: stakeholder.stakeholderId,
      raw_source_channel: report.channel,
      complete: completeness.complete,
    },
    at: new Date().toISOString(),
  });

  if (decision.action === "accept") {
    return { kind: "accepted", structured, projectId, stakeholderId: stakeholder.stakeholderId };
  }
  if (decision.action === "escalate_incomplete") {
    return { kind: "escalate_incomplete", lastPartial: structured };
  }
  return {
    kind: "clarify",
    message: formatClarificationMessage(completeness.missingFields),
    clarifyCount: clarifyState.clarifyCount + 1,
  };
}
