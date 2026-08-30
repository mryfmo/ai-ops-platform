# P7-T04: Implement rich result components

- task_id: P7-T04
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P7-T03 ✅（#258）
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-002（render snapshot まで。live E2E は tenant 後）
- risk: medium
- **並行注意**: open PR #260（channel-teams の approvalCard/index +
  server approvals 系）。**#260 変更ファイルへ接触禁止** —
  components/ 配下の新規ファイルで完結し、index.ts の re-export が
  必要なら **#260 merge 後に rebase して追記**（順序条件）

## Canon / 前提

- WBS deliverables: status / table / chart / incident / PR / source cards
- **acceptance: data comes from typed result, not LLM markup** —
  AGENTS 原則 2（数値・表はコード算出、LLM は文章スロットのみ）の
  card 面での貫徹
- canon 05_opentag_teams.md: cards/tables/charts/diagram/incident/approval UI
  （approval card は P7-T05 済み — 本タスクは結果表示系）
- P7-T01..T03 の中立契約（AgUiRunRequest 系）と channel-teams 規約
  （business state なし・依存ゼロ）

## Objective

1. **typed result model**（pure）: status / table / chart / incident /
   PR / source-refs の**型付き結果契約**（unknown からの strict parse —
   LLM が生成した markup/HTML/Adaptive Card JSON を**そのまま render する
   経路を持たない**設計。数値・系列は型付き数値のみ受理）
2. **card builders**（pure）: 各 typed result → Adaptive Card payload の
   決定的生成（同一入力 → byte 一致）。text スロットは sanitize 済み文字列のみ、
   URL は allowlist scheme（https）検証、サイズ上限（Teams card 制限）で
   fail-closed
3. tests: render snapshot（決定的出力の固定）+ 負 fixture
   （markup 注入・script/データ URI・不正数値・上限超過・未知型）

## Acceptance（WBS）

- data comes from typed result, not LLM markup（型で経路遮断 + 負 fixture）

## Forbidden

- LLM 生成 markup/JSON の pass-through render / channel 状態
- open PR #260 変更ファイル接触（index re-export は merge 後）
- 依存追加 / 実資格情報 / main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `packages/channel-teams/src/components/**`（新規）+
  `packages/channel-teams/tests/**`
- `packages/channel-teams/src/index.ts`（**#260 merge 後のみ** re-export 行）
- `.orchestration/**`（証跡）

## Validation

- snapshot/負 fixture green / fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P7-T04-rich-result-components`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T04-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T04 status=ready_for_review
