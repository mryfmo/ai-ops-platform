/**
 * packages/shared/src/correlationContext.ts
 *
 * 根拠: FinalArch:CON-001 / FinalArch:CON-002 / FinalArch:FR-OBS-001 /
 *       FinalArch:PRD-003 / ADR-0020
 *
 * W3C Trace Context version 00 と platform の UUID contract を橋渡しする純粋関数。
 * 任意文字列は識別子だけに限定して 512 文字で閉じる。外部の本文をここへ格納せず、
 * 本文が必要な境界では別途 sanitizeSecrets()/sanitizeForLlmInput() を適用する。
 */
import { newTraceId } from "./ids.js";

export const TRACEPARENT_HEADER = "traceparent";
export const CORRELATION_ID_HEADER = "x-correlation-id";
export const CORRELATION_IDENTIFIER_MAX_LENGTH = 512;

export interface CorrelationContext {
  readonly traceId: string;
  readonly correlationId: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly actorId?: string;
  readonly projectId?: string;
  readonly repository?: string;
  readonly agentTaskId?: string;
  readonly meetingId?: string;
  readonly approvalId?: string;
  readonly toolId?: string;
  readonly modelId?: string;
  readonly sourceSystem?: string;
  readonly sourceObjectId?: string;
  readonly pullRequestNumber?: number;
}

export type CorrelationContextInput = Partial<CorrelationContext>;
export type CorrelationContextAttributes = Omit<CorrelationContextInput, "traceId" | "correlationId">;
export type CorrelationHeaders = Readonly<Record<string, string | undefined>>;
export type ParsedCorrelationHeaders = Readonly<{
  context: CorrelationContext;
  parentSpanId?: string;
  sampled: boolean;
}>;
type MutableCorrelationContext = { -readonly [K in keyof CorrelationContext]?: CorrelationContext[K] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/u;
const SPAN_ID = /^[0-9a-f]{16}$/u;
const ZERO_TRACE_ID = "0".repeat(32);
const ZERO_SPAN_ID = "0".repeat(16);
const STRING_FIELDS = [
  "workflowId",
  "runId",
  "actorId",
  "projectId",
  "repository",
  "agentTaskId",
  "meetingId",
  "approvalId",
  "toolId",
  "modelId",
  "sourceSystem",
  "sourceObjectId",
] as const;
const KNOWN_FIELDS = new Set(["traceId", "correlationId", ...STRING_FIELDS, "pullRequestNumber"]);

function uuid(value: unknown, field: "traceId" | "correlationId"): string {
  if (typeof value !== "string" || !UUID.test(value) || value.replaceAll("-", "") === ZERO_TRACE_ID) {
    throw new RangeError(`${field} must be a non-zero UUID`);
  }
  return value.toLowerCase();
}

function normalize(input: CorrelationContextInput, requireIds: boolean): CorrelationContextInput {
  for (const key of Object.keys(input)) {
    if (!KNOWN_FIELDS.has(key)) throw new RangeError(`correlation context has unknown field ${JSON.stringify(key)}`);
  }

  const normalized: MutableCorrelationContext = {};
  if (input.traceId !== undefined || requireIds) normalized.traceId = uuid(input.traceId, "traceId");
  if (input.correlationId !== undefined || requireIds) {
    normalized.correlationId = uuid(input.correlationId, "correlationId");
  }
  for (const field of STRING_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length < 1 || value.length > CORRELATION_IDENTIFIER_MAX_LENGTH) {
      throw new RangeError(`${field} must be between 1 and ${CORRELATION_IDENTIFIER_MAX_LENGTH} characters`);
    }
    normalized[field] = value;
  }
  if (input.pullRequestNumber !== undefined) {
    if (!Number.isSafeInteger(input.pullRequestNumber) || input.pullRequestNumber < 1) {
      throw new RangeError("pullRequestNumber must be a positive safe integer");
    }
    normalized.pullRequestNumber = input.pullRequestNumber;
  }
  return normalized;
}

export function createCorrelationContext(
  input: CorrelationContextInput = {},
  uuidProvider: () => string = newTraceId,
): CorrelationContext {
  return normalize(
    {
      ...input,
      traceId: input.traceId ?? uuidProvider(),
      correlationId: input.correlationId ?? uuidProvider(),
    },
    true,
  ) as CorrelationContext;
}

export function inheritCorrelationContext(
  parent: CorrelationContext,
  attributes: CorrelationContextAttributes = {},
): CorrelationContext {
  if ("traceId" in attributes || "correlationId" in attributes) {
    throw new RangeError("inherited traceId and correlationId cannot be overridden");
  }
  const validatedParent = normalize(parent, true) as CorrelationContext;
  const validatedAttributes = normalize(attributes, false);
  return normalize({ ...validatedParent, ...validatedAttributes }, true) as CorrelationContext;
}

function traceIdToHex(traceId: string): string {
  return uuid(traceId, "traceId").replaceAll("-", "");
}

function traceHexToUuid(traceId: string): string {
  return `${traceId.slice(0, 8)}-${traceId.slice(8, 12)}-${traceId.slice(12, 16)}-${traceId.slice(16, 20)}-${traceId.slice(20)}`;
}

function normalizedHeaders(headers: CorrelationHeaders): Map<string, string> {
  const normalized = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const key = name.toLowerCase();
    if (key !== TRACEPARENT_HEADER && key !== CORRELATION_ID_HEADER) continue;
    if (normalized.has(key)) throw new RangeError(`duplicate header ${JSON.stringify(key)}`);
    normalized.set(key, value);
  }
  return normalized;
}

export function serializeCorrelationHeaders(
  context: CorrelationContext,
  spanId: string,
  sampled = false,
): CorrelationHeaders {
  const validated = normalize(context, true) as CorrelationContext;
  if (!SPAN_ID.test(spanId) || spanId === ZERO_SPAN_ID)
    throw new RangeError("span ID must be 16 non-zero lowercase hex digits");
  return {
    [TRACEPARENT_HEADER]: `00-${traceIdToHex(validated.traceId)}-${spanId}-${sampled ? "01" : "00"}`,
    [CORRELATION_ID_HEADER]: validated.correlationId,
  };
}

export function parseCorrelationHeaders(
  headers: CorrelationHeaders,
  attributes: CorrelationContextAttributes = {},
  uuidProvider: () => string = newTraceId,
): ParsedCorrelationHeaders {
  const values = normalizedHeaders(headers);
  const traceparent = values.get(TRACEPARENT_HEADER);
  const correlationId = values.get(CORRELATION_ID_HEADER);
  if (!traceparent) {
    return {
      context: createCorrelationContext({ ...attributes, correlationId }, uuidProvider),
      sampled: false,
    };
  }

  const match = TRACEPARENT.exec(traceparent);
  if (!match) throw new RangeError("traceparent must use W3C version 00 lowercase format");
  const [, traceHex, parentSpanId, flags] = match;
  if (traceHex === ZERO_TRACE_ID) throw new RangeError("traceparent trace ID must be non-zero");
  if (parentSpanId === ZERO_SPAN_ID) throw new RangeError("traceparent span ID must be non-zero");
  const traceId = traceHexToUuid(traceHex!);
  return {
    context: createCorrelationContext({ ...attributes, traceId, correlationId: correlationId ?? traceId }),
    parentSpanId,
    sampled: (Number.parseInt(flags!, 16) & 1) === 1,
  };
}
