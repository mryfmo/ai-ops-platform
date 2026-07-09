/**
 * packages/server/tests/channelPollingTask.test.ts
 *
 * 根拠: ADR-0005（5分間隔delta取得、pollingフォールバック実行部）/ REQ-030（保存前sanitizeSecrets）
 */
import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import {
  createChannelPollingTask,
  type ChannelPollingGraphMessage,
} from "../src/scheduler/tasks/channelPollingTask.js";
import type { GraphSubscription } from "../src/db/graphSubscriptionsRepo.js";
import type { ProjectChannel } from "../src/db/projectChannelsRepo.js";
import type { ChannelMessagesRepo } from "../src/db/channelMessagesRepo.js";

function makeSub(overrides: Partial<GraphSubscription> = {}): GraphSubscription {
  return {
    subscriptionId: "sub-1",
    resource: "teams('t-1')/channels('c-1')/messages",
    teamId: "t-1",
    channelId: "c-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    deltaLink: "old-delta",
    mode: "polling",
    updatedAt: "2026-07-06T23:00:00.000Z",
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ProjectChannel> = {}): ProjectChannel {
  return {
    teamId: "t-1",
    channelId: "c-1",
    projectId: "PJ-001",
    createdBy: "ST-001",
    ingestion: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    githubOwner: null,
    githubRepo: null,
    ...overrides,
  };
}

const SAMPLE_MSG: ChannelPollingGraphMessage = {
  id: "m-1",
  replyToId: null,
  authorAadId: "aad-1",
  authorDisplayName: "Alice",
  contentType: "text",
  content: "hello ghp_abcdefghijklmnopqrst0123 world",
  createdDateTime: "2026-07-07T00:00:00.000Z",
  lastModifiedDateTime: null,
  deletedDateTime: null,
};

describe("channelPollingTask (ADR-0005 / REQ-030)", () => {
  it("取込許可チャネルはdelta取得→sanitize→保存し、deltaLinkを更新する", async () => {
    const upserted: unknown[] = [];
    const channelMessagesRepo = {
      upsert: async (msg: unknown) => {
        upserted.push(msg);
      },
    } as unknown as ChannelMessagesRepo;

    const deltaLinkUpdates: Array<{ id: string; link: string }> = [];
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub()],
        updateDeltaLink: async (id: string, link: string) => {
          deltaLinkUpdates.push({ id, link });
        },
      } as never,
      projectChannelsRepo: {
        findByChannel: async () => makeChannel(),
      } as never,
      channelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [SAMPLE_MSG], deltaLink: "new-delta" }),
      },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-1",
    });

    await task.run(new Date("2026-07-07T00:10:00.000Z"));

    expect(upserted).toHaveLength(1);
    const saved = upserted[0] as { content: string };
    expect(saved.content).not.toContain("ghp_");
    expect(saved.content).toContain("***REDACTED:github_pat***");
    expect(deltaLinkUpdates).toEqual([{ id: "sub-1", link: "new-delta" }]);
  });

  it("未登録チャネルは破棄+監査ログ、delta取得もしない", async () => {
    let deltaFetchCount = 0;
    const auditLog = new InMemoryAuditLog();
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub()],
        updateDeltaLink: async () => {},
      } as never,
      projectChannelsRepo: {
        findByChannel: async () => null,
      } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => {
          deltaFetchCount += 1;
          return { messages: [], deltaLink: "x" };
        },
      },
      auditLog,
      traceIdProvider: () => "trace-2",
    });

    await task.run(new Date());
    expect(deltaFetchCount).toBe(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "channel_polling_rejected")).toBe(true);
  });

  it("mode=notificationの購読は対象外", async () => {
    let deltaFetchCount = 0;
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async (mode: string) => (mode === "polling" ? [] : [makeSub({ mode: "notification" })]),
        updateDeltaLink: async () => {},
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => {
          deltaFetchCount += 1;
          return { messages: [], deltaLink: "x" };
        },
      },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-3",
    });
    await task.run(new Date());
    expect(deltaFetchCount).toBe(0);
  });
});
