# ADR-0022: LiteLLMをBedrock + Anthropic API専用Inference Planeに採用する

## Status
Accepted proposal.

## Decision
全application/agent inferenceをLiteLLM logical aliasへ集約する。Bedrockを既定、Anthropic APIをexplicit policy許可されたnative/alternative pathとする。LiteLLMのMCP/A2A機能は使用しない。provider/master keysはgatewayだけが保持する。

## Supersession
ADR-0002の「LLM対象範囲、structured tool output、deterministic logic separation」は維持するが、direct Anthropic credential/provider selectionを更新する。

## Consequences
Claude Code/Droidもscoped virtual keyを使用。fallbackはtransport/429/5xx等に限定し、policy/safety/classification errorでは行わない。
