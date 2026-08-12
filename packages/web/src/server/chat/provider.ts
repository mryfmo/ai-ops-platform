/**
 * packages/web/src/server/chat/provider.ts
 *
 * 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / ADR-0022（P2-T07）。
 * Vercel AI SDK の Anthropic protocol provider を LiteLLM gateway に限定する。
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { withTimeout } from "@aiops/shared";
import { WEB_GATEWAY_MODEL_ALIASES, type WebConfig } from "../config";

type WebFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type WebGatewayConfig = Pick<WebConfig, "LITELLM_BASE_URL" | "LITELLM_WEB_VIRTUAL_KEY" | "ANTHROPIC_DEFAULT_MODEL">;

function anthropicProtocolBaseURL(baseURL: string): string {
  const url = new URL(baseURL);
  const path = url.pathname.replace(/\/+$/u, "");
  url.pathname = path.endsWith("/v1") ? path : `${path}/v1`;
  return url.toString().replace(/\/$/u, "");
}

/** Auth header injection and same-gateway egress enforcement shared by streaming and smoke tests. */
export function createWebGatewayFetch(
  gatewayBaseURL: string,
  virtualKey: string,
  fetchImpl: WebFetch = fetch,
): WebFetch {
  const expected = new URL(gatewayBaseURL);
  const token = virtualKey.trim();
  if (!token) throw new Error("E-CFG06: Web LiteLLM virtual key is required");
  const expectedPath = `${expected.pathname.replace(/\/+$/u, "")}/`;
  const timedFetch = withTimeout(fetchImpl, 600_000);
  return async (input, init = {}) => {
    const requestUrl = new URL(input instanceof Request ? input.url : String(input));
    if (requestUrl.origin !== expected.origin || !requestUrl.pathname.startsWith(expectedPath)) {
      throw new Error(`E-CFG06: request URL is outside configured gateway path ${expected.origin}${expectedPath}`);
    }
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    headers.delete("x-api-key");
    headers.set("authorization", `Bearer ${token}`);
    return timedFetch(input, { ...init, headers, redirect: "error" });
  };
}

export function createWebChatModel(config: WebGatewayConfig, fetchImpl: WebFetch = fetch): LanguageModel {
  const baseURL = config.LITELLM_BASE_URL;
  const virtualKey = config.LITELLM_WEB_VIRTUAL_KEY?.trim();
  if (!baseURL || !virtualKey) throw new Error("E-CFG06: Web LiteLLM gateway URL and virtual key are required");
  if (!WEB_GATEWAY_MODEL_ALIASES.has(config.ANTHROPIC_DEFAULT_MODEL)) {
    throw new Error("E-CFG06: Web chat model must be a LiteLLM logical alias");
  }
  const protocolBaseURL = anthropicProtocolBaseURL(baseURL);
  return createAnthropic({
    baseURL: protocolBaseURL,
    apiKey: virtualKey,
    fetch: createWebGatewayFetch(protocolBaseURL, virtualKey, fetchImpl),
  })(config.ANTHROPIC_DEFAULT_MODEL);
}
