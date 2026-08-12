/**
 * verification/model-gateway/fixtures.ts
 *
 * 根拠: FinalArch:LLM-002 / FinalArch:LLM-004 / FinalArch:LLM-005 / ADR-0022
 * Bedrock Converse と Anthropic Messages の合成 conformance fixture。
 * 実プロンプト、実ログ、credential を含めない。
 */

export const SYNTHETIC_SCHEMA = {
  type: "object",
  properties: { item: { type: "string" } },
  required: ["item"],
  additionalProperties: false,
} as const;

export const TOOL_FIXTURES = {
  bedrock: {
    request: {
      toolConfig: {
        tools: [{ toolSpec: { name: "lookup_synthetic", inputSchema: { json: SYNTHETIC_SCHEMA } } }],
        toolChoice: { tool: { name: "lookup_synthetic" } },
      },
    },
    response: {
      output: {
        message: {
          role: "assistant",
          content: [
            {
              toolUse: {
                toolUseId: "synthetic-tool-1",
                name: "lookup_synthetic",
                input: { item: "synthetic-item" },
              },
            },
          ],
        },
      },
      stopReason: "tool_use",
    },
  },
  anthropic: {
    request: {
      tools: [{ name: "lookup_synthetic", description: "Return synthetic data", input_schema: SYNTHETIC_SCHEMA }],
      tool_choice: { type: "tool", name: "lookup_synthetic" },
    },
    response: {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "synthetic-tool-1",
          name: "lookup_synthetic",
          input: { item: "synthetic-item" },
        },
      ],
      stop_reason: "tool_use",
    },
  },
} as const;

export const STREAM_FIXTURES = {
  bedrock: [
    { messageStart: { role: "assistant" } },
    { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "synthetic " } } },
    { contentBlockDelta: { contentBlockIndex: 0, delta: { text: "stream" } } },
    { messageStop: { stopReason: "end_turn" } },
  ],
  anthropic: [
    { type: "message_start", message: { role: "assistant" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "synthetic " } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "stream" } },
    { type: "message_stop", stop_reason: "end_turn" },
  ],
} as const;

export const THINKING_FIXTURES = {
  betaHeader: "interleaved-thinking-2025-05-14",
  request: { thinking: { type: "enabled", budget_tokens: 1024 } },
  bedrock: {
    reasoningContent: { reasoningText: { text: "synthetic reasoning", signature: "synthetic-signature" } },
  },
  anthropic: {
    type: "thinking",
    thinking: "synthetic reasoning",
    signature: "synthetic-signature",
  },
} as const;

export const CACHE_FIXTURES = {
  request: {
    system: [{ type: "text", text: "synthetic cache input ".repeat(1200), cache_control: { type: "ephemeral" } }],
  },
  bedrock: {
    inputTokens: 7,
    outputTokens: 3,
    totalTokens: 21,
    cacheReadInputTokens: 5,
    cacheWriteInputTokens: 6,
  },
  anthropic: {
    input_tokens: 7,
    output_tokens: 3,
    cache_read_input_tokens: 5,
    cache_creation_input_tokens: 6,
  },
} as const;

export const ERROR_FIXTURES = [
  {
    errorClass: "rate_limited",
    bedrock: { status: 429, code: "ThrottlingException", message: "synthetic throttle" },
    anthropic: { status: 429, type: "rate_limit_error", message: "synthetic throttle" },
  },
  {
    errorClass: "provider_5xx",
    bedrock: { status: 500, code: "InternalServerException", message: "synthetic internal error" },
    anthropic: { status: 500, type: "api_error", message: "synthetic internal error" },
  },
  {
    errorClass: "model_temporarily_unavailable",
    bedrock: { status: 503, code: "ModelNotReadyException", message: "synthetic model not ready" },
    anthropic: { status: 529, type: "overloaded_error", message: "synthetic overloaded" },
  },
  {
    errorClass: "policy_denied",
    bedrock: { status: 403, code: "AccessDeniedException", message: "synthetic denied" },
    anthropic: { status: 403, type: "permission_error", message: "synthetic denied" },
  },
  {
    errorClass: "invalid_request",
    bedrock: { status: 400, code: "ValidationException", message: "synthetic invalid request" },
    anthropic: { status: 400, type: "invalid_request_error", message: "synthetic invalid request" },
  },
  {
    errorClass: "context_limit",
    bedrock: { status: 400, code: "ValidationException", message: "synthetic context limit exceeded" },
    anthropic: { status: 400, type: "invalid_request_error", message: "synthetic context limit exceeded" },
  },
] as const;

export const BEDROCK_ONLY_ERROR_FIXTURE = {
  errorClass: "regional_unavailable",
  status: 503,
  code: "ServiceUnavailableException",
  message: "synthetic regional outage",
} as const;
