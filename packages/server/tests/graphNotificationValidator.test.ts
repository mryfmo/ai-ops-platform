/**
 * packages/server/tests/graphNotificationValidator.test.ts
 *
 * 根拠: ADR-0005（clientState定数時間比較・resourceパスからのID抽出）/ PrjOps:SPEC-INT-001
 */
import { describe, it, expect } from "vitest";
import {
  isValidClientState,
  parseChannelMessageResource,
  classifyNotifications,
  graphNotificationDedupeKey,
} from "../src/lib/graphNotificationValidator.js";

describe("isValidClientState (ADR-0005)", () => {
  it("一致でtrue", () => {
    expect(isValidClientState("secret-abc", "secret-abc")).toBe(true);
  });
  it("不一致・未指定でfalse", () => {
    expect(isValidClientState("secret-abc", "wrong")).toBe(false);
    expect(isValidClientState("secret-abc", undefined)).toBe(false);
    expect(isValidClientState("secret-abc", null)).toBe(false);
  });
  it("長さが異なってもfalse（例外を出さない）", () => {
    expect(isValidClientState("secret-abc", "s")).toBe(false);
  });
});

describe("parseChannelMessageResource (PrjOps:SPEC-INT-001)", () => {
  it("ルートメッセージのIDを抽出する", () => {
    const ids = parseChannelMessageResource("teams('t-1')/channels('c-1')/messages('m-1')");
    expect(ids).toEqual({ teamId: "t-1", channelId: "c-1", messageId: "m-1" });
  });
  it("スレッド返信は親メッセージIDと返信IDを区別する", () => {
    const ids = parseChannelMessageResource("teams('t-1')/channels('c-1')/messages('m-1')/replies('r-9')");
    expect(ids).toEqual({ teamId: "t-1", channelId: "c-1", messageId: "r-9", replyOfMessageId: "m-1" });
  });
  it("対象外リソースはnull", () => {
    expect(parseChannelMessageResource("users('u-1')/messages('m-1')")).toBeNull();
  });
});

describe("classifyNotifications (ADR-0005)", () => {
  it("clientState不一致をrejectedへ分離する", () => {
    const { accepted, rejected } = classifyNotifications("expected", [
      { clientState: "expected", resource: "teams('t')/channels('c')/messages('m')" },
      { clientState: "attacker", resource: "teams('t')/channels('c')/messages('x')" },
      {},
    ]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.ids?.messageId).toBe("m");
    expect(rejected).toHaveLength(2);
  });
});

describe("graphNotificationDedupeKey (PrjOps:SPEC-INT-001)", () => {
  it("notification idをexact redelivery keyとして優先する", () => {
    expect(
      graphNotificationDedupeKey({
        id: "notification-1",
        subscriptionId: "sub-1",
        resource: "teams('t')/channels('c')/messages('m')",
        changeType: "updated",
        resourceData: { "@odata.etag": "version-1" },
      }),
    ).toBe("graph:notification:notification-1");
  });

  it("idなしはsubscription/resource/changeType/etagが揃う場合だけversion keyを返す", () => {
    expect(
      graphNotificationDedupeKey({
        subscriptionId: "sub-1",
        resource: "teams('t')/channels('c')/messages('m')",
        changeType: "updated",
        resourceData: { "@odata.etag": 'W/"version-1"' },
      }),
    ).toContain('["sub-1","teams(\'t\')/channels(\'c\')/messages(\'m\')","updated","W/\\"version-1\\""]');
    expect(
      graphNotificationDedupeKey({
        subscriptionId: "sub-1",
        resource: "teams('t')/channels('c')/messages('m')",
        changeType: "updated",
      }),
    ).toBeNull();
  });
});
