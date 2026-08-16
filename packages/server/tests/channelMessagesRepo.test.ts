/** 根拠: ADR-0005 / DevOps:REQ-030 / FinalArch:FR-UI-001 / UX-001 */
import { describe, expect, it } from "vitest";

import type { PgQueryable } from "@aiops/shared";
import { ChannelMessagesRepo } from "../src/db/channelMessagesRepo.js";

describe("ChannelMessagesRepo source dedupe [FinalArch:FR-UI-001 / UX-001]", () => {
  it("writes the channel source with the platform message ID", async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const db: PgQueryable = {
      query: async (text, params) => {
        calls.push({ text, params });
        return { rows: [], rowCount: 1 };
      },
    };
    const repo = new ChannelMessagesRepo(db);

    await repo.upsert({
      source: "teams",
      teamId: "team-1",
      channelId: "channel-1",
      messageId: "message-1",
      replyToId: null,
      authorAadId: "user-1",
      authorName: "Operator",
      contentType: "text",
      content: "status",
      createdAt: "2026-08-16T00:00:00.000Z",
      lastModifiedAt: null,
      deletedAt: null,
    });

    expect(calls[0]!.text).toContain("ON CONFLICT DO NOTHING");
    expect(calls[0]!.params).toContain("teams");
  });

  it("updates only an exact source/team/channel replay after a dedupe conflict", async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const outcomes = [0, 1];
    const db: PgQueryable = {
      query: async (text, params) => {
        calls.push({ text, params });
        return { rows: [], rowCount: outcomes.shift() };
      },
    };
    const repo = new ChannelMessagesRepo(db);

    await expect(
      repo.upsert({
        teamId: "team-1",
        channelId: "channel-1",
        messageId: "message-1",
        replyToId: null,
        authorAadId: null,
        authorName: null,
        contentType: "text",
        content: "updated",
        createdAt: "2026-08-16T00:00:00.000Z",
        lastModifiedAt: "2026-08-16T00:01:00.000Z",
        deletedAt: null,
      }),
    ).resolves.toBeUndefined();
    expect(calls[1]!.text).toContain("WHERE source = $1 AND team_id = $2 AND channel_id = $3 AND message_id = $4");
  });

  it("rejects a source-message collision outside the original channel", async () => {
    const outcomes = [0, 0];
    const db: PgQueryable = {
      query: async () => ({ rows: [], rowCount: outcomes.shift() }),
    };
    const repo = new ChannelMessagesRepo(db);
    await expect(
      repo.upsert({
        source: "teams",
        teamId: "wrong-team",
        channelId: "wrong-channel",
        messageId: "message-1",
        replyToId: null,
        authorAadId: null,
        authorName: null,
        contentType: "text",
        content: "collision",
        createdAt: "2026-08-16T00:00:00.000Z",
        lastModifiedAt: null,
        deletedAt: null,
      }),
    ).rejects.toThrow("source message identity conflict");
  });
});
