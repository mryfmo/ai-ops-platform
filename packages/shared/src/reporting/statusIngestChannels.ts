/**
 * 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001。
 * email / Teams / GitHub の外部 payload を一つの bounded event へ写像する純粋層。
 */
import { sanitizeSecrets } from "../secretSanitizer.js";
import {
  normalizeSelfStatus,
  resolveStatusReportProjectId,
  type StructuredStatusUpdate,
} from "./statusIngestContract.js";

export type StatusIngestChannel = "email" | "teams" | "github";

export interface NormalizedStatusIngestEvent {
  readonly channel: StatusIngestChannel;
  readonly sourceMessageId: string;
  readonly threadId: string;
  readonly receivedAt: string;
  readonly reporterId: string;
  readonly projectId: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly update: StructuredStatusUpdate;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u;
const REPORTER_PATTERN = /^ST-[0-9]+$/u;
const PROJECT_PATTERN = /^PJ-[0-9]{3,}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const UPDATE_KEYS = ["progress_pct", "self_status", "achievements", "plans", "issues", "risks"] as const;

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new RangeError(`${label} contains unknown field ${JSON.stringify(extras[0])}`);
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new RangeError(`${label} must be a bounded canonical identifier`);
  }
  return value;
}

function text(value: unknown, label: string, max: number, nullable = false): string | null {
  if (nullable && (value === undefined || value === null)) return null;
  if (typeof value !== "string" || value.length > max) throw new RangeError(`${label} must be a bounded string`);
  return sanitizeSecrets(value).sanitized;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !RFC3339_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RangeError("receivedAt must be an RFC3339 timestamp");
  }
  return value;
}

function structured(value: unknown): StructuredStatusUpdate {
  const input = object(value, "structured");
  exactKeys(input, UPDATE_KEYS, "structured");
  const progress = input.progress_pct;
  if (progress !== undefined && progress !== null && typeof progress !== "number") {
    throw new RangeError("structured.progress_pct must be a number or null");
  }
  const rawStatus = input.self_status;
  if (rawStatus !== undefined && rawStatus !== null && typeof rawStatus !== "string") {
    throw new RangeError("structured.self_status must be a string or null");
  }
  const status = typeof rawStatus === "string" ? normalizeSelfStatus(rawStatus) : rawStatus;
  const result: StructuredStatusUpdate = { progress_pct: progress as number | null | undefined, self_status: status };
  for (const key of ["achievements", "plans", "issues", "risks"] as const) {
    const item = input[key];
    if (item !== undefined && item !== null && typeof item !== "string") {
      throw new RangeError(`structured.${key} must be a string or null`);
    }
    result[key] = item == null ? item : text(item, `structured.${key}`, 10_000);
  }
  return result;
}

interface CommonFields {
  readonly receivedAt: string;
  readonly reporterId: string;
  readonly projectIdHintFromSender: string | undefined;
  readonly subject: string | null;
  readonly body: string;
  readonly structured: StructuredStatusUpdate;
}

function common(input: Record<string, unknown>, subjectKey: string | null): CommonFields {
  if (typeof input.reporterId !== "string" || !REPORTER_PATTERN.test(input.reporterId)) {
    throw new RangeError("reporterId must be a canonical stakeholder ID");
  }
  if (
    input.projectIdHintFromSender !== undefined &&
    (typeof input.projectIdHintFromSender !== "string" || !PROJECT_PATTERN.test(input.projectIdHintFromSender))
  ) {
    throw new RangeError("projectIdHintFromSender must be a canonical project ID");
  }
  return {
    receivedAt: timestamp(input.receivedAt),
    reporterId: input.reporterId,
    projectIdHintFromSender: input.projectIdHintFromSender as string | undefined,
    subject: subjectKey === null ? null : text(input[subjectKey], subjectKey, 1_000, true),
    body: text(input.body, "body", 100_000)!,
    structured: structured(input.structured),
  };
}

function normalized(
  channel: StatusIngestChannel,
  sourceMessageId: string,
  threadId: string,
  fields: CommonFields,
): NormalizedStatusIngestEvent {
  return {
    channel,
    sourceMessageId,
    threadId,
    receivedAt: fields.receivedAt,
    reporterId: fields.reporterId,
    projectId: resolveStatusReportProjectId({
      subject: fields.subject ?? undefined,
      body: fields.body,
      projectIdHintFromSender: fields.projectIdHintFromSender,
    }),
    subject: fields.subject,
    body: fields.body,
    update: fields.structured,
  };
}

/** Outlook/Graph connector payload mapping. */
export function normalizeEmailStatusPayload(value: unknown): NormalizedStatusIngestEvent {
  const input = object(value, "email payload");
  exactKeys(
    input,
    [
      "internetMessageId",
      "conversationId",
      "receivedAt",
      "reporterId",
      "projectIdHintFromSender",
      "subject",
      "body",
      "structured",
    ],
    "email payload",
  );
  return normalized(
    "email",
    identifier(input.internetMessageId, "internetMessageId"),
    identifier(input.conversationId, "conversationId"),
    common(input, "subject"),
  );
}

/** Teams channel-message payload mapping. */
export function normalizeTeamsStatusPayload(value: unknown): NormalizedStatusIngestEvent {
  const input = object(value, "Teams payload");
  exactKeys(
    input,
    ["messageId", "rootMessageId", "receivedAt", "reporterId", "projectIdHintFromSender", "body", "structured"],
    "Teams payload",
  );
  return normalized(
    "teams",
    identifier(input.messageId, "messageId"),
    identifier(input.rootMessageId, "rootMessageId"),
    common(input, null),
  );
}

/** GitHub webhook payload mapping. */
export function normalizeGithubStatusPayload(value: unknown): NormalizedStatusIngestEvent {
  const input = object(value, "GitHub payload");
  exactKeys(
    input,
    [
      "deliveryId",
      "discussionId",
      "receivedAt",
      "reporterId",
      "projectIdHintFromSender",
      "title",
      "body",
      "structured",
    ],
    "GitHub payload",
  );
  return normalized(
    "github",
    identifier(input.deliveryId, "deliveryId"),
    identifier(input.discussionId, "discussionId"),
    common(input, "title"),
  );
}
