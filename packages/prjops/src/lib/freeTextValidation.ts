/**
 * packages/prjops/src/lib/freeTextValidation.ts
 *
 * 根拠: REQ-005 自由文の構造化 / PrjOps:SPEC-EXT-011, 012 / PrjOps:SPEC-INT-030
 *   自由文報告の6項目: ①進捗率(0-100の整数%) ②自己申告ステータス(順調/注意/危険 or Green/Yellow/Red)
 *   ③今週の実績 ④来週の予定 ⑤課題(なければ「なし」) ⑥リスク(なければ「なし」)
 *   AC-005-1: 必須6項目のうち欠落があった場合、聞き返しが自動送信される。
 *   AC-005-2: 聞き返しは最大3回。3回で充足しない場合は運用担当へエスカレーション、「不完全」フラグ。
 *   PrjOps:SPEC-INT-030手順3: 必須6項目の欠落判定は構造化後にコードで実施（LLMに判定させない）。
 *   PrjOps:SPEC-EXT-012 / PrjOps:SPEC-EXT-032（通知一覧の聞き返し）: 聞き返しの文面形式「不足: ②ステータス, ⑥リスク」。
 *
 * 設計方針: LLM構造化の出力を受け取り、完全性判定は本モジュール（決定的コード）が単独で行う。
 */

export type SelfStatus = "green" | "yellow" | "red";

export interface StructuredStatusUpdate {
  progress_pct?: number | null;
  self_status?: SelfStatus | null;
  achievements?: string | null;
  plans?: string | null;
  issues?: string | null; // 課題なしの場合は "なし"（有効な値。欠落とは区別する）
  risks?: string | null; // リスクなしの場合は "なし"
}

type FieldKey = "progress_pct" | "self_status" | "achievements" | "plans" | "issues" | "risks";

const FIELD_LABELS: Record<FieldKey, { circled: string; label: string }> = {
  progress_pct: { circled: "①", label: "進捗率" },
  self_status: { circled: "②", label: "ステータス" },
  achievements: { circled: "③", label: "今週の実績" },
  plans: { circled: "④", label: "来週の予定" },
  issues: { circled: "⑤", label: "課題" },
  risks: { circled: "⑥", label: "リスク" },
};

const FIELD_ORDER: FieldKey[] = ["progress_pct", "self_status", "achievements", "plans", "issues", "risks"];

function isMissingText(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim().length === 0;
}

export interface CompletenessResult {
  complete: boolean;
  missingFields: FieldKey[];
}

/** PrjOps:SPEC-INT-030手順3: 必須6項目の欠落判定（決定的、LLM不使用） */
export function checkCompleteness(input: StructuredStatusUpdate): CompletenessResult {
  const missingFields: FieldKey[] = [];

  if (
    input.progress_pct === null ||
    input.progress_pct === undefined ||
    !Number.isInteger(input.progress_pct) ||
    input.progress_pct < 0 ||
    input.progress_pct > 100
  ) {
    missingFields.push("progress_pct");
  }
  if (!input.self_status || !["green", "yellow", "red"].includes(input.self_status)) {
    missingFields.push("self_status");
  }
  if (isMissingText(input.achievements)) missingFields.push("achievements");
  if (isMissingText(input.plans)) missingFields.push("plans");
  // 課題・リスクは「なし」という文字列も有効な値として扱う（欠落ではない）
  if (isMissingText(input.issues)) missingFields.push("issues");
  if (isMissingText(input.risks)) missingFields.push("risks");

  return { complete: missingFields.length === 0, missingFields };
}

/** PrjOps:SPEC-EXT-012: 「不足: ②ステータス, ⑥リスク」形式の聞き返しメッセージを生成する */
export function formatClarificationMessage(missingFields: FieldKey[], lang: "ja" | "en" = "ja"): string {
  const ordered = FIELD_ORDER.filter((f) => missingFields.includes(f));
  if (lang === "en") {
    const parts = ordered.map((f) => `${FIELD_LABELS[f].circled}${f}`);
    return `Missing: ${parts.join(", ")}`;
  }
  const parts = ordered.map((f) => `${FIELD_LABELS[f].circled}${FIELD_LABELS[f].label}`);
  return `不足: ${parts.join(", ")}`;
}

export interface ClarificationState {
  clarifyCount: number; // これまでの聞き返し回数
}

export interface ClarificationDecision {
  action: "accept" | "clarify" | "escalate_incomplete";
}

/** AC-005-2: 聞き返しは最大3回。3回で充足しない場合は「不完全」フラグ＋運用担当へエスカレーション。 */
export function decideClarificationAction(
  completeness: CompletenessResult,
  state: ClarificationState,
): ClarificationDecision {
  if (completeness.complete) return { action: "accept" };
  if (state.clarifyCount >= 3) return { action: "escalate_incomplete" };
  return { action: "clarify" };
}

/** 自己申告ステータスの表記ゆれ（順調/注意/危険 ⇔ green/yellow/red）を正規化する（PrjOps:SPEC-EXT-011） */
export function normalizeSelfStatus(raw: string): SelfStatus | null {
  const t = raw.trim().toLowerCase();
  if (t === "green" || t === "順調") return "green";
  if (t === "yellow" || t === "注意") return "yellow";
  if (t === "red" || t === "危険") return "red";
  return null;
}
