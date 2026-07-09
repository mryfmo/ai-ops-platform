import { describe, it, expect } from "vitest";
import {
  createGraphSubscriptionFromCliArgs,
  parseCreateSubscriptionArgs,
} from "../src/tools/createGraphSubscription.js";

describe("createGraphSubscription CLI [REQ-042 SPEC-INT-069]", () => {
  it("resource/notificationUrl/expiryをパースする", () => {
    expect(
      parseCreateSubscriptionArgs([
        "--resource",
        "/teams/t/channels/c/messages",
        "--notificationUrl",
        "https://aiops.example.com/webhooks/graph",
        "--expiry",
        "2026-07-09T06:00:00Z",
      ]),
    ).toEqual({
      resource: "/teams/t/channels/c/messages",
      notificationUrl: "https://aiops.example.com/webhooks/graph",
      expiry: "2026-07-09T06:00:00Z",
    });
  });

  it("既存GraphClient interfaceへclientState付きで委譲する", async () => {
    const calls: unknown[] = [];
    const result = await createGraphSubscriptionFromCliArgs(
      {
        resource: "/resource",
        notificationUrl: "https://aiops.example.com/webhooks/graph",
        expiry: "2026-07-09T06:00:00Z",
      },
      {
        createSubscription: async (...args) => {
          calls.push(args);
          return { id: "sub-1" };
        },
      },
      "client-state-of-at-least-32-chars",
    );
    expect(result.id).toBe("sub-1");
    expect(JSON.stringify(calls[0])).toContain("created,updated,deleted");
    expect(JSON.stringify(calls[0])).toContain("client-state-of-at-least-32-chars");
  });
});
