// 根拠: ADR-0030 / 添付TEXT「Jira・GitHub・ai-ops-platform構成」
// Jira webhookを最小metadataへ正規化する。Summary/Description/Comment本文は保持しない。
import { createHash } from "node:crypto";
import { computeJiraFieldHash } from "@aiops/integrations";

export const SUPPORTED_JIRA_WEBHOOK_EVENTS = [
  "jira:issue_created",
  "jira:issue_updated",
  "jira:issue_deleted",
] as const;
export type SupportedJiraWebhookEvent = (typeof SUPPORTED_JIRA_WEBHOOK_EVENTS)[number];

export interface JiraProjectMapping {
  readonly projectId: string;
  readonly jiraProjectId: string;
  readonly mappingVersion: number;
  readonly allowedStatusIds: readonly string[];
  readonly sprintFieldId?: string;
}

export interface QueuedJiraWebhookEvent {
  readonly kind: "jira_work_item_event";
  readonly origin: "jira-webhook";
  readonly eventName: SupportedJiraWebhookEvent;
  readonly issueKey: string;
  readonly projectId: string;
  readonly jiraProjectId: string;
  readonly statusId: string;
  readonly assigneeAccountId: string | null;
  readonly sprintId: string | null;
  readonly updated: string;
  readonly fieldHash: string;
  readonly revision: string;
  readonly mappingVersion: number;
  readonly payloadDigest: string;
}

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,29}-[1-9][0-9]{0,9}$/u;
const PROJECT_ID_PATTERN = /^PJ-[0-9]+$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, path: readonly string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === "string" && current.trim() !== "" ? current : null;
}

function readSprintId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const item = value[index];
      if (isRecord(item) && (typeof item.id === "string" || typeof item.id === "number")) return String(item.id);
    }
    return null;
  }
  if (isRecord(value) && (typeof value.id === "string" || typeof value.id === "number")) return String(value.id);
  return null;
}

function isSupportedEvent(value: unknown): value is SupportedJiraWebhookEvent {
  return typeof value === "string" && (SUPPORTED_JIRA_WEBHOOK_EVENTS as readonly string[]).includes(value);
}

export function jiraProjectIdFromWebhook(payload: unknown): string | null {
  return readString(payload, ["issue", "fields", "project", "id"]);
}

export function deriveJiraRevision(updated: string, fieldHash: string): string {
  const timestamp = new Date(updated);
  if (Number.isNaN(timestamp.getTime()) || !HASH_PATTERN.test(fieldHash)) {
    throw new RangeError("Jira revision requires a valid updated timestamp and fieldHash");
  }
  return createHash("sha256").update(`${timestamp.toISOString()}\n${fieldHash}`, "utf8").digest("hex");
}

export async function normalizeJiraWebhookEvent(
  payload: unknown,
  mapping: JiraProjectMapping,
  payloadDigest: string,
): Promise<QueuedJiraWebhookEvent> {
  if (!isRecord(payload)) throw new RangeError("Jira webhook payload must be an object");
  const eventName = payload.webhookEvent;
  if (!isSupportedEvent(eventName)) throw new RangeError("unsupported Jira webhook event");
  if (!PROJECT_ID_PATTERN.test(mapping.projectId)) throw new RangeError("mapping projectId must be PJ-*");
  if (!Number.isSafeInteger(mapping.mappingVersion) || mapping.mappingVersion < 1) {
    throw new RangeError("mappingVersion must be a positive integer");
  }
  if (!HASH_PATTERN.test(payloadDigest)) throw new RangeError("payloadDigest must be SHA-256 hex");

  const issueKey = readString(payload, ["issue", "key"]);
  const jiraProjectId = jiraProjectIdFromWebhook(payload);
  const statusId = readString(payload, ["issue", "fields", "status", "id"]);
  const updated = readString(payload, ["issue", "fields", "updated"]);
  if (!issueKey || !ISSUE_KEY_PATTERN.test(issueKey) || !jiraProjectId || !statusId || !updated) {
    throw new RangeError("Jira webhook is missing canonical issue metadata");
  }
  if (jiraProjectId !== mapping.jiraProjectId) throw new RangeError("Jira webhook project does not match mapping");
  if (!mapping.allowedStatusIds.includes(statusId)) throw new RangeError("Jira status is not allowlisted");
  if (Number.isNaN(Date.parse(updated))) throw new RangeError("Jira updated timestamp is invalid");

  const assigneeAccountId = readString(payload, ["issue", "fields", "assignee", "accountId"]);
  const fields = isRecord(payload.issue) && isRecord(payload.issue.fields) ? payload.issue.fields : {};
  const sprintId = mapping.sprintFieldId ? readSprintId(fields[mapping.sprintFieldId]) : null;
  const fieldHash = await computeJiraFieldHash({ assigneeAccountId, sprintId });
  return {
    kind: "jira_work_item_event",
    origin: "jira-webhook",
    eventName,
    issueKey,
    projectId: mapping.projectId,
    jiraProjectId,
    statusId,
    assigneeAccountId,
    sprintId,
    updated,
    fieldHash,
    revision: deriveJiraRevision(updated, fieldHash),
    mappingVersion: mapping.mappingVersion,
    payloadDigest,
  };
}

export function isQueuedJiraWebhookEvent(value: unknown): value is QueuedJiraWebhookEvent {
  if (!isRecord(value)) return false;
  return (
    value.kind === "jira_work_item_event" &&
    value.origin === "jira-webhook" &&
    isSupportedEvent(value.eventName) &&
    typeof value.issueKey === "string" &&
    ISSUE_KEY_PATTERN.test(value.issueKey) &&
    typeof value.projectId === "string" &&
    PROJECT_ID_PATTERN.test(value.projectId) &&
    typeof value.jiraProjectId === "string" &&
    typeof value.statusId === "string" &&
    (typeof value.assigneeAccountId === "string" || value.assigneeAccountId === null) &&
    (typeof value.sprintId === "string" || value.sprintId === null) &&
    typeof value.updated === "string" &&
    typeof value.fieldHash === "string" &&
    HASH_PATTERN.test(value.fieldHash) &&
    typeof value.revision === "string" &&
    HASH_PATTERN.test(value.revision) &&
    Number.isSafeInteger(value.mappingVersion) &&
    typeof value.payloadDigest === "string" &&
    HASH_PATTERN.test(value.payloadDigest)
  );
}
