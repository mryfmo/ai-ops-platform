/**
 * packages/server/tests/auditActor.test.ts
 *
 * 根拠: DevOps:SPEC-INT-010。監査actorのtrust boundary validationを検証する。
 */
import { describe, expect, it } from "vitest";
import { normalizeAuditActor } from "../src/lib/auditActor.js";

describe("normalizeAuditActor [DevOps:SPEC-INT-010]", () => {
  it("許可文字の識別子をtrimして返す [DevOps:SPEC-INT-010]", () => {
    expect(normalizeAuditActor(" operator@example.com ")).toBe("operator@example.com");
  });

  it.each(["", "operator name", "operator\nforged", "a".repeat(65)])(
    "不正な識別子 %j を拒否する [DevOps:SPEC-INT-010]",
    (actor) => {
      expect(() => normalizeAuditActor(actor)).toThrow("valid actor identifier");
    },
  );
});
