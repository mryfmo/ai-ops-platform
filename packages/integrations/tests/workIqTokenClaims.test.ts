// 根拠: ADR-0024
import { describe, expect, it } from "vitest";

import { WORKIQ_DELEGATED_SCOPE, WORKIQ_RESOURCE_AUDIENCE, validateWorkIqDelegatedClaims } from "../src/index.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000000";
const OTHER_TENANT_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const delegatedClaims = {
  iss: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  tid: TENANT_ID,
  aud: WORKIQ_RESOURCE_AUDIENCE,
  sub: "synthetic-user-subject",
  scp: WORKIQ_DELEGATED_SCOPE,
};

describe("Work IQ delegated/OBO token claims [ADR-0024]", () => {
  it.each([
    ["non-object claims", null, TENANT_ID],
    ["non-tenant configuration", delegatedClaims, "common"],
  ])("rejects malformed validation input: %s", (_label, claims, tenantId) => {
    expect(() => validateWorkIqDelegatedClaims(claims, tenantId)).toThrow(
      "E-WIQ01: invalid Work IQ token validation input",
    );
  });

  it("accepts the exact delegated Work IQ claim contract", () => {
    expect(validateWorkIqDelegatedClaims(delegatedClaims, TENANT_ID)).toEqual({
      issuer: delegatedClaims.iss,
      tenantId: TENANT_ID,
      audience: WORKIQ_RESOURCE_AUDIENCE,
      subject: delegatedClaims.sub,
      scopes: [WORKIQ_DELEGATED_SCOPE],
    });
  });

  it.each([
    ["roles-only", { ...delegatedClaims, scp: undefined, roles: ["WorkIQAgent.Ask"] }],
    ["missing scp", { ...delegatedClaims, scp: undefined }],
    ["empty scp", { ...delegatedClaims, scp: " " }],
  ])("rejects app-only shape: %s", (_label, claims) => {
    expect(() => validateWorkIqDelegatedClaims(claims, TENANT_ID)).toThrow(
      "E-WIQ02: Work IQ requires a delegated scp claim; app-only tokens are forbidden",
    );
  });

  it("rejects audience mix-up", () => {
    expect(() =>
      validateWorkIqDelegatedClaims({ ...delegatedClaims, aud: "https://graph.microsoft.com" }, TENANT_ID),
    ).toThrow("E-WIQ05: Work IQ token audience mismatch");
  });

  it("rejects tenant mix-up", () => {
    expect(() => validateWorkIqDelegatedClaims({ ...delegatedClaims, tid: OTHER_TENANT_ID }, TENANT_ID)).toThrow(
      "E-WIQ04: Work IQ token tenant mismatch",
    );
  });

  it("rejects issuer mix-up", () => {
    expect(() =>
      validateWorkIqDelegatedClaims(
        { ...delegatedClaims, iss: `https://login.microsoftonline.com/${OTHER_TENANT_ID}/v2.0` },
        TENANT_ID,
      ),
    ).toThrow("E-WIQ03: Work IQ token issuer mismatch");
  });

  it("rejects a missing delegated subject", () => {
    expect(() => validateWorkIqDelegatedClaims({ ...delegatedClaims, sub: " " }, TENANT_ID)).toThrow(
      "E-WIQ06: Work IQ token subject is missing",
    );
  });

  it("rejects scopes beyond the least-privilege contract", () => {
    expect(() =>
      validateWorkIqDelegatedClaims(
        { ...delegatedClaims, scp: `${WORKIQ_DELEGATED_SCOPE} WorkIQAgent.Write` },
        TENANT_ID,
      ),
    ).toThrow("E-WIQ07: Work IQ token scopes exceed the delegated allowlist");
  });
});
