# AGMSG-TASK: P3-T02 — workflow/activity base contracts

- task_id: P3-T02
- writer: claude-code-fable5-xhigh（orchestrator が実装）
- reviewer: codex-gpt56-sol-high（AGMSG-TASK `P3-T02-REVIEW` で独立レビュー発注）
- depends_on: P3-T01（merge 待ち — PR #197/#198）, P1-T04 ✅
- risk: medium
- branch: `agent/P3-T02-workflow-base-contracts`

## allowed_paths（WBS）

1. `packages/control-plane/src/**`（+ 対応する `packages/control-plane/tests/**`）

（付随: 本タスクは新規依存を追加しない前提。@temporalio/{client,worker,workflow,activity} の
うち P3-T01 で未導入のサブパッケージが必要になった場合は exact-pin + lockfile 変更を
本質的必要物として許可。workspace policy 追加が随伴する場合は P3-T01-013 と同様に
本 task file へ amendment を記録してから行う）

## forbidden_actions

- main direct push / draft PR / merge
- production configuration without approved environment gate
- LLM 呼び出し・外部 API 実呼び出しを含むテスト（全テストはネットワークなし）
- lib/ への非決定要素（時刻・乱数・I/O）持ち込み

## deliverables（WBS + component spec 01 Workflow rules）

- **retry classes**: operation class ごとの固定 retry policy（読み取り系 / 冪等書き込み /
  非冪等書き込み / 承認待ちの各 class）。数値はコード定数、`src/lib/` の純粋定義
- **idempotency**: 非冪等外部書き込みは single-attempt + reconcile 前提のヘルパ
  （idempotency key 構築は `buildWorkflowId` 系の決定的関数を踏襲）
- **versioning**: activity input/output の versioned schema 契約 + workflow code change 用
  Temporal versioning ヘルパ（`patched`/deployment pin 方針の薄い wrapper）
- **cancellation**: 未開始副作用を停止する cancellation ヘルパ（CancellationScope 契約）

## acceptance（WBS）

- workflow code deterministic（時刻・乱数・network・DB 直呼びなし — lint/test で機械検証）
- non-idempotent writes single-attempt/reconcile

## gates

- TMP-001（blocking, ci）: Workflow replay succeeds — recorded histories + replay command
- TMP-003（blocking, ci）: External side effects are idempotent — lost-response retry test +
  no duplicate object

## verification

- Temporal unit/replay tests（@temporalio/testing の TestWorkflowEnvironment。
  ネットワークなし・time-skipping）。recorded history を repo 内 fixture として保存し
  replay test で検証（TMP-001 evidence）
- lost-response retry で外部 object が二重作成されないこと（TMP-003 evidence、mock activity）
- `mise run ci` exit 0（fresh 使い捨て DB、単独判定）

## expected artifacts

- report: `.orchestration/reports/P3-T02-report.md`
- validation: `.orchestration/validation/P3-T02-validation.md`
- review: `.orchestration/reviews/P3-T02-REVIEW.md`（codex 記入）
- learning: `.orchestration/learning/P3-T02-learning.md`
