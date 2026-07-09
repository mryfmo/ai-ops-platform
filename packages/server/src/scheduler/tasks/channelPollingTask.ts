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
import { sanitizeSecrets, type AuditLogWriter } from "@aiops/shared";
import type { ScheduledTask } from "../scheduler.js";
import type { GraphSubscriptionsRepo } from "../../db/graphSubscriptionsRepo.js";
import type { ProjectChannelsRepo } from "../../db/projectChannelsRepo.js";
import { ChannelMessagesRepo, type ChannelMessageRecord } from "../../db/channelMessagesRepo.js";
import { decideChannelIngestion } from "../../lib/channelAuthorization.js";

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
}

export interface ChannelPollingTaskDeps {
  graphSubscriptionsRepo: GraphSubscriptionsRepo;
  projectChannelsRepo: ProjectChannelsRepo;
  channelMessagesRepo: ChannelMessagesRepo;
  graphClient: ChannelPollingGraphClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
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
    async run(now: Date): Promise<void> {
      const pollingSubs = await deps.graphSubscriptionsRepo.listByMode("polling");
      for (const sub of pollingSubs) {
        if (!sub.teamId || !sub.channelId) continue;

        const channel = await deps.projectChannelsRepo.findByChannel(sub.teamId, sub.channelId);
        const decision = decideChannelIngestion(channel);
        if (!decision.accepted) {
          await deps.auditLog.append({
            trace_id: deps.traceIdProvider(),
            actor: "SERVER",
            action: "channel_polling_rejected",
            basis: "ADR-0005",
            detail: { teamId: sub.teamId, channelId: sub.channelId, reason: decision.reason },
            at: now.toISOString(),
          });
          continue;
        }

        const { messages, deltaLink } = await deps.graphClient.getChannelMessagesDelta(
          { teamId: sub.teamId, channelId: sub.channelId },
          { deltaLink: sub.deltaLink ?? undefined },
        );

        for (const msg of messages) {
          const { sanitized } = sanitizeSecrets(msg.content);
          await deps.channelMessagesRepo.upsert(toChannelMessageRecord(sub.teamId, sub.channelId, msg, sanitized));
        }

        await deps.graphSubscriptionsRepo.updateDeltaLink(sub.subscriptionId, deltaLink);
      }
    },
  };
}
