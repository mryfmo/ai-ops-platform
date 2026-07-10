/**
 * packages/server/src/http/routes/graphNotifications.ts
 *
 * 根拠:
 *   - ADR-0005 / SPEC-INT-001: Graph change notification受信。
 *     (1) サブスクリプション作成時のvalidationTokenハンドシェイクは10秒以内にtext/plainで応答必須。
 *     (2) 通知本文は各要素のclientStateを検証し、不一致は破棄+監査ログ（攻撃兆候）。
 *     (3) 受理した通知はeventsテーブルへ source='inbound' でエンキューして即202
 *         （Graphは応答遅延でサブスクリプションを削除するため、重い処理は非同期化する）。
 */
import type { Hono } from "hono";
import type { AuditLogWriter } from "@aiops/shared";
import { classifyNotifications, type GraphNotification } from "../../lib/graphNotificationValidator.js";

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

export function registerGraphNotificationRoutes(app: Hono, deps: GraphNotificationDeps): void {
  app.post("/webhooks/graph", async (c) => {
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
        detail: { count: rejected.length, subscriptionIds: rejected.map((r) => r.subscriptionId ?? null) },
        at: new Date().toISOString(),
      });
    }

    // (3) 受理分をエンキュー（本文はfetch-on-notifyで後段が取得するため、通知メタデータのみ保存）
    for (const { notification, ids } of accepted) {
      const lifecycleEvent = toLifecycleEvent(notification);
      if (lifecycleEvent) {
        if (deps.handleLifecycleEvent) {
          await deps.handleLifecycleEvent(lifecycleEvent, traceId);
        } else {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "SERVER",
            action: "graph_lifecycle_disabled",
            basis: "SPEC-INT-001",
            detail: { lifecycleEvent: lifecycleEvent.lifecycleEvent, subscriptionId: lifecycleEvent.subscriptionId },
            at: new Date().toISOString(),
          });
        }
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
        { dedupeKey: notification.id ? `graph:${notification.id}` : null },
      );
      if (!inserted) {
        await deps.auditLog.append({
          trace_id: traceId,
          actor: "SERVER",
          action: "graph_notification_duplicate",
          basis: "SPEC-INT-001",
          detail: { notificationId: notification.id ?? null, subscriptionId: notification.subscriptionId ?? null },
          at: new Date().toISOString(),
        });
      }
    }

    // 不一致のみでも202（攻撃者に検証結果を漏らさない）
    return c.body(null, 202);
  });
}
