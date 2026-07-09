/**
 * packages/devops/src/agents/AGT_ORCH.ts
 *
 * 根拠: SPEC-INT-040 AGT-ORCH / REQ-029 可用性・失敗時挙動
 *   各エージェントのヘルスチェック（30秒間隔）。エージェント不応答が3回連続した場合、
 *   REQ-029のフェイルセーフを発動: 能動操作（デプロイ・自動クローズ・権限剥奪以外の付与）を停止し、
 *   SPEC-EXT-042の通知を送信。権限の自動失効（剥奪）は安全側の操作として継続する。
 *   逸脱監視: 各エージェントの出力が本仕様のスキーマに適合しない場合、当該出力を破棄してリトライ
 *   （最大2回）、それでも失敗した場合は人間へエスカレーションする。
 */

export interface HealthCheckState {
  consecutiveFailures: number;
}

export type FailsafeAction = "none" | "activate_failsafe";

/** REQ-029: 3回連続不応答でフェイルセーフを発動する */
export function evaluateFailsafe(state: HealthCheckState): FailsafeAction {
  return state.consecutiveFailures >= 3 ? "activate_failsafe" : "none";
}

export type OperationKind =
  "auto_deploy" | "auto_close_incident" | "grant_permission" | "revoke_permission" | "send_notification";

/**
 * REQ-029(a): フェイルセーフ発動中に許可される操作かどうか。
 * 「能動的操作（デプロイ・自動クローズ等）は停止」「権限の自動失効（剥奪）は安全側操作として継続」。
 */
export function isOperationAllowedDuringFailsafe(op: OperationKind): boolean {
  return op === "revoke_permission" || op === "send_notification";
}

export type SchemaValidationOutcome = "accept" | "retry" | "escalate_to_human";

export interface SchemaRetryState {
  attemptNumber: number;
}

/** 逸脱監視: スキーマ不適合出力は破棄してリトライ（最大2回）、それでも失敗なら人間へエスカレーション */
export function decideOnSchemaViolation(state: SchemaRetryState): SchemaValidationOutcome {
  return state.attemptNumber <= 2 ? "retry" : "escalate_to_human";
}
