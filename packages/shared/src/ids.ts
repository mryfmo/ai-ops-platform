/**
 * packages/shared/src/ids.ts
 *
 * 根拠: PrjOps DOC-00 §6（ID体系）、SPEC-INT-020/021/024/025/026（各IDフォーマット）、
 *       DevOps SPEC-INT-010（trace_id）、SPEC-EXT-001（trace_id末尾表記）。
 *
 * 設計方針: IDは一度発行したら再利用しない（DOC-00 §6）。本モジュールは
 *   (a) フォーマット検証（正規表現ベース、決定的）
 *   (b) 新規ID生成（連番はカウンタを外部から注入する。本モジュール自体は状態を持たない）
 *   の2つを提供する。永続化されたカウンタ管理は呼び出し側（各エージェントの正本更新処理）が行う。
 */
import { randomUUID } from "node:crypto";
import { JST_UTC_LABEL, toJstClock } from "./jst.js";

export const ID_PATTERNS = {
  // PrjOps
  project: /^PJ-\d{3,}$/,
  stakeholder: /^ST-\d{3,}$/,
  organization: /^ORG-\d{3,}$/,
  statusUpdate: /^SU-PJ-\d{3,}-\d{4}-W\d{2}-\d+$/,
  issue: /^ISSUE-\d{3,}$/,
  risk: /^RISK-\d{3,}$/,
  action: /^ACT-\d{3,}$/,
  reportJob: /^RPT-[A-Z0-9]+-[A-Za-z0-9]+-[0-9A-Za-z-]+-[A-Za-z0-9.]+$/,
  // DevOps
  projectDevOps: /^PRJ-\d{3,}$/,
  incident: /^INC-\d{3,}$/,
  grant: /^GRANT-\d{3,}$/,
  deploy: /^DEP-\d{3,}$/,
} as const;

export type PrjOpsIdKind =
  "project" | "stakeholder" | "organization" | "statusUpdate" | "issue" | "risk" | "action" | "reportJob";
export type DevOpsIdKind = "projectDevOps" | "incident" | "grant" | "deploy";

export function isValidId(kind: keyof typeof ID_PATTERNS, value: string): boolean {
  return ID_PATTERNS[kind].test(value);
}

export function assertValidId(kind: keyof typeof ID_PATTERNS, value: string): void {
  if (!isValidId(kind, value)) {
    throw new Error(`E-ID01: "${value}" is not a valid ${kind} ID (pattern: ${ID_PATTERNS[kind]})`);
  }
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** PJ-nnn 形式（REQ-001） */
export function formatProjectId(seq: number): string {
  return `PJ-${pad(seq, 3)}`;
}
/** ST-nnn 形式（REQ-002） */
export function formatStakeholderId(seq: number): string {
  return `ST-${pad(seq, 3)}`;
}
/** ORG-nnn 形式（REQ-002） */
export function formatOrganizationId(seq: number): string {
  return `ORG-${pad(seq, 3)}`;
}
/** ACT-nnn 形式（SPEC-INT-025） */
export function formatActionId(seq: number): string {
  return `ACT-${pad(seq, 4)}`;
}
/** ISSUE-nnn 形式（SPEC-INT-024） */
export function formatIssueId(seq: number): string {
  return `ISSUE-${pad(seq, 4)}`;
}
/** RISK-nnn 形式（SPEC-INT-024） */
export function formatRiskId(seq: number): string {
  return `RISK-${pad(seq, 4)}`;
}

/**
 * SU-{PJ-nnn}-{YYYY}-W{ww}-{seq} 形式（SPEC-INT-020）。
 * seq: 同一週の版番号。最新のみ有効（REQ-004 AC-004-2）。
 */
export function formatStatusUpdateId(projectId: string, isoYear: number, isoWeek: number, seq: number): string {
  assertValidId("project", projectId);
  return `SU-${projectId}-${isoYear}-W${pad(isoWeek, 2)}-${seq}`;
}

/**
 * RPT-{profile}-{scope}-{period}-{recipient} 形式（SPEC-INT-026）。
 * profile: M/L/G/PRF-01等, scope: プロジェクトIDや"ALL"等, period: 期間識別子, recipient: 受信者ID
 */
export function formatReportId(profile: string, scope: string, period: string, recipient: string): string {
  return `RPT-${profile}-${scope}-${period}-${recipient}`;
}

/** DevOps: PRJ-nnn（DOC-ANL-01/PRD-02全体） */
export function formatDevOpsProjectId(seq: number): string {
  return `PRJ-${pad(seq, 3)}`;
}
/** DevOps: INC-nnn（SPEC-INT-052） */
export function formatIncidentId(seq: number): string {
  return `INC-${pad(seq, 4)}`;
}
/** DevOps: GRANT-nnn（SPEC-INT-053） */
export function formatGrantId(seq: number): string {
  return `GRANT-${pad(seq, 4)}`;
}
/** DevOps: DEP-nnn（SPEC-INT-051） */
export function formatDeployId(seq: number): string {
  return `DEP-${pad(seq, 4)}`;
}

/**
 * trace_id (UUIDv4)。DevOps SPEC-INT-010（イベント受信時に採番し全出力に伝搬）、
 * PrjOps AGT-07監査ログのレコード相関にも使用する。
 */
export function newTraceId(): string {
  return randomUUID();
}

/** ISO 8601 + JST オフセット表記（DOC-05 §8「内部保存はISO 8601＋タイムゾーン」） */
export function nowIsoJst(now: Date = new Date()): string {
  const jst = toJstClock(now);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  const s = String(jst.getUTCSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
}

/** 外部向け日時表記（SPEC-EXT-027: JST時刻とUTCオフセットを明示） */
export function formatExternalDateTime(now: Date = new Date()): string {
  const jst = toJstClock(now);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi} JST (${JST_UTC_LABEL})`;
}

/** ISO週番号（月曜始まり、ISO 8601）を返す。status_updateのID生成（period.start基準）に使用。 */
export function isoWeekOf(dateStr: string): { isoYear: number; isoWeek: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { isoYear: date.getUTCFullYear(), isoWeek: week };
}
