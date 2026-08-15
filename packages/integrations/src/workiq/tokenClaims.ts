// 根拠: ADR-0024

export const WORKIQ_RESOURCE_AUDIENCE = "api://workiq.svc.cloud.microsoft";
export const WORKIQ_DELEGATED_SCOPE = "WorkIQAgent.Ask";

export interface ValidatedWorkIqDelegatedClaims {
  readonly issuer: string;
  readonly tenantId: string;
  readonly audience: typeof WORKIQ_RESOURCE_AUDIENCE;
  readonly subject: string;
  readonly scopes: readonly [typeof WORKIQ_DELEGATED_SCOPE];
}

const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates claims from an already signature- and lifetime-verified Entra access token.
 * The contract is deliberately exact: Work IQ has no application-token fallback.
 */
export function validateWorkIqDelegatedClaims(
  claims: unknown,
  expectedTenantId: string,
): ValidatedWorkIqDelegatedClaims {
  if (!TENANT_ID_PATTERN.test(expectedTenantId) || !isRecord(claims)) {
    throw new Error("E-WIQ01: invalid Work IQ token validation input");
  }

  if (typeof claims.scp !== "string" || claims.scp.trim() === "") {
    throw new Error("E-WIQ02: Work IQ requires a delegated scp claim; app-only tokens are forbidden");
  }

  const expectedIssuer = `https://login.microsoftonline.com/${expectedTenantId}/v2.0`;
  if (claims.iss !== expectedIssuer) throw new Error("E-WIQ03: Work IQ token issuer mismatch");
  if (claims.tid !== expectedTenantId) throw new Error("E-WIQ04: Work IQ token tenant mismatch");
  if (claims.aud !== WORKIQ_RESOURCE_AUDIENCE) throw new Error("E-WIQ05: Work IQ token audience mismatch");
  if (typeof claims.sub !== "string" || claims.sub.trim() === "") {
    throw new Error("E-WIQ06: Work IQ token subject is missing");
  }

  const scopes = claims.scp.trim().split(/\s+/u);
  if (scopes.length !== 1 || scopes[0] !== WORKIQ_DELEGATED_SCOPE) {
    throw new Error("E-WIQ07: Work IQ token scopes exceed the delegated allowlist");
  }

  return {
    issuer: expectedIssuer,
    tenantId: expectedTenantId,
    audience: WORKIQ_RESOURCE_AUDIENCE,
    subject: claims.sub,
    scopes: [WORKIQ_DELEGATED_SCOPE],
  };
}
