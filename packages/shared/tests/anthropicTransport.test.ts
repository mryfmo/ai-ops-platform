/**
 * packages/shared/tests/anthropicTransport.test.ts
 *
 * 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / ADR-0022（P2-T05）
 * gateway transport（baseURL / token provider 注入、direct は移行フラグの背後のみ）と
 * error normalization（正典 model-routing 語彙）を検証する。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  AnthropicRefusalError,
  DailyCostLimitExceededError,
  FALLBACK_ALLOWED_ERROR_CLASSES,
  FALLBACK_FORBIDDEN_ERROR_CLASSES,
  createAnthropicTransport,
  normalizeAnthropicError,
  type AnthropicTokenProvider,
} from "../src/clients/anthropicClient.js";

const GATEWAY_URL = "https://litellm.internal.example:4000";

function staticTokens(...tokens: string[]): AnthropicTokenProvider {
  let index = 0;
  return { getToken: async () => tokens[Math.min(index++, tokens.length - 1)] };
}

function messageResponse(): Response {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-standard",
      content: [],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("createAnthropicTransport [FinalArch:LLM-001][FinalArch:LLM-004]", () => {
  it("gateway モードは baseURL 必須で api.anthropic.com を拒否する [FinalArch:LLM-001]", () => {
    const tokenProvider = staticTokens("vk");
    expect(() => createAnthropicTransport({ mode: "gateway", tokenProvider })).toThrow(/E-CFG05/);
    expect(() => createAnthropicTransport({ mode: "gateway", baseURL: "not a url", tokenProvider })).toThrow(/E-CFG05/);
    expect(() => createAnthropicTransport({ mode: "gateway", baseURL: "ftp://x", tokenProvider })).toThrow(/E-CFG05/);
    expect(() =>
      createAnthropicTransport({ mode: "gateway", baseURL: "https://api.anthropic.com", tokenProvider }),
    ).toThrow(/E-CFG05/);
  });

  it("direct モードは移行フラグなし・baseURL 上書きを構成時に拒否する [FinalArch:LLM-001]", () => {
    const tokenProvider = staticTokens("key");
    expect(() => createAnthropicTransport({ mode: "direct", tokenProvider })).toThrow(/migration/);
    expect(() =>
      createAnthropicTransport({
        mode: "direct",
        tokenProvider,
        allowDirectModeMigration: true,
        baseURL: GATEWAY_URL,
      }),
    ).toThrow(/E-CFG05/);
    expect(() =>
      createAnthropicTransport({ mode: "direct", tokenProvider, allowDirectModeMigration: true }),
    ).not.toThrow();
  });

  it("gateway リクエストは注入 baseURL へ Bearer virtual key で送られ、リクエスト毎にトークンを解決する [FinalArch:LLM-004]", async () => {
    const captured: Array<{ url: string; auth: string | null; apiKey: string | null }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      captured.push({ url: input, auth: headers.get("authorization"), apiKey: headers.get("x-api-key") });
      return messageResponse();
    });
    const client = createAnthropicTransport({
      mode: "gateway",
      baseURL: GATEWAY_URL,
      tokenProvider: staticTokens("vk-first", "vk-rotated"),
      fetch: fetchMock,
    });
    const params = { model: "claude-standard", max_tokens: 1, messages: [{ role: "user" as const, content: "x" }] };
    await client.messages.create(params);
    await client.messages.create(params);
    expect(captured).toHaveLength(2);
    expect(captured[0].url.startsWith(GATEWAY_URL)).toBe(true);
    expect(captured[0].auth).toBe("Bearer vk-first");
    expect(captured[1].auth).toBe("Bearer vk-rotated");
    // SDK コンストラクタのプレースホルダ鍵はネットワークへ出ない
    expect(captured.every((c) => c.apiKey === null)).toBe(true);
  });

  it("direct モードは x-api-key でトークンを送る（移行期のみ） [FinalArch:LLM-001]", async () => {
    const captured: Array<string | null> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      captured.push(new Headers(init?.headers).get("x-api-key"));
      return messageResponse();
    });
    const client = createAnthropicTransport({
      mode: "direct",
      allowDirectModeMigration: true,
      tokenProvider: staticTokens("direct-key"),
      fetch: fetchMock,
    });
    await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1,
      messages: [{ role: "user", content: "x" }],
    });
    expect(captured).toEqual(["direct-key"]);
  });

  it("空トークンはリクエストを fail-closed にする [FinalArch:LLM-004]", async () => {
    const fetchMock = vi.fn(async () => messageResponse());
    const client = createAnthropicTransport({
      mode: "gateway",
      baseURL: GATEWAY_URL,
      tokenProvider: { getToken: async () => "  " },
      fetch: fetchMock,
      timeoutMs: 1000,
    });
    // SDK は fetch 層の例外を接続エラーとして包むが、実 fetch には一切到達しない
    // （空トークンのままリクエストが外に出ないことが保証点）。
    await expect(
      client.messages.create({ model: "claude-standard", max_tokens: 1, messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/E-CFG05|Connection error/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("normalizeAnthropicError [FinalArch:LLM-004]", () => {
  const withStatus = (status: number, message = "boom") => Object.assign(new Error(message), { status });

  it("正典 error class へ表どおりに正規化する [FinalArch:LLM-004]", () => {
    const cases: Array<[unknown, string, boolean]> = [
      [new AnthropicRefusalError("m"), "safety_refusal", false],
      [new DailyCostLimitExceededError(21, 20), "policy_denied", false],
      [withStatus(408), "timeout", true],
      [withStatus(429), "rate_limited", true],
      [withStatus(500), "provider_5xx", true],
      [withStatus(529), "model_temporarily_unavailable", true],
      [withStatus(401), "policy_denied", false],
      [withStatus(403), "policy_denied", false],
      [withStatus(400, "prompt is too long: 250000 tokens"), "context_limit", false],
      [withStatus(400, "invalid tool schema"), "invalid_request", false],
      [withStatus(404, "model: no-such"), "invalid_request", false],
      [new DOMException("aborted", "AbortError"), "timeout", true],
      [new Error("Request timed out."), "timeout", true],
      [new Error("fetch failed: ECONNREFUSED"), "model_temporarily_unavailable", true],
      [new Error("mystery"), "unknown", false],
      ["string error", "unknown", false],
    ];
    for (const [error, expectedClass, eligible] of cases) {
      const normalized = normalizeAnthropicError(error);
      expect(normalized.errorClass, String(error)).toBe(expectedClass);
      expect(normalized.fallbackEligible, String(error)).toBe(eligible);
    }
  });

  it("httpStatus を保持しメッセージをサニタイズ・切り詰めする [FinalArch:LLM-004 / DevOps:SPEC-INT-070]", () => {
    const leaky = Object.assign(new Error(`denied for key ghp_${"a".repeat(36)} end`), { status: 403 });
    const normalized = normalizeAnthropicError(leaky);
    expect(normalized.httpStatus).toBe(403);
    expect(normalized.message).not.toContain("ghp_");
    const long = normalizeAnthropicError(new Error("x".repeat(2000)));
    expect(long.message.length).toBeLessThanOrEqual(512);
  });

  it("fallback 語彙は正典 model-routing manifest と一致する [FinalArch:LLM-004]", () => {
    const manifest = readFileSync(new URL("../../../deploy/litellm/model-aliases.yaml", import.meta.url), "utf8");
    const listAfter = (anchor: string): string[] => {
      const start = manifest.indexOf(anchor);
      expect(start, anchor).toBeGreaterThan(-1);
      const items: string[] = [];
      for (const line of manifest.slice(start).split("\n").slice(1)) {
        const match = /^\s+-\s+([a-z0-9_]+)\s*$/.exec(line);
        if (!match) break;
        items.push(match[1]);
      }
      return items;
    };
    expect([...FALLBACK_ALLOWED_ERROR_CLASSES]).toEqual(listAfter("on_errors: &allowed_fallback_errors"));
    expect([...FALLBACK_FORBIDDEN_ERROR_CLASSES]).toEqual(listAfter("fallback_forbidden_errors:"));
  });
});
