/**
 * packages/web/tests/chat/provider.test.ts
 *
 * 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / ADR-0022（P2-T07）。
 */
import { describe, expect, it, vi } from "vitest";
import { streamText } from "ai";
import { createWebChatModel, createWebGatewayFetch } from "../../src/server/chat/provider";

describe("createWebChatModel [FinalArch:LLM-001 / FinalArch:LLM-004]", () => {
  it("alias streaming request を gateway /v1/messages へ Bearer virtual key で送る", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestInit = init;
      return Response.json({ error: { message: "dummy upstream unavailable", type: "api_error" } }, { status: 502 });
    });
    const model = createWebChatModel(
      {
        LITELLM_BASE_URL: "https://gateway.example/internal/",
        LITELLM_WEB_VIRTUAL_KEY: "vk-web-test",
        ANTHROPIC_DEFAULT_MODEL: "claude-standard",
      },
      fetchMock,
    );

    const result = streamText({ model, prompt: "hello", maxRetries: 0 });
    await expect(result.text).rejects.toThrow();
    expect(requestUrl).toBe("https://gateway.example/internal/v1/messages");
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("authorization")).toBe("Bearer vk-web-test");
    expect(headers.has("x-api-key")).toBe(false);
    expect(requestInit?.redirect).toBe("error");
  });

  it("gateway path 外への request は virtual key 付与前に遮断する", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const gatewayFetch = createWebGatewayFetch("https://gateway.example/internal/v1", "vk-web-test", fetchMock);

    await expect(gatewayFetch("https://other.example/v1/messages")).rejects.toThrow(/outside configured gateway/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("空の Web virtual key は fetch 構築時に拒否する", () => {
    expect(() => createWebGatewayFetch("https://gateway.example/v1", "  ")).toThrow(/virtual key is required/);
  });

  it("provider factory は gateway 構成不備と raw model ID を fail-fast する", () => {
    expect(() =>
      createWebChatModel({
        LITELLM_BASE_URL: undefined,
        LITELLM_WEB_VIRTUAL_KEY: "vk-web-test",
        ANTHROPIC_DEFAULT_MODEL: "claude-standard",
      }),
    ).toThrow(/gateway URL and virtual key are required/);
    expect(() =>
      createWebChatModel({
        LITELLM_BASE_URL: "https://gateway.example",
        LITELLM_WEB_VIRTUAL_KEY: "vk-web-test",
        ANTHROPIC_DEFAULT_MODEL: "claude-sonnet-4-6",
      }),
    ).toThrow(/logical alias/);
  });
});
