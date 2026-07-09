/**
 * packages/server/src/lib/githubEventRouter.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010（eventsテーブルのGitHub webhookイベントをDevOpsエージェントへ振り分ける）。
 */
import type { AuditLogWriter } from "@aiops/shared";
import type { PmEventRecordInput, PmTimeseriesRepo, PmSubjectType } from "../db/pmTimeseriesRepo.js";

export type DevopsAgentId = "AGT_BLD" | "AGT_DEP" | "AGT_INC";

export interface QueuedGithubWebhookEvent {
  eventName: string;
  payload: unknown;
}

export interface DevopsEventHandlerInput extends QueuedGithubWebhookEvent {
  targetAgent: DevopsAgentId;
}

export type DevopsEventHandler = (event: DevopsEventHandlerInput, traceId: string) => Promise<void>;

export interface GithubEventDispatcherDeps {
  auditLog: AuditLogWriter;
  handlers: Record<DevopsAgentId, DevopsEventHandler>;
  pmRepo?: PmTimeseriesRepo;
  now?: () => Date;
}

export function isQueuedGithubWebhookEvent(payload: unknown): payload is QueuedGithubWebhookEvent {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { eventName?: unknown }).eventName === "string" &&
    "payload" in payload
  );
}

function readString(payload: unknown, path: string[]): string | null {
  let cur: unknown = payload;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : null;
}

function readNumber(payload: unknown, path: string[]): number | null {
  let cur: unknown = payload;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "number" ? cur : null;
}

function readStatusChange(payload: unknown): { fromStatus: string | null; toStatus: string | null } {
  return {
    fromStatus:
      readString(payload, ["changes", "field_value", "from", "name"]) ??
      readString(payload, ["changes", "field_value", "from"]) ??
      readString(payload, ["changes", "status", "from"]),
    toStatus:
      readString(payload, ["changes", "field_value", "to", "name"]) ??
      readString(payload, ["changes", "field_value", "to"]) ??
      readString(payload, ["changes", "status", "to"]),
  };
}

function repositoryName(payload: unknown): string | null {
  return readString(payload, ["repository", "full_name"]);
}

function projectId(payload: unknown): string | null {
  return (
    readString(payload, ["project", "node_id"]) ??
    readString(payload, ["project", "id"]) ??
    readString(payload, ["projects_v2_item", "project_node_id"]) ??
    readString(payload, ["projects_v2_status_update", "project_node_id"])
  );
}

function subjectId(payload: unknown, type: PmSubjectType): string | null {
  if (type === "issue")
    return readString(payload, ["issue", "node_id"]) ?? String(readNumber(payload, ["issue", "number"]) ?? "");
  if (type === "pull_request") {
    return (
      readString(payload, ["pull_request", "node_id"]) ?? String(readNumber(payload, ["pull_request", "number"]) ?? "")
    );
  }
  if (type === "milestone")
    return String(readNumber(payload, ["milestone", "number"]) ?? readString(payload, ["milestone", "node_id"]) ?? "");
  if (type === "project_item")
    return readString(payload, ["projects_v2_item", "node_id"]) ?? readString(payload, ["projects_v2_item", "id"]);
  if (type === "deployment")
    return String(
      readNumber(payload, ["deployment_status", "id"]) ??
        readNumber(payload, ["deployment", "id"]) ??
        readString(payload, ["deployment_status", "node_id"]) ??
        readString(payload, ["deployment", "node_id"]) ??
        "",
    );
  return (
    readString(payload, ["projects_v2_status_update", "node_id"]) ??
    readString(payload, ["projects_v2_status_update", "id"])
  );
}

function occurredAt(payload: unknown, type: PmSubjectType, fallback: string): string {
  if (type === "issue") return readString(payload, ["issue", "updated_at"]) ?? fallback;
  if (type === "pull_request") return readString(payload, ["pull_request", "updated_at"]) ?? fallback;
  if (type === "milestone") return readString(payload, ["milestone", "updated_at"]) ?? fallback;
  if (type === "deployment")
    return (
      readString(payload, ["deployment_status", "created_at"]) ??
      readString(payload, ["deployment", "created_at"]) ??
      fallback
    );
  if (type === "project_status") return readString(payload, ["projects_v2_status_update", "updated_at"]) ?? fallback;
  return readString(payload, ["projects_v2_item", "updated_at"]) ?? fallback;
}

export function normalizePmWebhookEvent(
  event: QueuedGithubWebhookEvent,
  traceId: string,
  now: Date = new Date(),
): PmEventRecordInput | null {
  const subjectTypeByEvent: Record<string, PmSubjectType | undefined> = {
    issues: "issue",
    pull_request: "pull_request",
    milestone: "milestone",
    projects_v2_item: "project_item",
    projects_v2_status_update: "project_status",
    deployment: "deployment",
    deployment_status: "deployment",
  };
  const subjectType = subjectTypeByEvent[event.eventName];
  if (!subjectType) return null;

  const fallback = now.toISOString();
  const { fromStatus, toStatus } = readStatusChange(event.payload);
  const action = readString(event.payload, ["action"]);
  return {
    traceId,
    eventName: event.eventName,
    action,
    projectId: projectId(event.payload),
    repository: repositoryName(event.payload),
    subjectType,
    subjectId: subjectId(event.payload, subjectType),
    occurredAt: occurredAt(event.payload, subjectType, fallback),
    fromStatus,
    toStatus,
    normalized: {
      action,
      projectId: projectId(event.payload),
      repository: repositoryName(event.payload),
      subjectType,
      subjectId: subjectId(event.payload, subjectType),
      fromStatus,
      toStatus,
    },
    rawPayload: event.payload,
  };
}

export function selectDevopsAgentForGithubEvent(event: QueuedGithubWebhookEvent): DevopsAgentId | null {
  const workflowName = readString(event.payload, ["workflow_run", "name"])?.toLowerCase() ?? "";
  const conclusion = readString(event.payload, ["workflow_run", "conclusion"]);

  if (event.eventName === "issues") return "AGT_INC";
  if (event.eventName === "deployment" || event.eventName === "deployment_status") return "AGT_DEP";
  if (event.eventName === "workflow_run" && workflowName.includes("deploy")) return "AGT_DEP";
  if (event.eventName === "workflow_run" && conclusion === "failure") return "AGT_BLD";
  if (event.eventName === "push" || event.eventName === "pull_request") return "AGT_BLD";
  return null;
}

export async function dispatchGithubWebhookEvent(
  event: QueuedGithubWebhookEvent,
  traceId: string,
  deps: GithubEventDispatcherDeps,
): Promise<void> {
  const pmEvent = normalizePmWebhookEvent(event, traceId, deps.now?.() ?? new Date());
  if (pmEvent) {
    await deps.pmRepo?.recordEvent(pmEvent);
  }

  const targetAgent = selectDevopsAgentForGithubEvent(event);
  if (!targetAgent) {
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "github_event_ignored",
      basis: "SPEC-INT-010",
      detail: { eventName: event.eventName },
      at: new Date().toISOString(),
    });
    return;
  }

  await deps.handlers[targetAgent]({ ...event, targetAgent }, traceId);
  await deps.auditLog.append({
    trace_id: traceId,
    actor: "SERVER",
    action: "github_event_dispatched",
    basis: "SPEC-INT-010",
    detail: { eventName: event.eventName, targetAgent },
    at: new Date().toISOString(),
  });
}
