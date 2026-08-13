# AGMSG-TASK: P3-T04 — CodingTaskWorkflow

- task_id: P3-T04
- writer: claude-code-fable5-xhigh（orchestrator が実装）
- reviewer: codex-gpt56-sol-high（AGMSG-TASK `P3-T04-REVIEW`）
- depends_on: P3-T02 ✅（#200）, P3-T03 ✅（#202）
- risk: medium
- branch: `agent/P3-T04-coding-task-workflow`

## allowed_paths（WBS）

1. `packages/control-plane/src/workflows/**`
2. `packages/control-plane/src/activities/**`
3. `packages/server/src/http/routes/codingTasks.ts`
（+ 対応する `packages/control-plane/tests/**`・record script・`src/lib/**` の純粋判定）

**スコープ判断（P3-T03 と同型、レビューで妥当性確認済みの前例）**: deliverable
（workflow-managed dispatch/callback/review state）と acceptance は workflow 層で
充足する。server route の Temporal client 結線は `control.temporal.enabled` flag
配下の統合タスクで行い、codingTasks.ts の現行 dispatch 経路（ADR-0006 の人間
明示クリック + DB 原子確保）は不変更。workflow は現行 DB 状態機械
（queued → running → pr_created|failed|cancelled）と将来統合可能な形で、正典
component spec 01 の全状態（requested → approval_pending → queued → running →
pr_created|no_change|failed → review_pending → complete）を担う。

## deliverables（WBS + component spec 01/09 + ADR-0006）

- **CodingTaskWorkflow**: 正典状態機械の decision/遷移は lib/ の純粋関数に集約。
  - approval_pending: P3-T03 `approvalWorkflow` を **child workflow** として起動
    （expired/rejected は failed 系終端へ。auto-approval なし）
  - queued→running: GitHub workflow_dispatch を **external-side-effect class +
    runExternalSideEffect**（single-attempt + reconcile）で 1 回だけ実行
    （TMP-003: duplicate dispatch prevented）
  - callback: signal 受信。**replay/duplicate-safe**（同一 callback の再送・順序
    乱れ・不正 payload は P3-T03-001 の教訓どおり unknown 受け + 形検証 + 決定的
    拒否カウンタ。malformed で wedge しない）
  - review_pending→complete: レビュー結果 signal（承認系は approvalsRepo 正本の
    原則を維持し、workflow は待機の耐久化のみ）
- **activities 契約**: dispatch / reconcileDispatch / 状態読み取りの
  ActivityDefinition 型（実装は DI 注入、実 GitHub 呼び出しなし）

## acceptance（WBS）

- duplicate dispatch prevented（lost-response 再送でも外部 dispatch 1 回）
- callback replay safe（重複 callback で状態が壊れない・二重遷移しない）

## gates

- TMP-003（blocking, ci）: lost-response retry test + no duplicate object
- TMP-004（blocking, ci）: worker crash resumes workflow — kill/restart test +
  state preserved。CI 証跡は P3-T03 と同じ per-task history 再構築
  （maxCachedWorkflows=0）+ recorded fixture の replay。実プロセス kill/restart
  E2E は deploy smoke（staging）の管轄と明記

## verification

- lib 純粋関数の遷移 matrix unit tests（不正遷移・duplicate callback・
  malformed payload）
- recorded history fixtures（成功経路 / lost-response dispatch reconcile /
  duplicate callback / approval-rejected 終端 / crash-resume）+ replay tests
- fresh 使い捨て DB（run 毎再作成）で `mise run ci` exit 0

## forbidden_actions

- main direct push / draft PR / merge
- codingTasks.ts の現行 dispatch/confirm/callback 挙動の変更
- 承認権威の複製・auto-approval 経路
- ネットワークを要するテスト（record は dev-only script）

## expected artifacts

- report/validation/review/learning/acceptance: `.orchestration/*/P3-T04-*.md`
