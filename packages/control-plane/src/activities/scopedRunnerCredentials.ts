// 根拠: FinalArch:PRD-008 / FinalArch:COD-002 / FinalArch:COD-004 / ADR-0027 / WBS P8-T03
import type { FetchLike } from "@aiops/shared";

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_TOKEN_LIFETIME_MS = 60 * 60_000;
const RESPONSE_CLOCK_SKEW_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";

export const RUNNER_GITHUB_PERMISSIONS = {
  contents: "write",
  pull_requests: "write",
  // `gh pr create --label ai-generated` uses the issue-label permission surface.
  issues: "write",
} as const;

export type RunnerCredentialErrorCode =
  | "E-RUNNER-CREDENTIAL-CONFIG"
  | "E-RUNNER-CREDENTIAL-IDENTITY"
  | "E-RUNNER-CREDENTIAL-INPUT"
  | "E-RUNNER-CREDENTIAL-SCOPE"
  | "E-RUNNER-CREDENTIAL-ISSUE"
  | "E-RUNNER-CREDENTIAL-REVOKE";

export class RunnerCredentialError extends Error {
  constructor(readonly code: RunnerCredentialErrorCode) {
    super(code);
    this.name = "RunnerCredentialError";
  }
}

function fail(code: RunnerCredentialErrorCode): never {
  throw new RunnerCredentialError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, code: RunnerCredentialErrorCode): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || /[\r\n]/u.test(value)) fail(code);
  return value;
}

function httpsBaseUrl(value: unknown): string {
  const raw = requiredText(value, "E-RUNNER-CREDENTIAL-CONFIG");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("E-RUNNER-CREDENTIAL-CONFIG");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    fail("E-RUNNER-CREDENTIAL-CONFIG");
  }
  return url.toString().replace(/\/+$/u, "");
}

function parseFutureExpiry(value: unknown, now: number, latest: number): number {
  if (typeof value !== "string") fail("E-RUNNER-CREDENTIAL-ISSUE");
  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > latest + RESPONSE_CLOCK_SKEW_MS) {
    fail("E-RUNNER-CREDENTIAL-ISSUE");
  }
  return expiresAt;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) fail("E-RUNNER-CREDENTIAL-ISSUE");
    return body;
  } catch (error) {
    if (error instanceof RunnerCredentialError) throw error;
    return fail("E-RUNNER-CREDENTIAL-ISSUE");
  }
}

function requestSignal(
  timeoutSignal: ((ms: number) => AbortSignal) | undefined,
  timeoutMs: number | undefined,
): AbortSignal {
  return (timeoutSignal ?? AbortSignal.timeout)(timeoutMs ?? REQUEST_TIMEOUT_MS);
}

export interface LiteLlmScopedKeyRequest {
  readonly taskId: string;
  readonly modelAlias: string;
  readonly maxBudgetUsd: number;
  readonly durationSeconds: number;
}

export interface IssuedCredential {
  readonly token: string;
  readonly expiresAt: number;
}

export interface LiteLlmScopedKeyOperations {
  issue(input: LiteLlmScopedKeyRequest): Promise<IssuedCredential>;
  revoke(token: string): Promise<void>;
}

export interface LiteLlmScopedKeyClientOptions {
  readonly baseUrl: string;
  readonly masterKeyProvider: () => Promise<string>;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly timeoutSignal?: (ms: number) => AbortSignal;
}

function assertLiteLlmRequest(input: LiteLlmScopedKeyRequest): void {
  requiredText(input.taskId, "E-RUNNER-CREDENTIAL-INPUT");
  requiredText(input.modelAlias, "E-RUNNER-CREDENTIAL-INPUT");
  if (!Number.isFinite(input.maxBudgetUsd) || input.maxBudgetUsd <= 0) fail("E-RUNNER-CREDENTIAL-INPUT");
  if (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    fail("E-RUNNER-CREDENTIAL-INPUT");
  }
}

export function createLiteLlmScopedKeyClient(options: LiteLlmScopedKeyClientOptions): LiteLlmScopedKeyOperations {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const baseUrl = httpsBaseUrl(options.baseUrl);

  async function masterHeaders(): Promise<Record<string, string>> {
    let masterKey: string;
    try {
      masterKey = requiredText(await options.masterKeyProvider(), "E-RUNNER-CREDENTIAL-CONFIG");
    } catch {
      return fail("E-RUNNER-CREDENTIAL-CONFIG");
    }
    return { Authorization: `Bearer ${masterKey}`, "Content-Type": "application/json" };
  }

  return {
    async issue(input): Promise<IssuedCredential> {
      assertLiteLlmRequest(input);
      const issuedAt = now();
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/key/generate`, {
          method: "POST",
          signal: requestSignal(options.timeoutSignal, options.timeoutMs),
          headers: await masterHeaders(),
          body: JSON.stringify({
            models: [input.modelAlias],
            max_budget: input.maxBudgetUsd,
            duration: `${input.durationSeconds}s`,
            metadata: { task_id: input.taskId, credential_kind: "coding-runner" },
          }),
        });
      } catch {
        return fail("E-RUNNER-CREDENTIAL-ISSUE");
      }
      if (response.status !== 200) fail("E-RUNNER-CREDENTIAL-ISSUE");
      const body = await json(response);
      const token = requiredText(body.key, "E-RUNNER-CREDENTIAL-ISSUE");
      const expiresAt = parseFutureExpiry(body.expires, issuedAt, issuedAt + input.durationSeconds * 1_000);
      if (
        !Array.isArray(body.models) ||
        body.models.length !== 1 ||
        body.models[0] !== input.modelAlias ||
        body.max_budget !== input.maxBudgetUsd
      ) {
        fail("E-RUNNER-CREDENTIAL-ISSUE");
      }
      return { token, expiresAt };
    },

    async revoke(token): Promise<void> {
      requiredText(token, "E-RUNNER-CREDENTIAL-INPUT");
      try {
        const response = await fetchImpl(`${baseUrl}/key/delete`, {
          method: "POST",
          signal: requestSignal(options.timeoutSignal, options.timeoutMs),
          headers: await masterHeaders(),
          body: JSON.stringify({ keys: [token] }),
        });
        if (!response.ok) fail("E-RUNNER-CREDENTIAL-REVOKE");
      } catch {
        return fail("E-RUNNER-CREDENTIAL-REVOKE");
      }
    },
  };
}

export interface GitHubInstallationTokenRequest {
  readonly repository: string;
}

export interface GitHubInstallationTokenOperations {
  issue(input: GitHubInstallationTokenRequest): Promise<IssuedCredential>;
  revoke(token: string): Promise<void>;
}

export interface GitHubInstallationTokenClientOptions {
  readonly installationId: string;
  readonly appJwtProvider: () => Promise<string>;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly timeoutSignal?: (ms: number) => AbortSignal;
}

function repositoryName(repository: string): string {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/u.exec(repository);
  if (!match) fail("E-RUNNER-CREDENTIAL-INPUT");
  return match[2]!;
}

function assertGitHubResponseScope(body: Record<string, unknown>, repository: string): void {
  if (!isRecord(body.permissions)) fail("E-RUNNER-CREDENTIAL-ISSUE");
  for (const [name, level] of Object.entries(RUNNER_GITHUB_PERMISSIONS)) {
    if (body.permissions[name] !== level) fail("E-RUNNER-CREDENTIAL-ISSUE");
  }
  for (const [name, level] of Object.entries(body.permissions)) {
    if (!(name in RUNNER_GITHUB_PERMISSIONS) && !(name === "metadata" && level === "read")) {
      fail("E-RUNNER-CREDENTIAL-ISSUE");
    }
  }
  if (
    !Array.isArray(body.repositories) ||
    body.repositories.length !== 1 ||
    !isRecord(body.repositories[0]) ||
    body.repositories[0].full_name !== repository
  ) {
    fail("E-RUNNER-CREDENTIAL-ISSUE");
  }
}

export function createGitHubInstallationTokenClient(
  options: GitHubInstallationTokenClientOptions,
): GitHubInstallationTokenOperations {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const installationId = requiredText(options.installationId, "E-RUNNER-CREDENTIAL-CONFIG");

  return {
    async issue(input): Promise<IssuedCredential> {
      const repoName = repositoryName(input.repository);
      const issuedAt = now();
      let appJwt: string;
      let response: Response;
      try {
        appJwt = requiredText(await options.appJwtProvider(), "E-RUNNER-CREDENTIAL-CONFIG");
        response = await fetchImpl(
          `${GITHUB_API_BASE_URL}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
          {
            method: "POST",
            signal: requestSignal(options.timeoutSignal, options.timeoutMs),
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${appJwt}`,
              "Content-Type": "application/json",
              "X-GitHub-Api-Version": GITHUB_API_VERSION,
            },
            // GitHub defaults to every installed repository/permission when these are omitted.
            // https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app
            body: JSON.stringify({ repositories: [repoName], permissions: RUNNER_GITHUB_PERMISSIONS }),
          },
        );
      } catch {
        return fail("E-RUNNER-CREDENTIAL-ISSUE");
      }
      if (response.status !== 201) fail("E-RUNNER-CREDENTIAL-ISSUE");
      const body = await json(response);
      assertGitHubResponseScope(body, input.repository);
      return {
        token: requiredText(body.token, "E-RUNNER-CREDENTIAL-ISSUE"),
        expiresAt: parseFutureExpiry(body.expires_at, issuedAt, issuedAt + GITHUB_TOKEN_LIFETIME_MS),
      };
    },

    async revoke(token): Promise<void> {
      const installationToken = requiredText(token, "E-RUNNER-CREDENTIAL-INPUT");
      try {
        const response = await fetchImpl(`${GITHUB_API_BASE_URL}/installation/token`, {
          method: "DELETE",
          signal: requestSignal(options.timeoutSignal, options.timeoutMs),
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${installationToken}`,
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
          },
        });
        if (response.status !== 204) fail("E-RUNNER-CREDENTIAL-REVOKE");
      } catch {
        return fail("E-RUNNER-CREDENTIAL-REVOKE");
      }
    },
  };
}

export interface RunnerOidcClaims {
  readonly issuer: string;
  readonly audience: string | readonly string[];
  readonly repository: string;
  readonly subject: string;
  readonly expiresAt: number;
}

export interface RunnerTaskScope {
  readonly taskId: string;
  readonly repository: string;
  readonly branchName: string;
}

export type CredentialKind = "litellm" | "github";

export interface CredentialLease extends RunnerTaskScope {
  readonly leaseId: string;
  readonly kind: CredentialKind;
  readonly token: string;
  readonly expiresAt: number;
}

export interface CredentialLeaseStore {
  save(lease: CredentialLease): Promise<void>;
  get(leaseId: string): Promise<CredentialLease | null>;
  remove(leaseId: string): Promise<void>;
}

export interface RunnerCredentialGrant extends IssuedCredential {
  readonly kind: CredentialKind;
  readonly leaseId: string;
}

export interface RevokeRunnerCredentialInput extends RunnerTaskScope {
  readonly kind: CredentialKind;
  readonly leaseId: string;
}

export interface RunnerCredentialRevocationReceipt {
  readonly kind: CredentialKind;
  readonly leaseId: string;
  readonly revokedAt: number;
}

export interface ScopedRunnerCredentialIssuerOptions {
  readonly expectedAudience: string;
  readonly expectedRepository: string;
  readonly allowedModelAlias: string;
  readonly maximumLiteLlmBudgetUsd: number;
  readonly maximumDurationSeconds: number;
  readonly oidcVerifier: (token: string, expectedAudience: string) => Promise<RunnerOidcClaims>;
  readonly liteLlmClient: LiteLlmScopedKeyOperations;
  readonly githubClient: GitHubInstallationTokenOperations;
  readonly leaseStore: CredentialLeaseStore;
  readonly now?: () => number;
  readonly leaseIdProvider: (kind: CredentialKind) => string;
}

export interface ScopedRunnerCredentialIssuer {
  issueLiteLlm(oidcToken: string, input: RunnerTaskScope & LiteLlmScopedKeyRequest): Promise<RunnerCredentialGrant>;
  issueGitHub(oidcToken: string, input: RunnerTaskScope): Promise<RunnerCredentialGrant>;
  revoke(oidcToken: string, input: RevokeRunnerCredentialInput): Promise<RunnerCredentialRevocationReceipt>;
}

function audienceIncludes(audience: RunnerOidcClaims["audience"], expected: string): boolean {
  return typeof audience === "string" ? audience === expected : audience.includes(expected);
}

function assertTaskScope(input: RunnerTaskScope, expectedRepository: string): void {
  const taskId = requiredText(input.taskId, "E-RUNNER-CREDENTIAL-SCOPE");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(taskId)) fail("E-RUNNER-CREDENTIAL-SCOPE");
  if (input.repository !== expectedRepository || input.branchName !== `agent/${taskId}`) {
    fail("E-RUNNER-CREDENTIAL-SCOPE");
  }
}

function sameLeaseScope(lease: CredentialLease, input: RevokeRunnerCredentialInput): boolean {
  return (
    lease.kind === input.kind &&
    lease.taskId === input.taskId &&
    lease.repository === input.repository &&
    lease.branchName === input.branchName
  );
}

export function createScopedRunnerCredentialIssuer(
  options: ScopedRunnerCredentialIssuerOptions,
): ScopedRunnerCredentialIssuer {
  const expectedAudience = requiredText(options.expectedAudience, "E-RUNNER-CREDENTIAL-CONFIG");
  const expectedRepository = requiredText(options.expectedRepository, "E-RUNNER-CREDENTIAL-CONFIG");
  repositoryName(expectedRepository);
  const allowedModelAlias = requiredText(options.allowedModelAlias, "E-RUNNER-CREDENTIAL-CONFIG");
  if (!Number.isFinite(options.maximumLiteLlmBudgetUsd) || options.maximumLiteLlmBudgetUsd <= 0) {
    fail("E-RUNNER-CREDENTIAL-CONFIG");
  }
  if (!Number.isSafeInteger(options.maximumDurationSeconds) || options.maximumDurationSeconds <= 0) {
    fail("E-RUNNER-CREDENTIAL-CONFIG");
  }
  const now = options.now ?? Date.now;

  async function authorize(oidcToken: string): Promise<void> {
    let verified: RunnerOidcClaims;
    try {
      const token = requiredText(oidcToken, "E-RUNNER-CREDENTIAL-IDENTITY");
      verified = await options.oidcVerifier(token, expectedAudience);
    } catch {
      return fail("E-RUNNER-CREDENTIAL-IDENTITY");
    }
    if (
      verified.issuer !== GITHUB_OIDC_ISSUER ||
      !audienceIncludes(verified.audience, expectedAudience) ||
      verified.repository !== expectedRepository ||
      !verified.subject.startsWith(`repo:${expectedRepository}:`) ||
      !Number.isFinite(verified.expiresAt) ||
      verified.expiresAt <= now()
    ) {
      fail("E-RUNNER-CREDENTIAL-IDENTITY");
    }
  }

  async function saveLease(
    kind: CredentialKind,
    input: RunnerTaskScope,
    issued: IssuedCredential,
    revoke: (token: string) => Promise<void>,
  ): Promise<RunnerCredentialGrant> {
    if (!Number.isFinite(issued.expiresAt) || issued.expiresAt <= now()) {
      try {
        await revoke(issued.token);
      } catch {
        return fail("E-RUNNER-CREDENTIAL-REVOKE");
      }
      return fail("E-RUNNER-CREDENTIAL-ISSUE");
    }
    const leaseId = requiredText(options.leaseIdProvider(kind), "E-RUNNER-CREDENTIAL-CONFIG");
    const lease: CredentialLease = { ...input, ...issued, kind, leaseId };
    try {
      await options.leaseStore.save(lease);
    } catch {
      try {
        await revoke(issued.token);
      } catch {
        return fail("E-RUNNER-CREDENTIAL-REVOKE");
      }
      return fail("E-RUNNER-CREDENTIAL-ISSUE");
    }
    return { kind, leaseId, ...issued };
  }

  return {
    async issueLiteLlm(oidcToken, input): Promise<RunnerCredentialGrant> {
      await authorize(oidcToken);
      assertTaskScope(input, expectedRepository);
      if (
        input.modelAlias !== allowedModelAlias ||
        !Number.isFinite(input.maxBudgetUsd) ||
        input.maxBudgetUsd <= 0 ||
        input.maxBudgetUsd > options.maximumLiteLlmBudgetUsd ||
        !Number.isSafeInteger(input.durationSeconds) ||
        input.durationSeconds <= 0 ||
        input.durationSeconds > options.maximumDurationSeconds
      ) {
        fail("E-RUNNER-CREDENTIAL-SCOPE");
      }
      const issued = await options.liteLlmClient.issue(input);
      return saveLease("litellm", input, issued, options.liteLlmClient.revoke);
    },

    async issueGitHub(oidcToken, input): Promise<RunnerCredentialGrant> {
      await authorize(oidcToken);
      assertTaskScope(input, expectedRepository);
      const issued = await options.githubClient.issue({ repository: input.repository });
      return saveLease("github", input, issued, options.githubClient.revoke);
    },

    async revoke(oidcToken, input): Promise<RunnerCredentialRevocationReceipt> {
      await authorize(oidcToken);
      assertTaskScope(input, expectedRepository);
      const lease = await options.leaseStore.get(requiredText(input.leaseId, "E-RUNNER-CREDENTIAL-SCOPE"));
      if (!lease || !sameLeaseScope(lease, input)) fail("E-RUNNER-CREDENTIAL-SCOPE");
      const revoke = lease.kind === "litellm" ? options.liteLlmClient.revoke : options.githubClient.revoke;
      try {
        await revoke(lease.token);
        await options.leaseStore.remove(lease.leaseId);
      } catch {
        return fail("E-RUNNER-CREDENTIAL-REVOKE");
      }
      return { kind: lease.kind, leaseId: lease.leaseId, revokedAt: now() };
    },
  };
}
