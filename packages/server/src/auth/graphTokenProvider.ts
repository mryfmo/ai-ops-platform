/**
 * packages/server/src/auth/graphTokenProvider.ts
 *
 * 根拠: SPEC-INT-062 / ADR-0005（Microsoft Graph アプリケーション権限 client credentials flow）。
 *   msal-nodeを追加依存せず、token endpointへの直接POSTで実装（外部通信は
 *   login.microsoftonline.com / graph.microsoft.com のみ。SPEC-INT-060のallowlist内）。
 *   トークンは有効期限の60秒前までキャッシュする。
 */
import type { FetchLike, GraphTokenProvider } from "@aiops/shared";

export interface ClientCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export function createClientCredentialsTokenProvider(
  creds: ClientCredentials,
  fetchImpl: FetchLike = fetch,
  nowProvider: () => number = () => Date.now(),
): GraphTokenProvider {
  let cached: { token: string; expiresAtMs: number } | null = null;

  return {
    async getAccessToken(): Promise<string> {
      if (cached && nowProvider() < cached.expiresAtMs - 60_000) {
        return cached.token;
      }
      const res = await fetchImpl(
        `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }).toString(),
        },
      );
      if (!res.ok) {
        throw new Error(`E-AUTH01: Graph token acquisition failed with status ${res.status}`);
      }
      const json = (await res.json()) as { access_token: string; expires_in: number };
      cached = { token: json.access_token, expiresAtMs: nowProvider() + json.expires_in * 1000 };
      return cached.token;
    },
  };
}
