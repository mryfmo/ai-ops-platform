// 根拠: PrjOps:SPEC-INT-030 / ADR-0024 / WIQ-003 / FinalArch:ING-001
// Graph I/O は app-only system client に限定し、取得後は shared pure normalizerへ渡す薄い adapter。
import type { ChannelRef } from "@aiops/shared";

import type { GraphSystemClient } from "./systemClient.js";

export type StatusIngestGraphReader = Pick<GraphSystemClient, "authenticationMode" | "getChannelMessage">;

export interface TeamsStatusFetchInput {
  readonly teamId: string;
  readonly channelId: string;
  readonly messageId: string;
  readonly replyOfMessageId?: string;
  readonly structured: unknown;
}

export type StatusIngestReporterResolver = (
  aadObjectId: string,
) => Promise<{ readonly reporterId: string | null; readonly projectIdHint: string | null }>;

function bounded(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200 || /[\p{C}\p{Z}]/u.test(value)) {
    throw new RangeError(`${label} must be a bounded Graph identifier`);
  }
  return value;
}

/** Fetch-on-notify adapter。delegated client は型上代入できず、runtime marker も確認する。 */
export async function fetchTeamsStatusEvent<TResult>(
  reader: StatusIngestGraphReader,
  input: TeamsStatusFetchInput,
  resolveReporter: StatusIngestReporterResolver,
  normalize: (value: unknown) => TResult,
): Promise<TResult> {
  if (reader.authenticationMode !== "app-only")
    throw new Error("E-ING01: Graph status ingestion requires app-only auth");
  const ref: ChannelRef = {
    teamId: bounded(input.teamId, "teamId"),
    channelId: bounded(input.channelId, "channelId"),
  };
  const messageId = bounded(input.messageId, "messageId");
  const replyOfMessageId = input.replyOfMessageId && bounded(input.replyOfMessageId, "replyOfMessageId");
  const message = await reader.getChannelMessage(ref, messageId, replyOfMessageId);
  if (message.id !== messageId) throw new Error("E-ING01: Graph returned a different message identity");
  if (message.deletedDateTime !== null || message.authorAadId === null) {
    throw new Error("E-ING01: deleted or non-user Teams messages cannot identify a reporter");
  }
  const reporter = await resolveReporter(message.authorAadId);
  if (reporter.reporterId === null) throw new Error("E-ING01: Teams reporter is not in the stakeholder authority");
  return normalize({
    messageId: message.id,
    rootMessageId: message.replyToId ?? message.id,
    receivedAt: message.createdDateTime,
    reporterId: reporter.reporterId,
    projectIdHintFromSender: reporter.projectIdHint ?? undefined,
    body: message.content,
    structured: input.structured,
  });
}
