/**
 * packages/shared/src/reporting/statusIngestContract.ts
 *
 * 根拠: PrjOps:REQ-004 / PrjOps:REQ-005 / PrjOps:SPEC-INT-030 /
 * PrjOps:SPEC-EXT-011 / PrjOps:SPEC-EXT-012 / PrjOps:SPEC-EXT-013 /
 * PrjOps:SPEC-EXT-032 / PrjOps:SPEC-EXT-033。
 * A054 が runtime ingest を接続するまで pure contract として保持する。
 * PrjOps:SPEC-EXT-013 / PrjOps:SPEC-EXT-033 の受理通知は A054 の未実装義務であり、
 * この参照は実装済みを意味しない。
 */

export type SelfStatus = "green" | "yellow" | "red";

export interface StructuredStatusUpdate {
  progress_pct?: number | null;
  self_status?: SelfStatus | null;
  achievements?: string | null;
  plans?: string | null;
  issues?: string | null;
  risks?: string | null;
}

export type StatusFieldKey = "progress_pct" | "self_status" | "achievements" | "plans" | "issues" | "risks";

const FIELD_LABELS: Record<StatusFieldKey, { circled: string; label: string }> = {
  progress_pct: { circled: "①", label: "進捗率" },
  self_status: { circled: "②", label: "ステータス" },
  achievements: { circled: "③", label: "今週の実績" },
  plans: { circled: "④", label: "来週の予定" },
  issues: { circled: "⑤", label: "課題" },
  risks: { circled: "⑥", label: "リスク" },
};
const FIELD_ORDER: StatusFieldKey[] = ["progress_pct", "self_status", "achievements", "plans", "issues", "risks"];

export interface CompletenessResult {
  complete: boolean;
  missingFields: StatusFieldKey[];
}

function isMissingText(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

/** PrjOps:SPEC-INT-030 手順3: 必須6項目の完全性をコードで判定する。 */
export function checkCompleteness(input: StructuredStatusUpdate): CompletenessResult {
  const missingFields: StatusFieldKey[] = [];
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
  if (isMissingText(input.issues)) missingFields.push("issues");
  if (isMissingText(input.risks)) missingFields.push("risks");
  return { complete: missingFields.length === 0, missingFields };
}

export function formatClarificationMessage(missingFields: StatusFieldKey[], lang: "ja" | "en" = "ja"): string {
  const ordered = FIELD_ORDER.filter((field) => missingFields.includes(field));
  const parts = ordered.map((field) => {
    const prefix = FIELD_LABELS[field].circled;
    return `${prefix}${lang === "ja" ? FIELD_LABELS[field].label : field}`;
  });
  return `${lang === "ja" ? "不足" : "Missing"}: ${parts.join(", ")}`;
}

export interface ClarificationState {
  clarifyCount: number;
}

export interface ClarificationDecision {
  action: "accept" | "clarify" | "escalate_incomplete";
}

/** PrjOps:REQ-005: 3回の聞き返し後も不完全ならエスカレーションする。 */
export function decideClarificationAction(
  completeness: CompletenessResult,
  state: ClarificationState,
): ClarificationDecision {
  if (completeness.complete) return { action: "accept" };
  return { action: state.clarifyCount >= 3 ? "escalate_incomplete" : "clarify" };
}

export function normalizeSelfStatus(raw: string): SelfStatus | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "green" || normalized === "順調") return "green";
  if (normalized === "yellow" || normalized === "注意") return "yellow";
  if (normalized === "red" || normalized === "危険") return "red";
  return null;
}

const PROJECT_ID_PATTERN = /PJ-\d{3,}/;

export interface StatusReportProjectHints {
  subject?: string;
  body: string;
  projectIdHintFromSender?: string;
}

/** PrjOps:SPEC-INT-030 手順2: 件名→本文→sender hint の順で project を解決する。 */
export function resolveStatusReportProjectId(report: StatusReportProjectHints): string | null {
  const subjectMatch = report.subject?.match(PROJECT_ID_PATTERN);
  if (subjectMatch) return subjectMatch[0];
  const bodyMatch = report.body.match(PROJECT_ID_PATTERN);
  if (bodyMatch) return bodyMatch[0];
  return report.projectIdHintFromSender ?? null;
}
