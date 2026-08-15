// 根拠: ADR-0024 / WIQ-001 / WIQ-005
import { describe, expect, it, vi } from "vitest";

import {
  WORKIQ_DELEGATED_SCOPE,
  WORKIQ_RESOURCE_AUDIENCE,
  WorkIqRestClient,
  type ValidatedWorkIqDelegatedClaims,
  type WorkIqDelegatedTokenProvider,
} from "../src/index.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000000";
const claims: ValidatedWorkIqDelegatedClaims = {
  issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  tenantId: TENANT_ID,
  audience: WORKIQ_RESOURCE_AUDIENCE,
  subject: "synthetic-user-subject",
  scopes: [WORKIQ_DELEGATED_SCOPE],
};

const tokenProvider: WorkIqDelegatedTokenProvider = {
  getToken: vi.fn(async () => ({ accessToken: "synthetic-delegated-token", claims })),
};

function toolResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function toolSseResponse(payload: unknown): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    })}\n\n`,
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

describe("Work IQ delegated MCP client [ADR-0024] [WIQ-001] [WIQ-005]", () => {
  it("preserves the calling identity and upstream provenance for fetch", async () => {
    const sourceReferences = [{ system: "work-iq", objectId: "synthetic-message" }];
    const permissionContext = { sourceSystem: "outlook", access: "delegated" };
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(_url).toBe("https://workiq.svc.cloud.microsoft/mcp");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ authorization: "Bearer synthetic-delegated-token" });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: "fetch", arguments: { entityUrls: ["/me/messages"] } },
      });
      return toolResponse({
        results: [{ data: { subject: "Synthetic" }, statusCode: 200 }],
        sourceReferences,
        permissionContext,
      });
    });

    const result = await new WorkIqRestClient({ fetchImpl, tokenProvider, expectedTenantId: TENANT_ID }).fetch({
      entityUrls: ["/me/messages"],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        results: [
          {
            data: { subject: "Synthetic" },
            statusCode: 200,
            sourceReferences: [],
            permissionContext: null,
            provenanceComplete: false,
          },
        ],
        sourceReferences,
        permissionContext,
        provenanceComplete: true,
      },
      identity: claims,
    });
  });

  it("does not invent ask provenance when the upstream response omits it", async () => {
    const client = new WorkIqRestClient({
      fetchImpl: async () => toolResponse({ response: "Synthetic answer", conversationId: "synthetic-conversation" }),
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });

    await expect(client.ask({ question: "What changed?" })).resolves.toEqual({
      ok: true,
      value: {
        response: "Synthetic answer",
        conversationId: "synthetic-conversation",
        sourceReferences: [],
        permissionContext: null,
        provenanceComplete: false,
      },
      identity: claims,
    });
  });

  it("revalidates provider claims and never sends a mismatched identity", async () => {
    const fetchImpl = vi.fn();
    const wrongClaims = { ...claims, subject: "", scopes: [] } as unknown as ValidatedWorkIqDelegatedClaims;
    const client = new WorkIqRestClient({
      fetchImpl,
      tokenProvider: { getToken: async () => ({ accessToken: "synthetic-token", claims: wrongClaims }) },
      expectedTenantId: TENANT_ID,
    });

    await expect(client.fetch({ entityUrls: ["/me/messages"] })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-IDENTITY",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries a transient fetch failure once but never retries ask", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(toolResponse({ results: [{ data: {}, statusCode: 200 }] }));
    const client = new WorkIqRestClient({ fetchImpl, tokenProvider, expectedTenantId: TENANT_ID });

    await expect(client.fetch({ entityUrls: ["/me/messages"] })).resolves.toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const askFetch = vi.fn(async () => new Response(null, { status: 503 }));
    const askClient = new WorkIqRestClient({ fetchImpl: askFetch, tokenProvider, expectedTenantId: TENANT_ID });
    await expect(askClient.ask({ question: "What changed?" })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-HTTP",
    });
    expect(askFetch).toHaveBeenCalledTimes(1);
  });

  it("maps timeout and network failures without returning partial data", async () => {
    const timeoutFetch = vi.fn(
      async (_url: string, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
    );
    const timeoutClient = new WorkIqRestClient({
      fetchImpl: timeoutFetch,
      tokenProvider,
      expectedTenantId: TENANT_ID,
      timeoutMs: 1,
    });
    await expect(timeoutClient.fetch({ entityUrls: ["/me/messages"] })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-TIMEOUT",
    });

    const networkClient = new WorkIqRestClient({
      fetchImpl: async () => {
        throw new Error("synthetic network failure");
      },
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });
    await expect(networkClient.fetch({ entityUrls: ["/me/messages"] })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-NETWORK",
    });
  });

  it.each([
    ["invalid JSON-RPC envelope", { jsonrpc: "2.0", id: 2, result: {} }],
    ["tool error", { jsonrpc: "2.0", id: 1, result: { content: [], isError: true } }],
    [
      "invalid source references",
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                response: "Synthetic answer",
                conversationId: "synthetic-conversation",
                sourceReferences: ["not-an-object"],
              }),
            },
          ],
        },
      },
    ],
  ])("fails closed on malformed response: %s", async (_label, body) => {
    const client = new WorkIqRestClient({
      fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }),
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });
    await expect(client.ask({ question: "What changed?" })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-MALFORMED",
    });
  });

  it("rejects a partial fetch response instead of returning partial data", async () => {
    const client = new WorkIqRestClient({
      fetchImpl: async () => toolResponse({ results: [{ data: {}, statusCode: 200 }] }),
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });
    await expect(client.fetch({ entityUrls: ["/me/messages", "/me/events"] })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-MALFORMED",
    });
  });

  it("fails closed when one fetched entity has a non-success status", async () => {
    const client = new WorkIqRestClient({
      fetchImpl: async () =>
        toolResponse({
          results: [
            { data: { subject: "Synthetic" }, statusCode: 200 },
            { data: { error: "not found" }, statusCode: 404 },
          ],
        }),
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });
    await expect(client.fetch({ entityUrls: ["/me/messages/1", "/me/messages/2"] })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-HTTP",
    });
  });

  it("returns only fetch schemas and rejects unsafe resource paths", async () => {
    const fetchImpl = vi.fn(async () =>
      toolSseResponse({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" }),
    );
    const client = new WorkIqRestClient({ fetchImpl, tokenProvider, expectedTenantId: TENANT_ID });

    await expect(client.getSchema({ path: "/me/messages" })).resolves.toMatchObject({
      ok: true,
      value: { schema: { type: "object" } },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      params: { name: "get_schema", arguments: { path: "/me/messages", operationType: "fetch" } },
    });
    await expect(client.fetch({ entityUrls: ["https://graph.microsoft.com/v1.0/me/messages"] })).rejects.toThrow(
      "E-WIQ-INPUT",
    );
  });

  it("accepts text only for an explicitly requested TypeScript schema", async () => {
    const jsonSchemaClient = new WorkIqRestClient({
      fetchImpl: async () => toolResponse("not a JSON schema"),
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });
    await expect(jsonSchemaClient.getSchema({ path: "/me/messages" })).resolves.toEqual({
      ok: false,
      errorCode: "E-WIQ-MALFORMED",
    });

    const typescriptClient = new WorkIqRestClient({
      fetchImpl: async () => toolResponse("interface SyntheticMessage { id: string }"),
      tokenProvider,
      expectedTenantId: TENANT_ID,
    });
    await expect(typescriptClient.getSchema({ path: "/me/messages", format: "typescript" })).resolves.toMatchObject({
      ok: true,
      value: { schema: "interface SyntheticMessage { id: string }" },
    });
  });
});
