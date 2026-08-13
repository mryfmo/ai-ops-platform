// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// cancellation ヘルパ（正典 component spec 01 Acceptance
// 「Workflow cancellationで未開始の副作用を停止」）。
// 副作用 dispatch の直前に必ず guardSideEffectDispatch を通す契約とする。

import { CancellationScope, CancelledFailure } from "@temporalio/workflow";

/**
 * cancellation 要求済みなら CancelledFailure を投げ、未開始の副作用 dispatch を止める。
 * 実行中 activity の中断は Temporal 本体（heartbeat/cancellationType）が担い、
 * このヘルパは「これから開始する副作用を開始しない」ことのみを保証する。
 */
export function guardSideEffectDispatch(context: string): void {
  if (CancellationScope.current().consideredCancelled) {
    throw new CancelledFailure(`side effect dispatch blocked by cancellation: ${context}`);
  }
}

/**
 * cancel 後の後始末（補償・台帳記録）を実行するための non-cancellable scope。
 * CancelledFailure はそのまま伝播させる（握り潰さない）。
 */
export async function runCleanup<T>(cleanup: () => Promise<T>): Promise<T> {
  return CancellationScope.nonCancellable(cleanup);
}
