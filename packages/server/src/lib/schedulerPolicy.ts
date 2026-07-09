/**
 * packages/server/src/lib/schedulerPolicy.ts
 *
 * 根拠: ADR-0005（常駐ループの実行判定）。
 *   - DevOps SPEC-INT-040: ヘルスチェック30秒間隔 / SPEC-INT-032: JIT失効は毎分。
 *   - setIntervalはイベントループ遅延で累積ずれするため、setTimeout再帰+次回時刻計算で
 *     ドリフトを補正する。その判定ロジックを純粋関数として切り出し、fake timersなしでも検証可能にする。
 *
 * 設計: 純粋関数のみ。
 */

export interface TickState {
  /** 次回実行予定時刻（エポックms）。初期化時は startedAt + intervalMs */
  nextDueAtMs: number;
  /** 前回の run() がまだ実行中か（多重実行ガード） */
  running: boolean;
}

export interface TickDecision {
  /** 今回 run() を実行すべきか */
  shouldRun: boolean;
  /** 実行をスキップした理由（テレメトリ用） */
  skipReason?: "not_due" | "previous_still_running";
  /** 更新後の次回実行予定時刻（エポックms） */
  nextDueAtMs: number;
}

/**
 * ドリフト補正付きの実行判定。
 * - 予定時刻を過ぎていれば実行し、次回予定は「予定時刻 + interval の倍数で現在より未来の最小値」
 *   に設定する（遅延が interval を超えた場合の実行スキップ蓄積を防ぎつつ、バースト実行もしない）。
 * - 前回実行が未完了ならスキップ（多重実行ガード）。次回予定はそのまま維持する。
 */
export function decideTick(state: TickState, nowMs: number, intervalMs: number): TickDecision {
  if (nowMs < state.nextDueAtMs) {
    return { shouldRun: false, skipReason: "not_due", nextDueAtMs: state.nextDueAtMs };
  }
  if (state.running) {
    return { shouldRun: false, skipReason: "previous_still_running", nextDueAtMs: state.nextDueAtMs };
  }
  // 現在時刻より未来になる最小の予定時刻へ進める（ドリフト補正）
  const missed = Math.floor((nowMs - state.nextDueAtMs) / intervalMs) + 1;
  const nextDueAtMs = state.nextDueAtMs + missed * intervalMs;
  return { shouldRun: true, nextDueAtMs };
}

/** 次のtick確認までの待機時間（過ぎていれば0、最小10ms・最大1秒の粒度でポーリング負荷を抑制） */
export function nextCheckDelayMs(nextDueAtMs: number, nowMs: number): number {
  const remaining = nextDueAtMs - nowMs;
  if (remaining <= 0) return 10;
  return Math.min(remaining, 1000);
}
