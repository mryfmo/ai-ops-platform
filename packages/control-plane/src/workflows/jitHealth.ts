// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / TMP-003 / ADR-0021
// 旧 scheduler と shadow 共存する、毎分 JIT 失効と30秒 health evaluation の有限 workflow。

import { ApplicationFailure, proxyActivities, sleep } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertJitHealthRequest,
  buildHealthEvaluationWorkflowId,
  buildJitExpiryWorkflowId,
  jitHealthScheduleDelayMs,
  parseHealthEvaluationReceipt,
  parseJitRevocationCandidates,
  parseJitRevocationReceipt,
  parseOptionalJitRevocationReceipt,
  type HealthEvaluationActivityInput,
  type HealthEvaluationReceipt,
  type HealthEvaluationRequest,
  type JitCandidateQuery,
  type JitExpiryRequest,
  type JitRevocationActivityInput,
  type JitRevocationReceipt,
} from "../lib/jitHealthState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export { buildHealthEvaluationWorkflowId, buildJitExpiryWorkflowId } from "../lib/jitHealthState.js";

export interface JitHealthActivities {
  /** 権威台帳を読み、isGrantExpired で logical time 時点の候補を返す read-only activity。 */
  findJitRevocationCandidates(input: VersionedPayload<JitCandidateQuery>): Promise<unknown>;
  /** idempotency key に束縛された権威台帳/監査記録を読む。 */
  findJitRevocation(input: VersionedPayload<JitRevocationActivityInput>, idempotencyKey: string): Promise<unknown>;
  /** worker 実装は AGT_SEC.revokeExpiredGrants([grant], logicalTime, deps) を呼ぶ。 */
  revokeExpiredGrant(input: VersionedPayload<JitRevocationActivityInput>, idempotencyKey: string): Promise<unknown>;
  /** worker 実装は target check 後に AGT_ORCH.evaluateFailsafe を呼ぶ read-only evaluation。 */
  evaluateHealth(input: VersionedPayload<HealthEvaluationActivityInput>): Promise<unknown>;
  /** activate/recover を同じ logical observation に対して冪等適用する。 */
  applyHealthDecision(input: VersionedPayload<HealthEvaluationReceipt>, idempotencyKey: string): Promise<unknown>;
}

export interface JitExpiryResult {
  readonly operation: "jit-expiry";
  readonly workflowId: string;
  readonly evaluatedAtMs: number;
  readonly outcome: "completed" | "shadowed";
  readonly revocations: ReadonlyArray<{
    readonly grantId: string;
    readonly outcome: "executed" | "reconciled" | "shadowed";
  }>;
}

export interface HealthEvaluationResult {
  readonly operation: "health";
  readonly workflowId: string;
  readonly observedAtMs: number;
  readonly outcome: "applied" | "shadowed";
  readonly healthy: boolean;
  readonly consecutiveFailures: number;
  readonly decision: HealthEvaluationReceipt["decision"];
}

const reads = proxyActivities<
  Pick<JitHealthActivities, "findJitRevocationCandidates" | "findJitRevocation" | "evaluateHealth">
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("read") });

const externalWrites = proxyActivities<Pick<JitHealthActivities, "revokeExpiredGrant">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("external-side-effect"),
});

const idempotentWrites = proxyActivities<Pick<JitHealthActivities, "applyHealthDecision">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("idempotent-write"),
});

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid JIT/health workflow contract",
    "E-CP-CONTRACT",
  );
}

function unresolvedFailure(error: ExternalSideEffectUnresolvedError): never {
  throw ApplicationFailure.nonRetryable(error.message, "E-CP-EXTERNAL-UNRESOLVED");
}

function validatedRevocation(value: unknown, grantId: string, idempotencyKey: string): JitRevocationReceipt {
  try {
    return parseJitRevocationReceipt(value, grantId, idempotencyKey);
  } catch (error) {
    return contractFailure(error);
  }
}

function validatedOptionalRevocation(
  value: unknown,
  grantId: string,
  idempotencyKey: string,
): JitRevocationReceipt | null {
  try {
    return parseOptionalJitRevocationReceipt(value, grantId, idempotencyKey);
  } catch (error) {
    return contractFailure(error);
  }
}

function validatedHealth(value: unknown, observedAtMs: number): HealthEvaluationReceipt {
  try {
    return parseHealthEvaluationReceipt(value, observedAtMs);
  } catch (error) {
    return contractFailure(error);
  }
}

/** 1 schedule tick 分の JIT 候補を authority read → reconcile → single-attempt revoke する。 */
export async function jitExpiryWorkflow(input: unknown): Promise<VersionedPayload<JitExpiryResult>> {
  try {
    assertJitHealthRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  if (input.payload.operation !== "jit-expiry")
    return contractFailure(new RangeError("JIT workflow requires jit-expiry"));
  const request: JitExpiryRequest = input.payload;
  let workflowId: string;
  try {
    workflowId = buildJitExpiryWorkflowId(request.sequence);
  } catch (error) {
    return contractFailure(error);
  }

  await sleep(jitHealthScheduleDelayMs(request, Date.now()));
  const evaluatedAtMs = Date.now();
  const query: VersionedPayload<JitCandidateQuery> = { schemaVersion: 1, payload: { observedAtMs: evaluatedAtMs } };
  let candidates;
  try {
    candidates = parseJitRevocationCandidates(await reads.findJitRevocationCandidates(query), evaluatedAtMs);
  } catch (error) {
    return contractFailure(error);
  }

  const revocations: JitExpiryResult["revocations"][number][] = [];
  for (const candidate of candidates) {
    const activityInput: VersionedPayload<JitRevocationActivityInput> = {
      schemaVersion: 1,
      payload: { grantId: candidate.grantId, observedAtMs: evaluatedAtMs },
    };
    let idempotencyKey: string;
    try {
      idempotencyKey = buildIdempotencyKey(`${workflowId}:${candidate.grantId}`, "revokeExpiredGrant", evaluatedAtMs);
    } catch (error) {
      return contractFailure(error);
    }
    const reconcile = async (key: string): Promise<unknown> => reads.findJitRevocation(activityInput, key);
    const existing = validatedOptionalRevocation(await reconcile(idempotencyKey), candidate.grantId, idempotencyKey);
    if (existing !== null) {
      revocations.push({ grantId: candidate.grantId, outcome: "reconciled" });
      continue;
    }
    if (request.executionMode === "shadow") {
      revocations.push({ grantId: candidate.grantId, outcome: "shadowed" });
      continue;
    }
    try {
      const outcome = await runExternalSideEffect(
        {
          execute: async (_candidate, key) => externalWrites.revokeExpiredGrant(activityInput, key),
          reconcile,
        },
        candidate,
        idempotencyKey,
      );
      validatedRevocation(outcome.result, candidate.grantId, idempotencyKey);
      revocations.push({ grantId: candidate.grantId, outcome: outcome.outcome });
    } catch (error) {
      if (error instanceof ExternalSideEffectUnresolvedError) return unresolvedFailure(error);
      throw error;
    }
  }

  return {
    schemaVersion: 1,
    payload: {
      operation: "jit-expiry",
      workflowId,
      evaluatedAtMs,
      outcome: request.executionMode === "shadow" ? "shadowed" : "completed",
      revocations,
    },
  };
}

/** 1 schedule tick 分を logical time で評価し、active 時だけ決定を冪等適用する。 */
export async function healthEvaluationWorkflow(input: unknown): Promise<VersionedPayload<HealthEvaluationResult>> {
  try {
    assertJitHealthRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  if (input.payload.operation !== "health") return contractFailure(new RangeError("health workflow requires health"));
  const request: HealthEvaluationRequest = input.payload;
  let workflowId: string;
  try {
    workflowId = buildHealthEvaluationWorkflowId(request.sequence);
  } catch (error) {
    return contractFailure(error);
  }

  await sleep(jitHealthScheduleDelayMs(request, Date.now()));
  const observedAtMs = Date.now();
  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(workflowId, "applyHealthDecision", observedAtMs);
  } catch (error) {
    return contractFailure(error);
  }
  const evaluation = validatedHealth(
    await reads.evaluateHealth({ schemaVersion: 1, payload: { observedAtMs } }),
    observedAtMs,
  );
  let outcome: HealthEvaluationResult["outcome"];
  if (request.executionMode === "shadow") {
    outcome = "shadowed";
  } else {
    const applied = await idempotentWrites.applyHealthDecision(
      { schemaVersion: 1, payload: evaluation },
      idempotencyKey,
    );
    const appliedEvaluation = validatedHealth(applied, observedAtMs);
    if (
      appliedEvaluation.healthy !== evaluation.healthy ||
      appliedEvaluation.consecutiveFailures !== evaluation.consecutiveFailures ||
      appliedEvaluation.decision !== evaluation.decision
    ) {
      return contractFailure(new RangeError("applied health decision does not match the evaluated transition"));
    }
    outcome = "applied";
  }
  return {
    schemaVersion: 1,
    payload: { operation: "health", workflowId, outcome, ...evaluation },
  };
}
