/**
 * packages/server/tests/reportDeliveryAudience.test.ts
 *
 * 根拠: PrjOps:REQ-042 / PrjOps:SPEC-INT-069。受信者プロファイルから配信audienceを決める
 *   判定を検証する。所見 ADV-SEC-009（未知プロファイルのfail-open）。
 */
import { describe, expect, it } from "vitest";
import { audienceForRecipient } from "../src/scheduler/tasks/reportDeliveryTask.js";

const recipient = (profile: string, persona?: string) =>
  ({ userId: "u1", profile, persona, email: "a@example.com", active: true, projects: ["PJ-1"] }) as never;

describe("audienceForRecipient [PrjOps:REQ-042 / PrjOps:SPEC-INT-069]", () => {
  it.each([
    ["PRF-M", "PRF-01"],
    ["PRF-L", "PRF-02"],
    ["PRF-G", "PRF-04"],
  ])("DevOpsプロファイル %s を %s へ対応付ける [PrjOps:SPEC-INT-069]", (profile, expected) => {
    // 従来これらは未知扱いで PRF-03（配下の全情報）へ格上げされていた。明示対応は権限を締める方向。
    expect(audienceForRecipient(recipient(profile))).toBe(expected);
  });

  it.each(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"])(
    "PrjOpsプロファイル %s はそのまま通す [PrjOps:SPEC-INT-069]",
    (profile) => {
      expect(audienceForRecipient(recipient(profile))).toBe(profile);
    },
  );

  it("investorペルソナはprofileより優先する [PrjOps:REQ-042]", () => {
    expect(audienceForRecipient(recipient("PRF-01", "investor"))).toBe("investor");
  });

  it("未知プロファイルはnullを返す（既定値を当てて配信しない） [PrjOps:SPEC-INT-069]", () => {
    expect(audienceForRecipient(recipient("PRF-UNKNOWN"))).toBeNull();
  });
});

describe("audienceForRecipient の継承プロパティ耐性 [PrjOps:SPEC-INT-069]", () => {
  // recipients の profile 制約は NOT VALID で入っており、旧行に任意の文字列が残り得る。
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"])(
    "Object.prototype の %s をプロファイルとして受け付けない [PrjOps:SPEC-INT-069]",
    (profile) => {
      expect(audienceForRecipient(recipient(profile))).toBeNull();
    },
  );
});
