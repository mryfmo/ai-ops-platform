/**
 * packages/server/src/http/routes/graphNotifications.ts
 *
 * 根拠:
 *   - ADR-0005 / PrjOps:SPEC-INT-001: Graph change notification受信。
 *     (1) サブスクリプション作成時のvalidationTokenハンドシェイクは10秒以内にtext/plainで応答必須。
 *     (2) 通知本文は各要素のclientStateを検証し、不一致は破棄+監査ログ（攻撃兆候）。
 *     (3) 受理した通知はeventsテーブルへ source='inbound' でエンキューして即202
 *         （Graphは応答遅延でサブスクリプションを削除するため、重い処理は非同期化する）。
 */
import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { graphSubscriptionErrorDetail, sanitizeSecrets, type AuditLogWriter } from "@aiops/shared";
import {
  classifyNotifications,
  graphNotificationDedupeKey,
  type GraphNotification,
} from "../../lib/graphNotificationValidator.js";

/**
 * Microsoftはwebhook上限を公開していないため、1 MiBはGraph仕様値ではなく運用上限。
 * 現行subscriptionはincludeResourceDataなしのmetadata-only（約1〜2 KiB/件）なので
 * バッチと将来のvalidationTokensに約100倍の余裕を残しつつ、無認証経路のメモリを制限する。
 * Event Hubsの公開済み1 MB値は参考に留め、LB/WAF確定時（T-P1-07）に整合を再確認する。
 */
export const GRAPH_NOTIFICATION_MAX_BYTES = 1024 * 1024;

export type GraphLifecycleEventName = "reauthorizationRequired" | "subscriptionRemoved" | "missed";

export interface GraphLifecycleEvent {
  lifecycleEvent: GraphLifecycleEventName;
  subscriptionId: string | null;
  notification: GraphNotification;
}

export interface GraphNotificationDeps {
  clientState: string;
  auditLog: AuditLogWriter;
  /** eventsテーブルへのエンキュー（source='inbound'） */
  enqueueInboundEvent(payload: unknown, traceId: string, options?: { dedupeKey?: string | null }): Promise<boolean>;
  handleLifecycleEvent?(event: GraphLifecycleEvent, traceId: string): Promise<void>;
  traceIdProvider(): string;
}

function toLifecycleEvent(notification: GraphNotification): GraphLifecycleEvent | null {
  if (
    notification.lifecycleEvent !== "reauthorizationRequired" &&
    notification.lifecycleEvent !== "subscriptionRemoved" &&
    notification.lifecycleEvent !== "missed"
  ) {
    return null;
  }
  return {
    lifecycleEvent: notification.lifecycleEvent,
    subscriptionId: notification.subscriptionId ?? null,
    notification,
  };
}

function safeSubscriptionId(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : sanitizeSecrets(value).sanitized;
}

function runLifecycleAfterAck(deps: GraphNotificationDeps, event: GraphLifecycleEvent, traceId: string): void {
  const work = deps.handleLifecycleEvent
    ? deps.handleLifecycleEvent(event, traceId)
    : deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "graph_lifecycle_disabled",
        basis: "PrjOps:SPEC-INT-001",
        detail: { lifecycleEvent: event.lifecycleEvent, subscriptionId: safeSubscriptionId(event.subscriptionId) },
        at: new Date().toISOString(),
      });
  void work
    .catch((error) =>
      deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "graph_lifecycle_failed",
        basis: "PrjOps:SPEC-INT-001",
        detail: {
          lifecycleEvent: event.lifecycleEvent,
          subscriptionId: safeSubscriptionId(event.subscriptionId),
          ...graphSubscriptionErrorDetail(error),
          recovery: "lifecycle_event_retry",
        },
        at: new Date().toISOString(),
      }),
    )
    .catch(() => {});
}

export function registerGraphNotificationRoutes(app: Hono, deps: GraphNotificationDeps): void {
  const graphNotificationBodyLimit = bodyLimit({ maxSize: GRAPH_NOTIFICATION_MAX_BYTES });

  // 超過時はbodyLimit既定の413。無認証のattacker-controlledイベントによる追記専用監査ログの
  // 増幅を避けるため監査には残さず、Graph側の配送失敗とchannel polling fallbackで検知・回収する。
  app.post("/webhooks/graph", graphNotificationBodyLimit, async (c) => {
    // (1) サブスクリプション検証ハンドシェイク
    const validationToken = c.req.query("validationToken");
    if (validationToken) {
      return c.text(validationToken, 200);
    }

    // (2) 通知本文のパースとclientState検証
    let body: { value?: GraphNotification[] };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }
    const traceId = deps.traceIdProvider();
    const { accepted, rejected } = classifyNotifications(deps.clientState, body.value ?? []);

    if (rejected.length > 0) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "graph_notification_rejected",
        basis: "ADR-0005",
        detail: { count: rejected.length, subscriptionIds: rejected.map((r) => safeSubscriptionId(r.subscriptionId)) },
        at: new Date().toISOString(),
      });
    }

    // (3) 受理分をエンキュー（本文はfetch-on-notifyで後段が取得するため、通知メタデータのみ保存）
    for (const { notification, ids } of accepted) {
      const lifecycleEvent = toLifecycleEvent(notification);
      if (lifecycleEvent) {
        runLifecycleAfterAck(deps, lifecycleEvent, traceId);
        continue;
      }

      const messageId = ids?.messageId.trim() ?? "";
      if (!messageId) {
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "SERVER",
          action: "graph_notification_missing_dedupe_key",
          basis: "PrjOps:SPEC-INT-001",
          detail: {
            subscriptionId: safeSubscriptionId(notification.subscriptionId),
            changeType: notification.changeType ?? null,
          },
          at: new Date().toISOString(),
        });
        continue;
      }

      const inserted = await deps.enqueueInboundEvent(
        {
          kind: "graph_channel_message_notification",
          changeType: notification.changeType ?? null,
          resource: notification.resource ?? null,
          subscriptionId: notification.subscriptionId ?? null,
          ids,
        },
        traceId,
        { dedupeKey: graphNotificationDedupeKey(notification) },
      );
      if (!inserted) {
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "SERVER",
          action: "graph_notification_duplicate",
          basis: "PrjOps:SPEC-INT-001",
          detail: { messageId, subscriptionId: safeSubscriptionId(notification.subscriptionId) },
          at: new Date().toISOString(),
        });
      }
    }

    // 不一致のみでも202（攻撃者に検証結果を漏らさない）
    return c.body(null, 202);
  });
}
