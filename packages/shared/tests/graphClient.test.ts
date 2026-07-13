import { describe, it, expect, vi } from "vitest";
import {
  GraphClient,
  fetchWithBackoff,
  type FetchLike,
  type GraphAccessPolicy,
  type GraphTokenProvider,
} from "../src/clients/graphClient.js";

const tokenProvider: GraphTokenProvider = { getAccessToken: async () => "fake-graph-token" };
const accessPolicy: GraphAccessPolicy = {
  allowedTeamIds: ["team/a", "team-1"],
  allowedFromMailboxes: ["m@example.com", "prjops-system@example.com"],
};

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

  it("non-idempotent POSTは500を再送しない", async () => {
    let calls = 0;
    const res = await fetchWithBackoff(
      async () => ((calls += 1), new Response("", { status: 500 })),
      "https://example.test/send",
      { method: "POST" },
      { maxRetries: 2, sleep: async () => {} },
      "non-idempotent",
    );
    expect(res.status).toBe(500);
    expect(calls).toBe(1);
  });

  it("non-idempotent POSTは429のvalid Retry-Afterをcapせず待って再送する", async () => {
    let calls = 0;
    const waits: number[] = [];
    const res = await fetchWithBackoff(
      async () =>
        ++calls === 1
          ? new Response("", { status: 429, headers: { "Retry-After": "901" } })
          : new Response("", { status: 202 }),
      "https://example.test/send",
      { method: "POST" },
      { maxRetries: 1, maxDelayMs: 15 * 60_000, sleep: async (ms) => void waits.push(ms) },
      "non-idempotent",
    );
    expect(res.status).toBe(202);
    expect(calls).toBe(2);
    expect(waits).toEqual([901_000]);
  });

  it.each(["invalid", "NaN", "-1", "1e3", "0x10", "1.5", "9".repeat(400), ""])(
    "不正Retry-After=%jはjitter backoff後に再送する",
    async (value) => {
      let calls = 0;
      const waits: number[] = [];
      await fetchWithBackoff(
        async () =>
          ++calls === 1
            ? new Response("", { status: 429, headers: { "Retry-After": value } })
            : new Response("", { status: 200 }),
        "https://example.test/read",
        { method: "GET" },
        { initialDelayMs: 1_000, sleep: async (ms) => void waits.push(ms), random: () => 0.5 },
      );
      expect(waits).toEqual([1_000]);
    },
  );

  it("fallback jitterはmaxDelayを超えずinitialDelayも先に制約する", async () => {
    let calls = 0;
    const waits: number[] = [];
    await fetchWithBackoff(
      async () => (++calls === 1 ? new Response("", { status: 429 }) : new Response("", { status: 200 })),
      "https://example.test/read",
      { method: "GET" },
      { initialDelayMs: 2_000, maxDelayMs: 1_000, sleep: async (ms) => void waits.push(ms), random: () => 1 },
    );
    expect(waits).toEqual([1_000]);
  });

  it("native sleepはsetTimeout上限を超えるvalid Retry-Afterを分割して全量待つ", async () => {
    vi.useFakeTimers();
    try {
      const maxTimeoutMs = 2_147_483_647;
      const retryAfterSeconds = 2_147_485;
      const totalWaitMs = retryAfterSeconds * 1_000;
      let calls = 0;
      const pending = fetchWithBackoff(
        async () =>
          ++calls === 1
            ? new Response("", { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } })
            : new Response("", { status: 200 }),
        "https://example.test/read",
        { method: "GET" },
        { maxRetries: 1 },
      );

      await vi.advanceTimersByTimeAsync(maxTimeoutMs);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(totalWaitMs - maxTimeoutMs);
      await expect(pending).resolves.toMatchObject({ status: 200 });
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("injected sleepはsetTimeout上限を超えるvalid Retry-Afterの総量を1回で受け取る", async () => {
    const waits: number[] = [];
    let calls = 0;
    const retryAfterSeconds = 2_147_485;
    await fetchWithBackoff(
      async () =>
        ++calls === 1
          ? new Response("", { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } })
          : new Response("", { status: 200 }),
      "https://example.test/read",
      { method: "GET" },
      { maxRetries: 1, sleep: async (ms) => void waits.push(ms) },
    );
    expect(waits).toEqual([retryAfterSeconds * 1_000]);
  });
});

describe("GraphClient [SPEC-EXT-010/011/012/024, REQ-018, SPEC-INT-062]", () => {
  it.each([
    ["team allowlist外", { teamId: "team-2", channelId: "channel-1" }],
    ["empty team", { teamId: "   ", channelId: "channel-1" }],
    ["team IDはcase-sensitive exact match", { teamId: "TEAM-1", channelId: "channel-1" }],
  ])("sendAdaptiveCardは%sをtoken/fetch前に拒否する", async (_label, target) => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      { getAccessToken: async () => ((tokenRequested = true), "unexpected") },
      async () => ((fetched = true), new Response("{}", { status: 201 })),
      undefined,
      {},
      undefined,
      accessPolicy,
    );
    await expect(client.sendAdaptiveCard({ target, card: { body: [], actions: [] } })).rejects.toThrow(
      /team is not allowed/i,
    );
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it.each(["other@example.com", " "])(
    "sendMailはallowlist外/empty mailboxをtoken/fetch前に拒否する: %s",
    async (fromMailbox) => {
      let tokenRequested = false;
      let fetched = false;
      const client = createGraphClient(
        { getAccessToken: async () => ((tokenRequested = true), "unexpected") },
        async () => ((fetched = true), new Response("", { status: 202 })),
        undefined,
        {},
        undefined,
        accessPolicy,
      );
      await expect(
        client.sendMail({ toEmail: "secret@example.com", subject: "secret", htmlBody: "secret", fromMailbox }),
      ).rejects.toThrow(/mailbox is not allowed/i);
      expect(tokenRequested).toBe(false);
      expect(fetched).toBe(false);
    },
  );

  it("sendMailはmailboxをtrim/lowercase正規化して送信URLに使う", async () => {
    let calledUrl = "";
    const client = createGraphClient(
      tokenProvider,
      async (url) => ((calledUrl = url), new Response("", { status: 202 })),
      undefined,
      {},
      undefined,
      accessPolicy,
    );
    await client.sendMail({
      toEmail: "recipient@example.com",
      subject: "subject",
      htmlBody: "body",
      fromMailbox: "  M@EXAMPLE.COM  ",
    });
    expect(calledUrl).toContain("/users/m%40example.com/sendMail");
  });

  it.each([
    [
      "renewSubscription",
      (client: GraphClient) => client.renewSubscription("sub-1", "2026-07-12T00:00:00Z", "db-team"),
    ],
    ["deleteSubscription", (client: GraphClient) => client.deleteSubscription("sub-1", "db-team")],
  ])("%sはallowlist外ledger teamをtoken/fetch前に拒否する", async (_name, operation) => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphClient(
      { getAccessToken: async () => ((tokenRequested = true), "unexpected") },
      async () => ((fetched = true), new Response("", { status: 200 })),
    );
    await expect(operation(client)).rejects.toThrow(/team is not allowed/i);
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it("sendAdaptiveCard はteam/channelをencodeした正規URLへAdaptive CardをPOSTし201を成功扱いする", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "msg-1" }), { status: 201 });
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    const result = await client.sendAdaptiveCard({
      target: { teamId: "  team/a  ", channelId: "  channel b  " },
      card: {
        body: [{ type: "TextBlock", text: "本番デプロイ承認依頼" }],
        actions: [],
        openUrlActions: [{ title: "承認判断", url: "https://example.test/review/1" }],
      },
    });
    expect(result.messageId).toBe("msg-1");
    expect(calls[0]!.url).toBe("https://graph.microsoft.com/v1.0/teams/team%2Fa/channels/channel%20b/messages");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(String(calls[0]!.init?.body)).toContain("application/vnd.microsoft.card.adaptive");
    const payload = JSON.parse(String(calls[0]!.init?.body));
    expect(payload.body.content).toBe(`<attachment id="${payload.attachments[0].id}"></attachment>`);
    expect(payload.attachments[0].content).toContain("Action.OpenUrl");
    expect(JSON.stringify(payload)).not.toContain("Action.Submit");
  });

  it("sendAdaptiveCard はlegacy actionsをtoken/fetch前に拒否する", async () => {
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
        return new Response("{}", { status: 201 });
      },
    );
    await expect(
      client.sendAdaptiveCard({
        target: { teamId: "team-1", channelId: "channel-1" },
        card: { body: [], actions: [{ title: "unsupported", id: "submit" }] },
      }),
    ).rejects.toThrow(/legacy actions/i);
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it.each([
    [{ title: "", url: "https://example.test/review" }, "title"],
    [{ title: "Review", url: "" }, "URL"],
    [{ title: "Review", url: "javascript:alert(1)" }, "URL"],
    [{ title: "Review", url: "data:text/plain,unsafe" }, "URL"],
    [{ title: "Review", url: "http://example.test/review" }, "URL"],
  ])("sendAdaptiveCard は不正OpenUrlをtoken/fetch前に拒否する: %s", async (action, field) => {
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
        return new Response("{}", { status: 201 });
      },
    );
    await expect(
      client.sendAdaptiveCard({
        target: { teamId: "team-1", channelId: "channel-1" },
        card: { body: [], actions: [], openUrlActions: [action] },
      }),
    ).rejects.toThrow(new RegExp(field, "i"));
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it.each([
    [{ teamId: undefined as unknown as string, channelId: "channel-1" }, "teamId"],
    [{ teamId: "", channelId: "channel-1" }, "teamId"],
    [{ teamId: "   ", channelId: "channel-1" }, "teamId"],
    [{ teamId: "team-1", channelId: undefined as unknown as string }, "channelId"],
    [{ teamId: "team-1", channelId: "" }, "channelId"],
    [{ teamId: "team-1", channelId: "\t" }, "channelId"],
  ])("sendAdaptiveCard は空白IDをfetch前に拒否する: %s", async (target, field) => {
    let fetched = false;
    const client = createGraphClient(tokenProvider, async () => {
      fetched = true;
      return new Response(JSON.stringify({ id: "unexpected" }), { status: 201 });
    });
    await expect(client.sendAdaptiveCard({ target, card: { body: [], actions: [] } })).rejects.toThrow(field);
    expect(fetched).toBe(false);
  });

  it("sendAdaptiveCard は403を成功扱いしない", async () => {
    const client = createGraphClient(tokenProvider, async () => new Response("", { status: 403 }));
    await expect(
      client.sendAdaptiveCard({
        target: { teamId: "team-1", channelId: "channel-1" },
        card: { body: [], actions: [] },
      }),
    ).rejects.toThrow(/E-DLV02.*403/);
  });

  it("sendMail はHTML本文をtoRecipientsへ送信する", async () => {
    let capturedBody = "";
    const fetchImpl: FetchLike = async (url, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response("", { status: 202 });
    };
    const client = createGraphClient(tokenProvider, fetchImpl);
    await client.sendMail({
      toEmail: "pm@example.com",
      subject: "【進捗報告依頼】サンプル案件 (PJ-001) 2026-07-06週",
      htmlBody: "<html><body>本文</body></html>",
      fromMailbox: "prjops-system@example.com",
    });
    const parsed = JSON.parse(capturedBody);
    expect(parsed.message.toRecipients[0].emailAddress.address).toBe("pm@example.com");
    expect(parsed.message.subject).toContain("進捗報告依頼");
    expect(parsed).not.toHaveProperty("saveToSentItems");
  });

  it.each([
    [
      "sendMail",
      200,
      (client: GraphClient) =>
        client.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "b", fromMailbox: "m@example.com" }),
    ],
    [
      "sendAdaptiveCard",
      200,
      (client: GraphClient) =>
        client.sendAdaptiveCard({
          target: { teamId: "team-1", channelId: "channel-1" },
          card: { body: [], actions: [] },
        }),
    ],
    [
      "renewSubscription",
      204,
      (client: GraphClient) => client.renewSubscription("sub-1", "2026-07-12T00:00:00Z", "team-1"),
    ],
  ])("%sはstatus %iを成功扱いしない", async (_name, status, operation) => {
    const client = createGraphClient(tokenProvider, async () => new Response("{}", { status }));
    await expect(operation(client)).rejects.toThrow();
  });

  it("sendMailは500を再POSTせず、429だけを指定待機後に再送する", async () => {
    let calls = 0;
    const waits: number[] = [];
    const failed = createGraphClient(
      tokenProvider,
      async () => ((calls += 1), new Response("", { status: 500 })),
      undefined,
      { maxRetries: 2, sleep: async () => {} },
    );
    await expect(
      failed.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "b", fromMailbox: "m@example.com" }),
    ).rejects.toThrow(/500/);
    expect(calls).toBe(1);

    calls = 0;
    const throttled = createGraphClient(
      tokenProvider,
      async () =>
        ++calls === 1
          ? new Response("", { status: 429, headers: { "Retry-After": "2" } })
          : new Response("", { status: 202 }),
      undefined,
      { maxRetries: 1, sleep: async (ms: number) => void waits.push(ms) },
    );
    await throttled.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "b", fromMailbox: "m@example.com" });
    expect(calls).toBe(2);
    expect(waits).toEqual([2_000]);
  });

  it("requestごとのUUIDとresponse correlation metadataだけをobserverへ渡す", async () => {
    const observed: unknown[] = [];
    const requestIds = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
    const sentIds: string[] = [];
    const client = new GraphClient(
      tokenProvider,
      async (_url, init) => {
        sentIds.push(new Headers(init?.headers).get("client-request-id") ?? "");
        return new Response(JSON.stringify({ id: "msg-1" }), {
          status: 200,
          headers: {
            "request-id": "10000000-0000-4000-8000-000000000001",
            date: "Sat, 11 Jul 2026 00:00:00 GMT",
          },
        });
      },
      undefined,
      undefined,
      undefined,
      accessPolicy,
      (metadata) => observed.push(metadata),
      () => requestIds.shift()!,
    );
    await client.getChannelMessage({ teamId: "team-1", channelId: "channel-secret" }, "message-secret");
    await client.getChannelMessage({ teamId: "team-1", channelId: "channel-secret" }, "message-secret");
    expect(sentIds).toEqual(["00000000-0000-4000-8000-000000000000", "00000000-0000-4000-8000-000000000001"]);
    expect(observed).toEqual([
      {
        clientRequestId: sentIds[0],
        requestId: "10000000-0000-4000-8000-000000000001",
        date: "Sat, 11 Jul 2026 00:00:00 GMT",
        status: 200,
      },
      {
        clientRequestId: sentIds[1],
        requestId: "10000000-0000-4000-8000-000000000001",
        date: "Sat, 11 Jul 2026 00:00:00 GMT",
        status: 200,
      },
    ]);
    expect(JSON.stringify(observed)).not.toMatch(
      /channel-secret|message-secret|fake-graph-token|graph\.microsoft\.com/i,
    );
  });

  it("observer例外は完了したHTTP操作を失敗させず再送もしない", async () => {
    let calls = 0;
    const client = new GraphClient(
      tokenProvider,
      async () => ((calls += 1), new Response("", { status: 202 })),
      undefined,
      { maxRetries: 2 },
      undefined,
      accessPolicy,
      () => {
        throw new Error("observer failed");
      },
    );
    await expect(
      client.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "b", fromMailbox: "m@example.com" }),
    ).resolves.toBeUndefined();
    expect(calls).toBe(1);
  });

  it("async observer rejectionはunhandledRejectionにせずHTTP結果を変えない", async () => {
    let calls = 0;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const client = new GraphClient(
        tokenProvider,
        async () => ((calls += 1), new Response("", { status: 202 })),
        undefined,
        { maxRetries: 2 },
        undefined,
        accessPolicy,
        async () => {
          throw new Error("async observer failed");
        },
      );
      await expect(
        client.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "b", fromMailbox: "m@example.com" }),
      ).resolves.toBeUndefined();
      await new Promise((resolve) => setImmediate(resolve));
      expect(calls).toBe(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("faulty ID providerでもretry attemptごとに一意UUIDを付け、PII response metadataをnull化する", async () => {
    let calls = 0;
    const sentIds: string[] = [];
    const observed: Array<{ clientRequestId: string; requestId: string | null; date: string | null }> = [];
    const client = new GraphClient(
      tokenProvider,
      async (_url, init) => {
        sentIds.push(new Headers(init?.headers).get("client-request-id") ?? "");
        return ++calls === 1
          ? new Response("", {
              status: 429,
              headers: { "Retry-After": "0", "request-id": "person@example.com", date: "private date" },
            })
          : new Response(JSON.stringify({ id: "msg-1" }), {
              status: 200,
              headers: { "request-id": "person@example.com", date: "private date" },
            });
      },
      undefined,
      { maxRetries: 1, sleep: async () => {} },
      undefined,
      accessPolicy,
      (metadata) => observed.push(metadata),
      () => "00000000-0000-4000-8000-000000000001",
    );
    await client.getChannelMessage({ teamId: "team-1", channelId: "channel-secret" }, "message-secret");
    expect(sentIds).toHaveLength(2);
    expect(new Set(sentIds).size).toBe(2);
    expect(
      sentIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
    ).toBe(true);
    expect(observed.map(({ clientRequestId, requestId, date }) => ({ clientRequestId, requestId, date }))).toEqual([
      { clientRequestId: sentIds[0], requestId: null, date: null },
      { clientRequestId: sentIds[1], requestId: null, date: null },
    ]);
  });

  it("faulty ID providerでも10,000 attemptsのUUIDを一意にし履歴Setを増やさない", async () => {
    const sentIds: string[] = [];
    const client = new GraphClient(
      tokenProvider,
      async (_url, init) => {
        sentIds.push(new Headers(init?.headers).get("client-request-id") ?? "");
        return new Response("{}", { status: 200 });
      },
      undefined,
      undefined,
      undefined,
      accessPolicy,
      undefined,
      () => "00000000-0000-4000-8000-000000000001",
    );
    const setSizesBefore = Object.values(client)
      .filter((value): value is Set<unknown> => value instanceof Set)
      .map((set) => set.size);

    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      await client.getChannelMessage({ teamId: "team-1", channelId: "channel-1" }, `message-${attempt}`);
    }

    expect(new Set(sentIds).size).toBe(10_000);
    expect(
      sentIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
    ).toBe(true);
    expect(
      Object.values(client)
        .filter((value): value is Set<unknown> => value instanceof Set)
        .map((set) => set.size),
    ).toEqual(setSizesBefore);
  });

  it("GETは201、DELETEは200を拒否し、cleanup 404だけは成功扱いする", async () => {
    const getClient = createGraphClient(tokenProvider, async () => new Response("{}", { status: 201 }));
    await expect(getClient.getChannelMessage({ teamId: "team-1", channelId: "channel-1" }, "msg-1")).rejects.toThrow(
      /201/,
    );
    const deleteClient = createGraphClient(tokenProvider, async () => new Response("", { status: 200 }));
    await expect(deleteClient.deleteSubscription("sub-1", "team-1")).rejects.toMatchObject({ status: 200 });
    const missingClient = createGraphClient(tokenProvider, async () => new Response("", { status: 404 }));
    await expect(missingClient.deleteSubscription("sub-1", "team-1")).resolves.toBeUndefined();
  });

  it("sendMail失敗時はE-DLV01を投げる", async () => {
    const fetchImpl: FetchLike = async () => new Response("", { status: 500 });
    const client = createGraphClient(tokenProvider, fetchImpl, undefined, {
      maxRetries: 0,
      initialDelayMs: 1,
      maxDelayMs: 1,
    });
    await expect(
      client.sendMail({ toEmail: "x@example.com", subject: "s", htmlBody: "<p/>", fromMailbox: "m@example.com" }),
    ).rejects.toThrow(/E-DLV01/);
  });

  it("renewSubscription失敗時はstructured E-SUB02/statusを投げる", async () => {
    const fetchImpl: FetchLike = async () => new Response("", { status: 404 });
    const client = createGraphClient(tokenProvider, fetchImpl, undefined, {
      maxRetries: 0,
      initialDelayMs: 1,
      maxDelayMs: 1,
    });
    await expect(client.renewSubscription("sub-1", "2026-07-06T10:00:00Z", "team-1")).rejects.toMatchObject({
      code: "E-SUB02",
      status: 404,
    });
  });

  it("deleteSubscriptionはbounded cleanup DELETEを送り失敗をstructured化する", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const client = createGraphClient(
      tokenProvider,
      async (url, init) => {
        calls.push({ url: String(url), method: init?.method });
        return new Response("", { status: 503 });
      },
      undefined,
      { maxRetries: 0 },
    );
    await expect(client.deleteSubscription("new-sub", "team-1")).rejects.toMatchObject({
      code: "E-SUB03",
      status: 503,
    });
    expect(calls).toEqual([{ url: "https://graph.microsoft.com/v1.0/subscriptions/new-sub", method: "DELETE" }]);
  });
});
