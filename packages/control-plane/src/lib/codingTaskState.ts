// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006 / ADR-0020
// CodingTaskWorkflow の状態機械（正典 component spec 01:
// requested → approval_pending → queued → running → pr_created|no_change|failed
// → review_pending → complete）。判定はすべて純粋関数。signal は transport 境界を
// 保証しないため unknown 受け + 参照前形検証（P3-T03-001 の恒久則）。

/** 正典の workflow phase。 */
export const CODING_TASK_PHASES = [
  "requested",
  "approval_pending",
  "queued",
  "running",
  "pr_created",
  "no_change",
  "failed",
  "review_pending",
  "complete",
] as const;

export type CodingTaskPhase = (typeof CODING_TASK_PHASES)[number];

export type CallbackOutcome = "pr_created" | "no_change" | "failed";

/** GitHub Actions callback signal の payload。 */
export interface CodingTaskCallbackPayload {
  readonly taskId: string;
  readonly outcome: CallbackOutcome;
  readonly runId: string;
  readonly prNumber?: number;
}

/** レビュー完了 signal の payload。 */
export interface CodingTaskReviewPayload {
  readonly taskId: string;
  readonly verdict: "complete";
  readonly reviewerObjectId: string;
}

export type CallbackRejectReason =
  "malformed-payload" | "task-id-mismatch" | "wrong-phase" | "duplicate-callback" | "conflicting-callback";

export type CallbackEvaluation =
  | { readonly accepted: true; readonly outcome: CallbackOutcome }
  | { readonly accepted: false; readonly reason: CallbackRejectReason };

export type ReviewRejectReason = "malformed-payload" | "task-id-mismatch" | "wrong-phase" | "missing-reviewer";

export type ReviewEvaluation =
  { readonly accepted: true } | { readonly accepted: false; readonly reason: ReviewRejectReason };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CALLBACK_OUTCOMES: readonly string[] = ["pr_created", "no_change", "failed"];

/** workflow 入力の境界検証。契約違反は E-CP-CONTRACT 相当（non-retryable）。 */
export function assertCodingTaskRequest(input: {
  taskId: string;
  approvalId: string;
  approvalVersion: number;
  approvalExpiryMs: number;
  callbackTimeoutMs: number;
  reviewTimeoutMs: number;
}): void {
  if (!UUID_PATTERN.test(input.taskId)) {
    throw new RangeError(`taskId must be a lowercase UUID (got ${JSON.stringify(input.taskId)})`);
  }
  if (!UUID_PATTERN.test(input.approvalId)) {
    throw new RangeError(`approvalId must be a lowercase UUID (got ${JSON.stringify(input.approvalId)})`);
  }
  if (!Number.isSafeInteger(input.approvalVersion) || input.approvalVersion < 1) {
    throw new RangeError(`approvalVersion must be a positive safe integer (got ${String(input.approvalVersion)})`);
  }
  for (const [name, value] of [
    ["approvalExpiryMs", input.approvalExpiryMs],
    ["callbackTimeoutMs", input.callbackTimeoutMs],
    ["reviewTimeoutMs", input.reviewTimeoutMs],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive safe integer (got ${String(value)})`);
    }
  }
}

/**
 * callback signal の受理判定。受理は「running phase かつ taskId 一致 かつ
 * outcome が正典 3 値 かつ 未決」のときのみ。決定後の同一 outcome 再送は
 * duplicate（冪等 = 状態不変）、異なる outcome は conflicting（先勝ち）。
 */
export function evaluateCallbackSignal(
  state: { readonly taskId: string; readonly phase: CodingTaskPhase; readonly decidedOutcome: CallbackOutcome | null },
  signal: unknown,
): CallbackEvaluation {
  if (typeof signal !== "object" || signal === null || Array.isArray(signal)) {
    return { accepted: false, reason: "malformed-payload" };
  }
  const candidate = signal as Partial<CodingTaskCallbackPayload>;
  if (
    typeof candidate.taskId !== "string" ||
    typeof candidate.runId !== "string" ||
    candidate.runId.trim().length === 0 ||
    typeof candidate.outcome !== "string" ||
    !CALLBACK_OUTCOMES.includes(candidate.outcome)
  ) {
    return { accepted: false, reason: "malformed-payload" };
  }
  if (candidate.taskId !== state.taskId) return { accepted: false, reason: "task-id-mismatch" };
  if (state.decidedOutcome !== null) {
    return {
      accepted: false,
      reason: candidate.outcome === state.decidedOutcome ? "duplicate-callback" : "conflicting-callback",
    };
  }
  if (state.phase !== "running") return { accepted: false, reason: "wrong-phase" };
  return { accepted: true, outcome: candidate.outcome as CallbackOutcome };
}

/** レビュー完了 signal の受理判定。review_pending でのみ受理、記名 reviewer 必須。 */
export function evaluateReviewSignal(
  state: { readonly taskId: string; readonly phase: CodingTaskPhase },
  signal: unknown,
): ReviewEvaluation {
  if (typeof signal !== "object" || signal === null || Array.isArray(signal)) {
    return { accepted: false, reason: "malformed-payload" };
  }
  const candidate = signal as Partial<CodingTaskReviewPayload>;
  if (typeof candidate.taskId !== "string" || candidate.verdict !== "complete") {
    return { accepted: false, reason: "malformed-payload" };
  }
  if (candidate.taskId !== state.taskId) return { accepted: false, reason: "task-id-mismatch" };
  if (typeof candidate.reviewerObjectId !== "string" || candidate.reviewerObjectId.trim().length === 0) {
    return { accepted: false, reason: "missing-reviewer" };
  }
  if (state.phase !== "review_pending") return { accepted: false, reason: "wrong-phase" };
  return { accepted: true };
}

/** callback outcome から次 phase を返す（正典の分岐そのまま）。 */
export function phaseAfterCallback(outcome: CallbackOutcome): CodingTaskPhase {
  return outcome === "failed" ? "failed" : outcome;
}
