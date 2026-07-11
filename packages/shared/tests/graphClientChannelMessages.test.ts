/**
 * packages/shared/tests/graphClientChannelMessages.test.ts
 *
 * 根拠: ADR-0005（チャネルメッセージ読取・返信・delta取得・clientState環境変数化）
 *   / SPEC-INT-001（pollingフォールバックのdelta取得）
 */
import { describe, it, expect } from "vitest";
import {
  GraphClient,
  type FetchLike,
  type GraphAccessPolicy,
  type GraphTokenProvider,
} from "../src/clients/graphClient.js";

const tokenProvider: GraphTokenProvider = { getAccessToken: async () => "fake-graph-token" };
const ref = { teamId: "team-1", channelId: "chan-1" };
const accessPolicy: GraphAccessPolicy = {
  allowedTeamIds: ["team-1", "team/a", "team:id", "t"],
  allowedFromMailboxes: ["m@example.com"],
};
const deltaUrl = "https://graph.microsoft.com/v1.0/teams/team-1/channels/chan-1/messages/delta";
const repliesUrl = "https://graph.microsoft.com/v1.0/teams/team-1/channels/chan-1/messages/msg-1/replies";

function createGraphClient(
  provider: GraphTokenProvider = tokenProvider,
  fetchImpl: FetchLike = fetch,
  baseUrl = "https://graph.microsoft.com/v1.0",
  retryOptions = {},
  nowProvider: () => Date = () => new Date(),
  policy: GraphAccessPolicy = accessPolicy,
): GraphClient {
  return new GraphClient(provider, fetchImpl, baseUrl, retryOptions, nowProvider, policy);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const rawMessage = {
  id: "msg-1",
  replyToId: null,
  from: { user: { id: "aad-user-1", displayName: "山田太郎" } },
  body: { contentType: "html", content: "<p>進捗50%です</p>" },
  createdDateTime: "2026-07-07T00:00:00Z",
  lastModifiedDateTime: null,
  deletedDateTime: null,
  webUrl: "https://teams.microsoft.com/l/message/1",
};

describe("GraphClient team access policy (ADR-0005)", () => {
  it.each([
    ["getChannelMessage", (client: GraphClient) => client.getChannelMessage({ ...ref, teamId: "db-team" }, "msg-1")],
    ["getChannelMessagesDelta", (client: GraphClient) => client.getChannelMessagesDelta({ ...ref, teamId: "db-team" })],
    ["listMessageReplies", (client: GraphClient) => client.listMessageReplies({ ...ref, teamId: "db-team" }, "msg-1")],
    [
      "replyToMessage",
      (client: GraphClient) =>
        client.replyToMessage({ ...ref, teamId: "db-team" }, "msg-1", { contentType: "text", content: "secret" }),
    ],
    [
      "createSubscription",
      (client: GraphClient) =>
        client.createSubscription(
          "/teams/db-team/channels/chan-1/messages",
          "https://example.test/hook",
          "2026-07-13T23:55:00Z",
          {
            clientState: "secret-state",
            changeType: "created,updated,deleted",
            lifecycleNotificationUrl: "https://example.test/hook",
          },
        ),
    ],
  ])("allowlist外teamの%sをtoken/fetch前に拒否する", async (_name, operation) => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      { getAccessToken: async () => ((tokenRequested = true), "unexpected") },
      async () => ((fetched = true), jsonResponse({})),
      undefined,
      {},
      () => new Date("2026-07-11T00:00:00Z"),
      accessPolicy,
    );
    await expect(operation(client)).rejects.toThrow(/team is not allowed/i);
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });
});

describe("GraphClient.getChannelMessage (ADR-0005)", () => {
  it("単一メッセージを正規化して返す", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse(rawMessage);
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    const msg = await client.getChannelMessage(ref, "msg-1");
    expect(calls[0]).toContain("/teams/team-1/channels/chan-1/messages/msg-1");
    expect(msg.authorAadId).toBe("aad-user-1");
    expect(msg.contentType).toBe("html");
    expect(msg.content).toContain("進捗50%");
  });

  it("replyOfMessageId指定でスレッド返信パスを叩く", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse({ ...rawMessage, id: "reply-1", replyToId: "msg-1" });
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    const msg = await client.getChannelMessage(ref, "reply-1", "msg-1");
    expect(calls[0]).toContain("/messages/msg-1/replies/reply-1");
    expect(msg.replyToId).toBe("msg-1");
  });

  it("失敗時はE-CHM01例外", async () => {
    const fetchImpl: FetchLike = async () => new Response("{}", { status: 404 });
    const client = createGraphClient(tokenProvider, fetchImpl);
    await expect(client.getChannelMessage(ref, "missing")).rejects.toThrow("E-CHM01");
  });
});

describe("GraphClient.getChannelMessagesDelta (SPEC-INT-001 pollingフォールバック)", () => {
  it.each([
    ["external origin", "https://evil.example/steal"],
    ["credentials", `https://user:pass@graph.microsoft.com/v1.0/teams/team-1/channels/chan-1/messages/delta`],
    ["fragment", `${deltaUrl}#secret`],
    ["empty fragment", `${deltaUrl}#`],
    ["noncanonical path", `${deltaUrl}/../delta`],
    ["different allowed team", "https://graph.microsoft.com/v1.0/teams/team%2Fa/channels/chan-1/messages/delta"],
    ["disallowed team", "https://graph.microsoft.com/v1.0/teams/db-team/channels/chan-1/messages/delta"],
  ])("不正な初回deltaLinkをtoken/fetch前に拒否する: %s", async (_label, continuationUrl) => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      { getAccessToken: async () => ((tokenRequested = true), "unexpected") },
      async () => ((fetched = true), jsonResponse({})),
    );
    await expect(client.getChannelMessagesDelta(ref, { deltaLink: continuationUrl })).rejects.toThrow(
      /continuation URL is not allowed/i,
    );
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it.each([
    ["external origin", "https://evil.example/steal"],
    ["cross-team", "https://graph.microsoft.com/v1.0/teams/db-team/channels/chan-1/messages/delta?$skiptoken=secret"],
  ])("不正な後続nextLinkへBearer付きfetchしない: %s", async (_label, continuationUrl) => {
    const calls: string[] = [];
    const client = createGraphClient(tokenProvider, async (url) => {
      calls.push(url);
      if (calls.length > 1) throw new Error("bearer exfiltration attempted");
      return jsonResponse({ value: [], "@odata.nextLink": continuationUrl });
    });
    await expect(client.getChannelMessagesDelta(ref)).rejects.toThrow(/continuation URL is not allowed/i);
    expect(calls).toEqual([deltaUrl]);
  });

  it("external deltaLinkを台帳へ返さない", async () => {
    const client = createGraphClient(tokenProvider, async () =>
      jsonResponse({ value: [], "@odata.deltaLink": "https://evil.example/delta-token" }),
    );
    await expect(client.getChannelMessagesDelta(ref)).rejects.toThrow(/continuation URL is not allowed/i);
  });

  it("nextLinkを辿り、deltaLinkを返す", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async (url) => {
      call += 1;
      if (call === 1) {
        expect(url).toContain("/messages/delta");
        return jsonResponse({
          value: [rawMessage],
          "@odata.nextLink": `${deltaUrl}?$skiptoken=page-2`,
        });
      }
      return jsonResponse({
        value: [{ ...rawMessage, id: "msg-2" }],
        "@odata.deltaLink": `${deltaUrl}?$deltatoken=abc`,
      });
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    const result = await client.getChannelMessagesDelta(ref);
    expect(result.messages.map((m) => m.id)).toEqual(["msg-1", "msg-2"]);
    expect(result.deltaLink).toBe(`${deltaUrl}?$deltatoken=abc`);
  });

  it("前回deltaLinkを渡すとそのURLから再開する", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse({ value: [], "@odata.deltaLink": `${deltaUrl}?$deltatoken=next` });
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    await client.getChannelMessagesDelta(ref, { deltaLink: `${deltaUrl}?$deltatoken=abc` });
    expect(calls[0]).toBe(`${deltaUrl}?$deltatoken=abc`);
  });

  it("deltaLink欠落はE-CHM02例外", async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ value: [] });
    const client = createGraphClient(tokenProvider, fetchImpl);
    await expect(client.getChannelMessagesDelta(ref)).rejects.toThrow("E-CHM02");
  });
});

describe("GraphClient.listMessageReplies (ADR-0005)", () => {
  it("external nextLinkへBearer付きfetchしない", async () => {
    const calls: string[] = [];
    const client = createGraphClient(tokenProvider, async (url) => {
      calls.push(url);
      if (calls.length > 1) throw new Error("bearer exfiltration attempted");
      return jsonResponse({ value: [], "@odata.nextLink": "https://evil.example/steal" });
    });
    await expect(client.listMessageReplies(ref, "msg-1")).rejects.toThrow(/continuation URL is not allowed/i);
    expect(calls).toEqual([repliesUrl]);
  });

  it("ページングして全返信を返す", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse({
          value: [{ ...rawMessage, id: "r1", replyToId: "msg-1" }],
          "@odata.nextLink": `${repliesUrl}?$skiptoken=page-2`,
        });
      }
      return jsonResponse({ value: [{ ...rawMessage, id: "r2", replyToId: "msg-1" }] });
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    const replies = await client.listMessageReplies(ref, "msg-1");
    expect(replies.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("GraphClient.replyToMessage (ADR-0005: RSC ChannelMessage.Send.Group)", () => {
  it("スレッド返信を投稿しmessageIdを返す", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      bodies.push(String(init?.body ?? ""));
      expect(url).toContain("/messages/msg-1/replies");
      return jsonResponse({ id: "reply-9" }, 201);
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    const result = await client.replyToMessage(ref, "msg-1", {
      contentType: "text",
      content: "3件のオープンPRがあります",
    });
    expect(result.messageId).toBe("reply-9");
    expect(bodies[0]).toContain("3件のオープンPR");
  });

  it("status 200を成功扱いせず、500を再POSTしない", async () => {
    for (const status of [200, 500]) {
      let calls = 0;
      const client = createGraphClient(
        tokenProvider,
        async () => ((calls += 1), jsonResponse({ id: "unexpected" }, status)),
        undefined,
        { maxRetries: 2, sleep: async () => {} },
      );
      await expect(client.replyToMessage(ref, "msg-1", { contentType: "text", content: "review" })).rejects.toThrow();
      expect(calls).toBe(1);
    }
  });

  it("team/channel/parent IDの周辺空白を除去してURLを組み立てる", async () => {
    let calledUrl = "";
    const client = createGraphClient(tokenProvider, async (url) => {
      calledUrl = url;
      return jsonResponse({ id: "reply-normalized" }, 201);
    });
    await client.replyToMessage({ teamId: "  team/a  ", channelId: "  channel b  " }, "  parent/1  ", {
      contentType: "text",
      content: "ok",
    });
    expect(calledUrl).toBe(
      "https://graph.microsoft.com/v1.0/teams/team%2Fa/channels/channel%20b/messages/parent%2F1/replies",
    );
  });

  it.each([
    [{ teamId: "", channelId: "channel-1" }, "parent-1", "teamId"],
    [{ teamId: "   ", channelId: "channel-1" }, "parent-1", "teamId"],
    [{ teamId: "team-1", channelId: "" }, "parent-1", "channelId"],
    [{ teamId: "team-1", channelId: "\t" }, "parent-1", "channelId"],
    [{ teamId: "team-1", channelId: "channel-1" }, "", "parentMessageId"],
    [{ teamId: "team-1", channelId: "channel-1" }, "  ", "parentMessageId"],
  ])("blank IDはtoken/fetch前に拒否する: %s %s", async (target, parentMessageId, field) => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      {
        getAccessToken: async () => {
          tokenRequested = true;
          return "unexpected";
        },
      },
      async () => {
        fetched = true;
        return jsonResponse({ id: "unexpected" });
      },
    );
    await expect(
      client.replyToMessage(target, parentMessageId, { contentType: "text", content: "review" }),
    ).rejects.toThrow(field);
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it("Action.OpenUrlボタン付きカードを添付できる（承認はWebUIディープリンク方式）", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return jsonResponse({ id: "reply-10" }, 201);
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    await client.replyToMessage(
      ref,
      "msg-1",
      { contentType: "html", content: "承認が必要です" },
      {
        body: [{ type: "TextBlock", text: "コーディングタスク確認" }],
        actions: [],
        openUrlActions: [{ title: "WebUIで承認", url: "https://example.test/app/approve/task-1" }],
      },
    );
    const payload = JSON.parse(bodies[0]!);
    expect(payload.body.contentType).toBe("html");
    expect(payload.body.content).toMatch(/^承認が必要です/);
    expect(payload.body.content).toContain(`<attachment id="${payload.attachments[0].id}"></attachment>`);
    expect(payload.attachments[0].content).toContain("Action.OpenUrl");
    expect(payload.attachments[0].content).toContain("https://example.test/app/approve/task-1");
    expect(JSON.stringify(payload)).not.toContain("Action.Submit");
  });

  it("legacy actions付きカードはtoken/fetch前に拒否する", async () => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      {
        getAccessToken: async () => {
          tokenRequested = true;
          return "unexpected";
        },
      },
      async () => {
        fetched = true;
        return jsonResponse({ id: "unexpected" });
      },
    );
    await expect(
      client.replyToMessage(
        ref,
        "msg-1",
        { contentType: "text", content: "review" },
        {
          body: [],
          actions: [{ title: "unsupported", id: "submit" }],
        },
      ),
    ).rejects.toThrow(/legacy actions/i);
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it("text本文はHTML escapeしてattachment referenceを付ける", async () => {
    let sent = "";
    const client = createGraphClient(tokenProvider, async (_url, init) => {
      sent = String(init?.body ?? "");
      return jsonResponse({ id: "reply-11" }, 201);
    });
    await client.replyToMessage(
      ref,
      "msg-1",
      { contentType: "text", content: `<unsafe & "quote" 'single'>` },
      { body: [], actions: [], openUrlActions: [{ title: "Review", url: "https://example.test/review" }] },
    );
    const payload = JSON.parse(sent);
    expect(payload.body.contentType).toBe("html");
    expect(payload.body.content).toBe(
      `&lt;unsafe &amp; &quot;quote&quot; &#39;single&#39;&gt;<attachment id="${payload.attachments[0].id}"></attachment>`,
    );
  });

  it.each([
    [{ title: "", url: "https://example.test/review" }, "title"],
    [{ title: "Review", url: "" }, "URL"],
    [{ title: "Review", url: "javascript:alert(1)" }, "URL"],
    [{ title: "Review", url: "data:text/plain,unsafe" }, "URL"],
    [{ title: "Review", url: "http://example.test/review" }, "URL"],
  ])("replyToMessage は不正OpenUrlをtoken/fetch前に拒否する: %s", async (action, field) => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      {
        getAccessToken: async () => {
          tokenRequested = true;
          return "unexpected";
        },
      },
      async () => {
        fetched = true;
        return jsonResponse({ id: "unexpected" });
      },
    );
    await expect(
      client.replyToMessage(
        ref,
        "msg-1",
        { contentType: "text", content: "review" },
        { body: [], actions: [], openUrlActions: [action] },
      ),
    ).rejects.toThrow(new RegExp(field, "i"));
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });
});

describe("GraphClient.sendAdaptiveCard (SPEC-INT-069)", () => {
  it("Action.OpenUrlボタン付きカードを投稿できる", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return jsonResponse({ id: "card-1" }, 201);
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    await client.sendAdaptiveCard({
      target: ref,
      card: {
        body: [{ type: "TextBlock", text: "週次レポート" }],
        actions: [],
        openUrlActions: [{ title: "Dashboard", url: "https://example.test/app/dashboard?persona=manager" }],
      },
    });
    expect(bodies[0]).toContain("Action.OpenUrl");
    expect(bodies[0]).toContain("https://example.test/app/dashboard?persona=manager");
  });
});

describe("GraphClient.createSubscription (ADR-0005 / SPEC-INT-001)", () => {
  it("resource-specific contractのexact payloadを送りGraph expiryを返す", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return jsonResponse({ id: "sub-1", expirationDateTime: "2026-07-14T08:54:59.1234567+09:00" }, 201);
    };
    const client = createGraphClient(tokenProvider, fetchImpl, undefined, {}, () => new Date("2026-07-11T00:00:00Z"));
    const result = await client.createSubscription(
      "/teams/team%3Aid/channels/19%3Aabc%40thread.tacv2/messages",
      "https://example.test/webhooks/graph",
      "2026-07-13T23:55:00.1234567Z",
      {
        clientState: "random-secret-128bit",
        changeType: "created,updated,deleted",
        lifecycleNotificationUrl: "https://example.test/webhooks/graph",
      },
    );
    const sent = JSON.parse(bodies[0]!);
    expect(sent).toEqual({
      changeType: "created,updated,deleted",
      notificationUrl: "https://example.test/webhooks/graph",
      lifecycleNotificationUrl: "https://example.test/webhooks/graph",
      resource: "/teams/team%3Aid/channels/19%3Aabc%40thread.tacv2/messages",
      expirationDateTime: "2026-07-13T23:55:00.1234567Z",
      clientState: "random-secret-128bit",
    });
    expect(result).toEqual({ id: "sub-1", expirationDateTime: "2026-07-14T08:54:59.1234567+09:00" });
  });

  it("status 200を成功扱いせず、500を再POSTしない", async () => {
    for (const status of [200, 500]) {
      let calls = 0;
      const client = createGraphClient(
        tokenProvider,
        async () => ((calls += 1), jsonResponse({ id: "sub-1", expirationDateTime: "2026-07-13T23:55:00Z" }, status)),
        undefined,
        { maxRetries: 2, sleep: async () => {} },
        () => new Date("2026-07-11T00:00:00Z"),
      );
      await expect(
        client.createSubscription("/teams/t/channels/c/messages", "https://example.test/hook", "2026-07-13T23:55:00Z", {
          clientState: "state",
          changeType: "created,updated,deleted",
          lifecycleNotificationUrl: "https://example.test/hook",
        }),
      ).rejects.toThrow();
      expect(calls).toBe(1);
    }
  });

  it.each([
    [
      "resource",
      "/resource",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "encoded whitespace resource",
      "/teams/team%20/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "internal ASCII whitespace resource",
      "/teams/te%20am/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "internal channel tab resource",
      "/teams/team/channels/ch%09annel/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "Unicode no-break space resource",
      "/teams/te%C2%A0am/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "encoded NUL control resource",
      "/teams/team/channels/ch%00annel/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "Unicode zero-width format control resource",
      "/teams/te%E2%80%8Bam/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "blank encoded whitespace resource",
      "/teams/%20/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "encoded separator resource",
      "/teams/team%2Fid/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "double encoded resource",
      "/teams/team%252Fid/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "noncanonical lowercase encoding resource",
      "/teams/team%3aid/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "notificationUrl",
      "/teams/t/channels/c/messages",
      "http://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "lifecycleNotificationUrl",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "",
      "state",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "clientState",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      " ",
      "created,updated,deleted",
      "2026-07-13T23:55:00Z",
    ],
    [
      "changeType",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated",
      "2026-07-13T23:55:00Z",
    ],
    [
      "expirationDateTime",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "invalid",
    ],
    [
      "date-only expirationDateTime",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13",
    ],
    [
      "space-separated expirationDateTime",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-13 23:55:00Z",
    ],
    [
      "over-cap expirationDateTime",
      "/teams/t/channels/c/messages",
      "https://example.test/hook",
      "https://example.test/hook",
      "state",
      "created,updated,deleted",
      "2026-07-14T00:00:01Z",
    ],
  ])(
    "不正%sをtoken/fetch前に拒否する",
    async (_field, resource, notificationUrl, lifecycleNotificationUrl, clientState, changeType, expiration) => {
      let tokenRequested = false;
      let fetched = false;
      const client = createGraphClient(
        {
          getAccessToken: async () => {
            tokenRequested = true;
            return "unexpected";
          },
        },
        async () => {
          fetched = true;
          return jsonResponse({});
        },
        undefined,
        {},
        () => new Date("2026-07-11T00:00:00Z"),
      );
      await expect(
        client.createSubscription(resource, notificationUrl, expiration, {
          clientState,
          changeType: changeType as "created,updated,deleted",
          lifecycleNotificationUrl,
        }),
      ).rejects.toThrow();
      expect(tokenRequested).toBe(false);
      expect(fetched).toBe(false);
    },
  );

  it.each([
    { id: "sub-1" },
    { expirationDateTime: "2026-07-13T23:55:00Z" },
    { id: " ", expirationDateTime: "invalid" },
    { id: "sub-1", expirationDateTime: "2026-07-13" },
    { id: "sub-1", expirationDateTime: "2026-07-13 23:55:00Z" },
    { id: "sub-1", expirationDateTime: "2026-07-14T00:00:01Z" },
  ])("不完全なGraph responseを拒否する: %s", async (body) => {
    const client = createGraphClient(
      tokenProvider,
      async () => jsonResponse(body, 201),
      undefined,
      {},
      () => new Date("2026-07-11T00:00:00Z"),
    );
    await expect(
      client.createSubscription("/teams/t/channels/c/messages", "https://example.test/hook", "2026-07-13T23:55:00Z", {
        clientState: "state",
        changeType: "created,updated,deleted",
        lifecycleNotificationUrl: "https://example.test/hook",
      }),
    ).rejects.toThrow(/response/i);
  });
});
