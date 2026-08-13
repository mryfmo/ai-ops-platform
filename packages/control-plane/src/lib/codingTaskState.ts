// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006 / ADR-0020
// CodingTaskWorkflow の状態機械（正典 component spec 01:
// requested → approval_pending → queued → running → pr_created|no_change|failed
// → review_pending → complete）。判定はすべて純粋関数。signal/activity 結果は
// transport 境界を保証しないため unknown 受け + 参照前形検証（P3-T03-001 の恒久則）。
// review の完了権威は DB 正本（P3-T04-001）: signal は wake 専用で、完了は
// evaluateReviewDecision が authoritative read の complete を確認したときのみ。

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

/** GitHub Actions callback signal の payload。dispatchId で発火済み dispatch に束縛する。 */
export interface CodingTaskCallbackPayload {
  readonly taskId: string;
  readonly dispatchId: string;
  readonly outcome: CallbackOutcome;
  readonly runId: string;
  readonly prNumber?: number;
}

/** 受理済み callback の同一性（exact replay 判定に使う不変 identity）。 */
export interface AcceptedCallback {
  readonly outcome: CallbackOutcome;
  readonly runId: string;
  readonly prNumber: number | null;
}

/** review wake signal の payload（wake 専用。完了権威ではない）。 */
export interface CodingTaskReviewPayload {
  readonly taskId: string;
  readonly verdict: "complete";
  readonly reviewerObjectId: string;
}

export type CallbackRejectReason =
  | "malformed-payload"
  | "task-id-mismatch"
  | "dispatch-mismatch"
  | "wrong-phase"
  | "duplicate-callback"
  | "conflicting-callback";

export type CallbackEvaluation =
  | { readonly accepted: true; readonly callback: AcceptedCallback }
  | { readonly accepted: false; readonly reason: CallbackRejectReason };

export type ReviewRejectReason =
  "malformed-payload" | "task-id-mismatch" | "wrong-phase" | "missing-reviewer" | "unconfirmed-review";

export type ReviewEvaluation =
  { readonly accepted: true } | { readonly accepted: false; readonly reason: ReviewRejectReason };

export type ReviewDecisionEvaluation =
  | { readonly accepted: true; readonly reviewerObjectId: string }
  | { readonly accepted: false; readonly reason: "unconfirmed-review" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CALLBACK_OUTCOMES: readonly string[] = ["pr_created", "no_change", "failed"];

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * workflow 入力の境界検証。TypeScript 型は Temporal payload の runtime 境界に
 * ならないため（P3-T04-004）、VersionedPayload 封筒・repository・requestedBy を
 * 含む全体を unknown から検証する。契約違反は E-CP-CONTRACT 相当（non-retryable）。
 */
export function assertCodingTaskRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: {
    taskId: string;
    approvalId: string;
    approvalVersion: number;
    approvalExpiryMs: number;
    callbackTimeoutMs: number;
    repository: { owner: string; repo: string; ref: string };
    requestedBy: string;
  };
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("coding task request must be a VersionedPayload object");
  }
  const envelope = input as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1) {
    throw new RangeError(`unsupported schemaVersion (got ${String(envelope.schemaVersion)})`);
  }
  if (typeof envelope.payload !== "object" || envelope.payload === null || Array.isArray(envelope.payload)) {
    throw new RangeError("coding task request payload must be an object");
  }
  const p = envelope.payload as Record<string, unknown>;
  if (typeof p.taskId !== "string" || !UUID_PATTERN.test(p.taskId)) {
    throw new RangeError(`taskId must be a lowercase UUID (got ${JSON.stringify(p.taskId)})`);
  }
  if (typeof p.approvalId !== "string" || !UUID_PATTERN.test(p.approvalId)) {
    throw new RangeError(`approvalId must be a lowercase UUID (got ${JSON.stringify(p.approvalId)})`);
  }
  if (!Number.isSafeInteger(p.approvalVersion) || (p.approvalVersion as number) < 1) {
    throw new RangeError(`approvalVersion must be a positive safe integer (got ${String(p.approvalVersion)})`);
  }
  for (const name of ["approvalExpiryMs", "callbackTimeoutMs"] as const) {
    const value = p[name];
    if (!Number.isSafeInteger(value) || (value as number) < 1) {
      throw new RangeError(`${name} must be a positive safe integer (got ${String(value)})`);
    }
  }
  const repository = p.repository as Record<string, unknown> | null | undefined;
  if (typeof repository !== "object" || repository === null || Array.isArray(repository)) {
    throw new RangeError("repository must be an object");
  }
  for (const name of ["owner", "repo", "ref"] as const) {
    if (!isNonBlankString(repository[name])) {
      throw new RangeError(`repository.${name} must be a non-blank string (got ${JSON.stringify(repository[name])})`);
    }
  }
  if (!isNonBlankString(p.requestedBy)) {
    throw new RangeError(`requestedBy must be a non-blank string (got ${JSON.stringify(p.requestedBy)})`);
  }
}

/**
 * callback signal の受理判定（P3-T04-002: dispatch 束縛）。受理は「running phase +
 * taskId 一致 + dispatchId が発火済み dispatch と一致 + 正典 outcome + 未決」のみ。
 * 決定後は (runId, outcome, prNumber) の完全一致 replay だけを duplicate（冪等）、
 * それ以外の同着は conflicting（先勝ち）として拒否する。
 */
export function evaluateCallbackSignal(
  state: {
    readonly taskId: string;
    readonly phase: CodingTaskPhase;
    readonly dispatchId: string | null;
    readonly accepted: AcceptedCallback | null;
  },
  signal: unknown,
): CallbackEvaluation {
  if (typeof signal !== "object" || signal === null || Array.isArray(signal)) {
    return { accepted: false, reason: "malformed-payload" };
  }
  const candidate = signal as Partial<CodingTaskCallbackPayload>;
  const prNumber = candidate.prNumber;
  if (
    typeof candidate.taskId !== "string" ||
    !isNonBlankString(candidate.dispatchId) ||
    !isNonBlankString(candidate.runId) ||
    typeof candidate.outcome !== "string" ||
    !CALLBACK_OUTCOMES.includes(candidate.outcome) ||
    (prNumber !== undefined && (!Number.isSafeInteger(prNumber) || prNumber < 1))
  ) {
    return { accepted: false, reason: "malformed-payload" };
  }
  if (candidate.taskId !== state.taskId) return { accepted: false, reason: "task-id-mismatch" };
  if (state.dispatchId === null || candidate.dispatchId !== state.dispatchId) {
    return { accepted: false, reason: "dispatch-mismatch" };
  }
  if (state.accepted !== null) {
    const exactReplay =
      candidate.runId === state.accepted.runId &&
      candidate.outcome === state.accepted.outcome &&
      (prNumber ?? null) === state.accepted.prNumber;
    return { accepted: false, reason: exactReplay ? "duplicate-callback" : "conflicting-callback" };
  }
  if (state.phase !== "running") return { accepted: false, reason: "wrong-phase" };
  return {
    accepted: true,
    callback: { outcome: candidate.outcome as CallbackOutcome, runId: candidate.runId, prNumber: prNumber ?? null },
  };
}

/** review wake signal の形検証。受理 = wake（完了は evaluateReviewDecision が握る）。 */
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
  if (!isNonBlankString(candidate.reviewerObjectId)) {
    return { accepted: false, reason: "missing-reviewer" };
  }
  if (state.phase !== "review_pending") return { accepted: false, reason: "wrong-phase" };
  return { accepted: true };
}

/**
 * authoritative review decision（DB 正本の read 結果）の検証（P3-T04-001）。
 * 完了は「taskId 一致 + status complete + 記名 reviewer」を read が確認したときのみ。
 * それ以外（pending・null・形不正・不一致）はすべて unconfirmed として待機継続。
 */
export function evaluateReviewDecision(taskId: string, decision: unknown): ReviewDecisionEvaluation {
  if (typeof decision !== "object" || decision === null || Array.isArray(decision)) {
    return { accepted: false, reason: "unconfirmed-review" };
  }
  const candidate = decision as { taskId?: unknown; status?: unknown; reviewerObjectId?: unknown };
  if (candidate.taskId !== taskId || candidate.status !== "complete" || !isNonBlankString(candidate.reviewerObjectId)) {
    return { accepted: false, reason: "unconfirmed-review" };
  }
  return { accepted: true, reviewerObjectId: candidate.reviewerObjectId };
}

/** callback outcome から次 phase を返す（正典の分岐そのまま）。 */
export function phaseAfterCallback(outcome: CallbackOutcome): CodingTaskPhase {
  return outcome === "failed" ? "failed" : outcome;
}
