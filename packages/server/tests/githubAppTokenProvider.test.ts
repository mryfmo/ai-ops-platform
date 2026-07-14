/**
 * packages/server/tests/githubAppTokenProvider.test.ts
 *
 * 根拠: DevOps:SPEC-INT-061。GitHub App JWTとinstallation tokenの取得・更新を検証する。
 */
import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import {
  createGitHubAppTokenProvider,
  createGitHubClientForConfig,
  type GitHubAppCredentials,
} from "../src/auth/githubAppTokenProvider.js";

const nowMs = Date.parse("2026-07-12T00:00:00.000Z");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const credentials: GitHubAppCredentials = {
  appId: "12345",
  privateKey: privateKeyPem.replaceAll("\n", "\\n"),
  installationId: "67890",
};

function decodePart(jwt: string, index: number): Record<string, unknown> {
  return JSON.parse(Buffer.from(jwt.split(".")[index]!, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("GitHub App token provider [DevOps:SPEC-INT-061]", () => {
  it("RS256 JWTを正しいclaimsで署名し、GitHubのinstallation token API契約を守る", async () => {
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const jwt = String((init?.headers as Record<string, string>).Authorization).slice("Bearer ".length);
      expect(decodePart(jwt, 0)).toEqual({ alg: "RS256", typ: "JWT" });
      expect(decodePart(jwt, 1)).toEqual({ iss: "12345", iat: nowMs / 1000 - 60, exp: nowMs / 1000 + 540 });
      expect(
        verify(
          "RSA-SHA256",
          jwt.split(".").slice(0, 2).join("."),
          publicKey,
          Buffer.from(jwt.split(".")[2]!, "base64url"),
        ),
      ).toBe(true);
      expect(input).toBe("https://api.github.com/app/installations/67890/access_tokens");
      expect(init).toEqual({
        method: "POST",
        signal: expect.any(AbortSignal),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      return Response.json({ token: "installation-token", expires_at: "2026-07-12T01:00:00.000Z" }, { status: 201 });
    });

    const provider = createGitHubAppTokenProvider(credentials, fetchImpl, () => nowMs);

    await expect(provider.getInstallationToken()).resolves.toBe("installation-token");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("期限5分前まではcacheし、境界到達後にrefreshする", async () => {
    let current = nowMs;
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { token: `token-${fetchImpl.mock.calls.length}`, expires_at: new Date(nowMs + 3_600_000).toISOString() },
        { status: 201 },
      ),
    );
    const provider = createGitHubAppTokenProvider(credentials, fetchImpl, () => current);

    await expect(provider.getInstallationToken()).resolves.toBe("token-1");
    current = nowMs + 3_600_000 - 300_001;
    await expect(provider.getInstallationToken()).resolves.toBe("token-1");
    current += 1;
    await expect(provider.getInstallationToken()).resolves.toBe("token-2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("同時呼出しは1回のinstallation token取得を共有する", async () => {
    let resolveFetch!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => (resolveFetch = resolve));
    const fetchImpl = vi.fn(() => pending);
    const provider = createGitHubAppTokenProvider(credentials, fetchImpl, () => nowMs);

    const first = provider.getInstallationToken();
    const second = provider.getInstallationToken();
    expect(fetchImpl).toHaveBeenCalledOnce();

    resolveFetch(Response.json({ token: "shared-token", expires_at: "2026-07-12T01:00:00.000Z" }, { status: 201 }));
    await expect(Promise.all([first, second])).resolves.toEqual(["shared-token", "shared-token"]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("installation token取得を注入した期限signalで中断し、固定エラーへ閉じる", async () => {
    const controller = new AbortController();
    const timeoutSignal = vi.fn(() => controller.signal);
    const fetchImpl = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
    );
    const provider = createGitHubAppTokenProvider(credentials, fetchImpl, () => nowMs, {
      timeoutMs: 1_234,
      timeoutSignal,
    });

    const pending = expect(provider.getInstallationToken()).rejects.toEqual(
      new Error("E-AUTH02: GitHub installation token acquisition failed"),
    );
    expect(timeoutSignal).toHaveBeenCalledWith(1_234);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    controller.abort(new DOMException("timeout", "TimeoutError"));
    await pending;
  });

  it.each([
    ["status", new Response(null, { status: 200 })],
    ["malformed json", new Response("not-json", { status: 201 })],
    ["blank token", Response.json({ token: " ", expires_at: "2026-07-12T01:00:00.000Z" }, { status: 201 })],
    ["invalid expiry", Response.json({ token: "secret-token", expires_at: "invalid" }, { status: 201 })],
    ["expired", Response.json({ token: "secret-token", expires_at: "2026-07-11T23:59:59.000Z" }, { status: 201 })],
  ])("不正レスポンスを固定メッセージでfail closedする: %s", async (_name, response) => {
    const provider = createGitHubAppTokenProvider(
      credentials,
      async () => response,
      () => nowMs,
    );

    const error = await provider.getInstallationToken().catch((caught: unknown) => caught);
    expect(error).toEqual(new Error("E-AUTH02: GitHub installation token acquisition failed"));
    expect(String(error)).not.toContain("secret-token");
  });

  it.each([
    ["app", { GITHUB_APP_ID: "12345", GITHUB_APP_PRIVATE_KEY: privateKeyPem, GITHUB_APP_INSTALLATION_ID: "67890" }],
    ["pat", { GITHUB_TOKEN: "pat-token" }],
  ] as const)("%s modeを選択する", async (mode, config) => {
    const auditLog = new InMemoryAuditLog();
    const result = await createGitHubClientForConfig(config, auditLog, {
      tokenFetch: async () =>
        Response.json({ token: "app-token", expires_at: "2026-07-12T01:00:00.000Z" }, { status: 201 }),
      githubFetch: async () => new Response(null, { status: 204 }),
      now: () => nowMs,
      traceIdProvider: () => "trace-auth",
    });

    expect(result.mode).toBe(mode);
    await expect(
      result.client.dispatchWorkflow({ owner: "o", repo: "r", workflowIdOrFileName: "w", ref: "main", inputs: {} }),
    ).resolves.toBeUndefined();
    expect(await auditLog.readAll()).toEqual([]);
  });

  it("未設定時はGitHub outboundを無効化し、監査を初期化時の1回だけ記録する", async () => {
    const auditLog = new InMemoryAuditLog();
    const networkFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const result = await createGitHubClientForConfig({}, auditLog, {
      githubFetch: networkFetch,
      traceIdProvider: () => "trace-auth",
    });

    expect(result.mode).toBe("disabled");
    const input = { owner: "o", repo: "r", workflowIdOrFileName: "w", ref: "main", inputs: {} };
    await expect(result.client.dispatchWorkflow(input)).rejects.toThrow("E-DEP01");
    await expect(result.client.dispatchWorkflow(input)).rejects.toThrow("E-DEP01");
    expect(networkFetch).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map(({ action }) => action)).toEqual(["github_auth_not_configured"]);
  });
});
