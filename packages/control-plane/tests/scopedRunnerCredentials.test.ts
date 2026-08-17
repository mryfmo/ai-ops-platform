// 根拠: FinalArch:PRD-008 / FinalArch:COD-002 / FinalArch:COD-004 / ADR-0027 / WBS P8-T03
import { describe, expect, it, vi } from "vitest";

import {
  RUNNER_GITHUB_PERMISSIONS,
  RunnerCredentialError,
  createGitHubInstallationTokenClient,
  createLiteLlmScopedKeyClient,
  createScopedRunnerCredentialIssuer,
  type CredentialLease,
  type CredentialLeaseStore,
  type GitHubInstallationTokenOperations,
  type LiteLlmScopedKeyOperations,
  type RunnerOidcClaims,
} from "../src/activities/scopedRunnerCredentials.js";

const NOW = Date.parse("2026-08-17T00:00:00.000Z");
const TASK = {
  taskId: "task-123",
  repository: "acme/ai-ops",
  branchName: "agent/task-123",
} as const;

class MemoryLeaseStore implements CredentialLeaseStore {
  readonly records = new Map<string, CredentialLease>();

  async save(lease: CredentialLease): Promise<void> {
    if (this.records.has(lease.leaseId)) throw new Error("duplicate lease");
    this.records.set(lease.leaseId, lease);
  }

  async get(leaseId: string): Promise<CredentialLease | null> {
    return this.records.get(leaseId) ?? null;
  }

  async remove(leaseId: string): Promise<void> {
    this.records.delete(leaseId);
  }
}

function claims(overrides: Partial<RunnerOidcClaims> = {}): RunnerOidcClaims {
  return {
    issuer: "https://token.actions.githubusercontent.com",
    audience: "aiops-runner-credential-issuer",
    repository: "acme/ai-ops",
    subject: "repo:acme/ai-ops:ref:refs/heads/main",
    expiresAt: NOW + 5 * 60_000,
    ...overrides,
  };
}

function fakeClients(
  overrides: {
    liteLlmRevoke?: LiteLlmScopedKeyOperations["revoke"];
    githubRevoke?: GitHubInstallationTokenOperations["revoke"];
  } = {},
): {
  liteLlm: LiteLlmScopedKeyOperations;
  github: GitHubInstallationTokenOperations;
} {
  return {
    liteLlm: {
      issue: vi.fn(async () => ({
        token: "virtual-job-token",
        expiresAt: NOW + 30 * 60_000,
      })),
      revoke: overrides.liteLlmRevoke ?? vi.fn(async () => undefined),
    },
    github: {
      issue: vi.fn(async () => ({
        token: "installation-job-token",
        expiresAt: NOW + 60 * 60_000,
      })),
      revoke: overrides.githubRevoke ?? vi.fn(async () => undefined),
    },
  };
}

function issuer(
  overrides: {
    oidcClaims?: RunnerOidcClaims;
    store?: MemoryLeaseStore;
    clients?: ReturnType<typeof fakeClients>;
  } = {},
) {
  const store = overrides.store ?? new MemoryLeaseStore();
  const clients = overrides.clients ?? fakeClients();
  return {
    store,
    clients,
    value: createScopedRunnerCredentialIssuer({
      expectedAudience: "aiops-runner-credential-issuer",
      expectedRepository: "acme/ai-ops",
      allowedModelAlias: "claude-code",
      maximumLiteLlmBudgetUsd: 2,
      maximumDurationSeconds: 1_800,
      oidcVerifier: async () => overrides.oidcClaims ?? claims(),
      liteLlmClient: clients.liteLlm,
      githubClient: clients.github,
      leaseStore: store,
      now: () => NOW,
      leaseIdProvider: (kind) => `${kind}-lease-1`,
    }),
  };
}

describe("scoped runner credential clients [FinalArch:COD-002][FinalArch:COD-004]", () => {
  it.each(["", "http://litellm.internal.invalid", "https://root@example.invalid", "https://example.invalid?key=x"])(
    "rejects unsafe LiteLLM issuer base URL %j before client use",
    (baseUrl) => {
      expect(() =>
        createLiteLlmScopedKeyClient({
          baseUrl,
          masterKeyProvider: async () => "synthetic-master-root",
        }),
      ).toThrowError(expect.objectContaining({ code: "E-RUNNER-CREDENTIAL-CONFIG" }));
    },
  );

  it("issues exactly one model/budget/duration bounded LiteLLM key without returning the master key", async () => {
    const rootKey = "synthetic-master-root";
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${rootKey}` });
      expect(JSON.parse(String(init?.body))).toEqual({
        models: ["claude-code"],
        max_budget: 1.25,
        duration: "600s",
        metadata: { task_id: "task-123", credential_kind: "coding-runner" },
      });
      return new Response(
        JSON.stringify({
          key: "virtual-job-token",
          expires: "2026-08-17T00:10:00.000Z",
          models: ["claude-code"],
          max_budget: 1.25,
        }),
        { status: 200 },
      );
    });
    const client = createLiteLlmScopedKeyClient({
      baseUrl: "https://litellm.internal.invalid",
      masterKeyProvider: async () => rootKey,
      fetchImpl,
      now: () => NOW,
    });

    const result = await client.issue({
      taskId: "task-123",
      modelAlias: "claude-code",
      maxBudgetUsd: 1.25,
      durationSeconds: 600,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://litellm.internal.invalid/key/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ token: "virtual-job-token", expiresAt: NOW + 600_000 });
    expect(JSON.stringify(result)).not.toContain(rootKey);
  });

  it.each([
    ["model", { taskId: "task-123", modelAlias: "", maxBudgetUsd: 1, durationSeconds: 600 }],
    ["budget", { taskId: "task-123", modelAlias: "claude-code", maxBudgetUsd: 0, durationSeconds: 600 }],
    ["duration", { taskId: "task-123", modelAlias: "claude-code", maxBudgetUsd: 1, durationSeconds: 0 }],
  ])("rejects missing or invalid %s before LiteLLM network I/O", async (_label, input) => {
    const fetchImpl = vi.fn();
    const client = createLiteLlmScopedKeyClient({
      baseUrl: "https://litellm.internal.invalid",
      masterKeyProvider: async () => "synthetic-master-root",
      fetchImpl,
      now: () => NOW,
    });

    await expect(client.issue(input)).rejects.toMatchObject({ code: "E-RUNNER-CREDENTIAL-INPUT" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", { key: "token", expires: "2026-08-16T23:59:59.000Z", models: ["claude-code"], max_budget: 1 }],
    ["model drift", { key: "token", expires: "2026-08-17T00:10:00.000Z", models: ["other"], max_budget: 1 }],
    ["budget drift", { key: "token", expires: "2026-08-17T00:10:00.000Z", models: ["claude-code"], max_budget: 2 }],
  ])("rejects a %s LiteLLM issuance response", async (_label, responseBody) => {
    const client = createLiteLlmScopedKeyClient({
      baseUrl: "https://litellm.internal.invalid",
      masterKeyProvider: async () => "synthetic-master-root",
      fetchImpl: async () => new Response(JSON.stringify(responseBody), { status: 200 }),
      now: () => NOW,
    });

    await expect(
      client.issue({ taskId: "task-123", modelAlias: "claude-code", maxBudgetUsd: 1, durationSeconds: 600 }),
    ).rejects.toMatchObject({ code: "E-RUNNER-CREDENTIAL-ISSUE" });
  });

  it("revokes a LiteLLM key through /key/delete and reports provider failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const client = createLiteLlmScopedKeyClient({
      baseUrl: "https://litellm.internal.invalid",
      masterKeyProvider: async () => "synthetic-master-root",
      fetchImpl,
      now: () => NOW,
    });

    await expect(client.revoke("virtual-job-token")).resolves.toBeUndefined();
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({ keys: ["virtual-job-token"] });
    await expect(client.revoke("virtual-job-token")).rejects.toMatchObject({
      code: "E-RUNNER-CREDENTIAL-REVOKE",
    });
  });

  it("mints one-repository GitHub App credentials with only workflow-required permissions", async () => {
    const appJwt = "synthetic-app-jwt";
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${appJwt}` });
      expect(JSON.parse(String(init?.body))).toEqual({
        repositories: ["ai-ops"],
        permissions: RUNNER_GITHUB_PERMISSIONS,
      });
      return new Response(
        JSON.stringify({
          token: "installation-job-token",
          expires_at: "2026-08-17T01:00:00.000Z",
          permissions: { ...RUNNER_GITHUB_PERMISSIONS, metadata: "read" },
          repositories: [{ full_name: "acme/ai-ops" }],
        }),
        { status: 201 },
      );
    });
    const client = createGitHubInstallationTokenClient({
      installationId: "12345",
      appJwtProvider: async () => appJwt,
      fetchImpl,
      now: () => NOW,
    });

    const result = await client.issue({ repository: "acme/ai-ops" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/12345/access_tokens",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ token: "installation-job-token", expiresAt: NOW + 3_600_000 });
    expect(JSON.stringify(result)).not.toContain(appJwt);
  });

  it("revokes an installation token with itself and requires GitHub 204", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const client = createGitHubInstallationTokenClient({
      installationId: "12345",
      appJwtProvider: async () => "unused-on-revoke",
      fetchImpl,
      now: () => NOW,
    });

    await expect(client.revoke("installation-job-token")).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/installation/token",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer installation-job-token" }),
      }),
    );
    await expect(client.revoke("installation-job-token")).rejects.toMatchObject({
      code: "E-RUNNER-CREDENTIAL-REVOKE",
    });
  });
});

describe("scoped runner credential issuer [FinalArch:COD-002][FinalArch:COD-004]", () => {
  it.each([
    ["missing token", "", claims()],
    ["wrong issuer", "oidc", claims({ issuer: "https://issuer.invalid" })],
    ["wrong audience", "oidc", claims({ audience: "other-audience" })],
    ["wrong repository", "oidc", claims({ repository: "acme/other" })],
    ["wrong subject", "oidc", claims({ subject: "repo:acme/other:ref:refs/heads/main" })],
    ["expired", "oidc", claims({ expiresAt: NOW })],
  ])("rejects %s OIDC identity before issuing", async (_label, token, oidcClaims) => {
    const value = issuer({ oidcClaims });

    await expect(
      value.value.issueLiteLlm(token, {
        ...TASK,
        modelAlias: "claude-code",
        maxBudgetUsd: 1,
        durationSeconds: 600,
      }),
    ).rejects.toMatchObject({ code: "E-RUNNER-CREDENTIAL-IDENTITY" });
    expect(value.clients.liteLlm.issue).not.toHaveBeenCalled();
  });

  it.each([
    ["out-of-scope repository", { ...TASK, repository: "acme/other" }],
    ["main branch", { ...TASK, branchName: "main" }],
  ])("rejects GitHub %s before token mint", async (_label, input) => {
    const value = issuer();

    await expect(value.value.issueGitHub("oidc", input)).rejects.toBeInstanceOf(RunnerCredentialError);
    expect(value.clients.github.issue).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong model", { modelAlias: "other", maxBudgetUsd: 1, durationSeconds: 600 }],
    ["excess budget", { modelAlias: "claude-code", maxBudgetUsd: 2.01, durationSeconds: 600 }],
    ["excess duration", { modelAlias: "claude-code", maxBudgetUsd: 1, durationSeconds: 1_801 }],
  ])("rejects LiteLLM %s before token mint", async (_label, limits) => {
    const value = issuer();

    await expect(value.value.issueLiteLlm("oidc", { ...TASK, ...limits })).rejects.toMatchObject({
      code: "E-RUNNER-CREDENTIAL-SCOPE",
    });
    expect(value.clients.liteLlm.issue).not.toHaveBeenCalled();
  });

  it("stores root-free grants server-side and revokes both credential kinds by lease", async () => {
    const value = issuer();
    const liteLlmGrant = await value.value.issueLiteLlm("oidc", {
      ...TASK,
      modelAlias: "claude-code",
      maxBudgetUsd: 1,
      durationSeconds: 600,
    });
    const githubGrant = await value.value.issueGitHub("oidc", TASK);

    expect(liteLlmGrant).toEqual({
      kind: "litellm",
      leaseId: "litellm-lease-1",
      token: "virtual-job-token",
      expiresAt: NOW + 30 * 60_000,
    });
    expect(githubGrant).toEqual({
      kind: "github",
      leaseId: "github-lease-1",
      token: "installation-job-token",
      expiresAt: NOW + 60 * 60_000,
    });
    expect(JSON.stringify([liteLlmGrant, githubGrant])).not.toMatch(/master|private|app-jwt/u);

    await expect(
      value.value.revoke("oidc", { ...TASK, kind: "litellm", leaseId: liteLlmGrant.leaseId }),
    ).resolves.toMatchObject({ kind: "litellm", leaseId: liteLlmGrant.leaseId, revokedAt: NOW });
    await expect(
      value.value.revoke("oidc", { ...TASK, kind: "github", leaseId: githubGrant.leaseId }),
    ).resolves.toMatchObject({ kind: "github", leaseId: githubGrant.leaseId, revokedAt: NOW });
    expect(value.store.records.size).toBe(0);
  });

  it("keeps a lease retryable and reports a cleanup failure when provider revocation fails", async () => {
    const revoke = vi.fn(async () => {
      throw new Error("synthetic provider outage");
    });
    const value = issuer({ clients: fakeClients({ liteLlmRevoke: revoke }) });
    const grant = await value.value.issueLiteLlm("oidc", {
      ...TASK,
      modelAlias: "claude-code",
      maxBudgetUsd: 1,
      durationSeconds: 600,
    });

    await expect(
      value.value.revoke("oidc", { ...TASK, kind: "litellm", leaseId: grant.leaseId }),
    ).rejects.toMatchObject({ code: "E-RUNNER-CREDENTIAL-REVOKE" });
    expect(value.store.records.has(grant.leaseId)).toBe(true);
  });

  it("rejects and revokes an already-expired credential before returning it", async () => {
    const clients = fakeClients();
    clients.liteLlm.issue = vi.fn(async () => ({ token: "expired-job-token", expiresAt: NOW }));
    const value = issuer({ clients });

    await expect(
      value.value.issueLiteLlm("oidc", {
        ...TASK,
        modelAlias: "claude-code",
        maxBudgetUsd: 1,
        durationSeconds: 600,
      }),
    ).rejects.toMatchObject({ code: "E-RUNNER-CREDENTIAL-ISSUE" });
    expect(clients.liteLlm.revoke).toHaveBeenCalledWith("expired-job-token");
    expect(value.store.records.size).toBe(0);
  });
});
