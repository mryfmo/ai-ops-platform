/** 根拠: PrjOps:SPEC-INT-030 / ADR-0024 / WIQ-003 / FinalArch:ING-001 */
import { describe, expect, it } from "vitest";

import type { ChannelMessage } from "@aiops/shared";
import { normalizeTeamsStatusPayload } from "@aiops/shared/reporting/statusIngestChannels.js";
import { fetchTeamsStatusEvent, type StatusIngestGraphReader } from "../src/graph/statusIngestAdapter.js";
import type { WorkIqRestClient } from "../src/workiq/restClient.js";

const message: ChannelMessage = {
  id: "teams-001",
  replyToId: "root-001",
  authorAadId: "aad-user-001",
  authorDisplayName: "Reporter",
  contentType: "text",
  content: "PJ-101 weekly",
  createdDateTime: "2026-08-16T06:00:00Z",
  lastModifiedDateTime: null,
  deletedDateTime: null,
  webUrl: null,
};

const structured = {
  progress_pct: 62,
  self_status: "yellow" as const,
  achievements: "設計完了",
  plans: "実装着手",
  issues: "なし",
  risks: "なし",
};

describe("FinalArch:ING-001 Teams status adapter uses the app-only Graph surface", () => {
  it("fetches a message and resolves the stakeholder before pure normalization", async () => {
    const reader: StatusIngestGraphReader = {
      authenticationMode: "app-only",
      getChannelMessage: async () => message,
    };
    await expect(
      fetchTeamsStatusEvent(
        reader,
        { teamId: "team-001", channelId: "channel-001", messageId: "teams-001", structured },
        async (aadId) => ({ reporterId: aadId === "aad-user-001" ? "ST-010" : null, projectIdHint: "PJ-303" }),
        normalizeTeamsStatusPayload,
      ),
    ).resolves.toMatchObject({
      channel: "teams",
      sourceMessageId: "teams-001",
      threadId: "root-001",
      projectId: "PJ-101",
    });
  });

  it("fails closed for application/system messages and deleted messages", async () => {
    for (const candidate of [
      { ...message, authorAadId: null },
      { ...message, deletedDateTime: "2026-08-16T06:01:00Z" },
    ]) {
      await expect(
        fetchTeamsStatusEvent(
          { authenticationMode: "app-only", getChannelMessage: async () => candidate },
          { teamId: "team-001", channelId: "channel-001", messageId: "teams-001", structured },
          async () => ({ reporterId: "ST-010", projectIdHint: null }),
          normalizeTeamsStatusPayload,
        ),
      ).rejects.toThrow(/E-ING01/u);
    }
  });
});

function assertCompileTimeSeparation(delegatedClient: WorkIqRestClient): void {
  // @ts-expect-error ADR-0024: delegated Work IQ surface cannot be used for Graph channel ingestion.
  const rejected: StatusIngestGraphReader = delegatedClient;
  void rejected;
}

void assertCompileTimeSeparation;
