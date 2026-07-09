/**
 * packages/devops/src/lib/thresholds.ts
 *
 * 根拠: DOC-ANL-01 §2.5 判断基準（閾値）一覧 ※全文書共通の正定義
 *   TH-001 ステージング自動昇格条件: CI全ジョブ成功 AND 単体テストカバレッジ80%以上 AND 静的解析Critical指摘0件
 *   TH-002 本番デプロイ承認: リーダー以上Teams承認必須。30分無応答でマネージャーへエスカレーション、
 *          60分無応答でデプロイ自動中止（ステータス「期限切れ」）
 *   TH-004 一次切り分けSLA: アラート受信から5分以内に重大度分類・起票・通知を完了
 *   TH-005 エスカレーション時限: Sev1/Sev2で当番メンバーが通知後10分以内に応答(Ack)しない場合リーダーへ、
 *          20分でマネージャーへ自動エスカレーション
 *
 * TH-003（自動ロールバック）はdeployMonitor.ts、TH-006（誤検知抑制）はfalsePositiveRule.ts、
 * TH-007（JIT失効）はjitExpiry.tsに分離する。
 *
 * SPEC-INT-041 スケジューラ: TH-002/TH-005等のタイマージョブは永続化キューで管理し、
 * プロセス再起動でタイマーが消失しないこと。本ファイルのevaluateTh002ApprovalTimer /
 * evaluateTh005Escalationは「現在時刻と起点時刻の差分」から都度再計算する副作用のない設計とし、
 * これにより判定ロジック自体はプロセス再起動に対して自然に耐性を持つ
 * （消えてはならない状態はrequestedAt/notifiedAt等のタイムスタンプのみで、永続ストア側の責務とする）。
 */

export interface Th001Input {
  ciAllJobsSuccess: boolean;
  unitTestCoveragePct: number;
  staticAnalysisCriticalCount: number;
}

/** TH-001: ステージング自動昇格条件（AC-003a: カバレッジ80.0%ちょうどは充足＝境界値を満たす） */
export function evaluateTh001StagingPromotion(input: Th001Input): boolean {
  return input.ciAllJobsSuccess && input.unitTestCoveragePct >= 80.0 && input.staticAnalysisCriticalCount === 0;
}

export type Th002State = "pending" | "escalated_to_manager" | "expired";

export interface Th002Input {
  requestedAt: string;
  now: Date;
  decided: boolean;
  alreadyEscalated: boolean;
}

/** TH-002: 30分無応答でマネージャーへエスカレーション、60分無応答でデプロイ自動中止（期限切れ） */
export function evaluateTh002ApprovalTimer(input: Th002Input): Th002State | "none" {
  if (input.decided) return "none";
  const elapsedMin = (input.now.getTime() - Date.parse(input.requestedAt)) / 60000;
  if (elapsedMin >= 60) return "expired";
  if (elapsedMin >= 30 && !input.alreadyEscalated) return "escalated_to_manager";
  return "none";
}

/** TH-004: アラート受信から5分以内にAGT-INCが重大度分類・起票・通知を完了する必要がある（SLA判定） */
export function isWithinTh004Sla(receivedAt: string, completedAt: string): boolean {
  const elapsedMin = (Date.parse(completedAt) - Date.parse(receivedAt)) / 60000;
  return elapsedMin <= 5;
}

export type Th005EscalationTarget = "leader" | "manager" | "none";

export interface Th005Input {
  notifiedAt: string;
  now: Date;
  acked: boolean;
}

/** TH-005: Ack未応答10分でリーダー、20分でマネージャーへ自動エスカレーション。Ack済みなら停止する。 */
export function evaluateTh005Escalation(input: Th005Input): Th005EscalationTarget {
  if (input.acked) return "none";
  const elapsedMin = (input.now.getTime() - Date.parse(input.notifiedAt)) / 60000;
  if (elapsedMin >= 20) return "manager";
  if (elapsedMin >= 10) return "leader";
  return "none";
}
