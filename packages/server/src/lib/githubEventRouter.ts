/**
 * packages/server/src/lib/githubEventRouter.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010（eventsテーブルのGitHub webhookイベントをDevOpsエージェントへ振り分ける）。
 */
import type { AuditLogWriter } from "@aiops/shared";

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
