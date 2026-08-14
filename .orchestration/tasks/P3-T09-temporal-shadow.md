# AGMSG-TASK: P3-T09 — Shadow existing scheduler against Temporal

- task_id: P3-T09
- writer: codex-gpt56-sol-high（WBS 指定 — worker 実装）
- reviewer: claude-code-fable5-xhigh（orchestrator adversarial review）
- depends_on: P3-T05 ✅ / P3-T06 ✅ / P3-T07 ✅（+ P3-T08 ✅ の shadow 様式）
- risk: medium
- branch: `agent/P3-T09-temporal-shadow`

## allowed_paths（WBS）

1. `packages/server/src/index.ts`（**必要最小限** — shadow 観測の hook 追加のみ。
   既存 15 task の登録・挙動・順序は不変更）
2. `verification/temporal-shadow/**`（新設 — shadow 比較 harness と evidence）
（付随: `packages/server/src/lib/**`・`tests/**` に shadow 比較の純粋関数と
テストを置く必要が生じた場合は最小限で許可。control-plane 変更は不可）

## DELTA-01（binding）

shadow inventory は index.ts に現在登録される **全 15 scheduler task** を対象とする:
healthcheck / capability-metrics-refresh-30s（inline）/ report-delivery-metrics /
approved-deploy / prod-monitor / jit-revocation / coding-task-reaper /
subscription-renewal / channel-polling / events-polling / pm-snapshot-reconcile /
seven-keys-monthly-snapshot / prjops-weekly-analyze / prjops-daily-tracker /
report-delivery。1 件でも欠けたら差し戻し。

## deliverables（WBS）

- **comparison report with side effects suppressed**: 各 task について
  「旧 scheduler が計画する action/時刻」と「Temporal 側（P3-T05..T08 の
  workflow/schedule 定義、未実装分は写像表）が計画する action/時刻」を突合する
  決定的な比較 harness と、その実行 evidence（verification/temporal-shadow/）
- 比較は**副作用完全抑止**（shadow 構造抑止 / dry-run / 記録のみ）で行う。
  実外部 API・実 Temporal server への依存は不可（time-skipping か純粋計算）

## acceptance（WBS）

- same planned actions/times（15/15 task の計画一致 or 差分の根拠付き記録）
- no duplicate external writes（shadow 実行中の外部 write 0 を機械検証）

## 恒久則（binding、P3-T03..T08 で確立）

- unknown 受け + 参照前形検証 / 比較は決定的（実時刻直参照なし、固定 clock 注入）
- 既存 scheduler の挙動・登録は不変更（shadow は観測のみ）
- merged fixtures byte 不変（push head の merge-base diff で検証）
- PR は AIOPS_PR_TOKEN（app/aiops-pr-bot author）のみ。不可なら blocked-auth
- gates standalone → fresh 使い捨て DB（run 毎再作成・same-shell）で
  `mise run ci` exit 0

## verification

- 15 task の inventory 完全性を機械検証（index.ts の登録列挙と突合し、
  将来の task 追加で fail する形）
- 比較 harness の unit tests（一致 / 意図的差分の検出 / 欠落 task の検出）
- shadow run evidence を `verification/temporal-shadow/` に保存（決定的出力）

## expected artifacts

- report/validation/sandbox/learning/autoskill: `.orchestration/*/P3-T09-*.md`
- done_signal: AGMSG-RESULT（non-draft PR + ai-generated label + head + pr_url）
