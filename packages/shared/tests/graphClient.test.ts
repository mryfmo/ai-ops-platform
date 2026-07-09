import { describe, it, expect } from "vitest";
import { GraphClient, fetchWithBackoff, type FetchLike, type GraphTokenProvider } from "../src/clients/graphClient.js";

const tokenProvider: GraphTokenProvider = { getAccessToken: async () => "fake-graph-token" };

describe("fetchWithBackoff [DevOps SPEC-INT-080]", () => {
  it("200応答は即座に返る", async () => {
    const fetchImpl: FetchLike = async () => new Response("{}", { status: 200 });
    const res = await fetchWithBackoff(fetchImpl, "https://example.test", {});
    expect(res.status).toBe(200);
  });

  it("429の後に200が返れば成功として返す（Retry-Afterヘッダを尊重）", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async () => {
      call += 1;
      if (call === 1) return new Response("{}", { status: 429, headers: { "Retry-After": "0" } });
      return new Response("{}", { status: 200 });
    };
    const res = await fetchWithBackoff(fetchImpl, "https://example.test", {}, { initialDelayMs: 1, maxDelayMs: 10 });
    expect(res.status).toBe(200);
    expect(call).toBe(2);
  });

  it("maxRetriesを超えたら最後の応答（エラー）をそのまま返す", async () => {
    const fetchImpl: FetchLike = async () => new Response("{}", { status: 429 });
    const res = await fetchWithBackoff(
      fetchImpl,
      "https://example.test",
      {},
      { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 5 },
    );
    expect(res.status).toBe(429);
  });

  it("4xx（429以外）はリトライせず即座に返る", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async () => {
      call += 1;
      return new Response("{}", { status: 404 });
    };
    const res = await fetchWithBackoff(fetchImpl, "https://example.test", {});
    expect(res.status).toBe(404);
    expect(call).toBe(1);
  });
});

describe("GraphClient [SPEC-EXT-010/011/012/024, REQ-018, SPEC-INT-062]", () => {
  it("sendAdaptiveCard はAdaptive Card形式のボディでPOSTする", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, body: String(init?.body ?? "") });
      return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    const result = await client.sendAdaptiveCard({
      channelOrChatId: "chat-123",
      card: {
        body: [{ type: "TextBlock", text: "本番デプロイ承認依頼" }],
        actions: [
          { title: "承認", id: "approve" },
          { title: "却下", id: "reject" },
        ],
      },
    });
    expect(result.messageId).toBe("msg-1");
    expect(calls[0]!.body).toContain("application/vnd.microsoft.card.adaptive");
    expect(calls[0]!.body).toContain("承認");
  });

  it("sendMail はHTML本文をtoRecipientsへ送信する", async () => {
    let capturedBody = "";
    const fetchImpl: FetchLike = async (url, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response("", { status: 202 });
    };
    const client = new GraphClient(tokenProvider, fetchImpl);
    await client.sendMail({
      toEmail: "pm@example.com",
      subject: "【進捗報告依頼】サンプル案件 (PJ-001) 2026-07-06週",
      htmlBody: "<html><body>本文</body></html>",
      fromMailbox: "prjops-system@example.com",
    });
    const parsed = JSON.parse(capturedBody);
    expect(parsed.message.toRecipients[0].emailAddress.address).toBe("pm@example.com");
    expect(parsed.message.subject).toContain("進捗報告依頼");
  });

  it("sendMail失敗時はE-DLV01を投げる", async () => {
    const fetchImpl: FetchLike = async () => new Response("", { status: 500 });
    const client = new GraphClient(tokenProvider, fetchImpl, undefined, {
      maxRetries: 0,
      initialDelayMs: 1,
      maxDelayMs: 1,
    });
    await expect(
      client.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "<p/>", fromMailbox: "m@example.com" }),
    ).rejects.toThrow(/E-DLV01/);
  });

  it("renewSubscription失敗時はE-SUB02（ポーリングフォールバックへの言及付き）を投げる", async () => {
    const fetchImpl: FetchLike = async () => new Response("", { status: 404 });
    const client = new GraphClient(tokenProvider, fetchImpl, undefined, {
      maxRetries: 0,
      initialDelayMs: 1,
      maxDelayMs: 1,
    });
    await expect(client.renewSubscription("sub-1", "2026-07-06T10:00:00Z")).rejects.toThrow(/E-SUB02/);
  });
});
