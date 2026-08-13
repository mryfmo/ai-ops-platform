// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006 / ADR-0020
// CodingTaskWorkflow（正典 component spec 01）。approval は P3-T03 approvalWorkflow
// を child workflow として実行し、GitHub dispatch は single-attempt + reconcile
// （TMP-003）、callback/review は unknown 受け signal（replay/duplicate-safe）。
// 承認権威・DB 状態機械の正本（approvalsRepo / codingTasksRepo、ADR-0006 の人間
// 明示クリック経路）は変更しない — この workflow は待機・期限・遷移の耐久化を担う。

import { condition, defineQuery, defineSignal, executeChild, proxyActivities, setHandler } from "@temporalio/workflow";

import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertCodingTaskRequest,
  evaluateCallbackSignal,
  evaluateReviewSignal,
  phaseAfterCallback,
  type CallbackOutcome,
  type CallbackRejectReason,
  type CodingTaskPhase,
  type ReviewRejectReason,
} from "../lib/codingTaskState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { approvalWorkflow, type ApprovalOutcome } from "./approval.js";
import { runExternalSideEffect, ExternalSideEffectUnresolvedError } from "./sideEffect.js";
import type { VersionedPayload } from "../contracts/index.js";

/** workflow が要求する activity 契約（実装は worker 側 DI。実 GitHub 呼び出しはしない）。 */
export interface CodingTaskActivities {
  /** workflow_dispatch の発火（非冪等）。戻り値は dispatch 識別子。 */
  dispatchCodingTask(
    input: { taskId: string; owner: string; repo: string; ref: string },
    idempotencyKey: string,
  ): Promise<string>;
  /** idempotency key での dispatch 存在照会（冪等 read）。 */
  findCodingTaskDispatch(idempotencyKey: string): Promise<string | null>;
}

export interface CodingTaskRequest {
  readonly taskId: string;
  readonly approvalId: string;
  readonly approvalVersion: number;
  readonly approvalExpiryMs: number;
  readonly callbackTimeoutMs: number;
  readonly reviewTimeoutMs: number;
  readonly repository: { readonly owner: string; readonly repo: string; readonly ref: string };
  readonly requestedBy: string;
}

export interface CodingTaskResult {
  readonly taskId: string;
  readonly phase: CodingTaskPhase;
  readonly failureReason:
    | "approval-rejected"
    | "approval-expired"
    | "dispatch-unresolved"
    | "callback-timeout"
    | "review-timeout"
    | "callback-failed"
    | null;
  readonly dispatchOutcome: "executed" | "reconciled" | null;
  readonly callbackOutcome: CallbackOutcome | null;
  readonly rejectedCallbacks: Readonly<Record<CallbackRejectReason, number>>;
  readonly rejectedReviews: Readonly<Record<ReviewRejectReason, number>>;
}

export const codingTaskCallbackSignal = defineSignal<[unknown]>("codingTaskCallback");
export const codingTaskReviewSignal = defineSignal<[unknown]>("codingTaskReview");
export const codingTaskPhaseQuery = defineQuery<CodingTaskPhase>("codingTaskPhase");

const sideEffects = proxyActivities<Pick<CodingTaskActivities, "dispatchCodingTask">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("external-side-effect"),
});

const reads = proxyActivities<Pick<CodingTaskActivities, "findCodingTaskDispatch">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("read"),
});

/**
 * 正典状態機械の耐久実行。timeout・拒否累積・signal 不達のいずれからも
 * complete/approved 側へ転落する経路はない（失敗系はすべて failed + 理由）。
 */
export async function codingTaskWorkflow(
  input: VersionedPayload<CodingTaskRequest>,
): Promise<VersionedPayload<CodingTaskResult>> {
  const request = input.payload;
  assertCodingTaskRequest(request);

  let phase: CodingTaskPhase = "requested";
  let callbackOutcome: CallbackOutcome | null = null;
  let reviewAccepted = false;
  const rejectedCallbacks: Record<CallbackRejectReason, number> = {
    "malformed-payload": 0,
    "task-id-mismatch": 0,
    "wrong-phase": 0,
    "duplicate-callback": 0,
    "conflicting-callback": 0,
  };
  const rejectedReviews: Record<ReviewRejectReason, number> = {
    "malformed-payload": 0,
    "task-id-mismatch": 0,
    "wrong-phase": 0,
    "missing-reviewer": 0,
  };

  setHandler(codingTaskCallbackSignal, (signal) => {
    const evaluation = evaluateCallbackSignal(
      { taskId: request.taskId, phase, decidedOutcome: callbackOutcome },
      signal,
    );
    if (evaluation.accepted) {
      callbackOutcome = evaluation.outcome;
    } else {
      rejectedCallbacks[evaluation.reason] += 1;
    }
  });
  setHandler(codingTaskReviewSignal, (signal) => {
    const evaluation = evaluateReviewSignal({ taskId: request.taskId, phase }, signal);
    if (evaluation.accepted) {
      reviewAccepted = true;
    } else {
      rejectedReviews[evaluation.reason] += 1;
    }
  });
  setHandler(codingTaskPhaseQuery, () => phase);

  const finish = (
    failureReason: CodingTaskResult["failureReason"],
    dispatchOutcome: CodingTaskResult["dispatchOutcome"],
  ): VersionedPayload<CodingTaskResult> => ({
    schemaVersion: 1,
    payload: {
      taskId: request.taskId,
      phase,
      failureReason,
      dispatchOutcome,
      callbackOutcome,
      rejectedCallbacks,
      rejectedReviews,
    },
  });

  // requested → approval_pending（child approval。expired/rejected は failed 終端）
  phase = "approval_pending";
  const approval: VersionedPayload<ApprovalOutcome> = await executeChild(approvalWorkflow, {
    workflowId: `coding-task/${request.taskId}/approval`,
    args: [
      {
        schemaVersion: 1,
        payload: {
          approvalId: request.approvalId,
          version: request.approvalVersion,
          expiryMs: request.approvalExpiryMs,
          requestedBy: request.requestedBy,
        },
      },
    ],
  });
  if (approval.payload.status !== "approved") {
    phase = "failed";
    return finish(approval.payload.status === "expired" ? "approval-expired" : "approval-rejected", null);
  }

  // queued → running: dispatch は 1 回だけ（TMP-003）。応答喪失は reconcile で回収。
  phase = "queued";
  const idempotencyKey = buildIdempotencyKey(`coding-task/${request.taskId}`, "dispatchCodingTask", 0);
  let dispatchOutcome: "executed" | "reconciled";
  try {
    const dispatched = await runExternalSideEffect<
      { taskId: string; owner: string; repo: string; ref: string },
      string
    >(
      {
        execute: async (dispatchInput, key) => sideEffects.dispatchCodingTask(dispatchInput, key),
        reconcile: async (key) => reads.findCodingTaskDispatch(key),
      },
      { taskId: request.taskId, ...request.repository },
      idempotencyKey,
    );
    dispatchOutcome = dispatched.outcome;
  } catch (error) {
    if (!(error instanceof ExternalSideEffectUnresolvedError)) throw error;
    phase = "failed";
    return finish("dispatch-unresolved", null);
  }

  // running → pr_created|no_change|failed（callback signal、期限付き）
  phase = "running";
  const callbackArrived = await condition(() => callbackOutcome !== null, request.callbackTimeoutMs);
  if (!callbackArrived || callbackOutcome === null) {
    phase = "failed";
    return finish("callback-timeout", dispatchOutcome);
  }
  phase = phaseAfterCallback(callbackOutcome);
  if (phase === "failed") {
    return finish("callback-failed", dispatchOutcome);
  }

  // pr_created|no_change → review_pending → complete（review signal、期限付き。
  // 期限超過は complete への自動遷移ではなく failed 終端 = no auto-complete）
  phase = "review_pending";
  const reviewArrived = await condition(() => reviewAccepted, request.reviewTimeoutMs);
  if (!reviewArrived) {
    phase = "failed";
    return finish("review-timeout", dispatchOutcome);
  }
  phase = "complete";
  return finish(null, dispatchOutcome);
}
