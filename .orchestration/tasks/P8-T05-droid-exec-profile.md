# P8-T05: Enable Droid execution profile

- task_id: P8-T05
- writer: codex-deep-dot（WBS どおり codex）/ reviewer: claude-code-fable5-xhigh
- depends_on: P8-T02 ✅ / P8-T03 ✅（#264）。P8-T04（#267 open）と同一ファイル
  `.github/actions/run-coding-agent/action.yml` を触るため
  **branch は agent/P8-T04-claude-exec-profile から分岐**し、#267 merge 後に
  main へ rebase する（先行 PR の変更を含んだ形で差分を作る）
- acceptance_gate_ids: COD-005（ci 面。staging E2E / 実 Droid 実行は
  FACTORY_API_KEY 提供 gate 後）
- risk: medium

## Canon / 前提（必読）

- WBS deliverables: **pinned Droid CLI/exec path**。acceptance:
  **same branch/PR/security controls as Claude**
- ADR-0006 残課題: Droid 経路は現在明示失敗。security plan の FACTORY_API_KEY
  行: Droid も **同じ scoped LiteLLM virtual-key 契約**を使うなら provider key
  不要（provision は P8-T05 前に行わない — 本タスクは構造のみ）
- P8-T04 の hardened profile（pinned artifact + sha256 / branch guard /
  tool deny policy / ceilings / schema 強制 evidence）と**同一水準**を Droid
  実行 step に適用する。Claude 側の実装・防御を弱めない・重複させない
  （共通化できる shell 断片は action 内で共有可）

## Objective

1. **pinned Droid CLI**: exact version + sha256 検証で導入（floating 禁止）。
   Factory の CI 実行方式が資格未提供で検証不能な間は、**発火時 fail-closed
   を維持**しつつ「構造・検証・pin」を先行（P8-T03 の issuer 構造先行と同型）
2. **parity controls**: agent/* branch 必須 / tool・network・deploy deny /
   runtime・cost・token・turn ceilings / 構造化 evidence 出力 /
   no provider key（LiteLLM virtual key input のみ）— Claude と同一の
   acceptance を Droid step にも機械検証（contracts/agent-execution の
   validator/test を拡張）
3. ADR 追記（docs/adr/**）: Droid 有効化条件（FACTORY_API_KEY gate、
   virtual-key 契約、E2E 手順）を記録
4. tests: validator 拡張の negative（pin 欠落 / policy 欠落 / provider key
   混入 / ceilings 欠落）

## Forbidden

- FACTORY_API_KEY の provision・実 Droid 実行の主張 / Claude 経路の変更・
  弱体化 / main push / merge / approve / 依存追加 / 実資格情報
- open PR #267 の**先行変更の書換え**（分岐元として含むのは可、編集は不可）

## Scope / allowed_paths（WBS）

- `.github/actions/run-coding-agent/action.yml`
- `.factory/**` / `docs/adr/**`
- `contracts/agent-execution/**` + `contracts/package.json`（test 登録のみ、
  P8-T04 と同慣行）
- `.orchestration/**`（証跡）

## Validation

- actionlint / contracts tests green / fresh DB で `mise run ci` exit 0
  （単独判定）

## PR / blocked-auth

- branch `agent/P8-T05-droid-exec-profile`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行（#267 merge 後に rebase して PR）。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T05-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T05 status=ready_for_review
