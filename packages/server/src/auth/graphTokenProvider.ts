/**
 * packages/server/src/auth/graphTokenProvider.ts
 *
 * 根拠: DevOps:SPEC-INT-062 / ADR-0005（Microsoft Graph アプリケーション権限 client credentials flow）。
 * MSAL Nodeのapplication token cacheへ委譲し、wrapperは同時取得だけをsingle-flightする。
 */
import type { GraphAppOnlyToken, GraphTokenProvider } from "@aiops/shared";
import { ConfidentialClientApplication } from "@azure/msal-node";

export interface ClientCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface ConfidentialClientApplicationCompatible {
  acquireTokenByClientCredential(request: { scopes: string[] }): Promise<{
    accessToken?: string;
    expiresOn?: Date | null;
  } | null>;
}

const GRAPH_DEFAULT_SCOPE = "https://graph.microsoft.com/.default";
const AUTH_ERROR = "E-AUTH01: Graph token acquisition failed";

export function createMsalGraphTokenProvider(
  creds: ClientCredentials,
  client: ConfidentialClientApplicationCompatible = new ConfidentialClientApplication({
    auth: {
      authority: `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}`,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    },
  }),
  nowProvider: () => number = () => Date.now(),
): GraphTokenProvider {
  let inflight: Promise<GraphAppOnlyToken> | null = null;

  async function acquire(): Promise<GraphAppOnlyToken> {
    try {
      const result = await client.acquireTokenByClientCredential({ scopes: [GRAPH_DEFAULT_SCOPE] });
      const expiresAt = result?.expiresOn?.getTime();
      if (
        typeof result?.accessToken !== "string" ||
        !/^\S+$/u.test(result.accessToken) ||
        expiresAt === undefined ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= nowProvider()
      ) {
        throw new Error(AUTH_ERROR);
      }
      return result.accessToken as GraphAppOnlyToken;
    } catch {
      throw new Error(AUTH_ERROR);
    }
  }

  return {
    async getAccessToken(): Promise<GraphAppOnlyToken> {
      if (inflight) return inflight;
      inflight = acquire();
      try {
        return await inflight;
      } finally {
        inflight = null;
      }
    },
  };
}
