# AGMSG-TASK: P3-T05 — Graph subscription workflow

- task_id: P3-T05
- writer: codex-gpt56-sol-high（WBS 指定 — worker 実装）
- reviewer: claude-code-fable5-xhigh（orchestrator が adversarial review）
- depends_on: P3-T02 ✅（#200）。P3-T03/T04 の確立パターン（entry bundle・
  recorded history fixtures・unknown 受け signal 検証・decision read 権威）を踏襲
- risk: medium
- branch: `agent/P3-T05-graph-subscription-workflow`

## allowed_paths（WBS）

1. `packages/control-plane/src/workflows/**`（+ 対応 `src/lib/**` 純粋判定・
   `tests/**`・`scripts/record-replay-history.mjs` への fixture 追記）
2. `packages/server/src/**`（**必要最小限**。既存 scheduler
   （subscriptionRenewalTask 等）の削除・置換は禁止 — acceptance の
   shadow 共存が目的。server 変更が不要なら変更しない選択も boundary 内）

## forbidden_actions

- main direct push / draft PR / merge
- 既存 scheduler 経路（subscriptionRenewalTask / channelPollingTask /
  eventsPollingTask）の削除・無効化・挙動変更
- 実 Graph API 呼び出しを含むテスト（全テストはネットワークなし。record は
  dev-only script のみ）
- 新規依存追加（P3-T01..T04 で導入済みの Temporal SDK pin で完結させる）

## deliverables（WBS）

- **renewal/delta/reconcile schedules**: Graph subscription の更新・delta 取得・
  照合を担う workflow（複数でも単一+kind でも可。設計判断は worker に委ねるが
  workflowId は `graph-subscription/...` 規約 = buildWorkflowId(kind) を使う）
- **shadow 共存**: 旧 scheduler と新 workflow が同時稼働しても外部書き込みが
  重複しないこと（TMP-003）。非冪等外部書き込み（subscription create/renew 等）は
  runExternalSideEffect + 決定的 idempotency key + reconcile 経路必須

## acceptance（WBS）

- old scheduler and new workflow can shadow without duplicate writes

## gates

- TMP-003（blocking, ci）: lost-response retry test + no duplicate object

## verification

- time-skipping tests（@temporalio/testing）— renewal 期限・delta 周期の時間進行
- recorded history fixtures + replay tests（P3-T02..T04 の harness に追記。
  entry.ts へ export 追加を忘れない — bundle は entry の export のみ）
- shadow no-duplicate: 旧 scheduler 相当の書き込みが先行済みのとき workflow 側
  が reconcile で回収し二重作成しない負 fixture
- Graph sandbox は実 tenant 待ちのため対象外（validation に明記）。
  activity は DI 注入 mock（既存 FetchLike/DI パターン踏襲）
- fresh 使い捨て DB（run 毎再作成）で `mise run ci` exit 0（単独判定・exit code
  masking 禁止）
- merged fixtures（P3-T02..T04 の既存 history）は byte 不変で維持
  （record script 全体再実行後は origin/main から復元し、報告前に
  `git diff origin/main...HEAD --stat` で不在確認）

## 実装上の恒久則（P3-T03/T04 review で確立 — 違反は review で差し戻し）

- signal/activity 結果は unknown 受け + 参照前形検証（malformed で wedge しない）
- 相関 ID は activity schedule 前に決定的に確定（in-flight race で喪失しない）
- 完了・状態の権威は DB/外部正本の read で確認（signal 単独で状態を確定しない）
- timeout から成功側への自動遷移なし
- workflow ID は fixture 毎に一意（getHandle の旧 run route 問題）

## expected artifacts

- report: `.orchestration/reports/P3-T05-report.md`
- validation: `.orchestration/validation/P3-T05-validation.md`
- sandbox: `.orchestration/sandboxes/P3-T05-sandbox.md`
- learning: `.orchestration/learning/P3-T05-learning.md`
- autoskill: `.orchestration/autoskill/runs/P3-T05-autoskill.md`
- done_signal: AGMSG-RESULT（PR は non-draft + ai-generated label。push/PR 作成が
  token で不可の場合は blocked-auth で RESULT を返し orchestrator が代行）
