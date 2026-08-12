# Bedrock vs Anthropic synthetic compatibility report

根拠: FinalArch:LLM-002 / FinalArch:LLM-004 / FinalArch:LLM-005 / ADR-0022

## Scope

このレポートは完全合成データだけを使った conformance 結果です。provider-specific fixture の正規化と、pinned LiteLLM oss.3 の `mock_response` aliases への transport を検証します。実 tenant/provider の性能・availability・課金を証明するものではありません。

## Results

| Dimension     | Bedrock path                                                                | Anthropic path                                                                        | Compatibility result                                                                                              |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tool use      | Converse `toolConfig.toolChoice.tool` + `inputSchema.json`; `toolUse` block | Messages forced `tool_choice` + `input_schema`; `tool_use` block                      | Same canonical id/name/input/stop reason                                                                          |
| Streaming     | `messageStart` → `contentBlockDelta` → `messageStop`                        | `message_start` → `content_block_delta` → `message_stop`                              | Same assembled text and stop reason; both LiteLLM mock aliases emit SSE completion and `[DONE]`                   |
| Thinking      | `reasoningContent.reasoningText`                                            | extended-thinking beta header + `thinking` block                                      | Same reasoning text/signature after normalization                                                                 |
| Cache         | `cacheReadInputTokens` / `cacheWriteInputTokens`                            | `cache_control: ephemeral`; `cache_read_input_tokens` / `cache_creation_input_tokens` | Same read/creation counters after normalization                                                                   |
| Error mapping | AWS exception code + HTTP status                                            | Anthropic error type + HTTP status                                                    | Shared canonical allowed/forbidden vocabulary matches manifest; representative 429/500/529/403/400 mappings agree |

## Material differences

- Bedrock exposes `ModelNotReadyException` and `ServiceUnavailableException`; HTTP 503 alone cannot distinguish `model_temporarily_unavailable` or `regional_unavailable` from generic `provider_5xx`. The existing HTTP-only shared normalizer conservatively returns `provider_5xx`. Provider code must be preserved when the finer canonical class is required.
- Anthropic does not expose a dedicated regional-unavailable public error type in the tested contract; its generic 5xx remains `provider_5xx` unless gateway metadata supplies a stronger signal.
- Forced tool choice and extended thinking are separate cases because Anthropic does not support forced `tool` choice together with extended thinking.

## Re-run

`./verification/model-gateway/run.sh` runs the deterministic local suite. Set `MODEL_GATEWAY_BASE_URL`, `MODEL_GATEWAY_KEY`, `MODEL_GATEWAY_USE_MOCK=0`, and both alias variables to repeat the non-injection checks against P2-T03/T04 staging tenants.

Primary shape references: [Amazon Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html), [Amazon Bedrock prompt caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html), [Anthropic tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use), and [Anthropic pricing/usage fields](https://docs.anthropic.com/en/docs/about-claude/pricing).
