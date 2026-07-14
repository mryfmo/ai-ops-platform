import { describe, it, expect } from "vitest";
import {
  createGraphSubscriptionClient,
  createGraphSubscriptionFromCliArgs,
  parseCreateSubscriptionArgs,
} from "../src/tools/createGraphSubscription.js";

describe("createGraphSubscription CLI [PrjOps:REQ-042 SPEC-INT-069]", () => {
  it("production clientはallowlist外teamをtoken/fetch前に拒否する", async () => {
    let tokenRequested = false;
    let fetched = false;
    const client = createGraphSubscriptionClient(
      { getAccessToken: async () => ((tokenRequested = true), "unexpected") },
      { GRAPH_ALLOWED_TEAM_IDS: ["team-1"], GRAPH_ALLOWED_FROM_MAILBOXES: ["reports@example.com"] },
      async () => ((fetched = true), new Response("{}", { status: 201 })),
    );
    await expect(
      createGraphSubscriptionFromCliArgs(
        { teamId: "db-team", channelId: "channel-1", notificationUrl: "https://example.test/hook" },
        client,
        "client-state-of-at-least-32-chars",
        undefined,
        new Date("2026-07-11T00:00:00Z"),
      ),
    ).rejects.toThrow(/team is not allowed/i);
    expect(tokenRequested).toBe(false);
    expect(fetched).toBe(false);
  });

  it("teamId/channelId/notificationUrlだけをパースする", () => {
    expect(
      parseCreateSubscriptionArgs([
        "--teamId",
        " team-1 ",
        "--channelId",
        " channel-1 ",
        "--notificationUrl",
        "https://aiops.example.com/webhooks/graph",
      ]),
    ).toEqual({
      teamId: "team-1",
      channelId: "channel-1",
      notificationUrl: "https://aiops.example.com/webhooks/graph",
    });
  });

  it.each([
    [["--teamId", "t", "--channelId", "c"], "missing"],
    [["--teamId", "t", "--channelId", "c", "--notificationUrl", "http://example.test/hook"], "HTTPS"],
    [
      ["--teamId", "t", "--channelId", "c", "--notificationUrl", "https://example.test/hook", "--expiry", "x"],
      "unknown",
    ],
    [
      ["--teamId", "t", "--teamId", "t2", "--channelId", "c", "--notificationUrl", "https://example.test/hook"],
      "duplicate",
    ],
    [["--teamId", "t", "--channelId", "c", "--notificationUrl", "https://example.test/hook", "extra"], "usage"],
  ])("不正・unknown・extra argsを拒否する: %s", (argv, message) => {
    expect(() => parseCreateSubscriptionArgs(argv)).toThrow(new RegExp(message, "i"));
  });

  it("canonical resourceとpolicy expiryを送り、Graph返却expiryをteam/channel付きで保存する", async () => {
    const calls: unknown[] = [];
    const persisted: unknown[] = [];
    const result = await createGraphSubscriptionFromCliArgs(
      {
        teamId: "team-1",
        channelId: "channel-1",
        notificationUrl: "https://aiops.example.com/webhooks/graph",
      },
      {
        createSubscription: async (...args) => {
          calls.push(args);
          return { id: "sub-1", expirationDateTime: "2026-07-13T23:54:58Z" };
        },
      },
      "client-state-of-at-least-32-chars",
      { upsert: async (sub) => persisted.push(sub) },
      new Date("2026-07-11T00:00:00Z"),
    );
    expect(result.id).toBe("sub-1");
    expect(calls[0]).toEqual([
      "/teams/team-1/channels/channel-1/messages",
      "https://aiops.example.com/webhooks/graph",
      "2026-07-13T23:55:00.000Z",
      {
        clientState: "client-state-of-at-least-32-chars",
        changeType: "created,updated,deleted",
        lifecycleNotificationUrl: "https://aiops.example.com/webhooks/graph",
      },
    ]);
    expect(persisted).toEqual([
      {
        subscriptionId: "sub-1",
        resource: "/teams/team-1/channels/channel-1/messages",
        teamId: "team-1",
        channelId: "channel-1",
        expiresAt: "2026-07-13T23:54:58Z",
        mode: "notification",
      },
    ]);
  });

  it.each(["2026-07-13", "2026-07-13 23:55:00Z", "2026-07-14T00:00:01Z"])(
    "不正なGraph返却expiryを台帳保存前に拒否する: %s",
    async (expirationDateTime) => {
      const persisted: unknown[] = [];
      await expect(
        createGraphSubscriptionFromCliArgs(
          {
            teamId: "team-1",
            channelId: "channel-1",
            notificationUrl: "https://aiops.example.com/webhooks/graph",
          },
          { createSubscription: async () => ({ id: "sub-1", expirationDateTime }) },
          "client-state-of-at-least-32-chars",
          { upsert: async (sub) => persisted.push(sub) },
          new Date("2026-07-11T00:00:00Z"),
        ),
      ).rejects.toThrow(/expiration/i);
      expect(persisted).toEqual([]);
    },
  );
});
