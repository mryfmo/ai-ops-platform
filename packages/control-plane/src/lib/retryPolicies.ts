// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// operation class ごとに固定の retry policy（正典 component spec 01 Workflow rules:
// 「retry policyはoperation classごとに固定」）。数値はコード定数であり、
// 呼び出し側が上書きできる引数は設けない。純粋定義のみ。

import type { OperationClass } from "../contracts/index.js";

/** Temporal RetryPolicy と構造互換の固定 policy。interval は ms 数値で保持する。 */
export interface FixedRetryPolicy {
  readonly initialIntervalMs: number;
  readonly backoffCoefficient: number;
  readonly maximumIntervalMs: number;
  readonly maximumAttempts: number;
  readonly nonRetryableErrorTypes: readonly string[];
}

/** 入力不正・契約違反はどの class でも再試行しない。 */
const NON_RETRYABLE = Object.freeze(["RangeError", "TypeError", "E-CP-CONTRACT"] as const);

const POLICIES: Readonly<Record<OperationClass, FixedRetryPolicy>> = Object.freeze({
  read: Object.freeze({
    initialIntervalMs: 1_000,
    backoffCoefficient: 2,
    maximumIntervalMs: 30_000,
    maximumAttempts: 5,
    nonRetryableErrorTypes: NON_RETRYABLE,
  }),
  "idempotent-write": Object.freeze({
    initialIntervalMs: 1_000,
    backoffCoefficient: 2,
    maximumIntervalMs: 60_000,
    maximumAttempts: 5,
    nonRetryableErrorTypes: NON_RETRYABLE,
  }),
  // 非冪等な外部副作用は single-attempt。応答喪失時の再実行判断は
  // runExternalSideEffect の reconcile 経路のみが行う（TMP-003）。
  "external-side-effect": Object.freeze({
    initialIntervalMs: 1_000,
    backoffCoefficient: 1,
    maximumIntervalMs: 1_000,
    maximumAttempts: 1,
    nonRetryableErrorTypes: NON_RETRYABLE,
  }),
  // 承認系は人間待ちが本体。activity 自体の再試行は控えめに固定する。
  approval: Object.freeze({
    initialIntervalMs: 5_000,
    backoffCoefficient: 2,
    maximumIntervalMs: 60_000,
    maximumAttempts: 3,
    nonRetryableErrorTypes: NON_RETRYABLE,
  }),
});

/** operation class の固定 retry policy を返す。 */
export function retryPolicyFor(operationClass: OperationClass): FixedRetryPolicy {
  return POLICIES[operationClass];
}

/** Temporal SDK の RetryPolicy（ms 単位オプション）へ変換した形。SDK 型が mutable のため配列は複製する。 */
export function toTemporalRetryPolicy(operationClass: OperationClass): {
  initialInterval: number;
  backoffCoefficient: number;
  maximumInterval: number;
  maximumAttempts: number;
  nonRetryableErrorTypes: string[];
} {
  const p = POLICIES[operationClass];
  return {
    initialInterval: p.initialIntervalMs,
    backoffCoefficient: p.backoffCoefficient,
    maximumInterval: p.maximumIntervalMs,
    maximumAttempts: p.maximumAttempts,
    nonRetryableErrorTypes: [...p.nonRetryableErrorTypes],
  };
}
