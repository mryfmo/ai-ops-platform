/**
 * verification/model-gateway/conformance.test.ts
 *
 * 根拠: FinalArch:LLM-002 / FinalArch:LLM-004 / FinalArch:LLM-005 / ADR-0022
 * 合成 provider envelope と LiteLLM mock aliases の dual-path conformance を検証する。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { parse } from "yaml";
import {
  FALLBACK_ALLOWED_ERROR_CLASSES,
  FALLBACK_FORBIDDEN_ERROR_CLASSES,
  normalizeAnthropicError,
} from "../../packages/shared/src/clients/anthropicClient.js";
import {
  BEDROCK_ONLY_ERROR_FIXTURE,
  CACHE_FIXTURES,
  ERROR_FIXTURES,
  STREAM_FIXTURES,
  SYNTHETIC_SCHEMA,
  THINKING_FIXTURES,
  TOOL_FIXTURES,
} from "./fixtures.js";

type JsonObject = Record<string, any>;

const gatewayBaseUrl = process.env.MODEL_GATEWAY_BASE_URL?.replace(/\/$/u, "");
const gatewayKey = process.env.MODEL_GATEWAY_KEY;
const useMock = process.env.MODEL_GATEWAY_USE_MOCK !== "0";
const bedrockAlias = process.env.MODEL_GATEWAY_BEDROCK_ALIAS ?? "synthetic-bedrock";
const anthropicAlias = process.env.MODEL_GATEWAY_ANTHROPIC_ALIAS ?? "synthetic-anthropic";

function normalizeTool(provider: "bedrock" | "anthropic", response: JsonObject) {
  if (provider === "bedrock") {
    const block = response.output.message.content.find((item: JsonObject) => item.toolUse)?.toolUse;
    return { id: block.toolUseId, name: block.name, input: block.input, stopReason: response.stopReason };
  }
  const block = response.content.find((item: JsonObject) => item.type === "tool_use");
  return { id: block.id, name: block.name, input: block.input, stopReason: response.stop_reason };
}

function normalizeStream(provider: "bedrock" | "anthropic", events: readonly JsonObject[]) {
  if (provider === "bedrock") {
    return {
      text: events.map((event) => event.contentBlockDelta?.delta?.text ?? "").join(""),
      stopReason: events.find((event) => event.messageStop)?.messageStop.stopReason,
    };
  }
  return {
    text: events.map((event) => (event.delta?.type === "text_delta" ? event.delta.text : "")).join(""),
    stopReason: events.find((event) => event.type === "message_stop")?.stop_reason,
  };
}

function normalizeThinking(provider: "bedrock" | "anthropic", block: JsonObject) {
  if (provider === "bedrock") {
    return {
      text: block.reasoningContent.reasoningText.text,
      signature: block.reasoningContent.reasoningText.signature,
    };
  }
  return { text: block.thinking, signature: block.signature };
}

function normalizeCacheUsage(provider: "bedrock" | "anthropic", usage: JsonObject) {
  return provider === "bedrock"
    ? { read: usage.cacheReadInputTokens, creation: usage.cacheWriteInputTokens }
    : { read: usage.cache_read_input_tokens, creation: usage.cache_creation_input_tokens };
}

function normalizeProviderError(provider: "bedrock" | "anthropic", error: JsonObject): string {
  if (provider === "bedrock") {
    if (error.code === "ModelNotReadyException") return "model_temporarily_unavailable";
    if (error.code === "ServiceUnavailableException") return "regional_unavailable";
    if (error.code === "ThrottlingException") return "rate_limited";
    if (error.code === "AccessDeniedException") return "policy_denied";
    if (error.code === "ValidationException") {
      return /context/iu.test(error.message) ? "context_limit" : "invalid_request";
    }
    if (error.status >= 500) return "provider_5xx";
  } else {
    if (error.type === "overloaded_error" || error.status === 529) return "model_temporarily_unavailable";
    if (error.type === "rate_limit_error" || error.status === 429) return "rate_limited";
    if (error.status === 401 || error.status === 403) return "policy_denied";
    if (error.status === 400 || error.status === 404 || error.status === 422) {
      return /context/iu.test(error.message) ? "context_limit" : "invalid_request";
    }
    if (error.status >= 500) return "provider_5xx";
  }
  return "unknown";
}

function parseSse(body: string) {
  const data = body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  return {
    events: data.filter((line) => line !== "[DONE]").map((line) => JSON.parse(line)),
    done: data.at(-1) === "[DONE]" && data.filter((line) => line === "[DONE]").length === 1,
  };
}

function parseGatewayError(body: string, status: number) {
  const parsed = JSON.parse(body);
  assert.equal(typeof parsed.error?.message, "string");
  const code = Number(parsed.error.code);
  if (Number.isInteger(code)) assert.equal(code, status);
  return Object.assign(new Error(parsed.error.message), { status });
}

async function gatewayRequest(path: string, body: JsonObject, extraHeaders: Record<string, string> = {}) {
  assert(gatewayBaseUrl, "MODEL_GATEWAY_BASE_URL is required for gateway checks");
  assert(gatewayKey, "MODEL_GATEWAY_KEY is required for gateway checks");
  return fetch(`${gatewayBaseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: ["Bearer", gatewayKey].join(" "),
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

async function message(alias: string, overrides: JsonObject = {}, extraHeaders: Record<string, string> = {}) {
  return gatewayRequest(
    "/v1/messages",
    {
      model: alias,
      max_tokens: 32,
      messages: [{ role: "user", content: "synthetic conformance input" }],
      ...overrides,
    },
    extraHeaders,
  );
}

describe("synthetic provider envelopes [FinalArch:LLM-005]", () => {
  test("forced tool_choice and input_schema normalize identically [FinalArch:LLM-005]", () => {
    assert.deepEqual(TOOL_FIXTURES.anthropic.request.tools[0].input_schema, SYNTHETIC_SCHEMA);
    assert.equal(TOOL_FIXTURES.anthropic.request.tool_choice.type, "tool");
    assert.deepEqual(TOOL_FIXTURES.bedrock.request.toolConfig.tools[0].toolSpec.inputSchema.json, SYNTHETIC_SCHEMA);
    assert.equal(TOOL_FIXTURES.bedrock.request.toolConfig.toolChoice.tool.name, "lookup_synthetic");
    assert.deepEqual(
      normalizeTool("bedrock", TOOL_FIXTURES.bedrock.response),
      normalizeTool("anthropic", TOOL_FIXTURES.anthropic.response),
    );
  });

  test("stream event sequences normalize identically [FinalArch:LLM-005]", () => {
    assert.deepEqual(
      normalizeStream("bedrock", STREAM_FIXTURES.bedrock),
      normalizeStream("anthropic", STREAM_FIXTURES.anthropic),
    );
  });

  test("SSE parser requires exactly one terminal DONE marker [FinalArch:LLM-005]", () => {
    const event = 'data: {"choices":[{"delta":{"content":"synthetic"}}]}';
    assert.equal(parseSse(`${event}\ndata: [DONE]\n`).done, true);
    assert.equal(parseSse(`${event}\ndata: [DONE]\n${event}\ndata: [DONE]\n`).done, false);
  });

  test("extended thinking header and reasoning blocks normalize identically [FinalArch:LLM-005]", () => {
    assert.match(THINKING_FIXTURES.betaHeader, /thinking/u);
    assert.equal(THINKING_FIXTURES.request.thinking.type, "enabled");
    assert.deepEqual(
      normalizeThinking("bedrock", THINKING_FIXTURES.bedrock),
      normalizeThinking("anthropic", THINKING_FIXTURES.anthropic),
    );
  });

  test("cache_control ephemeral usage normalizes identically [FinalArch:LLM-005]", () => {
    assert.equal(CACHE_FIXTURES.request.system[0].cache_control.type, "ephemeral");
    assert.deepEqual(
      normalizeCacheUsage("bedrock", CACHE_FIXTURES.bedrock),
      normalizeCacheUsage("anthropic", CACHE_FIXTURES.anthropic),
    );
  });
});

describe("canonical error mapping [FinalArch:LLM-004]", () => {
  test("suite config pins oss.3 and distinct Bedrock/Anthropic mock providers", () => {
    const config = parse(readFileSync("verification/model-gateway/config.yaml", "utf8"));
    assert.equal(
      config.provenance.image,
      "ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a42798776da20d252f75e7672855c51de97dbc5d3e03fad47eff1fce97c4",
    );
    const models = new Map(config.model_list.map((entry: JsonObject) => [entry.model_name, entry.litellm_params]));
    assert.equal(models.get("synthetic-bedrock").custom_llm_provider, "bedrock");
    assert.equal(models.get("synthetic-anthropic").custom_llm_provider, "anthropic");
    assert.equal(models.get("synthetic-bedrock").mock_response, "synthetic conformance response");
    assert.equal(models.get("synthetic-anthropic").mock_response, "synthetic conformance response");
  });

  test("shared constants exactly match the routing manifest", () => {
    const manifest = parse(readFileSync("deploy/litellm/model-aliases.yaml", "utf8"));
    assert.deepEqual([...FALLBACK_ALLOWED_ERROR_CLASSES], manifest.aiops_settings.fallbacks[0].on_errors);
    assert.deepEqual([...FALLBACK_FORBIDDEN_ERROR_CLASSES], manifest.aiops_settings.fallback_forbidden_errors);
  });

  test("provider error envelopes map to canonical classes", () => {
    const canonicalClasses = new Set<string>([...FALLBACK_ALLOWED_ERROR_CLASSES, ...FALLBACK_FORBIDDEN_ERROR_CLASSES]);
    for (const fixture of ERROR_FIXTURES) {
      const bedrockClass = normalizeProviderError("bedrock", fixture.bedrock);
      const anthropicClass = normalizeProviderError("anthropic", fixture.anthropic);
      assert.equal(bedrockClass, fixture.errorClass);
      assert.equal(anthropicClass, fixture.errorClass);
      assert(canonicalClasses.has(bedrockClass));
      assert(canonicalClasses.has(anthropicClass));
    }
    assert.equal(normalizeProviderError("bedrock", BEDROCK_ONLY_ERROR_FIXTURE), "regional_unavailable");
  });

  test("HTTP-only normalizer preserves canonical status mapping and fail-closed 4xx", () => {
    const cases = [
      [429, "synthetic throttle", "rate_limited", true],
      [500, "synthetic internal", "provider_5xx", true],
      [529, "synthetic overloaded", "model_temporarily_unavailable", true],
      [403, "synthetic denied", "policy_denied", false],
      [400, "synthetic invalid", "invalid_request", false],
      [400, "synthetic context limit", "context_limit", false],
    ] as const;
    for (const [status, text, errorClass, eligible] of cases) {
      const normalized = normalizeAnthropicError(Object.assign(new Error(text), { status }));
      assert.equal(normalized.errorClass, errorClass);
      assert.equal(normalized.fallbackEligible, eligible);
      assert.equal(normalized.httpStatus, status);
    }
  });

  test("provider codes retain distinctions that HTTP 503 alone cannot express", () => {
    const modelNotReady = ERROR_FIXTURES.find((fixture) => fixture.errorClass === "model_temporarily_unavailable")!;
    assert.equal(normalizeProviderError("bedrock", modelNotReady.bedrock), "model_temporarily_unavailable");
    assert.equal(
      normalizeAnthropicError(Object.assign(new Error(modelNotReady.bedrock.message), { status: 503 })).errorClass,
      "provider_5xx",
    );
    assert.equal(normalizeProviderError("bedrock", BEDROCK_ONLY_ERROR_FIXTURE), "regional_unavailable");
  });
});

describe("LiteLLM dual-path mock transport [FinalArch:LLM-002][FinalArch:LLM-005]", { skip: !gatewayBaseUrl }, () => {
  test("tool, thinking, and cache request shapes reach both configured provider paths", async () => {
    assert.notEqual(bedrockAlias, anthropicAlias, "provider-path aliases must be distinct");
    const requests: Array<[JsonObject, Record<string, string>, (body: JsonObject) => void]> = [
      [
        TOOL_FIXTURES.anthropic.request,
        {},
        (body) => assert(body.content.some((block: JsonObject) => block.type === "tool_use")),
      ],
      [
        CACHE_FIXTURES.request,
        {},
        (body) => {
          assert.equal(typeof body.usage?.cache_read_input_tokens, "number");
          assert.equal(typeof body.usage?.cache_creation_input_tokens, "number");
        },
      ],
      [
        { ...THINKING_FIXTURES.request, max_tokens: 2048 },
        { "anthropic-beta": THINKING_FIXTURES.betaHeader },
        (body) => assert(body.content.some((block: JsonObject) => block.type === "thinking")),
      ],
    ];
    for (const alias of [bedrockAlias, anthropicAlias]) {
      for (const [overrides, headers, validate] of requests) {
        const response = await message(alias, overrides, headers);
        const body = await response.text();
        assert.equal(response.status, 200, `${alias}: ${body}`);
        if (!useMock) validate(JSON.parse(body));
      }
    }
  });

  test("streaming reaches both configured provider paths", async () => {
    for (const alias of [bedrockAlias, anthropicAlias]) {
      const response = await gatewayRequest("/v1/chat/completions", {
        model: alias,
        stream: true,
        messages: [{ role: "user", content: "synthetic stream input" }],
      });
      const body = await response.text();
      assert.equal(response.status, 200, `${alias}: ${body}`);
      const stream = parseSse(body);
      assert(stream.events.length > 0, `${alias}: no SSE JSON events`);
      assert(
        stream.events.some((event: JsonObject) =>
          event.choices?.some(
            (choice: JsonObject) => typeof choice.delta?.content === "string" && choice.delta.content,
          ),
        ),
        `${alias}: no streamed content delta`,
      );
      assert(
        stream.events
          .at(-1)
          ?.choices?.some(
            (choice: JsonObject) => typeof choice.finish_reason === "string" && choice.finish_reason.length > 0,
          ),
        `${alias}: no terminal finish reason`,
      );
      assert(stream.done, `${alias}: missing [DONE]`);
    }
  });

  test("mock error statuses map identically across provider paths", { skip: !useMock }, async () => {
    const cases = [
      ["rate", 429, "rate_limited"],
      ["internal", 500, "provider_5xx"],
      ["context", 400, "context_limit"],
    ] as const;
    for (const provider of ["bedrock", "anthropic"] as const) {
      for (const [suffix, status, errorClass] of cases) {
        const response = await message(`synthetic-${provider}-${suffix}`);
        const body = await response.text();
        assert.equal(response.status, status, `${provider}/${suffix}: ${body}`);
        const normalized = normalizeAnthropicError(parseGatewayError(body, status));
        assert.equal(normalized.errorClass, errorClass, `${provider}/${suffix}`);
      }
    }
  });
});
