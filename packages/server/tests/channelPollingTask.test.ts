/**
 * packages/server/tests/channelPollingTask.test.ts
 *
 * 根拠: ADR-0005（5分間隔delta取得、pollingフォールバック実行部）/ DevOps:REQ-030（保存前sanitizeSecrets）
 */
import { describe, it, expect } from "vitest";
import { GraphSubscriptionError, InMemoryAuditLog } from "@aiops/shared";
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

const NOW = new Date("2026-07-07T00:00:00Z");

describe("channelPollingTask (ADR-0005 / DevOps:REQ-030)", () => {
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
    expect(task.runOnStart).toBe(true);
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

  it.each([
    ["unregistered", null],
    ["paused", makeChannel({ ingestion: "paused" })],
    ["closed", makeChannel({ ingestion: "closed" })],
  ])("%s channelはsubscription mutation前に拒否する", async (_case, channel) => {
    const graphCalls: string[] = [];
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub()],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub(),
      } as never,
      projectChannelsRepo: { findByChannel: async () => channel } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => {
          graphCalls.push("delta");
          return { messages: [], deltaLink: "delta" };
        },
        renewSubscription: async () => void graphCalls.push("renew"),
        createSubscription: async () => {
          graphCalls.push("create");
          return { id: "new", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
        deleteSubscription: async () => void graphCalls.push("delete"),
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-rejected-recovery",
    });

    await task.run(NOW);

    expect(graphCalls).toEqual([]);
  });

  it("subscription mutation後も取込直前にチャネル認可を再確認する", async () => {
    const graphCalls: string[] = [];
    let channelReads = 0;
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub()],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub(),
        updateExpiresAt: async () => {
          throw new Error("must not publish rejected recovery");
        },
        switchMode: async () => {
          throw new Error("must not publish rejected recovery");
        },
      } as never,
      projectChannelsRepo: {
        findByChannel: async () => (++channelReads === 1 ? makeChannel() : makeChannel({ ingestion: "paused" })),
      } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => {
          graphCalls.push("delta");
          return { messages: [], deltaLink: "delta" };
        },
        renewSubscription: async () => void graphCalls.push("renew"),
        createSubscription: async () => {
          throw new Error("must not create");
        },
        deleteSubscription: async () => {},
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-recheck",
    });

    await task.run(NOW);

    expect(channelReads).toBe(2);
    expect(graphCalls).toEqual(["renew"]);
  });

  it("renew 404後にpausedならcreate前の再確認で停止する", async () => {
    const graphCalls: string[] = [];
    let channelReads = 0;
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub()],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub(),
        updateDeltaLink: async () => void graphCalls.push("publish-delta"),
        updateExpiresAt: async () => void graphCalls.push("publish-expiry"),
        switchMode: async () => void graphCalls.push("publish-mode"),
        replacePollingSubscription: async () => (graphCalls.push("publish-replacement"), true),
      } as never,
      projectChannelsRepo: {
        findByChannel: async () => (++channelReads === 1 ? makeChannel() : makeChannel({ ingestion: "paused" })),
      } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => {
          graphCalls.push("delta");
          return { messages: [], deltaLink: "delta" };
        },
        renewSubscription: async () => {
          graphCalls.push("renew");
          throw new GraphSubscriptionError("E-SUB02", 404);
        },
        createSubscription: async () => {
          graphCalls.push("create");
          return { id: "new", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
        deleteSubscription: async () => void graphCalls.push("delete"),
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-renew-404-recheck",
    });

    await task.run(NOW);

    expect(channelReads).toBe(2);
    expect(graphCalls).toEqual(["renew"]);
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

  it.each([
    ["expired", "2026-07-06T23:59:00Z", null],
    ["renew-404", "2026-07-07T01:00:00Z", 404],
  ])("%s polling rowはcreate→backfill→DB publishする", async (_case, expiresAt, renewStatus) => {
    const events: string[] = [];
    const replacements: unknown[][] = [];
    const resources: string[] = [];
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub({ expiresAt, resource: "stale-resource" })],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub({ expiresAt, resource: "stale-resource" }),
        updateDeltaLink: async () => void events.push("backfill"),
        updateExpiresAt: async () => {},
        switchMode: async () => {},
        replacePollingSubscription: async (...args: unknown[]) => {
          events.push("publish");
          replacements.push(args);
          return true;
        },
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "new-delta" }),
        renewSubscription: async (_id, _expiresAt, teamId) => {
          events.push(`renew:${teamId}`);
          if (renewStatus) throw new GraphSubscriptionError("E-SUB02", renewStatus);
        },
        createSubscription: async (resource) => {
          events.push("create");
          resources.push(resource);
          return { id: "new-sub", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
        deleteSubscription: async () => void events.push("cleanup"),
      },
      recovery: {
        notificationUrl: "https://example.test/webhooks/graph",
        clientState: "not-a-real-secret-but-at-least-32-chars",
      },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-recover",
    });
    await task.run(NOW);
    expect(events).toEqual(
      renewStatus ? ["renew:t-1", "create", "backfill", "publish"] : ["create", "backfill", "publish"],
    );
    expect(resources).toEqual(["/teams/t-1/channels/c-1/messages"]);
    expect(replacements).toEqual([["sub-1", "new-sub", "2026-07-09T23:55:00Z"]]);
  });

  it.each([429, 503])("retry exhausted %sはbackfillしpolling/recoverableのまま保持する", async (status) => {
    const switched: string[] = [];
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub({ expiresAt: "2026-07-07T01:00:00Z" })],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub({ expiresAt: "2026-07-07T01:00:00Z" }),
        updateDeltaLink: async () => {},
        updateExpiresAt: async () => {},
        switchMode: async () => void switched.push("notification"),
        replacePollingSubscription: async () => true,
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "new-delta" }),
        renewSubscription: async () => {
          throw new GraphSubscriptionError("E-SUB02", status);
        },
        createSubscription: async () => {
          throw new Error("must not create after 503");
        },
        deleteSubscription: async () => {},
      },
      recovery: {
        notificationUrl: "https://example.test/webhooks/graph",
        clientState: "not-a-real-secret-but-at-least-32-chars",
      },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => `trace-${status}`,
    });
    await task.run(NOW);
    expect(switched).toEqual([]);
  });

  it.each(["backfill", "publish"] as const)("%s failureはnew subscriptionをcleanupしpollingに残す", async (failure) => {
    const events: string[] = [];
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub({ expiresAt: "invalid" })],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub({ expiresAt: "invalid" }),
        updateDeltaLink: async () => void events.push("backfill"),
        replacePollingSubscription: async () => {
          events.push("publish-lost");
          return failure !== "publish";
        },
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => {
          if (failure === "backfill") {
            events.push("backfill-failed");
            throw new Error("secret response body");
          }
          return { messages: [], deltaLink: "new-delta" };
        },
        renewSubscription: async () => {},
        createSubscription: async () => {
          events.push("create");
          return { id: "orphan", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
        deleteSubscription: async (id, teamId) => void events.push(`cleanup:${id}:${teamId}`),
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-cleanup",
    });
    await task.run(NOW);
    expect(events).toEqual(
      failure === "backfill"
        ? ["create", "backfill-failed", "cleanup:orphan:t-1"]
        : ["create", "backfill", "publish-lost", "cleanup:orphan:t-1"],
    );
  });

  it("DELETE成功後のcleanup_complete audit失敗をcleanup_failedへ誤変換しない", async () => {
    const auditActions: string[] = [];
    let deleted = false;
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub({ expiresAt: "invalid" })],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => makeSub({ expiresAt: "invalid" }),
        updateDeltaLink: async () => {},
        replacePollingSubscription: async () => false,
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "delta" }),
        renewSubscription: async () => {},
        createSubscription: async () => ({ id: "new-sub", expirationDateTime: "2026-07-09T23:55:00Z" }),
        deleteSubscription: async () => void (deleted = true),
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: {
        append: async (entry) => {
          auditActions.push(entry.action);
          if (entry.action === "graph_subscription_recovery_cleanup") throw new Error("audit unavailable");
        },
      },
      traceIdProvider: () => "trace-cleanup-audit",
    });
    await task.run(NOW);
    expect(deleted).toBe(true);
    expect(auditActions.filter((action) => action === "graph_subscription_recovery_cleanup")).toHaveLength(1);
  });

  it("cross-process lock loserはGraph createしない", async () => {
    let creates = 0;
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub({ expiresAt: "invalid" })],
        withRecoveryLock: async () => false,
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "delta" }),
        renewSubscription: async () => {},
        createSubscription: async () => {
          creates += 1;
          return { id: "new", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
        deleteSubscription: async () => {},
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-lock",
    });
    await task.run(NOW);
    expect(creates).toBe(0);
  });

  it("lock待ち中にwinnerがpublish済みならledger再読込でstale contenderはcreateしない", async () => {
    let creates = 0;
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub({ expiresAt: "invalid" })],
        withRecoveryLock: async (_id: string, operation: () => Promise<void>) => {
          await operation();
          return true;
        },
        findBySubscriptionId: async () => null,
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "delta" }),
        renewSubscription: async () => {},
        createSubscription: async () => {
          creates += 1;
          return { id: "duplicate", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
        deleteSubscription: async () => {},
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-stale",
    });
    await task.run(NOW);
    expect(creates).toBe(0);
  });

  it("1行のbackfill失敗を監査して後続rowを処理する", async () => {
    const fetched: string[] = [];
    const auditLog = new InMemoryAuditLog();
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: {
        listByMode: async () => [makeSub(), makeSub({ subscriptionId: "sub-2", channelId: "c-2" })],
        updateDeltaLink: async () => {},
      } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async ({ channelId }) => {
          fetched.push(channelId);
          if (channelId === "c-1") throw new Error("secret response body");
          return { messages: [], deltaLink: "delta" };
        },
      },
      auditLog,
      traceIdProvider: () => "trace-row",
    });
    await task.run(NOW);
    expect(fetched).toEqual(["c-1", "c-2"]);
    expect(JSON.stringify(await auditLog.readAll())).not.toContain("secret response body");
  });

  it("missing team/channelはcreateせず監査してpollingに残す", async () => {
    let creates = 0;
    const auditLog = new InMemoryAuditLog();
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: { listByMode: async () => [makeSub({ teamId: null, expiresAt: "invalid" })] } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "delta" }),
        createSubscription: async () => {
          creates += 1;
          return { id: "new", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog,
      traceIdProvider: () => "trace-invalid",
    });
    await task.run(NOW);
    expect(creates).toBe(0);
    expect((await auditLog.readAll()).some((log) => log.action === "graph_subscription_recovery_invalid_ref")).toBe(
      true,
    );
  });

  it("whitespace ledger IDはtrimせずcreate前に拒否する", async () => {
    let creates = 0;
    const auditLog = new InMemoryAuditLog();
    const task = createChannelPollingTask({
      graphSubscriptionsRepo: { listByMode: async () => [makeSub({ teamId: " t-1", expiresAt: "invalid" })] } as never,
      projectChannelsRepo: { findByChannel: async () => makeChannel() } as never,
      channelMessagesRepo: { upsert: async () => {} } as unknown as ChannelMessagesRepo,
      graphClient: {
        getChannelMessagesDelta: async () => ({ messages: [], deltaLink: "delta" }),
        createSubscription: async () => {
          creates += 1;
          return { id: "new", expirationDateTime: "2026-07-09T23:55:00Z" };
        },
      },
      recovery: { notificationUrl: "https://example.test/webhooks/graph", clientState: "x".repeat(32) },
      auditLog,
      traceIdProvider: () => "trace-whitespace",
    });
    await task.run(NOW);
    expect(creates).toBe(0);
    expect((await auditLog.readAll()).some((log) => log.action === "graph_subscription_recovery_invalid_ref")).toBe(
      true,
    );
  });
});
