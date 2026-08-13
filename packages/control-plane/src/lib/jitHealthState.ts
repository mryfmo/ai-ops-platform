// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / TMP-003 / ADR-0021
// JIT 失効と health evaluation の Temporal 入出力を決定的に検証する。

import { buildWorkflowId } from "./workflowId.js";

export const JIT_EXPIRY_INTERVAL_MS = 60_000;
export const HEALTH_EVALUATION_INTERVAL_MS = 30_000;

interface JitHealthRequestBase {
  readonly executionMode: "shadow" | "active";
  readonly sequence: number;
  readonly observedAtMs: number;
}

export interface JitExpiryRequest extends JitHealthRequestBase {
  readonly operation: "jit-expiry";
}

export interface HealthEvaluationRequest extends JitHealthRequestBase {
  readonly operation: "health";
}

export type JitHealthRequest = JitExpiryRequest | HealthEvaluationRequest;

export interface JitRevocationCandidate {
  readonly grantId: string;
}

export interface JitCandidateQuery {
  readonly observedAtMs: number;
}

export interface JitRevocationActivityInput extends JitCandidateQuery, JitRevocationCandidate {}

export interface JitRevocationReceipt extends JitRevocationCandidate {
  readonly idempotencyKey: string;
  readonly revokedAtMs: number;
}

export type HealthDecision = "none" | "activate_failsafe" | "recover";

export interface HealthEvaluationActivityInput {
  readonly observedAtMs: number;
}

export interface HealthEvaluationReceipt extends HealthEvaluationActivityInput {
  readonly healthy: boolean;
  readonly consecutiveFailures: number;
  readonly decision: HealthDecision;
}

const OPERATIONS: readonly string[] = ["jit-expiry", "health"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const HEALTH_DECISIONS: readonly string[] = ["none", "activate_failsafe", "recover"];

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function buildJitExpiryWorkflowId(sequence: number): string {
  return buildWorkflowId("incident", `jit-expiry:global:${String(sequence)}`);
}

export function buildHealthEvaluationWorkflowId(sequence: number): string {
  return buildWorkflowId("incident", `health:global:${String(sequence)}`);
}

export function assertJitHealthRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: JitHealthRequest;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("JIT/health request must be a VersionedPayload object");
  }
  const envelope = input as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("JIT/health request must use schemaVersion 1 with an object payload");
  }
  const payload = envelope.payload as Record<string, unknown>;
  if (typeof payload.operation !== "string" || !OPERATIONS.includes(payload.operation)) {
    throw new RangeError("operation must be jit-expiry or health");
  }
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  if (!isSafeNonNegativeInteger(payload.sequence)) {
    throw new RangeError("sequence must be a non-negative safe integer");
  }
  if (!isSafeNonNegativeInteger(payload.observedAtMs)) {
    throw new RangeError("observedAtMs must be a non-negative safe integer");
  }
}

export function jitHealthScheduleDelayMs(request: JitHealthRequest, currentTimeMs: number): number {
  if (!isSafeNonNegativeInteger(currentTimeMs)) {
    throw new RangeError("currentTimeMs must be a non-negative safe integer");
  }
  const interval = request.operation === "jit-expiry" ? JIT_EXPIRY_INTERVAL_MS : HEALTH_EVALUATION_INTERVAL_MS;
  return Math.max(0, request.observedAtMs + interval - currentTimeMs);
}

export function parseJitRevocationCandidates(value: unknown, evaluatedAtMs: number): JitRevocationCandidate[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError("JIT candidate result must use schemaVersion 1 with an object payload");
  }
  const envelope = value as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("JIT candidate result must use schemaVersion 1 with an object payload");
  }
  const payload = envelope.payload as { evaluatedAtMs?: unknown; grants?: unknown };
  if (payload.evaluatedAtMs !== evaluatedAtMs || !Array.isArray(payload.grants)) {
    throw new RangeError("JIT candidate result must match workflow logical time and contain grants");
  }
  const seen = new Set<string>();
  return payload.grants.map((candidate) => {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new RangeError("JIT candidate must be an object");
    }
    const grantId = (candidate as { grantId?: unknown }).grantId;
    if (typeof grantId !== "string" || !UUID_PATTERN.test(grantId) || seen.has(grantId)) {
      throw new RangeError("JIT candidates must contain unique canonical grant UUIDs");
    }
    seen.add(grantId);
    return { grantId };
  });
}

export function parseJitRevocationReceipt(
  value: unknown,
  grantId: string,
  idempotencyKey: string,
): JitRevocationReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError("JIT revocation receipt must use schemaVersion 1 with an object payload");
  }
  const envelope = value as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("JIT revocation receipt must use schemaVersion 1 with an object payload");
  }
  const receipt = envelope.payload as Record<string, unknown>;
  if (
    receipt.grantId !== grantId ||
    receipt.idempotencyKey !== idempotencyKey ||
    !isSafeNonNegativeInteger(receipt.revokedAtMs)
  ) {
    throw new RangeError("JIT revocation receipt does not match the scheduled grant and idempotency key");
  }
  return { grantId, idempotencyKey, revokedAtMs: receipt.revokedAtMs };
}

export function parseOptionalJitRevocationReceipt(
  value: unknown,
  grantId: string,
  idempotencyKey: string,
): JitRevocationReceipt | null {
  return value === null ? null : parseJitRevocationReceipt(value, grantId, idempotencyKey);
}

export function parseHealthEvaluationReceipt(value: unknown, observedAtMs: number): HealthEvaluationReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError("health evaluation receipt must use schemaVersion 1 with an object payload");
  }
  const envelope = value as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("health evaluation receipt must use schemaVersion 1 with an object payload");
  }
  const receipt = envelope.payload as Record<string, unknown>;
  if (
    receipt.observedAtMs !== observedAtMs ||
    typeof receipt.healthy !== "boolean" ||
    !isSafeNonNegativeInteger(receipt.consecutiveFailures) ||
    typeof receipt.decision !== "string" ||
    !HEALTH_DECISIONS.includes(receipt.decision)
  ) {
    throw new RangeError("health evaluation receipt does not match workflow logical time");
  }
  if (
    (receipt.decision === "activate_failsafe" && (receipt.healthy || receipt.consecutiveFailures < 3)) ||
    (receipt.decision === "recover" && (!receipt.healthy || receipt.consecutiveFailures !== 0))
  ) {
    throw new RangeError("health evaluation receipt has an inconsistent decision");
  }
  return {
    observedAtMs,
    healthy: receipt.healthy,
    consecutiveFailures: receipt.consecutiveFailures,
    decision: receipt.decision as HealthDecision,
  };
}
