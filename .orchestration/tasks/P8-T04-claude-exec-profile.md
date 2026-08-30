# P8-T04: Harden Claude Code execution profile

- task_id: P8-T04
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude）/ reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P8-T02 ✅（#251）/ P8-T03 ✅（#264）
- acceptance_gate_ids: COD-003（ci 面。staging E2E は環境 gate 後）
- risk: medium

## Canon / 前提（必読）

- canon 07_agent_execution/CLAUDE_CODE_FABLE5_XHIGH.md と
  04_component_specs/09_coding_agents.md「Runner environment」:
  exact pinned CLI/version/digest / scoped virtual key（P8-T03 済み）/
  allowed/forbidden paths / max runtime/cost/tokens/tool calls /
  no direct production network / clean checkout
- 既存 `.github/actions/run-coding-agent/action.yml` の防御（persist-
  credentials 対策・input 渡し virtual key・git config 復元）を弱めない
- P8-T02 の path guard / P8-T01 の task contract と整合（重複実装しない）

## Objective

1. **pinned CLI**: Claude Code CLI の exact version + integrity 検証
   （既存の gitleaks 導入 step の sha256 検証パターンと同水準）で導入。
   `command not found` / floating latest を排除
2. **xhigh profile label**: execution profile label を task contract /
   callback evidence に明示（capability assumption はハードコードしない —
   canon の注意書きどおり label として扱う）
3. **permissions/tool policy**: agent 実行 step の権限を宣言的に固定 —
   PR-only（main push 不能は P8-T03 の token scope で担保済み、runner 側でも
   branch 検証）、tool allowlist/deny（network/deploy 系 tool 遮断)、
   max runtime/cost/token 上限の実引数化（P8-T03 の budget/duration と整合）
4. **acceptance 3 点の機械検証**: PR-only / evidence callback（P8-T01 の
   task completion callback 形式で commands/tests/changed paths/security
   findings を返す）/ no direct provider key（ANTHROPIC_API_KEY 等が
   action env/input に存在しないことの負検査）。
   contracts 系 validator（P8-T06/P10-T05 の workflow-validator パターン）で
   action.yml を静的検証する test を追加
5. docs: 07_agent_execution/ へ profile 実装記録（実装差分の説明）

## Acceptance（WBS）

- PR-only / evidence callback / no direct provider key（いずれも機械検証）

## Forbidden

- main direct push / merge / approve / production configuration / 依存追加 /
  実資格情報。既存 action の security 対策の弱体化・削除
- staging E2E の実行主張（環境 gate 後 deferred と明記）

## Scope / allowed_paths（WBS）

- `.github/actions/run-coding-agent/action.yml`
- `docs/plans/2026-08-final-architecture/07_agent_execution/**`
- （静的検証 test の置き場が必要な場合は既存 contracts/ 慣行に従い
  最小追加 — 逸脱する場合は AGMSG-TASK-UPDATE で裁定を求める）
- `.orchestration/**`（証跡）

## Validation

- actionlint green / 新規検証 green / fresh DB で `mise run ci` exit 0
  （単独判定）

## PR / blocked-auth

- branch `agent/P8-T04-claude-exec-profile`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T04-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T04 status=ready_for_review
