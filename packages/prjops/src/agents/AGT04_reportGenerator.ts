/**
 * packages/prjops/src/agents/AGT04_reportGenerator.ts
 *
 * 根拠: PrjOps:REQ-010〜016 / PrjOps:SPEC-INT-031 / DEC-SPEC-007
 *   数値・色・表はコード算出、LLMはプロファイルごとに許可された文章スロットのみ生成する。
 */
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import type { AnthropicStructuredClient } from "@aiops/shared/clients/anthropicClient.js";
import { sanitizeForLlmInput, sanitizeSecrets } from "@aiops/shared/secretSanitizer.js";
import { checkNarrativeHasNoNumbers } from "../lib/narrativeSanitizer.js";
import { composeExecutiveReport, type ComposeCommonOptions } from "../templates/index.js";
import type { ColorDistribution } from "../templates/svgCharts.js";

export const NARRATIVE_SLOTS_BY_PROFILE = {
  "PRF-01": ["own_progress_summary", "own_next_action"],
  "PRF-02": ["project_health_summary", "delivery_risk_summary"],
  "PRF-03": ["portfolio_summary", "escalation_summary"],
  "PRF-04": ["executive_summary", "decision_request_summary"],
  "PRF-05": ["investor_highlight", "investor_risk_outlook"],
} as const;

export type NarrativeProfile = keyof typeof NARRATIVE_SLOTS_BY_PROFILE;
export type NarrativeSlot = (typeof NARRATIVE_SLOTS_BY_PROFILE)[NarrativeProfile][number];
export type NarrativeWarningReason = "missing" | "empty" | "invalid" | "number" | "secret";

export interface NarrativeWarning {
  slot: NarrativeSlot;
  reason: NarrativeWarningReason;
}

export interface ProfileNarrativeInput {
  profile: NarrativeProfile;
  sourceSummaries: string[];
}

export interface NarrativeAuditContext {
  auditLog: AuditLogWriter;
  traceId: string;
}

export interface ProfileNarrativeResult {
  slots: Record<string, string>;
  warnings: NarrativeWarning[];
}

function narrativeToolSchema(profile: NarrativeProfile) {
  return {
    type: "object",
    properties: Object.fromEntries(NARRATIVE_SLOTS_BY_PROFILE[profile].map((slot) => [slot, { type: "string" }])),
    additionalProperties: false,
  } as const;
}

function parseNarratives(raw: unknown, profile: NarrativeProfile): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("E-GEN01: invalid narrative slots");
  const value = raw as Record<string, unknown>;
  const allowed = new Set<string>(NARRATIVE_SLOTS_BY_PROFILE[profile]);
  if (Object.keys(value).some((slot) => !allowed.has(slot))) throw new Error("E-GEN01: invalid narrative slot");
  return value;
}

function sanitizeSlot(value: unknown): { value: string; reason?: NarrativeWarningReason } {
  if (value === undefined) return { value: "", reason: "missing" };
  if (typeof value !== "string") return { value: "", reason: "invalid" };
  if (value.trim().length === 0) return { value: "", reason: "empty" };
  if (sanitizeSecrets(value).redactionCount > 0) return { value: "", reason: "secret" };
  if (!checkNarrativeHasNoNumbers(value).ok) return { value: "", reason: "number" };
  return { value: value.normalize("NFKC").trim() };
}

/** DEC-SPEC-007: profileごとの許可slotだけを生成・検証し、空slotの警告を追記監査する。 */
export async function generateProfileNarratives(
  llmClient: AnthropicStructuredClient,
  input: ProfileNarrativeInput,
  audit: NarrativeAuditContext,
): Promise<ProfileNarrativeResult> {
  const allowedSlots = NARRATIVE_SLOTS_BY_PROFILE[input.profile];
  const safeSummaries = sanitizeForLlmInput(input.sourceSummaries.join(" / ")).sanitized;
  const result = await llmClient.call<Record<string, unknown>>({
    agent: "AGT-04",
    purpose: `profile_narratives_${input.profile}`,
    system:
      `あなたはPMOの${input.profile}向け報告アシスタントです。` +
      `指定された文章スロット（${allowedSlots.join(", ")}）だけを日本語で返してください。` +
      "数値・パーセンテージ・件数・認証情報・個人名は一切書かないでください。",
    user: `根拠情報: ${safeSummaries || "特記事項なし"}`,
    toolName: "emit_profile_narratives",
    toolDescription: `${input.profile}向け文章スロットを返す`,
    inputSchema: narrativeToolSchema(input.profile),
    parse: (raw) => parseNarratives(raw, input.profile),
    maxAttempts: 2,
  });

  const slots: Record<string, string> = {};
  const warnings: NarrativeWarning[] = [];
  for (const slot of allowedSlots) {
    const sanitized = sanitizeSlot(result.value[slot]);
    slots[slot] = sanitized.value;
    if (sanitized.reason) warnings.push({ slot, reason: sanitized.reason });
  }

  if (warnings.length > 0) {
    await audit.auditLog.append({
      trace_id: audit.traceId,
      actor: "AGT-04",
      action: "narrative_slot_warning",
      basis: "DEC-SPEC-007",
      detail: { profile: input.profile, warnings },
      at: new Date().toISOString(),
    });
  }

  return { slots, warnings };
}

export interface ExecutiveNarrativeInput {
  colorDistribution: ColorDistribution;
  topRiskProjectSummaries: string[];
}

/**
 * 旧「結論3行」入口の互換名。LLMにはPRF-04の2 slotだけを許可し、テンプレートの固定3行目は空にする。
 */
export async function generateExecutiveConclusionLines(
  llmClient: AnthropicStructuredClient,
  input: ExecutiveNarrativeInput,
  audit: NarrativeAuditContext,
): Promise<{ conclusionLines: [string, string, string]; warnings: NarrativeWarning[] }> {
  const result = await generateProfileNarratives(
    llmClient,
    { profile: "PRF-04", sourceSummaries: input.topRiskProjectSummaries },
    audit,
  );
  return {
    conclusionLines: [result.slots.executive_summary!, result.slots.decision_request_summary!, ""],
    warnings: result.warnings,
  };
}

/** PRF-04向けレポート生成（文章warningは呼出元へ返す前に監査済み）。 */
export async function generateExecutiveReport(
  llmClient: AnthropicStructuredClient,
  common: ComposeCommonOptions,
  narrativeInput: ExecutiveNarrativeInput,
  topTopics: Array<{ title: string; lines: [string, string] }>,
  monthOverMonthDiffText: string,
  audit: NarrativeAuditContext,
): Promise<string> {
  const { conclusionLines } = await generateExecutiveConclusionLines(llmClient, narrativeInput, audit);
  return composeExecutiveReport(common, {
    conclusionLines,
    colorDistribution: narrativeInput.colorDistribution,
    topTopics,
    monthOverMonthDiffText,
  });
}
