/**
 * packages/prjops/src/lib/reportJobStateMachine.ts
 *
 * 根拠: SPEC-INT-026 report_job / SPEC-INT-050 承認状態遷移
 *   状態遷移: generated → verified → (PRF-01..03: → delivered) / (PRF-04,05: → pending_approval → approved → delivered)
 *   分岐: pending_approval → rejected（差し戻し。コメント必須）
 *   状態遷移は上記の順のみ許可（スキップ不可）[REQ-017 AC-017-1]。
 *   AC-017-1: 承認前に配信された事例が発生しない（audit_logで機械検証可能）。
 *
 * 設計方針: 遷移表を明示的に定義し、許可されない遷移は例外を投げる（コードレベルでスキップを禁止する）。
 */

export type ReportStatus =
  "generated" | "verified" | "pending_approval" | "approved" | "rejected" | "delivered" | "failed";
export type Profile = "PRF-01" | "PRF-02" | "PRF-03" | "PRF-04" | "PRF-05";

/** ASM-004: 経営陣(PRF-04)・投資元(PRF-05)向けレポートは配信前にマネージャー承認が必須 */
export function requiresApproval(profile: Profile): boolean {
  return profile === "PRF-04" || profile === "PRF-05";
}

function allowedNextStates(current: ReportStatus, profile: Profile): ReportStatus[] {
  switch (current) {
    case "generated":
      return ["verified", "failed"]; // AGT-07検証の結果
    case "verified":
      return requiresApproval(profile) ? ["pending_approval"] : ["delivered"];
    case "pending_approval":
      return ["approved", "rejected"];
    case "approved":
      return ["delivered"];
    case "rejected":
    case "delivered":
    case "failed":
      return []; // 終端状態
  }
}

export class InvalidReportTransitionError extends Error {
  constructor(from: ReportStatus, to: ReportStatus, profile: Profile) {
    super(
      `E-RPT01: invalid report_job transition ${from} -> ${to} for profile ${profile} (SPEC-INT-026/SPEC-INT-050, REQ-017 AC-017-1: skipping states is not allowed)`,
    );
  }
}

/** 遷移が許可されているかを判定する（許可されていなければ例外を投げる版はassertReportTransition） */
export function canTransitionReport(from: ReportStatus, to: ReportStatus, profile: Profile): boolean {
  return allowedNextStates(from, profile).includes(to);
}

/** AC-017-1を強制する: 承認前配信（verified/pending_approval -> delivered を承認プロファイルでスキップ）を例外にする */
export function assertReportTransition(from: ReportStatus, to: ReportStatus, profile: Profile): void {
  if (!canTransitionReport(from, to, profile)) {
    throw new InvalidReportTransitionError(from, to, profile);
  }
}

/** レポートが配信可能な状態かどうか（配信キュー投入前の最終ガード） */
export function isDeliverable(status: ReportStatus): boolean {
  return status === "delivered" ? false : status === "approved" || status === "verified";
  // 注: verifiedはrequiresApproval=falseのプロファイルのみdeliverable。呼び出し側でprofileも併せて確認すること。
}

/** 「承認前に配信された」ことを監査ログの遷移列から検出するヘルパ（AC-017-1の機械検証に使用） */
export function detectPreApprovalDelivery(transitionLog: ReportStatus[], profile: Profile): boolean {
  if (!requiresApproval(profile)) return false; // 承認不要プロファイルには適用外
  const deliveredIndex = transitionLog.indexOf("delivered");
  if (deliveredIndex === -1) return false;
  const approvedIndex = transitionLog.indexOf("approved");
  return approvedIndex === -1 || approvedIndex > deliveredIndex;
}
