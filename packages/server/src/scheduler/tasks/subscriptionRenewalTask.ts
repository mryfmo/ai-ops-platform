/**
 * packages/server/src/scheduler/tasks/subscriptionRenewalTask.ts
 *
 * 根拠: ADR-0005（30分間隔のGraphサブスクリプション更新）/ SPEC-INT-001（renewSubscription失敗時は
 *   5分間隔ポーリング(mode='polling')へフォールバックする。フォールバック未実装だったループの実装）。
 *   graphClient.renewSubscription()はE-SUB02を投げる契約（既存実装。変更不可）。
 *
 * 設計: healthcheckTask/jitRevocationTaskと同じファクトリ関数パターン
 *   （createSubscriptionRenewalTask(deps): ScheduledTask）。
 */
import type { AuditLogWriter } from "@aiops/shared";
import type { ScheduledTask } from "../scheduler.js";
import type { GraphSubscriptionsRepo, GraphSubscription } from "../../db/graphSubscriptionsRepo.js";

export interface SubscriptionRenewalGraphClient {
  renewSubscription(subscriptionId: string, newExpirationIso: string): Promise<void>;
}

export interface SubscriptionRenewalTaskDeps {
  graphSubscriptionsRepo: GraphSubscriptionsRepo;
  graphClient: SubscriptionRenewalGraphClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  /** 更新後の新しい有効期限を計算する（既定: 現在時刻+60分。資源種別上限はADR-0005参照） */
  computeNewExpirationIso?(now: Date): string;
  /** 期限切れ間近と判定する残り時間の閾値ms（既定10分） */
  renewBeforeExpiryMs?: number;
}

const DEFAULT_RENEW_BEFORE_EXPIRY_MS = 10 * 60_000;

function defaultComputeNewExpirationIso(now: Date): string {
  return new Date(now.getTime() + 60 * 60_000).toISOString();
}

function isDueForRenewal(sub: GraphSubscription, now: Date, thresholdMs: number): boolean {
  const expiresAtMs = new Date(sub.expiresAt).getTime();
  return expiresAtMs - now.getTime() < thresholdMs;
}

export function createSubscriptionRenewalTask(deps: SubscriptionRenewalTaskDeps): ScheduledTask {
  const thresholdMs = deps.renewBeforeExpiryMs ?? DEFAULT_RENEW_BEFORE_EXPIRY_MS;
  const computeNewExpirationIso = deps.computeNewExpirationIso ?? defaultComputeNewExpirationIso;

  return {
    name: "subscription-renewal-30m",
    intervalMs: 30 * 60_000,
    async run(now: Date): Promise<void> {
      const notifying = await deps.graphSubscriptionsRepo.listByMode("notification");
      const due = notifying.filter((s) => isDueForRenewal(s, now, thresholdMs));
      if (due.length === 0) return;

      for (const sub of due) {
        const newExpirationIso = computeNewExpirationIso(now);
        try {
          await deps.graphClient.renewSubscription(sub.subscriptionId, newExpirationIso);
          await deps.graphSubscriptionsRepo.updateExpiresAt(sub.subscriptionId, newExpirationIso);
        } catch (err) {
          // E-SUB02: renew失敗 → pollingへフォールバック（SPEC-INT-001）+ 監査ログ
          await deps.graphSubscriptionsRepo.switchMode(sub.subscriptionId, "polling");
          await deps.auditLog.append({
            trace_id: deps.traceIdProvider(),
            actor: "SERVER",
            action: "graph_subscription_renewal_failed",
            basis: "SPEC-INT-001",
            detail: {
              subscriptionId: sub.subscriptionId,
              error: err instanceof Error ? err.message : String(err),
            },
            at: now.toISOString(),
          });
        }
      }
    },
  };
}
