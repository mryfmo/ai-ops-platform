/**
 * packages/devops/src/agents/AGT_CHG.ts
 *
 * 根拠: SPEC-INT-031 AGT-CHG 承認パッケージ生成 / REQ-010, REQ-011
 *   入力: 対象リリースのPR一覧・diff・CI結果。処理: 差分要約(PROMPT-CHG-01、最大10行)、
 *   リスクスコア(SPEC-INT-021)、ロールバック手順を組み立て、SPEC-EXT-010カードをTeamsへ送信。
 *   承認完了イベントを受けた場合、影響対象の関連企業へSPEC-EXT-033のリリース事前通知を送信する。
 */
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import type { GraphClient, AdaptiveCardPayload } from "@aiops/shared/clients/graphClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import type { HolidayCalendar } from "@aiops/shared/calendar/businessCalendar.js";
import { formatExternalDateTime } from "@aiops/shared/ids.js";
import type { RiskScoreBreakdown } from "../lib/riskScore.js";

const SUMMARY_TOOL_SCHEMA = {
  type: "object",
  properties: { lines: { type: "array", items: { type: "string" }, maxItems: 10 } },
  required: ["lines"],
} as const;

export interface ChgDependencies {
  llmClient: AnthropicStructuredClient;
  graphClient: Pick<GraphClient, "sendAdaptiveCard" | "sendMail">;
  auditLog: AuditLogWriter;
  traceId: string;
  cal: HolidayCalendar;
}

/** SPEC-INT-031: 差分要約(PROMPT-CHG-01、最大10行) */
export async function summarizeChangeDiff(diffText: string, deps: ChgDependencies): Promise<string[]> {
  const result = await deps.llmClient.call<{ lines: string[] }>({
    agent: "AGT-CHG",
    purpose: "change_diff_summary",
    system:
      "あなたはリリース差分要約アシスタントです。与えられたdiffから変更内容を最大10行の箇条書きで要約してください。数値の創作は禁止です。",
    user: diffText.slice(0, 50000),
    toolName: "emit_summary",
    toolDescription: "差分要約（最大10行）を返す",
    inputSchema: SUMMARY_TOOL_SCHEMA,
    parse: (raw) => raw as { lines: string[] },
    maxAttempts: 2,
  });
  return result.value.lines.slice(0, 10);
}

export interface ApprovalPackage {
  projectName: string;
  diffSummaryLines: string[];
  testSummary: { successCount: number; failureCount: number; coveragePct: number };
  riskScore: RiskScoreBreakdown;
  rollbackSummary: string;
  approvalDeadlineLabel: string;
}

/** SPEC-EXT-010: 本番デプロイ承認カードを送信する（表示項目の順序固定） */
export async function sendApprovalCard(pkg: ApprovalPackage, channelId: string, deps: ChgDependencies): Promise<void> {
  const card: AdaptiveCardPayload = {
    body: [
      { type: "TextBlock", text: `${pkg.projectName} — 対象環境: 本番`, weight: "bolder" },
      { type: "TextBlock", text: pkg.diffSummaryLines.join("\n"), wrap: true },
      {
        type: "FactSet",
        facts: [
          {
            title: "テスト結果",
            value: `成功${pkg.testSummary.successCount}件/失敗${pkg.testSummary.failureCount}件、カバレッジ${pkg.testSummary.coveragePct}%`,
          },
          { title: "リスクスコア", value: `${pkg.riskScore.score}${pkg.riskScore.isHighRisk ? "（高リスク）" : ""}` },
          { title: "ロールバック手順", value: pkg.rollbackSummary },
          { title: "承認期限", value: pkg.approvalDeadlineLabel },
        ],
      },
    ],
    actions: [
      { title: "承認", id: "approve" },
      { title: "却下", id: "reject" },
      { title: "保留（コメント必須）", id: "hold" },
    ],
  };

  await deps.graphClient.sendAdaptiveCard({ channelOrChatId: channelId, card });
  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-CHG",
    action: "send_approval_card",
    basis: "SPEC-EXT-010",
    detail: { projectName: pkg.projectName, riskScore: pkg.riskScore.score },
    at: new Date().toISOString(),
  });
}

export interface PartnerCompanyNotifyTarget {
  email: string;
  language: "ja" | "en";
}

const RELEASE_NOTICE_TEXT = {
  ja: (time: string) => `本番リリースを予定しています（予定時刻: ${time}）。ご不明点は担当PMまでお問い合わせください。`,
  en: (time: string) =>
    `A production release is scheduled (planned time: ${time}). Please contact your PM with any questions.`,
};

/** SPEC-EXT-033 / REQ-027（多言語通知）: 承認完了時点で影響対象企業へリリース事前通知を送信する */
export async function notifyPartnersOfRelease(
  targets: PartnerCompanyNotifyTarget[],
  scheduledAt: Date,
  fromMailbox: string,
  deps: ChgDependencies,
): Promise<void> {
  const timeLabel = formatExternalDateTime(scheduledAt);
  for (const target of targets) {
    await deps.graphClient.sendMail({
      toEmail: target.email,
      subject: target.language === "ja" ? "【リリース事前通知】" : "[Release Notice]",
      htmlBody: `<p>${RELEASE_NOTICE_TEXT[target.language](timeLabel)}</p>`,
      fromMailbox,
    });
  }
  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-CHG",
    action: "notify_partners",
    basis: "SPEC-EXT-033",
    detail: { count: targets.length },
    at: new Date().toISOString(),
  });
}

// 注: calculateRiskScore は lib/riskScore.js からパッケージバレル(index.ts)経由でも参照可能なため、
// ここでの再エクスポートは行わない（バレルでの重複エクスポート衝突を避けるため）。
