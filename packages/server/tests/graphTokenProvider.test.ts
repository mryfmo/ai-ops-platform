/**
 * packages/server/tests/graphTokenProvider.test.ts
 *
 * 根拠: DevOps:SPEC-INT-062 / ADR-0005。MSAL application cacheへ委譲するGraph token providerを検証する。
 */
import { describe, expect, it } from "vitest";
import {
  createMsalGraphTokenProvider,
  type ConfidentialClientApplicationCompatible,
} from "../src/auth/graphTokenProvider.js";

const credentials = { tenantId: "tenant", clientId: "client", clientSecret: "client-secret" };
const expiresOn = new Date("2026-07-11T01:00:00Z");
const now = () => new Date("2026-07-11T00:00:00Z").getTime();

describe("Graph MSAL token provider [DevOps:SPEC-INT-062]", () => {
  it("scopeをGraph .defaultに固定し、MSAL application cacheへ逐次委譲する", async () => {
    const requests: unknown[] = [];
    const client: ConfidentialClientApplicationCompatible = {
      acquireTokenByClientCredential: async (request) => {
        requests.push(request);
        return { accessToken: "cached-token", expiresOn };
      },
    };
    const provider = createMsalGraphTokenProvider(credentials, client, now);

    await expect(provider.getAccessToken()).resolves.toBe("cached-token");
    await expect(provider.getAccessToken()).resolves.toBe("cached-token");
    expect(requests).toEqual([
      { scopes: ["https://graph.microsoft.com/.default"] },
      { scopes: ["https://graph.microsoft.com/.default"] },
    ]);
  });

  it("同時呼出しだけをsingle-flightする", async () => {
    let calls = 0;
    let resolve!: (result: { accessToken: string; expiresOn: Date }) => void;
    const pending = new Promise<{ accessToken: string; expiresOn: Date }>((done) => (resolve = done));
    const client: ConfidentialClientApplicationCompatible = {
      acquireTokenByClientCredential: async () => {
        calls += 1;
        return pending;
      },
    };
    const provider = createMsalGraphTokenProvider(credentials, client, now);

    const first = provider.getAccessToken();
    const second = provider.getAccessToken();
    expect(calls).toBe(1);
    resolve({ accessToken: "token", expiresOn });
    await expect(Promise.all([first, second])).resolves.toEqual(["token", "token"]);
  });

  it("MSALがrefreshしたtokenを返し、wrapper cacheを保持しない", async () => {
    let calls = 0;
    const client: ConfidentialClientApplicationCompatible = {
      acquireTokenByClientCredential: async () => ({ accessToken: `token-${++calls}`, expiresOn }),
    };
    const provider = createMsalGraphTokenProvider(credentials, client, now);

    await expect(provider.getAccessToken()).resolves.toBe("token-1");
    await expect(provider.getAccessToken()).resolves.toBe("token-2");
    expect(calls).toBe(2);
  });

  it("失敗したinflightを消去し、次回取得で回復する", async () => {
    let calls = 0;
    const client: ConfidentialClientApplicationCompatible = {
      acquireTokenByClientCredential: async () => {
        if (++calls === 1) throw new Error("client-secret token-value raw-response");
        return { accessToken: "recovered-token", expiresOn };
      },
    };
    const provider = createMsalGraphTokenProvider(credentials, client, now);

    const error = await provider.getAccessToken().catch((caught: unknown) => caught);
    expect(error).toEqual(new Error("E-AUTH01: Graph token acquisition failed"));
    expect(String(error)).not.toMatch(/client-secret|token-value|raw-response/);
    await expect(provider.getAccessToken()).resolves.toBe("recovered-token");
    expect(calls).toBe(2);
  });

  it.each([
    ["null result", null],
    ["empty token", { accessToken: "", expiresOn }],
    ["blank token", { accessToken: "  ", expiresOn }],
    ["surrounding whitespace token", { accessToken: " sensitive-token ", expiresOn }],
    ["null expiry", { accessToken: "sensitive-token", expiresOn: null }],
    ["invalid expiry", { accessToken: "sensitive-token", expiresOn: new Date(Number.NaN) }],
    ["expired result", { accessToken: "sensitive-token", expiresOn: new Date(now() - 1) }],
  ])("%sを固定メッセージでfail closedする", async (_name, result) => {
    const provider = createMsalGraphTokenProvider(
      credentials,
      { acquireTokenByClientCredential: async () => result },
      now,
    );

    const error = await provider.getAccessToken().catch((caught: unknown) => caught);
    expect(error).toEqual(new Error("E-AUTH01: Graph token acquisition failed"));
    expect(String(error)).not.toContain("sensitive-token");
  });
});
