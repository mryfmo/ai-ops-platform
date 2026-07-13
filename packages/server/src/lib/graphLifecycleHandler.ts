/**
 * packages/server/src/lib/graphLifecycleHandler.ts
 *
 * 根拠: SPEC-INT-001 / Microsoft Graph lifecycle notifications。
 * lifecycle通知は通常のmessage通知と違い、キュー投入ではなく購読台帳のrenew/fallback/backfillを即時起動する。
 */
import { graphSubscriptionErrorDetail, type AuditLogWriter } from "@aiops/shared";
import type { GraphSubscription, GraphSubscriptionsRepo } from "../db/graphSubscriptionsRepo.js";
import type { GraphLifecycleEvent } from "../http/routes/graphNotifications.js";
import { computeGraphSubscriptionExpiration } from "./graphSubscriptionPolicy.js";

export interface GraphLifecycleHandlerDeps {
  graphSubscriptionsRepo: Pick<GraphSubscriptionsRepo, "findBySubscriptionId" | "updateExpiresAt" | "switchMode">;
  graphClient: {
    renewSubscription(subscriptionId: string, newExpirationIso: string, teamId: string | null): Promise<void>;
  };
  backfillSubscription(sub: GraphSubscription, now: Date): Promise<void>;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  nowProvider?(): Date;
}

export async function handleGraphLifecycleEvent(
  event: GraphLifecycleEvent,
  traceId: string,
  deps: GraphLifecycleHandlerDeps,
): Promise<void> {
  const now = deps.nowProvider?.() ?? new Date();
  if (!event.subscriptionId) {
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "graph_lifecycle_unhandled",
      basis: "SPEC-INT-001",
      detail: { lifecycleEvent: event.lifecycleEvent, reason: "subscriptionId is missing" },
      at: now.toISOString(),
    });
    return;
  }

  const sub = await deps.graphSubscriptionsRepo.findBySubscriptionId(event.subscriptionId);
  if (!sub) {
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "graph_lifecycle_unhandled",
      basis: "SPEC-INT-001",
      detail: {
        lifecycleEvent: event.lifecycleEvent,
        subscriptionId: event.subscriptionId,
        reason: "unknown subscription",
      },
      at: now.toISOString(),
    });
    return;
  }

  if (event.lifecycleEvent === "reauthorizationRequired") {
    const newExpirationIso = computeGraphSubscriptionExpiration(now);
    try {
      await deps.graphClient.renewSubscription(sub.subscriptionId, newExpirationIso, sub.teamId);
      await deps.graphSubscriptionsRepo.updateExpiresAt(sub.subscriptionId, newExpirationIso);
    } catch (error) {
      await deps.graphSubscriptionsRepo.switchMode(sub.subscriptionId, "polling");
      await deps.backfillSubscription(sub, now);
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "graph_lifecycle_reauthorization_failed",
        basis: "SPEC-INT-001",
        detail: {
          subscriptionId: sub.subscriptionId,
          ...graphSubscriptionErrorDetail(error),
          recovery: "polling_backfill",
        },
        at: now.toISOString(),
      });
      return;
    }
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "graph_lifecycle_reauthorized",
      basis: "SPEC-INT-001",
      detail: { subscriptionId: sub.subscriptionId },
      at: now.toISOString(),
    });
    return;
  }

  if (event.lifecycleEvent === "subscriptionRemoved") {
    await deps.graphSubscriptionsRepo.switchMode(sub.subscriptionId, "polling");
    await deps.backfillSubscription(sub, now);
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "SERVER",
      action: "graph_subscription_removed",
      basis: "SPEC-INT-001",
      detail: {
        subscriptionId: sub.subscriptionId,
        recovery: "polling_backfill_and_automatic_replacement",
      },
      at: now.toISOString(),
    });
    return;
  }

  await deps.backfillSubscription(sub, now);
  await deps.auditLog.append({
    trace_id: traceId,
    actor: "SERVER",
    action: "graph_lifecycle_missed_backfilled",
    basis: "SPEC-INT-001",
    detail: { subscriptionId: sub.subscriptionId },
    at: now.toISOString(),
  });
}
