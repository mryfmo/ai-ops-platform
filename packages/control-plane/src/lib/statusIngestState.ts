// 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001 / ADR-0020
// status ingest の unknown 境界、決定的 identity、preserved contract parity を固定する純粋層。
import {
  checkCompleteness,
  decideClarificationAction,
  formatClarificationMessage,
  type CompletenessResult,
  type StatusFieldKey,
  type StructuredStatusUpdate,
} from "@aiops/shared/reporting/statusIngestContract.js";
import { sanitizeSecrets } from "@aiops/shared/secretSanitizer.js";
import type { NormalizedStatusIngestEvent, StatusIngestChannel } from "@aiops/shared/reporting/statusIngestChannels.js";

import { buildWorkflowId } from "./workflowId.js";

export type StatusIngestExecutionMode = "shadow" | "active";
export type StatusIngestAction = "accept" | "clarify" | "escalate_incomplete";

export interface StatusIngestRequest {
  readonly executionMode: StatusIngestExecutionMode;
  readonly event: NormalizedStatusIngestEvent;
}

export interface StatusIngestDecision {
  readonly action: StatusIngestAction;
  readonly completeness: CompletenessResult;
  readonly clarificationMessage: string | null;
}

export interface StatusIngestClaimReceipt {
  readonly sourceKey: string;
  readonly threadKey: string;
  readonly duplicate: boolean;
  readonly priorClarifyCount: number;
  readonly clarifyCount: number;
  readonly action: StatusIngestAction;
  readonly state: "pending" | "complete";
  readonly revision: number;
}

export interface StatusIngestSideEffectReceipt {
  readonly sourceKey: string;
  readonly idempotencyKey: string;
  readonly effect: "canonical" | "notification" | "audit";
  readonly reference: string;
}

export interface StatusIngestCompletionReceipt {
  readonly sourceKey: string;
  readonly revision: number;
  readonly state: "complete";
}

const CHANNELS: readonly StatusIngestChannel[] = ["email", "teams", "github"];
const EVENT_KEYS = [
  "channel",
  "sourceMessageId",
  "threadId",
  "receivedAt",
  "reporterId",
  "projectId",
  "subject",
  "body",
  "update",
] as const;
const UPDATE_KEYS = ["progress_pct", "self_status", "achievements", "plans", "issues", "risks"] as const;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u;
const REPORTER_PATTERN = /^ST-[0-9]+$/u;
const PROJECT_PATTERN = /^PJ-[0-9]{3,}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra !== undefined) throw new RangeError(`${label} contains unknown field ${JSON.stringify(extra)}`);
}

function assertEvent(value: unknown): asserts value is NormalizedStatusIngestEvent {
  const event = record(value, "status ingest event");
  exactKeys(event, EVENT_KEYS, "status ingest event");
  if (typeof event.channel !== "string" || !CHANNELS.includes(event.channel as StatusIngestChannel)) {
    throw new RangeError("status ingest channel must be email, teams, or github");
  }
  for (const name of ["sourceMessageId", "threadId"] as const) {
    if (typeof event[name] !== "string" || !ID_PATTERN.test(event[name])) {
      throw new RangeError(`${name} must be a bounded canonical identifier`);
    }
  }
  if (typeof event.reporterId !== "string" || !REPORTER_PATTERN.test(event.reporterId)) {
    throw new RangeError("reporterId must be a canonical stakeholder ID");
  }
  if (typeof event.projectId !== "string" || !PROJECT_PATTERN.test(event.projectId)) {
    throw new RangeError("E-ING02: projectId must resolve to a canonical project ID before workflow dispatch");
  }
  if (
    typeof event.receivedAt !== "string" ||
    !RFC3339_PATTERN.test(event.receivedAt) ||
    !Number.isFinite(Date.parse(event.receivedAt))
  ) {
    throw new RangeError("receivedAt must be RFC3339");
  }
  if (event.subject !== null && (typeof event.subject !== "string" || event.subject.length > 1_000)) {
    throw new RangeError("subject must be null or a bounded string");
  }
  if (typeof event.body !== "string" || event.body.length > 100_000) {
    throw new RangeError("body must be a bounded string");
  }
  const update = record(event.update, "status ingest update");
  exactKeys(update, UPDATE_KEYS, "status ingest update");
  if (update.progress_pct !== undefined && update.progress_pct !== null && typeof update.progress_pct !== "number") {
    throw new RangeError("progress_pct must be a number or null");
  }
  if (
    update.self_status !== undefined &&
    update.self_status !== null &&
    !["green", "yellow", "red"].includes(String(update.self_status))
  ) {
    throw new RangeError("self_status must be green, yellow, red, or null");
  }
  for (const name of ["achievements", "plans", "issues", "risks"] as const) {
    if (
      update[name] !== undefined &&
      update[name] !== null &&
      (typeof update[name] !== "string" || update[name].length > 10_000)
    ) {
      throw new RangeError(`${name} must be a string or null`);
    }
  }
  if (sanitizeSecrets(JSON.stringify({ subject: event.subject, body: event.body, update })).redactionCount > 0) {
    throw new RangeError("status ingest event must be sanitized before workflow dispatch");
  }
}

/** Temporal payload 全体を unknown から検証する。 */
export function assertStatusIngestRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: StatusIngestRequest;
} {
  const envelope = record(input, "status ingest request");
  exactKeys(envelope, ["schemaVersion", "payload"], "status ingest request");
  if (envelope.schemaVersion !== 1) throw new RangeError("status ingest request must use schemaVersion 1");
  const payload = record(envelope.payload, "status ingest payload");
  exactKeys(payload, ["executionMode", "event"], "status ingest payload");
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  assertEvent(payload.event);
}

export function buildStatusIngestSourceKey(event: NormalizedStatusIngestEvent): string {
  return `status-ingest:${event.channel}:${event.sourceMessageId}`;
}

export function buildStatusIngestThreadKey(event: NormalizedStatusIngestEvent): string {
  return `status-ingest:${event.channel}:${event.threadId}`;
}

export function buildStatusIngestWorkflowId(event: NormalizedStatusIngestEvent): string {
  return buildWorkflowId("report", `status-ingest:${event.channel}:${event.sourceMessageId}`);
}

/** Preserved pure contract を唯一の decision source とする。 */
export function deriveStatusIngestDecision(update: StructuredStatusUpdate, clarifyCount: number): StatusIngestDecision {
  if (!Number.isInteger(clarifyCount) || clarifyCount < 0 || clarifyCount > 3) {
    throw new RangeError("clarifyCount must be an integer between 0 and 3");
  }
  const completeness = checkCompleteness(update);
  const action = decideClarificationAction(completeness, { clarifyCount }).action;
  return {
    action,
    completeness,
    clarificationMessage: action === "clarify" ? formatClarificationMessage(completeness.missingFields) : null,
  };
}

function parseCompleteness(value: CompletenessResult): CompletenessResult {
  return { complete: value.complete, missingFields: [...value.missingFields] as StatusFieldKey[] };
}

/** DB authority receipt が preserved decision/count と一致することを workflow 前に強制する。 */
export function parseStatusIngestClaimReceipt(
  value: unknown,
  event: NormalizedStatusIngestEvent,
  completeness: CompletenessResult,
): StatusIngestClaimReceipt {
  const envelope = record(value, "status ingest claim receipt");
  exactKeys(envelope, ["schemaVersion", "payload"], "status ingest claim receipt");
  if (envelope.schemaVersion !== 1) throw new RangeError("status ingest claim receipt must use schemaVersion 1");
  const payload = record(envelope.payload, "status ingest claim receipt payload");
  exactKeys(
    payload,
    ["sourceKey", "threadKey", "duplicate", "priorClarifyCount", "clarifyCount", "action", "state", "revision"],
    "status ingest claim receipt payload",
  );
  const prior = payload.priorClarifyCount;
  const count = payload.clarifyCount;
  if (
    payload.sourceKey !== buildStatusIngestSourceKey(event) ||
    payload.threadKey !== buildStatusIngestThreadKey(event) ||
    typeof payload.duplicate !== "boolean" ||
    !Number.isInteger(prior) ||
    (prior as number) < 0 ||
    (prior as number) > 3 ||
    !Number.isInteger(count) ||
    (count as number) < 0 ||
    (count as number) > 3 ||
    (payload.state !== "pending" && payload.state !== "complete") ||
    !Number.isSafeInteger(payload.revision) ||
    (payload.revision as number) < 1
  ) {
    throw new RangeError("status ingest claim receipt does not match the request identity or bounds");
  }
  const expected = decideClarificationAction(parseCompleteness(completeness), { clarifyCount: prior as number }).action;
  const expectedCount = expected === "clarify" ? (prior as number) + 1 : (prior as number);
  if (payload.action !== expected || count !== expectedCount) {
    throw new RangeError("status ingest claim receipt drifts from the preserved clarification contract");
  }
  return {
    sourceKey: payload.sourceKey,
    threadKey: payload.threadKey,
    duplicate: payload.duplicate,
    priorClarifyCount: prior as number,
    clarifyCount: count as number,
    action: expected,
    state: payload.state,
    revision: payload.revision as number,
  };
}

/** shadow evaluation が参照する永続 thread authority の bounded count。 */
export function parseStatusIngestThreadReceipt(value: unknown, threadKey: string): number {
  const envelope = record(value, "status ingest thread receipt");
  exactKeys(envelope, ["schemaVersion", "payload"], "status ingest thread receipt");
  if (envelope.schemaVersion !== 1) throw new RangeError("status ingest thread receipt must use schemaVersion 1");
  const payload = record(envelope.payload, "status ingest thread receipt payload");
  exactKeys(payload, ["threadKey", "clarifyCount"], "status ingest thread receipt payload");
  if (
    payload.threadKey !== threadKey ||
    !Number.isInteger(payload.clarifyCount) ||
    (payload.clarifyCount as number) < 0 ||
    (payload.clarifyCount as number) > 3
  ) {
    throw new RangeError("status ingest thread receipt does not match the request identity or bounds");
  }
  return payload.clarifyCount as number;
}

/** 外部 canonical/notification receipt を source/key/effect に束縛する。 */
export function parseStatusIngestSideEffectReceipt(
  value: unknown,
  sourceKey: string,
  idempotencyKey: string,
  effect: StatusIngestSideEffectReceipt["effect"],
): StatusIngestSideEffectReceipt {
  const envelope = record(value, "status ingest side-effect receipt");
  exactKeys(envelope, ["schemaVersion", "payload"], "status ingest side-effect receipt");
  if (envelope.schemaVersion !== 1) throw new RangeError("status ingest side-effect receipt must use schemaVersion 1");
  const payload = record(envelope.payload, "status ingest side-effect receipt payload");
  exactKeys(
    payload,
    ["sourceKey", "idempotencyKey", "effect", "reference"],
    "status ingest side-effect receipt payload",
  );
  if (
    payload.sourceKey !== sourceKey ||
    payload.idempotencyKey !== idempotencyKey ||
    payload.effect !== effect ||
    typeof payload.reference !== "string" ||
    payload.reference.length === 0 ||
    payload.reference.length > 500
  ) {
    throw new RangeError("status ingest side-effect receipt does not match the requested effect");
  }
  return { sourceKey, idempotencyKey, effect, reference: payload.reference };
}

export function parseOptionalStatusIngestSideEffectReceipt(
  value: unknown,
  sourceKey: string,
  idempotencyKey: string,
  effect: StatusIngestSideEffectReceipt["effect"],
): StatusIngestSideEffectReceipt | null {
  return value === null ? null : parseStatusIngestSideEffectReceipt(value, sourceKey, idempotencyKey, effect);
}

/** CAS completion receipt を claimed revision の直後へ束縛する。 */
export function parseStatusIngestCompletionReceipt(
  value: unknown,
  sourceKey: string,
  expectedRevision: number,
): StatusIngestCompletionReceipt {
  const envelope = record(value, "status ingest completion receipt");
  exactKeys(envelope, ["schemaVersion", "payload"], "status ingest completion receipt");
  if (envelope.schemaVersion !== 1) throw new RangeError("status ingest completion receipt must use schemaVersion 1");
  const payload = record(envelope.payload, "status ingest completion receipt payload");
  exactKeys(payload, ["sourceKey", "revision", "state"], "status ingest completion receipt payload");
  if (payload.sourceKey !== sourceKey || payload.revision !== expectedRevision + 1 || payload.state !== "complete") {
    throw new RangeError("status ingest completion receipt does not match the claimed CAS revision");
  }
  return { sourceKey, revision: expectedRevision + 1, state: "complete" };
}
