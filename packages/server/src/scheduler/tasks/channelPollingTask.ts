/**
 * packages/server/src/scheduler/tasks/channelPollingTask.ts
 *
 * 根拠: ADR-0005（5分間隔のdelta取得。renewSubscription失敗時のpollingフォールバック実行部）/
 *   SPEC-INT-001（フォールバックポーリング）/ REQ-030（DB保存前のsanitizeSecrets必須）。
 *   graphClient.getChannelMessagesDelta()は既存実装（変更不可）。
 *
 * 設計: mode='polling'の購読を対象に、チャネル取込可否をchannelAuthorization（純粋関数）で判定した上で
 *   sanitizeSecrets()後にchannelMessagesRepo.upsert()する。deltaLinkは都度永続化する（プロセス再起動耐性）。
 */
import { graphSubscriptionErrorDetail, sanitizeSecrets, type AuditLogWriter } from "@aiops/shared";
import type { ScheduledTask } from "../scheduler.js";
import type { GraphSubscription, GraphSubscriptionsRepo } from "../../db/graphSubscriptionsRepo.js";
import type { ProjectChannelsRepo } from "../../db/projectChannelsRepo.js";
import { ChannelMessagesRepo, type ChannelMessageRecord } from "../../db/channelMessagesRepo.js";
import { decideChannelIngestion } from "../../lib/channelAuthorization.js";
import {
  buildGraphChatMessageResource,
  computeGraphSubscriptionExpiration,
} from "../../lib/graphSubscriptionPolicy.js";

export interface ChannelPollingGraphMessage {
  id: string;
  replyToId: string | null;
  authorAadId: string | null;
  authorDisplayName: string | null;
  contentType: "html" | "text";
  content: string;
  createdDateTime: string;
  lastModifiedDateTime: string | null;
  deletedDateTime: string | null;
}

export interface ChannelPollingGraphClient {
  getChannelMessagesDelta(
    ref: { teamId: string; channelId: string },
    opts?: { deltaLink?: string; top?: number },
  ): Promise<{ messages: ChannelPollingGraphMessage[]; deltaLink: string }>;
  renewSubscription?(subscriptionId: string, newExpirationIso: string, teamId: string | null): Promise<void>;
  createSubscription?(
    resource: string,
    notificationUrl: string,
    expirationDateTimeIso: string,
    opts: {
      clientState: string;
      changeType: "created,updated,deleted";
      lifecycleNotificationUrl: string;
    },
  ): Promise<{ id: string; expirationDateTime: string }>;
  deleteSubscription?(subscriptionId: string, teamId: string | null): Promise<void>;
}

export interface ChannelPollingTaskDeps {
  graphSubscriptionsRepo: GraphSubscriptionsRepo;
  projectChannelsRepo: ProjectChannelsRepo;
  channelMessagesRepo: ChannelMessagesRepo;
  graphClient: ChannelPollingGraphClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  recovery?: { notificationUrl: string; clientState: string };
}

function toChannelMessageRecord(
  teamId: string,
  channelId: string,
  msg: ChannelPollingGraphMessage,
  sanitizedContent: string,
): ChannelMessageRecord {
  return {
    teamId,
    channelId,
    messageId: msg.id,
    replyToId: msg.replyToId,
    authorAadId: msg.authorAadId,
    authorName: msg.authorDisplayName,
    contentType: msg.contentType,
    content: sanitizedContent,
    createdAt: msg.createdDateTime,
    lastModifiedAt: msg.lastModifiedDateTime,
    deletedAt: msg.deletedDateTime,
  };
}

export function createChannelPollingTask(deps: ChannelPollingTaskDeps): ScheduledTask {
  return {
    name: "channel-polling-5m",
    intervalMs: 5 * 60_000,
    runOnStart: true,
    async run(now: Date): Promise<void> {
      const pollingSubs = await deps.graphSubscriptionsRepo.listByMode("polling");
      for (const sub of pollingSubs) {
        try {
          await recoverGraphSubscription(sub, deps, now);
        } catch (error) {
          try {
            await auditRecovery(sub, deps, now, "graph_subscription_recovery_row_failed", "row", error);
          } catch {
            // The next subscription must still run when both recovery and audit storage fail.
          }
        }
      }
    },
  };
}

async function recoverGraphSubscription(
  sub: GraphSubscription,
  deps: ChannelPollingTaskDeps,
  now: Date,
): Promise<void> {
  if (!deps.recovery) {
    await backfillGraphSubscription(sub, deps, now);
    return;
  }
  let resource: string;
  try {
    if (
      sub.teamId === null ||
      sub.channelId === null ||
      sub.teamId !== sub.teamId.trim() ||
      sub.channelId !== sub.channelId.trim()
    ) {
      throw new Error("ledger IDs must be exact canonical values");
    }
    resource = buildGraphChatMessageResource(sub.teamId ?? "", sub.channelId ?? "");
  } catch {
    await auditRecovery(sub, deps, now, "graph_subscription_recovery_invalid_ref", "validate", null);
    return;
  }
  if (
    !deps.graphClient.renewSubscription ||
    !deps.graphClient.createSubscription ||
    !deps.graphClient.deleteSubscription
  ) {
    throw new Error("subscription recovery client is incomplete");
  }

  const acquired = await deps.graphSubscriptionsRepo.withRecoveryLock(sub.subscriptionId, async () => {
    const current = await deps.graphSubscriptionsRepo.findBySubscriptionId(sub.subscriptionId);
    if (!current || current.subscriptionId !== sub.subscriptionId || current.mode !== "polling") {
      await auditRecovery(sub, deps, now, "graph_subscription_recovery_stale", "ledger_recheck", null);
      return;
    }
    if (
      current.teamId === null ||
      current.channelId === null ||
      current.teamId !== current.teamId.trim() ||
      current.channelId !== current.channelId.trim()
    ) {
      await auditRecovery(current, deps, now, "graph_subscription_recovery_invalid_ref", "ledger_recheck", null);
      return;
    }
    resource = buildGraphChatMessageResource(current.teamId, current.channelId);
    if (!(await isChannelIngestionAllowed(current.teamId, current.channelId, deps, now))) return;
    await recoverGraphSubscriptionLocked(current, resource, deps, now);
  });
  if (!acquired) await auditRecovery(sub, deps, now, "graph_subscription_recovery_locked", "lock", null);
}

async function recoverGraphSubscriptionLocked(
  sub: GraphSubscription,
  resource: string,
  deps: ChannelPollingTaskDeps,
  now: Date,
): Promise<void> {
  const newExpiration = computeGraphSubscriptionExpiration(now);
  const expirationMs = Date.parse(sub.expiresAt);

  if (Number.isFinite(expirationMs) && expirationMs > now.getTime()) {
    try {
      await deps.graphClient.renewSubscription!(sub.subscriptionId, newExpiration, sub.teamId);
      if (!(await backfillGraphSubscription(sub, deps, now))) {
        await auditRecovery(sub, deps, now, "graph_subscription_recovery_pending", "backfill_rejected", null);
        return;
      }
      await deps.graphSubscriptionsRepo.updateExpiresAt(sub.subscriptionId, newExpiration);
      await deps.graphSubscriptionsRepo.switchMode(sub.subscriptionId, "notification");
      return;
    } catch (error) {
      if (graphSubscriptionErrorDetail(error).status !== 404) {
        await backfillGraphSubscription(sub, deps, now);
        await auditRecovery(sub, deps, now, "graph_subscription_recovery_pending", "renew", error);
        return;
      }
    }
  }

  const { teamId, channelId } = sub;
  if (!teamId || !channelId || !(await isChannelIngestionAllowed(teamId, channelId, deps, now))) return;

  let created: { id: string; expirationDateTime: string } | null = null;
  let published = false;
  let stage = "create";
  try {
    created = await deps.graphClient.createSubscription!(resource, deps.recovery!.notificationUrl, newExpiration, {
      clientState: deps.recovery!.clientState,
      changeType: "created,updated,deleted",
      lifecycleNotificationUrl: deps.recovery!.notificationUrl,
    });
    stage = "backfill";
    if (!(await backfillGraphSubscription(sub, deps, now))) {
      stage = "backfill_rejected";
      await auditRecovery(sub, deps, now, "graph_subscription_recovery_pending", stage, null);
      return;
    }
    stage = "publish";
    published = await deps.graphSubscriptionsRepo.replacePollingSubscription(
      sub.subscriptionId,
      created.id,
      created.expirationDateTime,
    );
    if (!published) await auditRecovery(sub, deps, now, "graph_subscription_recovery_pending", "publish_lost", null);
  } catch (error) {
    await auditRecovery(sub, deps, now, "graph_subscription_recovery_pending", stage, error);
  } finally {
    if (created && !published) {
      let cleanupFailed = false;
      let cleanupError: unknown;
      try {
        await deps.graphClient.deleteSubscription!(created.id, sub.teamId);
      } catch (error) {
        cleanupFailed = true;
        cleanupError = error;
      }
      if (cleanupFailed) {
        await auditRecovery(sub, deps, now, "graph_subscription_recovery_cleanup", "cleanup_failed", cleanupError);
      } else {
        try {
          await auditRecovery(sub, deps, now, "graph_subscription_recovery_cleanup", "cleanup_complete", null);
        } catch {
          // DELETE succeeded; audit storage failure must not change the cleanup outcome.
        }
      }
    }
  }
}

async function auditRecovery(
  sub: GraphSubscription,
  deps: ChannelPollingTaskDeps,
  now: Date,
  action: string,
  recovery: string,
  error: unknown,
): Promise<void> {
  const failure = graphSubscriptionErrorDetail(error);
  await deps.auditLog.append({
    trace_id: deps.traceIdProvider(),
    actor: "SERVER",
    action,
    basis: "SPEC-INT-001",
    detail: { subscriptionId: sub.subscriptionId, code: failure.code, status: failure.status, recovery },
    at: now.toISOString(),
  });
}

export async function backfillGraphSubscription(
  sub: GraphSubscription,
  deps: ChannelPollingTaskDeps,
  now: Date,
): Promise<boolean> {
  const { teamId, channelId } = sub;
  if (!teamId || !channelId || !(await isChannelIngestionAllowed(teamId, channelId, deps, now))) return false;

  const { messages, deltaLink } = await deps.graphClient.getChannelMessagesDelta(
    { teamId, channelId },
    { deltaLink: sub.deltaLink ?? undefined },
  );

  for (const msg of messages) {
    const { sanitized } = sanitizeSecrets(msg.content);
    await deps.channelMessagesRepo.upsert(toChannelMessageRecord(teamId, channelId, msg, sanitized));
  }

  await deps.graphSubscriptionsRepo.updateDeltaLink(sub.subscriptionId, deltaLink);
  return true;
}

async function isChannelIngestionAllowed(
  teamId: string,
  channelId: string,
  deps: ChannelPollingTaskDeps,
  now: Date,
): Promise<boolean> {
  const decision = decideChannelIngestion(await deps.projectChannelsRepo.findByChannel(teamId, channelId));
  if (decision.accepted) return true;
  await deps.auditLog.append({
    trace_id: deps.traceIdProvider(),
    actor: "SERVER",
    action: "channel_polling_rejected",
    basis: "ADR-0005",
    detail: { teamId, channelId, reason: decision.reason },
    at: now.toISOString(),
  });
  return false;
}
