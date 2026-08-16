// 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005 / ADR-0021
// deploy dispatch / prod monitor workflow の deterministic contract validation。

import { buildWorkflowId } from "./workflowId.js";

export const DEPLOY_DISPATCH_INTERVAL_MS = 30_000;
export const PROD_MONITOR_INTERVAL_MS = 60_000;

export const DEPLOYMENT_STATES = [
  "pending",
  "staging_deployed",
  "approval_requested",
  "approved",
  "rejected",
  "expired",
  "prod_deploying",
  "monitoring",
  "stable",
  "rolling_back",
  "rolled_back",
  "dispatch_failed",
] as const;
export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];
export type DeploymentWorkflowOperation = "deploy-dispatch" | "prod-monitor";

export interface DeploymentWorkflowRequest {
  readonly operation: DeploymentWorkflowOperation;
  readonly executionMode: "shadow" | "active";
  readonly sequence: number;
  readonly observedAtMs: number;
}

export interface DeploymentTarget {
  readonly deployId: string;
  readonly projectId: string;
  readonly owner: string;
  readonly repo: string;
  readonly commitSha: string;
}

export type DeployDispatchPlan =
  | { readonly kind: "dispatch"; readonly target: DeploymentTarget }
  | {
      readonly kind: "blocked";
      readonly target: DeploymentTarget;
      readonly reason: "workflow-unavailable" | "workflow-observation-failed";
    };

export interface ProdMonitorPlan {
  readonly kind: "rollback";
  readonly target: DeploymentTarget & { readonly channel: { readonly teamId: string; readonly channelId: string } };
  readonly targetVersion: string;
  readonly matchedConditions: ReadonlyArray<"a" | "b">;
}

export type DeploymentPlan = DeployDispatchPlan | ProdMonitorPlan;

export type ApprovedDeploymentClaimReceipt =
  | { readonly kind: "created"; readonly idempotencyKey: string; readonly plan: DeployDispatchPlan }
  | { readonly kind: "stale"; readonly idempotencyKey: string };

export type DeploymentCasReceipt =
  | {
      readonly kind: "created";
      readonly deployId: string;
      readonly from: DeploymentState;
      readonly to: DeploymentState;
    }
  | {
      readonly kind: "stale";
      readonly deployId: string;
      readonly expectedState: DeploymentState;
      readonly observedState: DeploymentState | null;
    };

export interface DeploymentEffectReceipt {
  readonly deployId: string;
  readonly effect: "deploy" | "rollback";
  readonly idempotencyKey: string;
}

export type DeploymentEffectStatus =
  | { readonly status: "absent" }
  | { readonly status: "pending" }
  | { readonly status: "sent"; readonly receipt: DeploymentEffectReceipt };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const OPERATIONS: readonly string[] = ["deploy-dispatch", "prod-monitor"];
const STATE_SET: ReadonlySet<string> = new Set(DEPLOYMENT_STATES);

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseEnvelope(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${label} must use schemaVersion 1 with an object payload`);
  }
  const envelope = value as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError(`${label} must use schemaVersion 1 with an object payload`);
  }
  return envelope.payload as Record<string, unknown>;
}

function parseTarget(
  value: unknown,
  monitor: boolean,
): DeploymentTarget & {
  readonly channel?: { readonly teamId: string; readonly channelId: string };
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError("deployment target must be an object");
  }
  const target = value as Record<string, unknown>;
  if (
    typeof target.deployId !== "string" ||
    !UUID_PATTERN.test(target.deployId) ||
    typeof target.projectId !== "string" ||
    !target.projectId.trim() ||
    typeof target.owner !== "string" ||
    !target.owner.trim() ||
    typeof target.repo !== "string" ||
    !target.repo.trim() ||
    typeof target.commitSha !== "string" ||
    !SHA_PATTERN.test(target.commitSha)
  ) {
    throw new RangeError("deployment target identity is invalid");
  }
  const parsed: DeploymentTarget & { channel?: { teamId: string; channelId: string } } = {
    deployId: target.deployId,
    projectId: target.projectId,
    owner: target.owner,
    repo: target.repo,
    commitSha: target.commitSha,
  };
  if (monitor) {
    if (typeof target.channel !== "object" || target.channel === null || Array.isArray(target.channel)) {
      throw new RangeError("prod monitor target must contain one channel");
    }
    const channel = target.channel as Record<string, unknown>;
    if (
      typeof channel.teamId !== "string" ||
      !channel.teamId.trim() ||
      typeof channel.channelId !== "string" ||
      !channel.channelId.trim()
    ) {
      throw new RangeError("prod monitor channel is invalid");
    }
    parsed.channel = { teamId: channel.teamId, channelId: channel.channelId };
  }
  return parsed;
}

export function buildDeployDispatchWorkflowId(sequence: number): string {
  return buildWorkflowId("incident", `deploy-dispatch:global:${String(sequence)}`);
}

export function buildProdMonitorWorkflowId(sequence: number): string {
  return buildWorkflowId("incident", `prod-monitor:global:${String(sequence)}`);
}

export function assertDeploymentWorkflowRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: DeploymentWorkflowRequest;
} {
  const payload = parseEnvelope(input, "deployment workflow request");
  if (typeof payload.operation !== "string" || !OPERATIONS.includes(payload.operation)) {
    throw new RangeError("operation must be deploy-dispatch or prod-monitor");
  }
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  if (!isSafeNonNegativeInteger(payload.sequence) || !isSafeNonNegativeInteger(payload.observedAtMs)) {
    throw new RangeError("sequence and observedAtMs must be non-negative safe integers");
  }
}

export function deploymentScheduleDelayMs(request: DeploymentWorkflowRequest, currentTimeMs: number): number {
  if (!isSafeNonNegativeInteger(currentTimeMs)) throw new RangeError("currentTimeMs must be non-negative");
  const delay = request.operation === "deploy-dispatch" ? 0 : PROD_MONITOR_INTERVAL_MS;
  return Math.max(0, request.observedAtMs + delay - currentTimeMs);
}

export function parseDeploymentPlans(value: unknown, operation: DeploymentWorkflowOperation): DeploymentPlan[] {
  const payload = parseEnvelope(value, "deployment plans");
  if (payload.operation !== operation || !Array.isArray(payload.plans) || payload.plans.length > 100) {
    throw new RangeError("deployment plans must match operation and contain at most 100 plans");
  }
  const seen = new Set<string>();
  return payload.plans.map((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new RangeError("deployment plan must be an object");
    }
    const plan = value as Record<string, unknown>;
    const target = parseTarget(plan.target, operation === "prod-monitor");
    if (seen.has(target.deployId)) throw new RangeError("deployment plans must contain unique deployIds");
    seen.add(target.deployId);
    if (operation === "deploy-dispatch" && plan.kind === "dispatch") {
      return { kind: "dispatch", target } satisfies DeployDispatchPlan;
    }
    if (
      operation === "deploy-dispatch" &&
      plan.kind === "blocked" &&
      (plan.reason === "workflow-unavailable" || plan.reason === "workflow-observation-failed")
    ) {
      return { kind: "blocked", target, reason: plan.reason } satisfies DeployDispatchPlan;
    }
    if (
      operation === "prod-monitor" &&
      plan.kind === "rollback" &&
      typeof plan.targetVersion === "string" &&
      plan.targetVersion.trim().length > 0 &&
      Array.isArray(plan.matchedConditions) &&
      plan.matchedConditions.length > 0 &&
      plan.matchedConditions.every((item) => item === "a" || item === "b") &&
      new Set(plan.matchedConditions).size === plan.matchedConditions.length &&
      target.channel !== undefined
    ) {
      return {
        kind: "rollback",
        target: { ...target, channel: target.channel },
        targetVersion: plan.targetVersion,
        matchedConditions: plan.matchedConditions as Array<"a" | "b">,
      } satisfies ProdMonitorPlan;
    }
    throw new RangeError("deployment plan kind does not match operation");
  });
}

export function parseApprovedDeploymentClaimReceipt(
  value: unknown,
  idempotencyKey: string,
): ApprovedDeploymentClaimReceipt {
  const payload = parseEnvelope(value, "approved deployment claim receipt");
  if (payload.idempotencyKey !== idempotencyKey) {
    throw new RangeError("approved deployment claim receipt idempotency key mismatch");
  }
  if (payload.kind === "stale") return { kind: "stale", idempotencyKey };
  if (payload.kind === "created") {
    const plan = parseDeploymentPlans(
      { schemaVersion: 1, payload: { operation: "deploy-dispatch", plans: [payload.plan] } },
      "deploy-dispatch",
    )[0];
    if (plan?.kind !== "dispatch" && plan?.kind !== "blocked") {
      throw new RangeError("approved deployment claim created receipt requires a deploy plan");
    }
    return { kind: "created", idempotencyKey, plan };
  }
  throw new RangeError("approved deployment claim receipt must be created or stale");
}

export function parseDeploymentCasReceipt(
  value: unknown,
  deployId: string,
  from: DeploymentState,
  to: DeploymentState,
): DeploymentCasReceipt {
  const payload = parseEnvelope(value, "deployment CAS receipt");
  if (payload.deployId !== deployId) throw new RangeError("deployment CAS receipt deployId mismatch");
  if (payload.kind === "created" && payload.from === from && payload.to === to) {
    return { kind: "created", deployId, from, to };
  }
  if (
    payload.kind === "stale" &&
    payload.expectedState === from &&
    (payload.observedState === null ||
      (typeof payload.observedState === "string" && STATE_SET.has(payload.observedState))) &&
    payload.observedState !== from
  ) {
    return {
      kind: "stale",
      deployId,
      expectedState: from,
      observedState: payload.observedState as DeploymentState | null,
    };
  }
  throw new RangeError("deployment CAS receipt does not match the requested transition");
}

function parseEffectReceipt(
  payload: Record<string, unknown>,
  deployId: string,
  effect: DeploymentEffectReceipt["effect"],
  idempotencyKey: string,
): DeploymentEffectReceipt {
  if (payload.deployId !== deployId || payload.effect !== effect || payload.idempotencyKey !== idempotencyKey) {
    throw new RangeError("deployment effect receipt does not match deployId/effect/idempotency key");
  }
  return { deployId, effect, idempotencyKey };
}

export function parseDeploymentEffectReceipt(
  value: unknown,
  deployId: string,
  effect: DeploymentEffectReceipt["effect"],
  idempotencyKey: string,
): DeploymentEffectReceipt {
  return parseEffectReceipt(parseEnvelope(value, "deployment effect receipt"), deployId, effect, idempotencyKey);
}

export function parseDeploymentEffectStatus(
  value: unknown,
  deployId: string,
  effect: DeploymentEffectReceipt["effect"],
  idempotencyKey: string,
): DeploymentEffectStatus {
  if (value === null) return { status: "absent" };
  const payload = parseEnvelope(value, "deployment effect status");
  if (payload.deployId !== deployId || payload.effect !== effect) {
    throw new RangeError("deployment effect status identity mismatch");
  }
  if (payload.status === "pending") return { status: "pending" };
  if (payload.status === "sent") {
    return { status: "sent", receipt: parseEffectReceipt(payload, deployId, effect, idempotencyKey) };
  }
  throw new RangeError("deployment effect status must be pending or sent");
}
