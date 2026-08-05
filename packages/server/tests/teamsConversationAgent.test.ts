/**
 * packages/server/tests/teamsConversationAgent.test.ts
 *
 * 根拠: ADR-0005（会話取込→コマンド/自由文解釈→GitHub照会→Teams返信の結線）/ PrjOps:SPEC-INT-001
 *   （resourceパース、fetch-on-notify）/ PrjOps:SPEC-INT-033（コマンド優先・自由文フォールバック）/
 *   DevOps:REQ-030（保存前sanitizeSecrets）/ ADR-0006（code_task: 確認リンク発行のみ、dispatchWorkflow不呼び出し）
 */
import { describe, it, expect } from "vitest";
import {
  InMemoryAuditLog,
  type AnthropicStructuredClient,
  type StructuredCallOptions,
  type StructuredCallResult,
} from "@aiops/shared";
import {
  TeamsConversationAgent,
  type TeamsConversationGraphClient,
  type TeamsConversationGithubClient,
  type TeamsConversationCodingTasksRepo,
  type TeamsConversationGraphMessage,
} from "../src/agents/teamsConversationAgent.js";
import type { ProjectChannelsRepo, ProjectChannel } from "../src/db/projectChannelsRepo.js";
import type { ChannelMessagesRepo, ChannelMessageRecord } from "../src/db/channelMessagesRepo.js";
import type { InboundNotificationPayload } from "../src/scheduler/tasks/eventsPollingTask.js";

function makeChannel(overrides: Partial<ProjectChannel> = {}): ProjectChannel {
  return {
    teamId: "t-1",
    channelId: "c-1",
    projectId: "PJ-001",
    createdBy: "ST-001",
    ingestion: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    githubOwner: "acme",
    githubRepo: "widget",
    ...overrides,
  };
}

function makeMessage(overrides: Partial<TeamsConversationGraphMessage> = {}): TeamsConversationGraphMessage {
  return {
    content: "hello",
    contentType: "text",
    authorAadId: "aad-1",
    authorDisplayName: "Alice",
    createdDateTime: "2026-07-07T00:00:00.000Z",
    lastModifiedDateTime: null,
    deletedDateTime: null,
    ...overrides,
  };
}

function makeNotification(overrides: Partial<InboundNotificationPayload> = {}): InboundNotificationPayload {
  return {
    kind: "graph_channel_message_notification",
    changeType: "created",
    resource: "teams('t-1')/channels('c-1')/messages('m-1')",
    subscriptionId: "sub-1",
    ids: null,
    ...overrides,
  };
}

function makeMockLlmClient(rawResponse: unknown): AnthropicStructuredClient {
  return {
    call: async <T>(opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> => {
      const value = opts.parse(rawResponse);
      return { value, model: "claude-sonnet-4-6", attempts: 1, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  } as unknown as AnthropicStructuredClient;
}

interface Harness {
  agent: TeamsConversationAgent;
  auditLog: InMemoryAuditLog;
  upserted: ChannelMessageRecord[];
  replies: Array<{
    ref: { teamId: string; channelId: string };
    parentMessageId: string;
    content: string;
    card?: unknown;
  }>;
  ghCalls: { listPr: number; listIssue: number; createIssue: number };
  codingTaskInserts: Array<Parameters<TeamsConversationCodingTasksRepo["insert"]>[0]>;
  channel: ProjectChannel | null;
  message: TeamsConversationGraphMessage;
}

function makeHarness(
  opts: {
    channel?: ProjectChannel | null;
    message?: Partial<TeamsConversationGraphMessage>;
    llmClient?: AnthropicStructuredClient;
    callerProfile?: "PRF-01" | "PRF-02" | "PRF-03" | "PRF-04" | "PRF-05" | null;
  } = {},
): Harness {
  const auditLog = new InMemoryAuditLog();
  const upserted: ChannelMessageRecord[] = [];
  const replies: Harness["replies"] = [];
  const ghCalls = { listPr: 0, listIssue: 0, createIssue: 0 };
  const codingTaskInserts: Harness["codingTaskInserts"] = [];
  const channel = opts.channel === undefined ? makeChannel() : opts.channel;
  const message = makeMessage(opts.message);

  const projectChannelsRepo = { findByChannel: async () => channel } as unknown as ProjectChannelsRepo;
  const channelMessagesRepo = {
    upsert: async (msg: ChannelMessageRecord) => {
      upserted.push(msg);
    },
  } as unknown as ChannelMessagesRepo;

  const graphClient: TeamsConversationGraphClient = {
    getChannelMessage: async () => message,
    replyToMessage: async (ref, parentMessageId, body, card) => {
      replies.push({ ref, parentMessageId, content: body.content, card });
      return { messageId: "reply-1" };
    },
  };

  const githubClient: TeamsConversationGithubClient = {
    listPullRequests: async () => {
      ghCalls.listPr += 1;
      return [{ number: 1, title: "Add feature", url: "https://github.com/acme/widget/pull/1", state: "open" }];
    },
    listIssues: async () => {
      ghCalls.listIssue += 1;
      return [{ number: 2, title: "Bug", url: "https://github.com/acme/widget/issues/2", state: "open" }];
    },
    createIssue: async () => {
      ghCalls.createIssue += 1;
      return { number: 3, htmlUrl: "https://github.com/acme/widget/issues/3" };
    },
  };

  const codingTasksRepo: TeamsConversationCodingTasksRepo = {
    insert: async (input) => {
      codingTaskInserts.push(input);
      return { taskId: input.taskId };
    },
  };

  const agent = new TeamsConversationAgent({
    projectChannelsRepo,
    channelMessagesRepo,
    graphClient,
    githubClient,
    auditLog,
    llmClient: opts.llmClient,
    resolveCallerProfile: () => (opts.callerProfile === undefined ? "PRF-02" : opts.callerProfile),
    codingTasksRepo,
    confirmTokenSecret: "test-confirm-token-secret-16+",
    publicBaseUrl: "https://aiops.example.com",
  });

  return { agent, auditLog, upserted, replies, ghCalls, codingTaskInserts, channel, message };
}

describe("TeamsConversationAgent: resourceパース (PrjOps:SPEC-INT-001)", () => {
  it("resource文字列からteamId/channelId/messageIdを抽出して処理する", async () => {
    const h = makeHarness();
    await h.agent.handleNotification(makeNotification(), "trace-1");
    expect(h.upserted).toHaveLength(1);
    expect(h.upserted[0]!.messageId).toBe("m-1");
  });

  it("解釈不能なresourceは破棄+監査ログ", async () => {
    const h = makeHarness();
    await h.agent.handleNotification(makeNotification({ resource: "users('u-1')/messages('m-1')" }), "trace-2");
    expect(h.upserted).toHaveLength(0);
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "teams_notification_unresolvable")).toBe(true);
  });
});

describe("TeamsConversationAgent: 権限チェック拒否 (PrjOps:SPEC-INT-033)", () => {
  it("PRF-01は/gh issue createを拒否され、返信で通知される", async () => {
    const h = makeHarness({
      message: { content: '/gh issue create PJ-001 "タイトル" 本文:"詳細"' },
      callerProfile: "PRF-01",
    });
    await h.agent.handleNotification(makeNotification(), "trace-3");
    expect(h.ghCalls.createIssue).toBe(0);
    expect(h.replies).toHaveLength(1);
    expect(h.replies[0]!.content).toContain("PRF-02以上");
  });

  it("未登録チャネルは破棄+監査ログ、コマンドも実行しない", async () => {
    const h = makeHarness({ channel: null, message: { content: "/gh pr list PJ-001" } });
    await h.agent.handleNotification(makeNotification(), "trace-4");
    expect(h.ghCalls.listPr).toBe(0);
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "teams_message_rejected")).toBe(true);
  });

  it("関係者マスタ未設定でも会話保存を継続し、コマンドを拒否+監査する (PrjOps:REQ-002 ADR-0005)", async () => {
    const h = makeHarness({ message: { content: "/gh pr list PJ-001" }, callerProfile: null });
    await h.agent.handleNotification(makeNotification(), "trace-4b");
    expect(h.upserted).toHaveLength(1);
    expect(h.ghCalls.listPr).toBe(0);
    expect(h.replies[0]!.content).toContain("関係者マスタ");
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "teams_caller_profile_unresolved")).toBe(true);
  });
});

describe("TeamsConversationAgent: GitHub照会成功 (ADR-0005)", () => {
  it("/gh pr list はPR一覧を返信する", async () => {
    const h = makeHarness({ message: { content: "/gh pr list PJ-001" }, callerProfile: "PRF-01" });
    await h.agent.handleNotification(makeNotification(), "trace-5");
    expect(h.ghCalls.listPr).toBe(1);
    expect(h.replies[0]!.content).toContain("#1 Add feature");
  });

  it("/gh issue list はIssue一覧を返信する", async () => {
    const h = makeHarness({ message: { content: "/gh issue list PJ-001" }, callerProfile: "PRF-01" });
    await h.agent.handleNotification(makeNotification(), "trace-6");
    expect(h.ghCalls.listIssue).toBe(1);
    expect(h.replies[0]!.content).toContain("#2 Bug");
  });

  it("/gh issue create はIssueを作成しURLを返信する", async () => {
    const h = makeHarness({
      message: { content: '/gh issue create PJ-001 "タイトル" 本文:"詳細"' },
      callerProfile: "PRF-02",
    });
    await h.agent.handleNotification(makeNotification(), "trace-7");
    expect(h.ghCalls.createIssue).toBe(1);
    expect(h.replies[0]!.content).toContain("https://github.com/acme/widget/issues/3");
  });

  it("GitHubリポジトリ未登録のプロジェクトは案内メッセージのみ返す", async () => {
    const h = makeHarness({
      channel: makeChannel({ githubOwner: null, githubRepo: null }),
      message: { content: "/gh pr list PJ-001" },
      callerProfile: "PRF-01",
    });
    await h.agent.handleNotification(makeNotification(), "trace-8");
    expect(h.ghCalls.listPr).toBe(0);
    expect(h.replies[0]!.content).toContain("GitHubリポジトリが未登録です");
  });

  it("/code fix はcoding_tasksへqueuedでINSERTし、確認リンクを返信する。dispatchWorkflowは呼ばない (ADR-0006)", async () => {
    const h = makeHarness({ message: { content: '/code fix PJ-001 "テストを直して"' }, callerProfile: "PRF-02" });
    await h.agent.handleNotification(makeNotification(), "trace-9");
    expect(h.codingTaskInserts).toHaveLength(1);
    expect(h.codingTaskInserts[0]!.projectId).toBe("PJ-001");
    expect(h.codingTaskInserts[0]!.source).toBe("teams");
    expect(h.codingTaskInserts[0]!.requestedBy).toBe("USER:PRF-02");
    expect(h.replies[0]!.content).toContain("https://aiops.example.com/coding-tasks/");
    expect(h.replies[0]!.content).toContain("/confirm?token=");
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "teams_code_task_queued")).toBe(true);
    expect(logs.every((l) => l.action !== "teams_code_task_deferred")).toBe(true);
  });

  it("発信元チャネル外のprojectIdを指すcode_taskは拒否し、監査と返信を残す (ADR-0006)", async () => {
    const h = makeHarness({
      message: { content: '/code fix PJ-999 "他プロジェクトを直して"' },
      callerProfile: "PRF-02",
    });
    await h.agent.handleNotification(makeNotification(), "trace-scope-1");

    expect(h.codingTaskInserts).toHaveLength(0);
    const logs = await h.auditLog.readAll();
    const rejected = logs.find((l) => l.action === "teams_code_task_rejected_project_scope");
    expect(rejected).toBeDefined();
    expect(rejected!.detail).toMatchObject({ requestedProjectId: "PJ-999", channelProjectId: "PJ-001" });
    expect(h.replies[0]!.content).toContain("PJ-999");
    expect(logs.every((l) => l.action !== "teams_code_task_queued")).toBe(true);
  });

  it("発信元チャネルと一致するprojectIdは従来どおり受理する (ADR-0006)", async () => {
    const h = makeHarness({
      message: { content: '/code fix PJ-001 "自プロジェクトを直して"' },
      callerProfile: "PRF-02",
    });
    await h.agent.handleNotification(makeNotification(), "trace-scope-2");

    expect(h.codingTaskInserts).toHaveLength(1);
    expect(h.codingTaskInserts[0]!.projectId).toBe("PJ-001");
    const logs = await h.auditLog.readAll();
    expect(logs.every((l) => l.action !== "teams_code_task_rejected_project_scope")).toBe(true);
  });

  it("/code fix のinstructionはdispatch前にLLM入力用サニタイズを通す (DevOps:REQ-030)", async () => {
    const h = makeHarness({
      message: { content: '/code fix PJ-001 "キー sk-ant-abcdefghijklmnopqrstuvwxyz を除去"' },
      callerProfile: "PRF-02",
    });
    await h.agent.handleNotification(makeNotification(), "trace-sanitized-instruction");
    expect(h.codingTaskInserts[0]!.instruction).toBe("キー ***REDACTED:anthropic_api_key*** を除去");
  });

  it("/dashboard はpersona付きWebUIディープリンクカードを返信する (PrjOps:REQ-042 SPEC-INT-069 PrjOps:AC-042-1)", async () => {
    const h = makeHarness({ message: { content: "/dashboard" }, callerProfile: "PRF-02" });
    await h.agent.handleNotification(makeNotification(), "trace-dashboard");
    expect(h.replies[0]!.content).toContain("ダッシュボード");
    expect(JSON.stringify(h.replies[0]!.card)).toContain("/app/dashboard?persona=PRF-02&period=current");
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "teams_dashboard_link_sent")).toBe(true);
  });
});

describe("TeamsConversationAgent: 自由文フォールバック (PrjOps:SPEC-INT-033)", () => {
  it("スラッシュで始まらない文はLLM意図解釈を試み、gh_pr_listならPR一覧を返す", async () => {
    const llmClient = makeMockLlmClient({
      intent: "gh_pr_list",
      projectId: "PJ-001",
      title: null,
      body: null,
      instruction: null,
    });
    const h = makeHarness({ message: { content: "PJ-001のPR教えて" }, llmClient, callerProfile: "PRF-01" });
    await h.agent.handleNotification(makeNotification(), "trace-10");
    expect(h.ghCalls.listPr).toBe(1);
  });

  it("intent=unknownなら何もせず会話保存のみ", async () => {
    const llmClient = makeMockLlmClient({
      intent: "unknown",
      projectId: null,
      title: null,
      body: null,
      instruction: null,
    });
    const h = makeHarness({ message: { content: "おはよう" }, llmClient });
    await h.agent.handleNotification(makeNotification(), "trace-11");
    expect(h.replies).toHaveLength(0);
    expect(h.upserted).toHaveLength(1);
  });

  it("llmClient未設定（ANTHROPIC_API_KEY未設定相当）なら自由文は何もしない", async () => {
    const h = makeHarness({ message: { content: "PJ-001のPR教えて" } });
    await h.agent.handleNotification(makeNotification(), "trace-12");
    expect(h.replies).toHaveLength(0);
    expect(h.ghCalls.listPr).toBe(0);
  });
});

describe("TeamsConversationAgent: 監査ログ記録", () => {
  it("コマンド実行はteams_command_parsed + teams_gh_pr_list_executedを記録する", async () => {
    const h = makeHarness({ message: { content: "/gh pr list PJ-001" }, callerProfile: "PRF-01" });
    await h.agent.handleNotification(makeNotification(), "trace-13");
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "teams_command_parsed")).toBe(true);
    expect(logs.some((l) => l.action === "teams_gh_pr_list_executed")).toBe(true);
    expect(logs.every((l) => l.trace_id === "trace-13")).toBe(true);
  });

  it("削除通知は会話保存のみでコマンド実行しない", async () => {
    const h = makeHarness({
      message: { content: "/gh pr list PJ-001", deletedDateTime: "2026-07-07T00:01:00.000Z" },
      callerProfile: "PRF-01",
    });
    await h.agent.handleNotification(makeNotification(), "trace-14");
    expect(h.ghCalls.listPr).toBe(0);
    expect(h.upserted).toHaveLength(1);
  });

  it("保存前にsanitizeSecretsを通す (DevOps:REQ-030)", async () => {
    const h = makeHarness({ message: { content: "token ghp_abcdefghijklmnopqrst0123" } });
    await h.agent.handleNotification(makeNotification(), "trace-15");
    expect(h.upserted[0]!.content).toContain("***REDACTED:github_pat***");
  });
});
