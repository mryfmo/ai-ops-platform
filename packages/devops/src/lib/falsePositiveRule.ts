/**
 * packages/devops/src/lib/falsePositiveRule.ts
 *
 * 根拠: TH-006 誤検知候補条件（DOC-ANL-01 §2.5）/ DevOps:REQ-017
 *   同一アラートルールが直近30日で3回以上「誤検知」ラベルでクローズ済み AND 今回のメトリクス値が
 *   閾値の110%未満 → 自動クローズ候補として人間の確認（24時間以内）に回す。
 *   AC-017a: TH-006充足ケースが候補化され、非充足ケースが候補化されないことを確認。
 *   AC-017b: 人間確認なしで自動クローズされないことを確認（24時間経過してもオープンのまま維持）。
 *   DevOps:SPEC-INT-030手順5: TH-006判定は決定的ロジック（LLM不使用）で実装する。
 */

export interface Th006Input {
  falsePositiveClosuresLast30Days: number;
  currentMetricValue: number;
  alertThreshold: number;
}

/** TH-006: 自動クローズ候補化の判定（決定的、LLM不使用） */
export function evaluateTh006FalsePositiveCandidate(input: Th006Input): boolean {
  // 浮動小数点誤差対策: 100*1.1 は IEEE754 では 110.00000000000001 になり得るため、
  // 「未満」判定が境界値ちょうどで誤ってtrueにならないよう微小イプシロンを差し引く。
  const threshold = input.alertThreshold * 1.1 - 1e-9;
  const withinTolerance = input.currentMetricValue < threshold;
  return input.falsePositiveClosuresLast30Days >= 3 && withinTolerance;
}

export type ConfirmationWindowStatus = "awaiting_confirmation" | "expired_remains_open" | "closed_by_human";

export interface ConfirmationWindowInput {
  candidateFlaggedAt: string; // ISO 8601
  now: Date;
  humanConfirmedClose: boolean;
}

/**
 * AC-017b: 24時間の人間確認ウィンドウ。確認がなければ「オープンのまま維持」（自動クローズはしない）。
 * 本関数はタイマーによる能動的なクローズ操作を一切行わない設計であることを型で表現する
 * （戻り値に"auto_closed"という選択肢自体が存在しない）。
 */
export function evaluateConfirmationWindow(input: ConfirmationWindowInput): ConfirmationWindowStatus {
  if (input.humanConfirmedClose) return "closed_by_human";
  const elapsedHours = (input.now.getTime() - Date.parse(input.candidateFlaggedAt)) / (60 * 60 * 1000);
  return elapsedHours >= 24 ? "expired_remains_open" : "awaiting_confirmation";
}
