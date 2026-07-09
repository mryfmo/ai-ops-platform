/**
 * packages/prjops/src/lib/approvalTimer.ts
 *
 * 根拠: REQ-017 承認ゲート / AC-017-2 / SPEC-INT-050 / SPEC-EXT-038（承認依頼/承認督促の通知一覧項目）
 *   承認期限24時間超過で代理承認者へ、さらに24時間で配信保留のまま遅延通知（DOC-02 §4）。
 *   SPEC-INT-050: 24h/48h判定は track-daily とは別の毎時ジョブで行う。
 */

const HOUR_MS = 60 * 60 * 1000;

export type ApprovalTimerAction = "none" | "escalate_to_proxy" | "notify_delay_hold";

export interface ApprovalTimerInput {
  requestedAt: string; // ISO 8601、承認依頼を送付した時刻
  now: Date;
  alreadyEscalatedToProxy: boolean; // 24h超過通知を送付済みか（重複送信防止）
  alreadyNotifiedDelay: boolean; // 48h超過の遅延通知を送付済みか
  decided: boolean; // 既に承認/差し戻し操作がされたか
}

export interface ApprovalTimerResult {
  action: ApprovalTimerAction;
  elapsedHours: number;
}

/** 毎時ジョブから呼ばれる純粋関数。AC-017-2の24h/48hタイマーを判定する。 */
export function evaluateApprovalTimer(input: ApprovalTimerInput): ApprovalTimerResult {
  const elapsedMs = input.now.getTime() - Date.parse(input.requestedAt);
  const elapsedHours = elapsedMs / HOUR_MS;

  if (input.decided) {
    return { action: "none", elapsedHours };
  }
  if (elapsedHours >= 48 && !input.alreadyNotifiedDelay) {
    return { action: "notify_delay_hold", elapsedHours };
  }
  if (elapsedHours >= 24 && !input.alreadyEscalatedToProxy) {
    return { action: "escalate_to_proxy", elapsedHours };
  }
  return { action: "none", elapsedHours };
}
