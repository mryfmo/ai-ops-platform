/**
 * packages/server/tests/graphSubscriptionPolicy.test.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-001。Microsoft Graph v1.0 chatMessage subscription policy,
 * checked 2026-07-11: https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0
 */
import { describe, expect, it } from "vitest";
import {
  buildGraphChatMessageResource,
  computeGraphSubscriptionExpiration,
  isGraphSubscriptionRenewalDue,
} from "../src/lib/graphSubscriptionPolicy.js";

const NOW = new Date("2026-07-11T00:00:00.000Z");

describe("graphSubscriptionPolicy (ADR-0005 / SPEC-INT-001)", () => {
  it("canonical resourceと4,320分上限内の5分buffer付きexpiryを作る", () => {
    expect(buildGraphChatMessageResource(" team-1 ", " channel-1 ")).toBe("/teams/team-1/channels/channel-1/messages");
    expect(computeGraphSubscriptionExpiration(NOW)).toBe("2026-07-13T23:55:00.000Z");
  });

  it.each([
    ["now", NOW, false],
    ["+1h", new Date("2026-07-11T01:00:00.000Z"), false],
    ["+45h", new Date("2026-07-12T21:00:00.000Z"), false],
    ["near expiry", new Date("2026-07-13T17:55:00.000Z"), true],
    ["expired", new Date("2026-07-14T00:00:00.000Z"), true],
  ])("%s のrenew判定", (_label, clock, expected) => {
    const expiresAt = computeGraphSubscriptionExpiration(NOW);
    expect(isGraphSubscriptionRenewalDue(expiresAt, clock)).toBe(expected);
  });

  it("internal whitespace/separatorを含むteam/channel IDを拒否する", () => {
    expect(() => buildGraphChatMessageResource("bad team", "channel")).toThrow(/canonical/);
    expect(() => buildGraphChatMessageResource("team", "bad/channel")).toThrow(/canonical/);
  });

  it("forward jump後もloss前にrenew対象となり、新expiryはjump時点のcap内", () => {
    const oldExpiry = computeGraphSubscriptionExpiration(NOW);
    const jumped = new Date("2026-07-13T20:00:00.000Z");
    expect(isGraphSubscriptionRenewalDue(oldExpiry, jumped)).toBe(true);
    const renewedExpiry = computeGraphSubscriptionExpiration(jumped);
    expect(new Date(renewedExpiry).getTime()).toBeGreaterThan(new Date(oldExpiry).getTime());
    expect(new Date(renewedExpiry).getTime() - jumped.getTime()).toBeLessThanOrEqual(4_320 * 60_000);
  });

  it.each([
    ["", "channel"],
    ["   ", "channel"],
    ["team", ""],
    ["team", "   "],
  ])("blank team/channelを拒否する", (teamId, channelId) => {
    expect(() => buildGraphChatMessageResource(teamId, channelId)).toThrow(/teamId|channelId/);
  });
});
