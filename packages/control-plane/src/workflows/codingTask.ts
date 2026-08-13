// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0006 / ADR-0020
// CodingTaskWorkflow（正典 component spec 01）。approval は P3-T03 approvalWorkflow
// を child workflow として実行し、GitHub dispatch は single-attempt + reconcile
// （TMP-003）、callback は dispatch 束縛の replay/duplicate-safe signal。review の
// 完了権威は DB 正本（signal は wake、完了は readReviewDecision の確認のみ）で、
// review 待ちは期限なしの durable wait（人間の遅延を coding failure に変換しない）。
// ADR-0006 の server 経路（人間明示クリック + DB 原子確保）は変更しない。

import { condition, defineQuery, defineSignal, executeChild, proxyActivities, setHandler } from "@temporalio/workflow";

import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertCodingTaskRequest,
  evaluateCallbackSignal,
  evaluateReviewDecision,
  evaluateReviewSignal,
  phaseAfterCallback,
  type AcceptedCallback,
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
  /** workflow_dispatch の発火（非冪等）。idempotencyKey は相関 ID として dispatch
   *  入力に含めて run へ伝播させる契約（callback は同じ値を echo する）。
   *  戻り値は provider 側識別子（相関には使わない）。 */
  dispatchCodingTask(
    input: { taskId: string; owner: string; repo: string; ref: string },
    idempotencyKey: string,
  ): Promise<string>;
  /** idempotency key での dispatch 存在照会（冪等 read）。 */
  findCodingTaskDispatch(idempotencyKey: string): Promise<string | null>;
  /** DB 正本のレビュー決定 read（冪等）。完了権威はこの結果のみ（P3-T04-001）。 */
  readReviewDecision(taskId: string): Promise<unknown>;
}

export interface CodingTaskRequest {
  readonly taskId: string;
  readonly approvalId: string;
  readonly approvalVersion: number;
  readonly approvalExpiryMs: number;
  readonly callbackTimeoutMs: number;
  readonly repository: { readonly owner: string; readonly repo: string; readonly ref: string };
  readonly requestedBy: string;
}

export interface CodingTaskResult {
  readonly taskId: string;
  readonly phase: CodingTaskPhase;
  readonly failureReason:
    "approval-rejected" | "approval-expired" | "dispatch-unresolved" | "callback-timeout" | "callback-failed" | null;
  readonly dispatchOutcome: "executed" | "reconciled" | null;
  readonly callback: AcceptedCallback | null;
  readonly reviewedBy: string | null;
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

const reads = proxyActivities<Pick<CodingTaskActivities, "findCodingTaskDispatch" | "readReviewDecision">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("read"),
});

/**
 * 正典状態機械の耐久実行。timeout・拒否累積・signal 単独のいずれからも
 * approved/complete 側へ転落する経路はない（完了は DB 正本の read 確認のみ）。
 */
export async function codingTaskWorkflow(
  input: VersionedPayload<CodingTaskRequest>,
): Promise<VersionedPayload<CodingTaskResult>> {
  assertCodingTaskRequest(input);
  const request = input.payload;

  let phase: CodingTaskPhase = "requested";
  // 相関 ID は activity schedule 前に決定的に確定する（P3-T04-005: in-flight 中の
  // 正規 callback を dispatch-mismatch で失わない）。受理時機は phase guard が握る。
  const dispatchCorrelationId = buildIdempotencyKey(`coding-task/${request.taskId}`, "dispatchCodingTask", 0);
  let dispatchId: string | null = null;
  let acceptedCallback: AcceptedCallback | null = null;
  let reviewWakes = 0;
  const rejectedCallbacks: Record<CallbackRejectReason, number> = {
    "malformed-payload": 0,
    "task-id-mismatch": 0,
    "dispatch-mismatch": 0,
    "wrong-phase": 0,
    "duplicate-callback": 0,
    "conflicting-callback": 0,
  };
  const rejectedReviews: Record<ReviewRejectReason, number> = {
    "malformed-payload": 0,
    "task-id-mismatch": 0,
    "wrong-phase": 0,
    "missing-reviewer": 0,
    "unconfirmed-review": 0,
  };

  setHandler(codingTaskCallbackSignal, (signal) => {
    const evaluation = evaluateCallbackSignal(
      { taskId: request.taskId, phase, dispatchId, accepted: acceptedCallback },
      signal,
    );
    if (evaluation.accepted) {
      acceptedCallback = evaluation.callback;
    } else {
      rejectedCallbacks[evaluation.reason] += 1;
    }
  });
  setHandler(codingTaskReviewSignal, (signal) => {
    const evaluation = evaluateReviewSignal({ taskId: request.taskId, phase }, signal);
    if (evaluation.accepted) {
      reviewWakes += 1;
    } else {
      rejectedReviews[evaluation.reason] += 1;
    }
  });
  setHandler(codingTaskPhaseQuery, () => phase);

  const finish = (
    failureReason: CodingTaskResult["failureReason"],
    dispatchOutcome: CodingTaskResult["dispatchOutcome"],
    reviewedBy: string | null = null,
  ): VersionedPayload<CodingTaskResult> => ({
    schemaVersion: 1,
    payload: {
      taskId: request.taskId,
      phase,
      failureReason,
      dispatchOutcome,
      callback: acceptedCallback,
      reviewedBy,
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
  // 相関識別子を保持し、callback はこの dispatch にのみ束縛される（P3-T04-002）。
  phase = "queued";
  dispatchId = dispatchCorrelationId;
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
      dispatchCorrelationId,
    );
    dispatchOutcome = dispatched.outcome;
  } catch (error) {
    if (!(error instanceof ExternalSideEffectUnresolvedError)) throw error;
    phase = "failed";
    return finish("dispatch-unresolved", null);
  }

  // running → pr_created|no_change|failed（callback signal、期限付き。queued 中に
  // 受理済みの callback があればそのまま前進する）
  phase = "running";
  const callbackArrived = await condition(() => acceptedCallback !== null, request.callbackTimeoutMs);
  if (!callbackArrived || acceptedCallback === null) {
    phase = "failed";
    return finish("callback-timeout", dispatchOutcome);
  }
  const decided: AcceptedCallback = acceptedCallback;
  phase = phaseAfterCallback(decided.outcome);
  if (phase === "failed") {
    return finish("callback-failed", dispatchOutcome);
  }
  if (phase === "no_change") {
    // no_change はレビュー対象の PR が存在しない正当な no-op（P3-T04-003）。
    phase = "complete";
    return finish(null, dispatchOutcome);
  }

  // pr_created → review_pending → complete。signal は wake、完了権威は DB 正本の
  // read（P3-T04-001）。人間の遅延で失敗に転落させない期限なし durable wait
  // （P3-T04-003）。未確認 wake は拒否記録して待機継続。
  phase = "review_pending";
  let processedWakes = 0;
  for (;;) {
    await condition(() => reviewWakes > processedWakes);
    processedWakes = reviewWakes;
    const decision = await reads.readReviewDecision(request.taskId);
    const evaluation = evaluateReviewDecision(request.taskId, decision);
    if (evaluation.accepted) {
      phase = "complete";
      return finish(null, dispatchOutcome, evaluation.reviewerObjectId);
    }
    rejectedReviews[evaluation.reason] += 1;
  }
}
