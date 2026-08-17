# P8-T02: Implement pre/post path boundary guard

- task_id: P8-T02
- writer: codex-deep-dot（WBS どおり codex）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P8-T01 ✅（#247 merged）
- requirement_refs: PRD-008 / FR-AGT-001..006
- adr_refs: ADR-0027
- acceptance_gate_ids: COD-001 / COD-004（malicious fixture tests — ci 面。
  staging E2E は P8-T04/T05）
- risk: **critical**
- **並行注意**: open PR #250（.orchestration のみ）— 接触禁止（自然に分離）

## Canon / 前提

- P8-T01 の `contracts/agent-task/`（schema + manifest-validator +
  pathScopesOverlap）— **path 意味論を再実装せず consume**（同じ overlap
  規則が guard と gate で食い違うと境界が壊れる）
- `04_component_specs/09_coding_agents.md`: Runner environment
  （allowed/forbidden paths / clean checkout / no direct production network）
- 既存 `.github/workflows/coding-task.yml`（P1 期の骨格）と
  `.github/actions/` の現況を読解してから設計

## Objective

coding agent 実行の**前後**で path 境界を強制する guard:

1. **pre-guard**（実行前）: manifest の allowed/forbidden を検証済み入力とし、
   worktree の baseline snapshot（tracked file 集合 + hash）を記録
2. **post-guard**（実行後）: 変更集合（added/modified/deleted、rename/
   symlink/mode 変更含む）を算出し、
   - allowed 外・forbidden 内の変更 → **fail-closed で reject**（CI red）
   - **無条件 forbidden**: `.git/**`（hooks 含む）、credential 類
     （`.env*`、`*.pem`、`~/.aws` 相当、workflow token 設定）、
     governance path（`.github/workflows/**`・`.github/actions/**`・
     `CODEOWNERS`・branch 保護に影響する設定・`contracts/agent-task/**`
     自身）— manifest が許可していても reject（self-modification 防止）
   - symlink 経由の boundary 脱出（allowed 内の symlink が forbidden 先を
     指す）と `..` traversal を検出
3. 実装は `scripts/`（POSIX sh または node、依存追加なし）+
   `.github/actions/run-coding-agent/`（composite action の骨格。
   runner 本体の結線は P8-T04/T05）
4. **malicious fixture tests**: 悪意ある変更パターン（forbidden 直接変更 /
   allowed 内 symlink 脱出 / .git hook 仕込み / workflow 改変 / rename での
   すり替え / mode 変更のみ）を fixture 化し、全て reject されることを
   CI 内で機械検証（node --test か bash test — 既存規約に合わせる）

## Acceptance（WBS）

- agent cannot alter .git/credentials/forbidden governance paths
  （malicious fixtures 全 reject）

## Forbidden

- P8-T01 の overlap 意味論の再実装・変更 / guard 自身を bypass 可能にする
  設定面 / 依存追加 / 実資格情報 / main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `.github/actions/run-coding-agent/**` / `scripts/**`
- `.orchestration/**`（証跡）
- （P8-T01 validator の consume に workspace 参照が必要なら要 amendment）

## Validation

- malicious fixture tests green / actionlint green /
  fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P8-T02-path-boundary-guard`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P8-T02-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P8-T02 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認 — option a）

- 追加 allowed_paths: root `package.json` — `governance:check` の node --test
  列挙へ `scripts/coding-agent-path-guard.test.mjs` の **1 件追加のみ**
  （P4-T01/P2-T02 の contracts 結線と同型の確立パターン。既存列挙の削除・
  変更禁止、依存追加なし）
