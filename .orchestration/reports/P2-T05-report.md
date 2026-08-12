# P2-T05 report

- Status: complete — #188 merged（main `137a1e0`）
- Branch: `agent/P2-T05-anthropic-gateway-transport`（base = main `73a899d`）
- PR: https://github.com/mryfmo/ai-ops-platform/pull/188（final head `f81e189`）
- Writer: claude-code-fable5-xhigh / Reviewer: codex-gpt56-sol-high（P2-T05-REVIEW 発注済み）

## Delivered

- `createAnthropicTransport`（packages/shared/src/clients/anthropicClient.ts）:
  gateway 既定の transport factory。baseURL / AnthropicTokenProvider / FetchLike 注入、
  virtual key はリクエスト毎解決 + fetch ラッパで Bearer 供給（SDK に実キー不渡し）。
  gateway での api.anthropic.com 指定拒否。direct は allowDirectModeMigration=true の
  背後のみ（E-CFG05 fail-closed、baseURL 上書き不可）
- `normalizeAnthropicError` + `FALLBACK_ALLOWED/FORBIDDEN_ERROR_CLASSES`:
  正典 model-routing 語彙への正規化と fallback 適格性の機械判定
  （unknown は不適格 = fail-closed）。メッセージは secretSanitizer + 512 字上限
- `AnthropicStructuredClient.call()` は不変更（consumer 結線と alias 移行は P2-T06）

## Handoff to P2-T06

- consumer は `createAnthropicTransport({mode:"gateway", baseURL, tokenProvider})` で
  SDK client を構築して既存 `AnthropicStructuredClient` に注入する。
  model は logical alias（claude-standard 等）へ移行すること
- direct fallback を残す場合は必ず migration flag を設定ファイル経由で明示し、
  P2-T07 cutover で撤去する
- fallback 判断は `normalizeAnthropicError(...).fallbackEligible` を唯一の入口とする
  （T01 handoff の error-classification guard がこの関数で実装された）
