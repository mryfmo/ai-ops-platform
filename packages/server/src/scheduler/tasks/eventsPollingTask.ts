/**
 * packages/server/src/scheduler/tasks/eventsPollingTask.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010: webhook受信は検証後ただちにeventsテーブルへキューイングし、
 *   重い処理（Graph本文取得・LLM解釈・GitHub操作）はディスパッチャが非同期に行う（本タスクがその
 *   ディスパッチャ実体。5秒間隔でstatus='queued'をポーリングする常駐ループの初の実装）。
 *
 * 設計: 1件処理失敗を他イベントの処理に波及させない（例外を隔離しmarkDelayedへ）。
 *   source='inbound'（graph_channel_message_notification）のみteamsConversationAgentへディスパッチする。
 *   他sourceは現時点で本タスクの対象外（github/monitorの既存ディスパッチ経路が別途あれば将来接続、
 *   本タスクでは黙って完了扱いにする＝markDone。TODO: github/monitorディスパッチは別タスクで実装）。
 */
import type { AuditLogWriter } from "@aiops/shared";
import type { ScheduledTask } from "../scheduler.js";
import type { EventsRepo, QueuedEvent } from "../../db/eventsRepo.js";

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
  traceIdProvider(): string;
  /** 1tickあたりの最大処理件数（既定10。無限ループ防止） */
  maxBatchSize?: number;
}

function isInboundNotificationPayload(payload: unknown): payload is InboundNotificationPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === "graph_channel_message_notification"
  );
}

async function processEvent(event: QueuedEvent, deps: EventsPollingTaskDeps, now: Date): Promise<void> {
  try {
    if (event.source === "inbound" && isInboundNotificationPayload(event.payload)) {
      await deps.dispatchInboundNotification(event.payload, event.traceId);
    }
    // github/monitor は本タスクの対象外（TODO: 別タスクでディスパッチ経路を接続）。
    // 未対応sourceも含め、正常経路として完了扱いにする（無限リトライを避ける）。
    await deps.eventsRepo.markDone(event.eventId);
  } catch (err) {
    // 1件の失敗を他イベント処理に波及させない（隔離）。delayedへ遷移させ、次tickでの再クレーム対象にする。
    await deps.eventsRepo.markDelayed(event.eventId);
    await deps.auditLog.append({
      trace_id: event.traceId,
      actor: "SERVER",
      action: "event_dispatch_failed",
      basis: "SPEC-INT-010",
      detail: { eventId: event.eventId, source: event.source, error: err instanceof Error ? err.message : String(err) },
      at: now.toISOString(),
    });
  }
}

export function createEventsPollingTask(deps: EventsPollingTaskDeps): ScheduledTask {
  const maxBatchSize = deps.maxBatchSize ?? 10;

  return {
    name: "events-polling-5s",
    intervalMs: 5_000,
    async run(now: Date): Promise<void> {
      for (let i = 0; i < maxBatchSize; i++) {
        const event = await deps.eventsRepo.claimNextQueued();
        if (!event) return;
        await processEvent(event, deps, now);
      }
    },
  };
}
