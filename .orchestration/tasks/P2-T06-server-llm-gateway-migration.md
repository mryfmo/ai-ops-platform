# P2-T06 server LLM consumer の gateway 移行

- task_id: `P2-T06`
- 根拠: FinalArch:LLM-001 / FinalArch:LLM-004 / FinalArch:LLM-006 / PRD-003 / FR-LLM-001..007 / ADR-0022
- Writer: claude-code-fable5-xhigh（WBS 指定） / Reviewer: codex-gpt56-sol-high
- depends_on: P2-T05（#188、codex approve 済み・Owner merge 待ち。merge 後に本タスクの push）
- branch: `agent/P2-T06-server-llm-gateway`（base = #188 merge 後の main）

## allowed_paths（WBS + 検証に必要な最小拡張）

1. `packages/server/src/**` / `packages/prjops/src/agents/**` / `packages/devops/src/agents/**`（WBS）
2. `packages/server/tests/**`・`packages/prjops/tests/**`・`packages/devops/tests/**`
   （WBS verification「grep/fitness test・package tests」の実装先。AGENTS.md は
   同一 PR でのテスト追加を必須とするため、P2-T01-001 と同様の scoped 拡張として明記）

## 現状（survey 済み）

- Anthropic SDK 構築は `packages/server/src/index.ts:331` の 1 箇所のみ
  （`new Anthropic({apiKey: config.ANTHROPIC_API_KEY, ...})` → AnthropicStructuredClient + PgCostGuard）
- 全 7 call site（AGT_BLD classify/suggest・AGT_INC classify・AGT_CHG summarize・
  AGT-03 escalation・teamsConversationAgent・freeTextIntent）は llmClient DI 済みで無変更
- config.ts の LLM env: ANTHROPIC_API_KEY / ANTHROPIC_DEFAULT_MODEL（既定 claude-sonnet-4-6）/
  ANTHROPIC_ESCALATION_MODEL（既定 claude-opus-4-8）/ ANTHROPIC_PRICING_USD_PER_MTOK
- feature flag `inference.litellm.enabled`（packages/shared/src/migration/featureFlags.ts）定義済み・未結線

## deliverables / acceptance

- **transport 差し替え**: index.ts の構築点を `createAnthropicTransport()` へ移行。
  gateway 構成（LITELLM_BASE_URL + LITELLM_VIRTUAL_KEY）が既定。
  direct は `allowDirectModeMigration` を要する明示 env の背後のみ（P2-T05 の契約に従属）
- **LiteLLM logical aliases in all runtime calls**: モデル既定値を logical alias へ変更
  （DEFAULT → `claude-standard`、ESCALATION → `claude-governed`。capability の実体は
  proxy 側 env binding（*_MODEL_ID）が担う。alias 以外を拒否する validation を
  gateway モードの config 層に追加）
- **no provider key in runtime**: gateway モードでは ANTHROPIC_API_KEY を要求しない/使わない。
  grep/fitness test で `new Anthropic(` の直接使用が shared 以外に無いこと・
  runtime 必須 env に provider key が無いことを機械検証
- **cost/route metadata recorded**: 既存 PgCostGuard の usage 行 model 列に alias が
  記録されること + 起動時に transport 構成（mode / gateway host。トークンは記録しない）を
  audit log へ記録

## verification

- grep/fitness test + 各 package tests（vitest、mock fetch でネットワークなし）
- fresh 使い捨て DB で `mise run ci` exit 0 を単独判定してから push
- lockfile 変更禁止

## フロー

App token push/PR、`ai-generated` ラベル、merge しない。レビューは AGMSG-TASK
`P2-T06-REVIEW` で codex に発注。

## 成果物パス

- report/validation/sandbox/learning/autoskill: `.orchestration/*/P2-T06-*.md`
