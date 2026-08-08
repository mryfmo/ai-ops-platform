/**
 * packages/shared/tests/identityEnvelope.test.ts
 *
 * 根拠: DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 */
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_ENVELOPE_FUTURE_SKEW_SECONDS,
  IDENTITY_ENVELOPE_TTL_SECONDS,
  signIdentityEnvelope,
  verifyIdentityEnvelope,
} from "../src/security/identityEnvelope.js";

const SECRET = "web-bff-identity-secret-of-at-least-32-chars";
const NOW = 1_786_118_400;
const input = {
  method: "POST",
  path: "/approvals/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/decision",
  body: JSON.stringify({ decision: "approved" }),
  tenantId: "11111111-1111-4111-8111-111111111111",
  objectId: "22222222-2222-4222-8222-222222222222",
  issuedAtUnix: NOW,
};

describe("signed Entra identity envelope [DevOps:REQ-028 / DEC-SPEC-002]", () => {
  it("versioned canonical stringをHMAC-SHA256で署名する", () => {
    const bodyHash = createHash("sha256").update(input.body).digest("hex");
    const canonical = `v1|${input.method}|${input.path}|${bodyHash}|${input.tenantId}|${input.objectId}|${NOW}`;
    expect(signIdentityEnvelope(input, SECRET)).toBe(
      `sha256=${createHmac("sha256", SECRET).update(canonical).digest("hex")}`,
    );
  });

  it("完全一致だけを受理しmethod/path/body/subject改変を拒否する", () => {
    const signature = signIdentityEnvelope(input, SECRET);
    expect(verifyIdentityEnvelope(input, signature, SECRET, NOW)).toBe(true);
    for (const tampered of [
      { ...input, method: "GET" },
      { ...input, path: "/approvals" },
      { ...input, body: JSON.stringify({ decision: "rejected" }) },
      { ...input, tenantId: "33333333-3333-4333-8333-333333333333" },
      { ...input, objectId: "44444444-4444-4444-8444-444444444444" },
    ]) {
      expect(verifyIdentityEnvelope(tampered, signature, SECRET, NOW)).toBe(false);
    }
  });

  it("90秒TTL内と30秒以内の正方向clock skewだけを許可する", () => {
    expect(IDENTITY_ENVELOPE_TTL_SECONDS).toBe(90);
    expect(IDENTITY_ENVELOPE_FUTURE_SKEW_SECONDS).toBe(30);
    const signature = signIdentityEnvelope(input, SECRET);
    expect(verifyIdentityEnvelope(input, signature, SECRET, NOW + 90)).toBe(true);
    expect(verifyIdentityEnvelope(input, signature, SECRET, NOW + 91)).toBe(false);

    const future = { ...input, issuedAtUnix: NOW + 30 };
    expect(verifyIdentityEnvelope(future, signIdentityEnvelope(future, SECRET), SECRET, NOW)).toBe(true);
    const tooFarFuture = { ...input, issuedAtUnix: NOW + 31 };
    expect(verifyIdentityEnvelope(tooFarFuture, signIdentityEnvelope(tooFarFuture, SECRET), SECRET, NOW)).toBe(false);
  });

  it("malformed signature・subject・弱いsecret・canonical delimiterを拒否する", () => {
    expect(verifyIdentityEnvelope(input, "sha256=not-hex", SECRET, NOW)).toBe(false);
    expect(verifyIdentityEnvelope({ ...input, objectId: "not-a-uuid" }, "sha256=" + "0".repeat(64), SECRET, NOW)).toBe(
      false,
    );
    expect(() => signIdentityEnvelope(input, "short")).toThrow(/secret/i);
    expect(() => signIdentityEnvelope({ ...input, path: "/approvals|forged" }, SECRET)).toThrow(/canonical/i);
  });
});
