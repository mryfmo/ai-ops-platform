/**
 * packages/shared/tests/graphClientChannelMessages.test.ts
 *
 * 根拠: ADR-0005（チャネルメッセージ読取・返信・delta取得・clientState環境変数化）
 *   / SPEC-INT-001（pollingフォールバックのdelta取得）
 */
import { describe, it, expect } from "vitest";
import { GraphClient, type FetchLike, type GraphTokenProvider } from "../src/clients/graphClient.js";

const tokenProvider: GraphTokenProvider = { getAccessToken: async () => "fake-graph-token" };
const ref = { teamId: "team-1", channelId: "chan-1" };

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

describe("GraphClient.getChannelMessage (ADR-0005)", () => {
  it("単一メッセージを正規化して返す", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse(rawMessage);
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
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
    const client = new GraphClient(tokenProvider, fetchImpl);
    const msg = await client.getChannelMessage(ref, "reply-1", "msg-1");
    expect(calls[0]).toContain("/messages/msg-1/replies/reply-1");
    expect(msg.replyToId).toBe("msg-1");
  });

  it("失敗時はE-CHM01例外", async () => {
    const fetchImpl: FetchLike = async () => new Response("{}", { status: 404 });
    const client = new GraphClient(tokenProvider, fetchImpl);
    await expect(client.getChannelMessage(ref, "missing")).rejects.toThrow("E-CHM01");
  });
});

describe("GraphClient.getChannelMessagesDelta (SPEC-INT-001 pollingフォールバック)", () => {
  it("nextLinkを辿り、deltaLinkを返す", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async (url) => {
      call += 1;
      if (call === 1) {
        expect(url).toContain("/messages/delta");
        return jsonResponse({
          value: [rawMessage],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/next-page",
        });
      }
      return jsonResponse({
        value: [{ ...rawMessage, id: "msg-2" }],
        "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-token-abc",
      });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    const result = await client.getChannelMessagesDelta(ref);
    expect(result.messages.map((m) => m.id)).toEqual(["msg-1", "msg-2"]);
    expect(result.deltaLink).toBe("https://graph.microsoft.com/v1.0/delta-token-abc");
  });

  it("前回deltaLinkを渡すとそのURLから再開する", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return jsonResponse({ value: [], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-token-next" });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    await client.getChannelMessagesDelta(ref, { deltaLink: "https://graph.microsoft.com/v1.0/delta-token-abc" });
    expect(calls[0]).toBe("https://graph.microsoft.com/v1.0/delta-token-abc");
  });

  it("deltaLink欠落はE-CHM02例外", async () => {
    const fetchImpl: FetchLike = async () => jsonResponse({ value: [] });
    const client = new GraphClient(tokenProvider, fetchImpl);
    await expect(client.getChannelMessagesDelta(ref)).rejects.toThrow("E-CHM02");
  });
});

describe("GraphClient.listMessageReplies (ADR-0005)", () => {
  it("ページングして全返信を返す", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse({
          value: [{ ...rawMessage, id: "r1", replyToId: "msg-1" }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/replies-page2",
        });
      }
      return jsonResponse({ value: [{ ...rawMessage, id: "r2", replyToId: "msg-1" }] });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
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
      return jsonResponse({ id: "reply-9" });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    const result = await client.replyToMessage(ref, "msg-1", {
      contentType: "text",
      content: "3件のオープンPRがあります",
    });
    expect(result.messageId).toBe("reply-9");
    expect(bodies[0]).toContain("3件のオープンPR");
  });

  it("Action.OpenUrlボタン付きカードを添付できる（承認はWebUIディープリンク方式）", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return jsonResponse({ id: "reply-10" });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
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
    expect(bodies[0]).toContain("Action.OpenUrl");
    expect(bodies[0]).toContain("https://example.test/app/approve/task-1");
  });
});

describe("GraphClient.createSubscription opts (ADR-0005: clientState環境変数化)", () => {
  it("clientStateとchangeTypeを指定できる", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return jsonResponse({ id: "sub-1" });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    await client.createSubscription(
      "/teams/t/channels/c/messages",
      "https://example.test/webhooks/graph",
      "2026-07-07T01:00:00Z",
      {
        clientState: "random-secret-128bit",
        changeType: "created,updated,deleted",
      },
    );
    const sent = JSON.parse(bodies[0]!);
    expect(sent.clientState).toBe("random-secret-128bit");
    expect(sent.changeType).toBe("created,updated,deleted");
  });

  it("opts省略時は後方互換の既定値", async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return jsonResponse({ id: "sub-2" });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    await client.createSubscription("/resource", "https://example.test/hook", "2026-07-07T01:00:00Z");
    const sent = JSON.parse(bodies[0]!);
    expect(sent.changeType).toBe("created,updated");
    expect(typeof sent.clientState).toBe("string");
  });
});
