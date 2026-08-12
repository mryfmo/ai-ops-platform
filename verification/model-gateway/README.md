# Synthetic model-gateway conformance

根拠: FinalArch:LLM-002 / FinalArch:LLM-004 / FinalArch:LLM-005 / ADR-0022

Bedrock Converse と Anthropic Messages の provider-specific envelope を完全合成 fixture で比較し、pinned LiteLLM mock aliases の transport も検証します。実 provider credential・実 prompt・実 log は使いません。

## Local pinned gateway

```bash
./verification/model-gateway/run.sh
```

Apple `container` で pinned oss.3（4 GiB）と `postgres:16-alpine` を起動し、終了時に削除します。

## Existing staging tenant

```bash
MODEL_GATEWAY_BASE_URL=https://gateway.example \
MODEL_GATEWAY_KEY="$SCOPED_VIRTUAL_KEY" \
MODEL_GATEWAY_USE_MOCK=0 \
MODEL_GATEWAY_BEDROCK_ALIAS=claude-standard \
MODEL_GATEWAY_ANTHROPIC_ALIAS=claude-standard-fallback \
./verification/model-gateway/run.sh
```

virtual key は指定した2 aliasesだけを許可し、budget と expiry を設定してください。production provider key はローカル環境や runner に渡さないでください。real-tenant mode では mock 専用 error injection tests を自動的に skip します。
外部 URL は HTTPS 必須です（HTTP は loopback の合成 gateway だけ許可）。2 aliases は異なる値でなければ suite が失敗し、real-tenant mode では tool/thinking/cache の応答ブロックと SSE イベントも検証します。
