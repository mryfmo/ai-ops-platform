# AGMSG-TASK: P3-T11 — Run durable execution chaos suite

- task_id: P3-T11
- writer: codex-gpt56-sol-high（WBS 指定 — worker 実装）
- reviewer: claude-code-fable5-xhigh
- depends_on: P3-T10 ✅（#224）— P3-T02..T08 の全 workflow + fixture/replay 基盤の上
- risk: medium
- branch: `agent/P3-T11-chaos-suite`

## allowed_paths（WBS）

1. `verification/chaos/**`（新設 — chaos suite 本体 + evidence）
2. `packages/control-plane/tests/**`（chaos 由来の regression fixture/tests 追記。
   `scripts/record-replay-history.mjs` への追記も fixture 生成の必要随伴物として許可）

## forbidden_actions

- main direct push / merge / owner-auth PR 作成（App token flow のみ、不可なら
  blocked-auth）
- `packages/control-plane/src/**` の変更（chaos で欠陥が出た場合は fix せず
  RESULT で報告 — 修正は別タスクとして orchestrator が裁定）
- 実外部 API・実 Temporal server 常設依存（time-skipping test env のみ可）
- merged fixtures の churn（push head の merge-base diff で byte 不変を検証）

## deliverables（WBS）

- **chaos suite**: P3-T02..T08 の全 workflow（replayProbe/approval/codingTask/
  graphSubscription×3/jitHealth×2/reportDelivery/planeSync 親子）に対する
  決定的 chaos 注入 harness:
  - **restart**: maxCachedWorkflows=0 + sticky timeout 短縮での全 workflow
    完走（P3-T02 の crash-resume proxy を全対象へ一般化）
  - **timeout**: activity timeout / heartbeat 喪失 / condition 期限の各経路が
    仕様どおりの終端（成功偽装なし）に到達すること
  - **duplicate**: signal 重複・callback 重複・schedule 二重 fire 相当の
    入力で外部 write が増えないこと（各 TMP-003 台帳で機械検証）
  - **approval**: 承認系（P3-T03 child を使う全経路）への stale/malformed/
    競合 signal 洪水下でも auto-approval が発生しないこと
- **evidence**: `verification/chaos/chaos-evidence.json`（決定的出力。
  シナリオ × workflow の matrix、duplicate side effects = 0、
  recovered | explicit-fail の分類）

## acceptance（WBS）

- zero duplicate side effects（全シナリオで外部 write 増分 0 を機械検証）
- all workflows recover or explicit fail（RUNNING 固着・silent 成功の 0 件）

## gates

- TMP-001（replay）: chaos 下で記録した history も現行 code で replay green
- TMP-004（crash resume）: 全 workflow の restart proxy 完走

## 恒久則（binding、P3-T03..T10 で確立）

- fixture 毎一意 workflow ID / 期限系は env.sleep 明示 advance /
  cache-0 worker は stickyQueueScheduleToStartTimeout 短縮 /
  mock 台帳は正本意味論（pending/sent 等）に忠実 / 素の `mise run ci`
  （fresh 使い捨て DB・same-shell）exit 0 / 重量テストは明示 timeout

## expected artifacts

- report/validation/sandbox/learning/autoskill: `.orchestration/*/P3-T11-*.md`
- done_signal: AGMSG-RESULT（head + pr_url。欠陥検出時は fix せず findings 列挙）
