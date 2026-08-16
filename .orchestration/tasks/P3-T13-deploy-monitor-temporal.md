# P3-T13: Migrate approved-deploy and prod-monitor loops to Temporal workflows

- task_id: P3-T13
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P3-T02 ✅ / P3-T03 ✅
- acceptance_gate_ids: TMP-003 / TMP-005
- risk: **high**

## Canon / 前提（必読）

- 既存 live tasks: `packages/server/src/scheduler/tasks/approvedDeployTask.ts` /
  `prodMonitorTask.ts` — **deployments 12-state machine と dispatched_at CAS
  semantics（PR #149/#151 で確立）を正確に読解してから設計すること**
- P3 の確立済み不変条件（P3-T02..T11 の全証跡・chaos suite が正本）:
  - runExternalSideEffect（single-attempt + reconcile、TMP-003）
  - 三値 ledger（absent|pending|sent — pending 非再送・非成功扱い）
  - unknown 型 envelope 検証 + E-CP-CONTRACT 非 retryable 変換
  - 決定的 correlation ID（冪等キー）事前確定
  - 権威は authoritative DB read（bare signal 禁止）
  - CAS union receipt（created|stale）で TOCTOU 防止
  - timeout→success 遷移禁止 / per-fixture unique workflow ID
- P3-T05..T08 の既存 workflow 実装パターン（executeChild・
  shadow/limited/primary executionMode・replay fixtures・
  record-replay-history.mjs）を踏襲
- P3-T09 shadow harness / P3-T10 cutover（15 task inventory）:
  **本タスクの 2 workflow も cutover 体系に整合させる**（inventory は
  15 task で CI 固定 — approvedDeploy/prodMonitor は既に inventory に
  含まれているか確認し、shadow.ts / TEMPORAL_CUTOVER_TASK_NAMES との
  整合を検分。差分が出る場合は要 amendment 申請）

## Objective

1. `DeployDispatchWorkflow` / `ProdMonitorWorkflow`
   （`packages/control-plane/src/workflows/`、entry.ts へ export 必須）:
   live task の判定ロジックを lib 純関数化しつつ、**deployments table を
   state authority のまま維持**（workflow 内に並行 state を作らない）。
   dispatched_at CAS を CAS union receipt パターンで移行し、
   cutover 跨ぎの二重 dispatch を構造的に排除
2. fail-closed **D-04 / D-16 境界の保存**（既存 task の該当分岐を特定し、
   同値性を test で固定）
3. shadow 比較: P3-T09 harness 系列に 2 workflow の計画等価検証を追加
4. replay fixtures（record-replay-history.mjs で採取、unique ID 規約）

## Acceptance（WBS）

- no duplicate dispatch across cutover（chaos/並行 test で実証）
- deployments table remains the state authority
- fail-closed D-04/D-16 boundaries preserved

## Scope / allowed_paths（WBS + test 規約）

- `packages/control-plane/src/workflows/**`（+ lib/ と tests/ は既存規約どおり）
- `packages/server/src/scheduler/tasks/**` / `packages/server/src/db/**`
- `packages/server/tests/**` / `packages/control-plane/tests/**`
- `verification/temporal-shadow/**`（整合検分で必要な場合 — 要 amendment）
- `.orchestration/**`（証跡）

## Forbidden

- deployments state machine の変更（移行のみ。12-state の意味論不変）
- 並行 state authority の新設 / audit 変更 / 依存追加
- live 有効化（executionMode は shadow default — P3-T10 cutover 体系に従う）
- main direct push / merge / approve

## Validation

- workflow tests（state matrix + replay）green / shadow 比較 green
- fresh DB で `mise run ci` exit 0（単独判定）

## PR / blocked-auth

- branch `agent/P3-T13-deploy-monitor-temporal`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P3-T13-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P3-T13 status=ready_for_review

## Scope amendment（2026-08-16、orchestrator 承認）

- 追加 allowed_paths: `packages/server/src/lib/deploymentTaskState.ts`
  （live task の判定ロジックの pure-lib 化の置き場。server → control-plane の
  逆方向依存を作らない正しい配置。AGENTS 原則 1 準拠）
- `packages/server/tests/**` は既承認どおり

## Scope amendment 2（2026-08-16、orchestrator 承認 — shadow harness）

- 追加 allowed_paths: `verification/temporal-shadow/shadow.ts` / `run.ts` /
  `shadow-evidence.json` / `README.md`（objective 3 の事前宣言どおり）
- 条件:
  1. **15-task inventory の名前集合は不変**（`EXPECTED_SCHEDULER_REGISTRATIONS`
     と `TEMPORAL_CUTOVER_TASK_NAMES` の完全一致 CI は維持）
  2. **AST guard（observedTask(cutover(literal, task)) 直接引数合成の pin）の
     意味論を弱めない**（placeholder mapping → 実 plan-equivalence への
     置換のみ）
  3. `shadow-evidence.json` は再生成し、unreasoned differences = 0 を
     validation に記録

## Scope amendment 3（2026-08-16、orchestrator 承認 — coverage exclude）

- 追加 allowed_paths: `packages/control-plane/vitest.config.ts` —
  既存 policy（Temporal sandbox 実行の workflow ファイルは V8 coverage 対象外:
  replayProbe/approval/codingTask/jitHealth/reportDelivery/planeSync/entry 等）
  への `src/workflows/deployment.ts` の **1 行追加のみ**。既存 exclude の
  削除・閾値変更は禁止
