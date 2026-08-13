// 根拠: FinalArch:FR-CP-001 / FinalArch:FR-CP-004 / FinalArch:FR-CP-005 / TMP-003 / ADR-0021
// Graph subscription の renewal/delta/reconcile durable timer。既存 scheduler と shadow
// 共存し、renewal は authoritative preflight + single-attempt write + reconcile で重複を防ぐ。

import { ApplicationFailure, proxyActivities, sleep } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import {
  assertGraphSubscriptionRequest,
  graphSubscriptionScheduleDelayMs,
  GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS,
  parseGraphSubscriptionReceipt,
  parseOptionalGraphSubscriptionReceipt,
  type GraphSubscriptionOperation,
  type GraphSubscriptionReceipt,
  type GraphSubscriptionRequest,
  type GraphSubscriptionRenewalActivityInput,
  type GraphSubscriptionScheduledRequest,
} from "../lib/graphSubscriptionState.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { buildWorkflowId } from "../lib/workflowId.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export interface GraphSubscriptionActivities {
  /** key または renewal target の外部正本を読む。旧 scheduler の先行更新も検出する。 */
  findGraphSubscriptionRenewal(
    input: VersionedPayload<GraphSubscriptionRenewalActivityInput>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** Inject Graph retry sleep that heartbeats more often than once per minute. */
  renewGraphSubscription(
    input: VersionedPayload<GraphSubscriptionRenewalActivityInput>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** renewal failure 時に polling へ切り替え、delta backfill を行う。 */
  fallbackGraphSubscriptionToPolling(
    input: VersionedPayload<GraphSubscriptionRenewalActivityInput>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** Graph retry sleep/page traversal must heartbeat more often than once per minute. */
  runGraphSubscriptionDelta(input: VersionedPayload<GraphSubscriptionScheduledRequest>): Promise<unknown>;
  reconcileGraphSubscription(input: VersionedPayload<GraphSubscriptionScheduledRequest>): Promise<unknown>;
}

export interface GraphSubscriptionResult {
  readonly subscriptionId: string;
  readonly operation: GraphSubscriptionOperation;
  readonly workflowId: string;
  readonly outcome: "executed" | "reconciled" | "completed" | "shadowed";
  readonly checkpoint: string | null;
}

const reads = proxyActivities<
  Pick<GraphSubscriptionActivities, "findGraphSubscriptionRenewal" | "reconcileGraphSubscription">
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("read") });

const idempotentWrites = proxyActivities<
  Pick<GraphSubscriptionActivities, "runGraphSubscriptionDelta" | "fallbackGraphSubscriptionToPolling">
>({
  // Graph Retry-After / multi-page reads may be long; heartbeat detects a lost worker promptly.
  startToCloseTimeout: "72 hours",
  heartbeatTimeout: "1 minute",
  retry: toTemporalRetryPolicy("idempotent-write"),
});

const externalWrites = proxyActivities<Pick<GraphSubscriptionActivities, "renewGraphSubscription">>({
  // Graph は valid Retry-After を全量待つ。heartbeat で worker loss は 1 分以内に検出する。
  startToCloseTimeout: "72 hours",
  heartbeatTimeout: "1 minute",
  retry: toTemporalRetryPolicy("external-side-effect"),
});

export function buildGraphSubscriptionWorkflowId(
  subscriptionId: string,
  operation: GraphSubscriptionOperation,
  sequence: number,
): string {
  return buildWorkflowId("graph-subscription", `${operation}:${subscriptionId}:${String(sequence)}`);
}

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid graph subscription workflow contract",
    "E-CP-CONTRACT",
  );
}

function validatedReceipt(
  value: unknown,
  subscriptionId: string,
  operation: GraphSubscriptionOperation,
): GraphSubscriptionReceipt {
  try {
    return parseGraphSubscriptionReceipt(value, subscriptionId, operation);
  } catch (error) {
    return contractFailure(error);
  }
}

function validatedOptionalReceipt(
  value: unknown,
  subscriptionId: string,
  operation: GraphSubscriptionOperation,
): GraphSubscriptionReceipt | null {
  try {
    return parseOptionalGraphSubscriptionReceipt(value, subscriptionId, operation);
  } catch (error) {
    return contractFailure(error);
  }
}

function result(
  request: GraphSubscriptionRequest,
  workflowId: string,
  outcome: GraphSubscriptionResult["outcome"],
  receipt: GraphSubscriptionReceipt | null,
): VersionedPayload<GraphSubscriptionResult> {
  return {
    schemaVersion: 1,
    payload: {
      subscriptionId: request.subscriptionId,
      operation: request.operation,
      workflowId,
      outcome,
      checkpoint: receipt?.checkpoint ?? null,
    },
  };
}

/** 1 schedule tick 分を実行する有限 workflow。反復は Temporal Schedule が担う。 */
export async function graphSubscriptionWorkflow(input: unknown): Promise<VersionedPayload<GraphSubscriptionResult>> {
  try {
    assertGraphSubscriptionRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request = input.payload;
  let workflowId: string;
  try {
    workflowId = buildGraphSubscriptionWorkflowId(request.subscriptionId, request.operation, request.sequence);
  } catch (error) {
    return contractFailure(error);
  }

  // Temporal workflow sandbox の Date.now() は history 時刻へ固定され replay-safe。
  await sleep(graphSubscriptionScheduleDelayMs(request, Date.now()));
  const fireAtMs = Date.now();
  let idempotencyKey: string;
  try {
    // Schedule action の引数が静的でも、fire ごとの logical time で renewal identity を更新する。
    idempotencyKey = buildIdempotencyKey(workflowId, "renewGraphSubscription", fireAtMs);
  } catch (error) {
    return contractFailure(error);
  }

  if (request.operation === "renewal") {
    const renewal: VersionedPayload<GraphSubscriptionRenewalActivityInput> = {
      schemaVersion: 1,
      payload: {
        subscriptionId: request.subscriptionId,
        operation: request.operation,
        executionMode: request.executionMode,
        sequence: request.sequence,
        observedAtMs: fireAtMs,
        targetExpiresAtMs: fireAtMs + GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS,
      },
    };
    const reconcile = async (key: string): Promise<GraphSubscriptionReceipt | null> =>
      validatedOptionalReceipt(
        await reads.findGraphSubscriptionRenewal(renewal, key),
        request.subscriptionId,
        request.operation,
      );
    const existing = await reconcile(idempotencyKey);
    if (existing !== null) return result(request, workflowId, "reconciled", existing);
    if (request.executionMode === "shadow") return result(request, workflowId, "shadowed", null);

    try {
      const outcome = await runExternalSideEffect(
        {
          execute: async (renewal, key) =>
            validatedReceipt(
              await externalWrites.renewGraphSubscription({ schemaVersion: 1, payload: renewal }, key),
              request.subscriptionId,
              request.operation,
            ),
          reconcile,
        },
        renewal.payload,
        idempotencyKey,
      );
      return result(request, workflowId, outcome.outcome, outcome.result);
    } catch (error) {
      if (!(error instanceof ExternalSideEffectUnresolvedError)) throw error;
      const fallback = validatedReceipt(
        await idempotentWrites.fallbackGraphSubscriptionToPolling(renewal, idempotencyKey),
        request.subscriptionId,
        request.operation,
      );
      return result(request, workflowId, "completed", fallback);
    }
  }

  /* v8 ignore next -- Temporal VM execution is covered by the time-skipping shadow tests. */
  if (request.executionMode === "shadow" && request.operation === "delta") {
    return result(request, workflowId, "shadowed", null);
  }

  const receipt = validatedReceipt(
    request.operation === "delta"
      ? await idempotentWrites.runGraphSubscriptionDelta({ schemaVersion: 1, payload: request })
      : await reads.reconcileGraphSubscription({ schemaVersion: 1, payload: request }),
    request.subscriptionId,
    request.operation,
  );
  return result(request, workflowId, "completed", receipt);
}
