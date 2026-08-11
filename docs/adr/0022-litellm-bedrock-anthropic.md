# ADR-0022: LiteLLMをBedrock + Anthropic API専用Inference Planeに採用する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

全application/agent inferenceをLiteLLM logical aliasへ集約する。Bedrockを既定、Anthropic APIをexplicit policy許可されたnative/alternative pathとする。LiteLLMのMCP/A2A機能は使用しない。provider/master keysはgatewayだけが保持する。

## Supersession

ADR-0002の「LLM対象範囲、structured tool output、deterministic logic separation」は維持するが、direct Anthropic credential/provider selectionを更新する。

## Consequences

Claude Code/Droidもscoped virtual keyを使用。fallbackはtransport/429/5xx等に限定し、policy/safety/classification errorでは行わない。
