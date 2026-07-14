/**
 * packages/server/src/scheduler/tasks/subscriptionRenewalTask.ts
 *
 * 根拠: ADR-0005（30分間隔のGraphサブスクリプション更新）/ PrjOps:SPEC-INT-001（renewSubscription失敗時は
 *   5分間隔ポーリング(mode='polling')へフォールバックする。フォールバック未実装だったループの実装）。
 *   graphClient.renewSubscription()はE-SUB02を投げる契約（既存実装。変更不可）。
 *
 * 設計: healthcheckTask/jitRevocationTaskと同じファクトリ関数パターン
 *   （createSubscriptionRenewalTask(deps): ScheduledTask）。
 */
import { graphSubscriptionErrorDetail, type AuditLogWriter } from "@aiops/shared";
import type { ScheduledTask } from "../scheduler.js";
import type { GraphSubscriptionsRepo, GraphSubscription } from "../../db/graphSubscriptionsRepo.js";
import {
  computeGraphSubscriptionExpiration,
  isGraphSubscriptionRenewalDue,
} from "../../lib/graphSubscriptionPolicy.js";

export interface SubscriptionRenewalGraphClient {
  renewSubscription(subscriptionId: string, newExpirationIso: string, teamId: string | null): Promise<void>;
}

export interface SubscriptionRenewalTaskDeps {
  graphSubscriptionsRepo: GraphSubscriptionsRepo;
  graphClient: SubscriptionRenewalGraphClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  backfillSubscription(sub: GraphSubscription, now: Date): Promise<void>;
}

export function createSubscriptionRenewalTask(deps: SubscriptionRenewalTaskDeps): ScheduledTask {
  return {
    name: "subscription-renewal-30m",
    intervalMs: 30 * 60_000,
    runOnStart: true,
    async run(now: Date): Promise<void> {
      const notifying = await deps.graphSubscriptionsRepo.listByMode("notification");
      const due = notifying.filter((s) => isGraphSubscriptionRenewalDue(s.expiresAt, now));
      if (due.length === 0) return;

      for (const sub of due) {
        try {
          const newExpirationIso = computeGraphSubscriptionExpiration(now);
          try {
            await deps.graphClient.renewSubscription(sub.subscriptionId, newExpirationIso, sub.teamId);
            await deps.graphSubscriptionsRepo.updateExpiresAt(sub.subscriptionId, newExpirationIso);
          } catch (err) {
            await deps.graphSubscriptionsRepo.switchMode(sub.subscriptionId, "polling");
            await deps.backfillSubscription(sub, now);
            await deps.auditLog.append({
              trace_id: deps.traceIdProvider(),
              actor: "SERVER",
              action: "graph_subscription_renewal_failed",
              basis: "PrjOps:SPEC-INT-001",
              detail: {
                subscriptionId: sub.subscriptionId,
                ...graphSubscriptionErrorDetail(err),
                recovery: "polling_backfill",
              },
              at: now.toISOString(),
            });
          }
        } catch (error) {
          try {
            await deps.auditLog.append({
              trace_id: deps.traceIdProvider(),
              actor: "SERVER",
              action: "graph_subscription_renewal_row_failed",
              basis: "PrjOps:SPEC-INT-001",
              detail: {
                subscriptionId: sub.subscriptionId,
                ...graphSubscriptionErrorDetail(error),
                recovery: "polling_recovery_pending",
              },
              at: now.toISOString(),
            });
          } catch {
            // Continue with later subscriptions even when audit storage also fails.
          }
        }
      }
    },
  };
}
