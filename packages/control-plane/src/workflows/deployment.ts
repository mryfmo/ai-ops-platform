// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005 / ADR-0021
// deployments table を唯一の state authority とする deploy dispatch / prod monitor workflow。

import { ApplicationFailure, proxyActivities, sleep } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import {
  assertDeploymentWorkflowRequest,
  buildDeployDispatchWorkflowId,
  buildProdMonitorWorkflowId,
  deploymentScheduleDelayMs,
  parseApprovedDeploymentClaimReceipt,
  parseDeploymentCasReceipt,
  parseDeploymentEffectReceipt,
  parseDeploymentEffectStatus,
  parseDeploymentPlans,
  type DeployDispatchPlan,
  type DeploymentPlan,
  type DeploymentState,
  type DeploymentWorkflowOperation,
  type DeploymentWorkflowRequest,
  type ProdMonitorPlan,
} from "../lib/deploymentState.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export interface DeploymentActivities {
  /** Existing deployments(state='approved') only; shadow must not consume approvals. */
  findDeployDispatchPlans(input: VersionedPayload<DeploymentWorkflowRequest>): Promise<unknown>;
  /** Active-only approvals.dispatched_at CAS + deployments(state='approved') insert transaction. */
  claimApprovedDeployment(
    input: VersionedPayload<{ readonly idempotencyKey: string }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** D-04 reads/evaluation/audit use the live pure deploymentTaskState plan. */
  planProdMonitor(input: VersionedPayload<DeploymentWorkflowRequest>): Promise<unknown>;
  /** deployments state CAS; receipt is created|stale and bound to the requested edge. */
  claimDeploymentTransition(
    input: VersionedPayload<{
      readonly deployId: string;
      readonly from: DeploymentState;
      readonly to: DeploymentState;
    }>,
  ): Promise<unknown>;
  /** External provider/action-ledger authority: null=absent, pending, or sent. */
  findDeploymentEffect(
    input: VersionedPayload<{ readonly plan: DeploymentPlan; readonly effect: "deploy" | "rollback" }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  dispatchDeployment(
    input: VersionedPayload<{ readonly plan: DeployDispatchPlan }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  dispatchRollback(
    input: VersionedPayload<{ readonly plan: ProdMonitorPlan }>,
    idempotencyKey: string,
  ): Promise<unknown>;
}

export interface DeploymentWorkflowResult {
  readonly operation: DeploymentWorkflowOperation;
  readonly workflowId: string;
  readonly outcome: "completed" | "shadowed";
  readonly actions: ReadonlyArray<{
    readonly deployId: string;
    readonly outcome: "executed" | "reconciled" | "blocked" | "stale" | "shadowed";
  }>;
}

const reads = proxyActivities<
  Pick<DeploymentActivities, "findDeployDispatchPlans" | "planProdMonitor" | "findDeploymentEffect">
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("read") });

const idempotentWrites = proxyActivities<
  Pick<DeploymentActivities, "claimApprovedDeployment" | "claimDeploymentTransition">
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("idempotent-write") });

const externalWrites = proxyActivities<Pick<DeploymentActivities, "dispatchDeployment" | "dispatchRollback">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("external-side-effect"),
});

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid deployment workflow contract",
    "E-CP-CONTRACT",
  );
}

function unresolvedFailure(message: string): never {
  throw ApplicationFailure.nonRetryable(message, "E-CP-EXTERNAL-UNRESOLVED");
}

function workflowIdentity(request: DeploymentWorkflowRequest): string {
  return request.operation === "deploy-dispatch"
    ? buildDeployDispatchWorkflowId(request.sequence)
    : buildProdMonitorWorkflowId(request.sequence);
}

async function transition(deployId: string, from: DeploymentState, to: DeploymentState): Promise<"created" | "stale"> {
  const raw = await idempotentWrites.claimDeploymentTransition({
    schemaVersion: 1,
    payload: { deployId, from, to },
  });
  try {
    return parseDeploymentCasReceipt(raw, deployId, from, to).kind;
  } catch (error) {
    return contractFailure(error);
  }
}

async function effectStatus(plan: DeploymentPlan, effect: "deploy" | "rollback", idempotencyKey: string) {
  const raw = await reads.findDeploymentEffect({ schemaVersion: 1, payload: { plan, effect } }, idempotencyKey);
  try {
    return parseDeploymentEffectStatus(raw, plan.target.deployId, effect, idempotencyKey);
  } catch (error) {
    return contractFailure(error);
  }
}

async function executePlan(
  plan: DeploymentPlan,
  workflowId: string,
  executionMode: "shadow" | "active",
): Promise<DeploymentWorkflowResult["actions"][number]> {
  const deployId = plan.target.deployId;
  if (plan.kind === "blocked") {
    if (executionMode === "shadow") return { deployId, outcome: "shadowed" };
    const claimed = await transition(deployId, "approved", "dispatch_failed");
    return { deployId, outcome: claimed === "created" ? "blocked" : "stale" };
  }

  const effect = plan.kind === "dispatch" ? "deploy" : "rollback";
  const from = plan.kind === "dispatch" ? "approved" : "monitoring";
  const to = plan.kind === "dispatch" ? "prod_deploying" : "rolling_back";
  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(
      `${workflowId}:${deployId}`,
      effect === "deploy" ? "dispatchDeployment" : "dispatchRollback",
      0,
    );
  } catch (error) {
    return contractFailure(error);
  }

  if (executionMode === "shadow") {
    await effectStatus(plan, effect, idempotencyKey);
    return { deployId, outcome: "shadowed" };
  }
  if ((await transition(deployId, from, to)) === "stale") return { deployId, outcome: "stale" };

  const preflight = await effectStatus(plan, effect, idempotencyKey);
  let outcome: "executed" | "reconciled";
  if (preflight.status === "sent") {
    outcome = "reconciled";
  } else {
    if (preflight.status === "pending") {
      return unresolvedFailure(
        `deployment ${effect} ledger is pending for ${deployId}; automatic redispatch is forbidden`,
      );
    }
    try {
      const write = await runExternalSideEffect(
        {
          execute: async (_plan, key) =>
            plan.kind === "dispatch"
              ? externalWrites.dispatchDeployment({ schemaVersion: 1, payload: { plan } }, key)
              : externalWrites.dispatchRollback({ schemaVersion: 1, payload: { plan } }, key),
          reconcile: async (key): Promise<unknown> => {
            const status = await effectStatus(plan, effect, key);
            return status.status === "sent" ? { schemaVersion: 1, payload: status.receipt } : null;
          },
        },
        plan,
        idempotencyKey,
      );
      try {
        parseDeploymentEffectReceipt(write.result, deployId, effect, idempotencyKey);
      } catch (error) {
        return contractFailure(error);
      }
      outcome = write.outcome;
    } catch (error) {
      if (error instanceof ExternalSideEffectUnresolvedError) return unresolvedFailure(error.message);
      throw error;
    }
  }

  if (plan.kind === "rollback" && (await transition(deployId, "rolling_back", "rolled_back")) === "stale") {
    return { deployId, outcome: "stale" };
  }
  return { deployId, outcome };
}

async function runDeploymentWorkflow(
  input: unknown,
  operation: DeploymentWorkflowOperation,
): Promise<VersionedPayload<DeploymentWorkflowResult>> {
  try {
    assertDeploymentWorkflowRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  if (input.payload.operation !== operation) return contractFailure(new RangeError(`workflow requires ${operation}`));
  const request = input.payload;
  let workflowId: string;
  try {
    workflowId = workflowIdentity(request);
  } catch (error) {
    return contractFailure(error);
  }
  await sleep(deploymentScheduleDelayMs(request, Date.now()));

  const rawPlans =
    operation === "deploy-dispatch" ? await reads.findDeployDispatchPlans(input) : await reads.planProdMonitor(input);
  let plans: DeploymentPlan[];
  try {
    plans = parseDeploymentPlans(rawPlans, operation);
  } catch (error) {
    return contractFailure(error);
  }

  if (operation === "deploy-dispatch" && request.executionMode === "active" && plans.length === 0) {
    let claimKey: string;
    try {
      claimKey = buildIdempotencyKey(workflowId, "claimApprovedDeployment", 0);
    } catch (error) {
      return contractFailure(error);
    }
    const rawClaim = await idempotentWrites.claimApprovedDeployment(
      { schemaVersion: 1, payload: { idempotencyKey: claimKey } },
      claimKey,
    );
    let claim;
    try {
      claim = parseApprovedDeploymentClaimReceipt(rawClaim, claimKey);
    } catch (error) {
      return contractFailure(error);
    }
    if (claim.kind === "created") plans = [claim.plan];
    else {
      const recovered = await reads.findDeployDispatchPlans(input);
      try {
        plans = parseDeploymentPlans(recovered, operation);
      } catch (error) {
        return contractFailure(error);
      }
    }
  }

  const actions: DeploymentWorkflowResult["actions"][number][] = [];
  for (const plan of plans) actions.push(await executePlan(plan, workflowId, request.executionMode));
  return {
    schemaVersion: 1,
    payload: {
      operation,
      workflowId,
      outcome: request.executionMode === "shadow" ? "shadowed" : "completed",
      actions,
    },
  };
}

export async function deployDispatchWorkflow(input: unknown): Promise<VersionedPayload<DeploymentWorkflowResult>> {
  return runDeploymentWorkflow(input, "deploy-dispatch");
}

export async function prodMonitorWorkflow(input: unknown): Promise<VersionedPayload<DeploymentWorkflowResult>> {
  return runDeploymentWorkflow(input, "prod-monitor");
}

export { buildDeployDispatchWorkflowId, buildProdMonitorWorkflowId } from "../lib/deploymentState.js";
