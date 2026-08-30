/**
 * packages/server/src/scheduler/tasks/eventsPollingTask.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-010: webhook受信は検証後ただちにeventsテーブルへキューイングし、
 *   重い処理（Graph本文取得・LLM解釈・GitHub操作）はディスパッチャが非同期に行う（本タスクがその
 *   ディスパッチャ実体。5秒間隔でstatus='queued'をポーリングする常駐ループの初の実装）。
 *
 * 設計: 1件処理失敗を他イベントの処理に波及させない（例外を隔離しmarkDelayedへ）。
 *   source='inbound' はteamsConversationAgentへ、source='github'/'monitor' はDevOps dispatcherへ渡す。
 *   未対応payloadは無限リトライを避けるため監査ログを残してdoneにする。
 */
import type { AuditLogWriter } from "@aiops/shared";
import type { Logger } from "../../observability/logger.js";
import type { MetricsRegistry } from "../../observability/metrics.js";
import type { ScheduledTask } from "../scheduler.js";
import type { EventsRepo, QueuedEvent } from "../../db/eventsRepo.js";
import { isQueuedGithubWebhookEvent, type QueuedGithubWebhookEvent } from "../../lib/githubEventRouter.js";
import { isQueuedJiraWebhookEvent, type QueuedJiraWebhookEvent } from "../../lib/jiraEventRouter.js";

export interface InboundNotificationPayload {
  kind: "graph_channel_message_notification";
  changeType: string | null;
  resource: string | null;
  subscriptionId: string | null;
  ids: unknown;
}

export interface EventsPollingTaskDeps {
  eventsRepo: EventsRepo;
  auditLog: AuditLogWriter;
  /** graph_channel_message_notification をディスパッチする（teamsConversationAgent.handleNotification想定） */
  dispatchInboundNotification(payload: InboundNotificationPayload, traceId: string): Promise<void>;
  /** GitHub webhookイベントをDevOpsエージェントへディスパッチする */
  dispatchGithubEvent(payload: QueuedGithubWebhookEvent, traceId: string): Promise<void>;
  /** Jira webhook metadataをjira-sync dispatcherへディスパッチする */
  dispatchJiraEvent?(payload: QueuedJiraWebhookEvent, traceId: string): Promise<void>;
  /** 監視イベントをDevOpsエージェントへディスパッチする */
  dispatchMonitorEvent(payload: unknown, traceId: string): Promise<void>;
  traceIdProvider(): string;
  /** 1tickあたりの最大処理件数（既定10。無限ループ防止） */
  maxBatchSize?: number;
  /** deadへ送る最大試行回数（既定5） */
  maxAttempts?: number;
  retryBackoffMs?(attemptsSoFar: number): number;
  logger?: Logger;
  metrics?: MetricsRegistry;
}

function isInboundNotificationPayload(payload: unknown): payload is InboundNotificationPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === "graph_channel_message_notification"
  );
}

async function processEvent(event: QueuedEvent, deps: EventsPollingTaskDeps, now: Date): Promise<void> {
  const logger = deps.logger?.child({ trace_id: event.traceId, event_id: event.eventId, source: event.source });
  try {
    logger?.info("event dispatch started");
    if (event.source === "inbound" && isInboundNotificationPayload(event.payload)) {
      await deps.dispatchInboundNotification(event.payload, event.traceId);
    } else if (event.source === "github" && isQueuedGithubWebhookEvent(event.payload)) {
      await deps.dispatchGithubEvent(event.payload, event.traceId);
    } else if (event.source === "jira" && isQueuedJiraWebhookEvent(event.payload)) {
      if (!deps.dispatchJiraEvent) throw new Error("Jira event dispatcher is not configured");
      await deps.dispatchJiraEvent(event.payload, event.traceId);
    } else if (event.source === "monitor") {
      await deps.dispatchMonitorEvent(event.payload, event.traceId);
    } else {
      await deps.auditLog.append({
        trace_id: event.traceId,
        actor: "SERVER",
        action: "event_dispatch_ignored",
        basis: "DevOps:SPEC-INT-010",
        detail: { eventId: event.eventId, source: event.source },
        at: now.toISOString(),
      });
    }
    await deps.eventsRepo.markDone(event.eventId);
    logger?.info("event dispatch completed");
  } catch (err) {
    const maxAttempts = deps.maxAttempts ?? 5;
    const backoffMs =
      deps.retryBackoffMs?.(event.attempts) ??
      Math.min(30_000 * 2 ** event.attempts, 15 * 60_000) + Math.random() * 1000;
    const result = await deps.eventsRepo.markFailed(event.eventId, {
      maxAttempts,
      nextAttemptAt: new Date(now.getTime() + backoffMs),
      claimedAt: event.claimedAt,
    });
    await deps.auditLog.append({
      trace_id: event.traceId,
      actor: "SERVER",
      action:
        result.status === "dead"
          ? "event_dispatch_dead"
          : result.status === "stale"
            ? "event_dispatch_stale_failure"
            : "event_dispatch_failed",
      basis: "DevOps:SPEC-INT-010",
      detail: {
        eventId: event.eventId,
        source: event.source,
        attempts: result.attempts,
        maxAttempts,
        error: err instanceof Error ? err.message : String(err),
      },
      at: now.toISOString(),
    });
    logger?.error({ err: err instanceof Error ? err.message : String(err) }, "event dispatch failed");
  }
}

export function createEventsPollingTask(deps: EventsPollingTaskDeps): ScheduledTask {
  const maxBatchSize = deps.maxBatchSize ?? 10;

  return {
    name: "events-polling-5s",
    intervalMs: 5_000,
    async run(now: Date): Promise<void> {
      try {
        for (let i = 0; i < maxBatchSize; i++) {
          const event = await deps.eventsRepo.claimNextQueued({ maxAttempts: deps.maxAttempts ?? 5 });
          if (!event) return;
          await processEvent(event, deps, now);
        }
      } finally {
        const metrics = deps.metrics;
        if (metrics && "getQueueMetrics" in deps.eventsRepo) {
          metrics.setEventQueue(await deps.eventsRepo.getQueueMetrics(now));
        }
      }
    },
  };
}
