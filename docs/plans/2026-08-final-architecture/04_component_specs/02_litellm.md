# Component Spec: LiteLLM Inference Plane

## Scope

LiteLLM Proxyを唯一のproduction LLM ingressにする。BedrockとAnthropic APIをAnthropic/OpenAI互換の論理aliasとして提供する。

## 禁止

- LiteLLM MCP Gateway/A2A Gatewayを有効化しない。
- master keyをclientへ配布しない。
- provider API keyをClaude Code/Droid/Webへ渡さない。
- clientが実model/providerを選べるgeneric passthroughを公開しない。

## Required interfaces

- Anthropic Messages-compatible endpoint for Claude Code/Web/server。
- OpenAI-compatible endpointは必要なinternal consumerだけ。
- `/health`、metrics、model alias lookup。
- virtual key / team / budget / rate limit management。

## Configuration source

`deploy/litellm/model-aliases.yaml`をplatform-owned source of truthとし、vendor configを生成・検証する。alias、provider、model ID、classification、fallback、feature support、pricing revisionを管理する。

## Migration from current code

1. `AnthropicClient` interfaceを維持。
2. transportへ`baseURL`とgateway token providerを注入。
3. direct API pathをfeature flag化。
4. dual-runはsynthetic/redacted casesのみ。
5. Web AI SDK providerをLiteLLM base URLへ変更。
6. GitHub coding actionを`ANTHROPIC_BASE_URL` + scoped tokenへ変更。
7. egress denyでdirect provider pathを閉じる。

## Cost and usage

既存PgCostGuardとLiteLLM usageを二重正本にしない。LiteLLMをinvocation usageの正本とし、AI Ops ledgerへeventとして取り込む。既存daily budget guardはmigration期間中に照合し、cutover後はpolicy/read modelとしてLiteLLM dataを利用する。

## Compatibility tests

- tool use / forced tool schema
- extended/adaptive thinking header passthrough
- prompt caching
- streaming
- error mapping
- 1M context header if allowed
- Claude Code CLI end-to-end
- Bedrock ↔ Anthropic behavior difference
