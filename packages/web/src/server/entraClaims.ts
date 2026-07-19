/**
 * packages/web/src/server/entraClaims.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054。
 * Auth.js の OIDC 検証後だけを入力とし、Entra claims を非 PII の stable subject へ正規化する。
 */
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntraCaller {
  subject: {
    tenantId: string;
    objectId: string;
  };
  roles: string[];
}

export interface ValidatedEntraClaims {
  tid?: unknown;
  oid?: unknown;
  roles?: unknown;
}

export class EntraClaimsError extends Error {
  public constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "EntraClaimsError";
  }
}

function canonicalUuid(value: unknown): string | undefined {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined;
}

function canonicalRoles(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new EntraClaimsError("E-AUTH01: malformed Entra roles", 401);

  const roles: string[] = [];
  const exact = new Set<string>();
  const folded = new Map<string, string>();
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new EntraClaimsError("E-AUTH01: malformed Entra roles", 401);
    }
    const role = entry.trim();
    const previous = folded.get(role.toLowerCase());
    if (previous !== undefined && previous !== role) {
      throw new EntraClaimsError("E-AUTH01: ambiguous Entra roles", 401);
    }
    folded.set(role.toLowerCase(), role);
    if (!exact.has(role)) {
      exact.add(role);
      roles.push(role);
    }
  }
  return roles;
}

export function canonicalizeValidatedEntraClaims(
  claims: ValidatedEntraClaims,
  configuredTenantId: unknown,
): EntraCaller {
  const expectedTenantId = canonicalUuid(configuredTenantId);
  const tenantId = canonicalUuid(claims.tid);
  const objectId = canonicalUuid(claims.oid);
  if (!expectedTenantId || !tenantId || !objectId) {
    throw new EntraClaimsError("E-AUTH01: missing or malformed Entra subject", 401);
  }
  if (tenantId !== expectedTenantId) {
    throw new EntraClaimsError("E-AUTH02: foreign Entra tenant", 403);
  }
  return { subject: { tenantId, objectId }, roles: canonicalRoles(claims.roles) };
}

export function toEntraJwt(token: JWT, profile: Record<string, unknown> | undefined, configuredTenantId: unknown): JWT {
  const claims = profile ?? {
    tid: token.entraTenantId,
    oid: token.entraObjectId,
    roles: token.entraRoles,
  };
  const caller = canonicalizeValidatedEntraClaims(
    { tid: claims.tid, oid: claims.oid, roles: claims.roles },
    configuredTenantId,
  );
  return {
    entraTenantId: caller.subject.tenantId,
    entraObjectId: caller.subject.objectId,
    entraRoles: caller.roles,
  };
}

export function toEntraSession(session: Session, token: JWT, configuredTenantId: unknown): Session {
  const caller = canonicalizeValidatedEntraClaims(
    {
      tid: token.entraTenantId,
      oid: token.entraObjectId,
      roles: token.entraRoles,
    },
    configuredTenantId,
  );
  return { expires: session.expires, user: caller };
}
