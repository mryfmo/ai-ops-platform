/**
 * packages/web/tests/entraClaims.test.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054。
 * Auth.js が検証済みの Entra claims を stable subject へ変換し、PII を session へ残さないことを検証する。
 */
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import {
  canonicalizeValidatedEntraClaims,
  EntraClaimsError,
  toEntraJwt,
  toEntraSession,
} from "../src/server/entraClaims";

const tenantId = "11111111-1111-4111-8111-111111111111";
const objectId = "22222222-2222-4222-8222-222222222222";

describe("Entra stable subject [DevOps:SPEC-INT-054]", () => {
  it("検証済み tid/oid と opaque roles を canonicalize する", () => {
    expect(
      canonicalizeValidatedEntraClaims(
        {
          tid: tenantId.toUpperCase(),
          oid: objectId.toUpperCase(),
          roles: [" Reader ", "Approver", "Reader"],
        },
        tenantId.toUpperCase(),
      ),
    ).toEqual({
      subject: { tenantId, objectId },
      roles: ["Reader", "Approver"],
    });
  });

  it.each([
    ["missing tid", { oid: objectId }],
    ["malformed tid", { tid: "not-a-uuid", oid: objectId }],
    ["missing oid", { tid: tenantId }],
    ["malformed oid", { tid: tenantId, oid: "not-a-uuid" }],
    ["non-array roles", { tid: tenantId, oid: objectId, roles: "Reader" }],
    ["blank role", { tid: tenantId, oid: objectId, roles: [" "] }],
  ])("%s は E-AUTH01 で拒否する", (_name, claims) => {
    expect(() => canonicalizeValidatedEntraClaims(claims, tenantId)).toThrow(
      expect.objectContaining<Partial<EntraClaimsError>>({ status: 401 }),
    );
  });

  it("foreign tenant は E-AUTH02 で拒否する", () => {
    expect(() =>
      canonicalizeValidatedEntraClaims(
        {
          tid: "99999999-9999-4999-8999-999999999999",
          oid: objectId,
        },
        tenantId,
      ),
    ).toThrow(expect.objectContaining<Partial<EntraClaimsError>>({ status: 403 }));
  });

  it("case-colliding role は意味を推測せず integrity error にする", () => {
    expect(() =>
      canonicalizeValidatedEntraClaims({ tid: tenantId, oid: objectId, roles: ["Reader", "reader"] }, tenantId),
    ).toThrow("E-AUTH01");
  });

  it("JWT/session から email・name・image・provider sub を除去する", () => {
    const token = toEntraJwt(
      {
        email: "person@example.com",
        name: "Person Name",
        picture: "https://example.com/person.jpg",
        sub: "provider-subject",
      },
      { tid: tenantId, oid: objectId, roles: ["Reader"] },
      tenantId,
    );
    expect(token).toEqual({
      entraTenantId: tenantId,
      entraObjectId: objectId,
      entraRoles: ["Reader"],
    });

    const session = toEntraSession(
      {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          subject: { tenantId, objectId },
          roles: [],
          email: "person@example.com",
          name: "Person Name",
          image: "https://example.com/person.jpg",
        },
      } as Session,
      token as JWT,
      tenantId,
    );
    expect(session).toEqual({
      expires: "2099-01-01T00:00:00.000Z",
      user: { subject: { tenantId, objectId }, roles: ["Reader"] },
    });
    expect(JSON.stringify(session)).not.toMatch(/person@example|Person Name|person\\.jpg|provider-subject/);
  });

  it("継続 session でも canonical claims 以外を JWT に残さない", () => {
    expect(
      toEntraJwt(
        {
          entraTenantId: tenantId,
          entraObjectId: objectId,
          entraRoles: ["Reader"],
          email: "stale@example.com",
        },
        undefined,
        tenantId,
      ),
    ).toEqual({
      entraTenantId: tenantId,
      entraObjectId: objectId,
      entraRoles: ["Reader"],
    });
  });
});
