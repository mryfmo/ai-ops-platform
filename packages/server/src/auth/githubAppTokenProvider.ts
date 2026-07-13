/**
 * packages/server/src/auth/githubAppTokenProvider.ts
 *
 * 根拠: SPEC-INT-061（GitHub App JWTからinstallation tokenを取得し、有効期限前に更新する）。
 */
import { createSign, randomUUID } from "node:crypto";
import { GitHubClient, type AuditLogWriter, type GhFetchLike, type GitHubTokenProvider } from "@aiops/shared";

export interface GitHubAppCredentials {
  appId: string;
  privateKey: string;
  installationId: string;
}

export interface GitHubAuthConfig {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_INSTALLATION_ID?: string;
  GITHUB_TOKEN?: string;
}

export type GitHubAuthMode = "app" | "pat" | "disabled";

const AUTH_ERROR = "E-AUTH02: GitHub installation token acquisition failed";
const REFRESH_BUFFER_MS = 5 * 60 * 1_000;
const TOKEN_REQUEST_TIMEOUT_MS = 30_000;

export interface GitHubAppTokenProviderOptions {
  timeoutMs?: number;
  timeoutSignal?: (ms: number) => AbortSignal;
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createAppJwt(credentials: GitHubAppCredentials, nowMs: number): string {
  const nowSeconds = Math.floor(nowMs / 1_000);
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
    iss: credentials.appId,
    iat: nowSeconds - 60,
    exp: nowSeconds + 540,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(credentials.privateKey.replaceAll("\\n", "\n"), "base64url")}`;
}

export function createGitHubAppTokenProvider(
  credentials: GitHubAppCredentials,
  fetchImpl: GhFetchLike = fetch,
  nowProvider: () => number = () => Date.now(),
  options: GitHubAppTokenProviderOptions = {},
): GitHubTokenProvider {
  let cached: { token: string; expiresAt: number } | undefined;
  let inflight: Promise<string> | undefined;

  const acquire = async (): Promise<string> => {
    try {
      const jwt = createAppJwt(credentials, nowProvider());
      const response = await fetchImpl(
        `https://api.github.com/app/installations/${encodeURIComponent(credentials.installationId)}/access_tokens`,
        {
          method: "POST",
          signal: (options.timeoutSignal ?? AbortSignal.timeout)(options.timeoutMs ?? TOKEN_REQUEST_TIMEOUT_MS),
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${jwt}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (response.status !== 201) throw new Error(AUTH_ERROR);
      const body = (await response.json()) as { token?: unknown; expires_at?: unknown };
      const token = typeof body.token === "string" ? body.token : "";
      const expiresAt = typeof body.expires_at === "string" ? Date.parse(body.expires_at) : Number.NaN;
      if (!token.trim() || token !== token.trim() || !Number.isFinite(expiresAt) || expiresAt <= nowProvider()) {
        throw new Error(AUTH_ERROR);
      }
      cached = { token, expiresAt };
      return token;
    } catch {
      throw new Error(AUTH_ERROR);
    }
  };

  return {
    async getInstallationToken(): Promise<string> {
      if (cached && nowProvider() < cached.expiresAt - REFRESH_BUFFER_MS) return cached.token;
      if (!inflight) inflight = acquire();
      try {
        return await inflight;
      } finally {
        inflight = undefined;
      }
    },
  };
}

export async function createGitHubClientForConfig(
  config: GitHubAuthConfig,
  auditLog: AuditLogWriter,
  options: {
    tokenFetch?: GhFetchLike;
    githubFetch?: GhFetchLike;
    now?: () => number;
    traceIdProvider?: () => string;
  } = {},
): Promise<{ client: GitHubClient; mode: GitHubAuthMode }> {
  if (config.GITHUB_APP_ID && config.GITHUB_APP_PRIVATE_KEY && config.GITHUB_APP_INSTALLATION_ID) {
    const provider = createGitHubAppTokenProvider(
      {
        appId: config.GITHUB_APP_ID,
        privateKey: config.GITHUB_APP_PRIVATE_KEY,
        installationId: config.GITHUB_APP_INSTALLATION_ID,
      },
      options.tokenFetch,
      options.now,
    );
    return { client: new GitHubClient(provider, options.githubFetch), mode: "app" };
  }

  if (config.GITHUB_TOKEN) {
    // SPEC-INT-061: GitHub App移行までの暫定PAT fallback。
    return {
      client: new GitHubClient({ getInstallationToken: async () => config.GITHUB_TOKEN! }, options.githubFetch),
      mode: "pat",
    };
  }

  await auditLog.append({
    trace_id: (options.traceIdProvider ?? randomUUID)(),
    actor: "SERVER",
    action: "github_auth_not_configured",
    basis: "SPEC-INT-061",
    detail: { reason: "GitHub App credentials and GITHUB_TOKEN are not configured" },
    at: new Date(options.now?.() ?? Date.now()).toISOString(),
  });
  const disabledFetch: GhFetchLike = async () => new Response(null, { status: 503 });
  return {
    client: new GitHubClient({ getInstallationToken: async () => "github-auth-disabled" }, disabledFetch),
    mode: "disabled",
  };
}
