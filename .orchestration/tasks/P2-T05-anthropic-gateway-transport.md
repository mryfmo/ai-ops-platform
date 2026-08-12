# P2-T05 shared Anthropic client の gateway transport 化

- task_id: `P2-T05`
- 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / PRD-003 / FR-LLM-001..007 / ADR-0022 / ADR-0029
- Writer: claude-code-fable5-xhigh（WBS 指定） / Reviewer: codex-gpt56-sol-high
- depends_on: P2-T02（#185/#186 merged）。P2-T03/T04（tenant 待ち）とは独立で先行可
- branch: `agent/P2-T05-anthropic-gateway-transport`（base = main `73a899d` 以降）

## allowed_paths（WBS どおり）

1. `packages/shared/src/clients/anthropicClient.ts`
2. `packages/shared/tests/**`

## deliverables / acceptance

- **baseURL / token provider injection**: LiteLLM gateway を既定とする transport factory。
  virtual key は `AnthropicTokenProvider` 注入（呼び出し毎解決）、baseURL は gateway URL を
  注入。fetch は `FetchLike` 注入（既存 githubClient / fetchPolicy パターン踏襲）
- **direct mode は migration flag の背後のみ**: 明示フラグなしの direct 構成は
  構成時に fail-closed（acceptance: direct mode only behind migration flag）
- **error normalization**: SDK/HTTP エラーを正典 error class
  （deploy/litellm/model-aliases.yaml の `on_errors` / `fallback_forbidden_errors` と
  同一語彙）へ正規化し、fallback 適格性を機械判定可能にする。メッセージは
  secretSanitizer 経由でログ安全化
- **既存 structured output テストの保存**: `AnthropicStructuredClient.call()` の
  挙動・既存テストは不変更（クライアントは従来どおり DI。gateway 移行の結線は P2-T06）

## verification

- shared tests（vitest。既存 describe 不変 + 新規: transport factory / token 注入 /
  direct flag fail-closed / error normalization の表駆動 + 正典語彙一致）
- contract tests（`mise run contracts` — 変更なしで green 維持）
- fresh 使い捨て DB で `mise run ci` exit 0 を単独判定してから push
- lockfile 変更禁止（SDK 追加依存なし）

## フロー

App token push/PR、`ai-generated` ラベル、merge しない。レビューは AGMSG-TASK
`P2-T05-REVIEW` で codex に発注。

## 成果物パス

- report: `.orchestration/reports/P2-T05-report.md`
- validation: `.orchestration/validation/P2-T05-validation.md`
- sandbox: `.orchestration/sandboxes/P2-T05-sandbox.md`
- learning: `.orchestration/learning/P2-T05-learning.md`
- autoskill: `.orchestration/autoskill/runs/P2-T05-autoskill.md`
