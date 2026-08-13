# P3-T03 validation

- unit: approvalDecision CAS matrix 5 green（stale 双方向 / already-decided /
  id-mismatch / invalid-decision（"auto-approve" 文字列含む）/ missing-approver /
  入力境界 RangeError）
- recorded history（`record:replay-history`、dev-only）:
  - approved: signal 3 件（stale-version 1・approval-id-mismatch 1 拒否 → valid 1 受理）、
    outcome カウンタと history が一致
  - expired: TIMER_STARTED/FIRED あり・signal 0 件・status=expired（自動承認なし）
  - restart: maxCachedWorkflows=0（task 毎 durable history 再構築）で
    workflow task 複数回を跨ぎ approved 完了
- replay: approval 3 + replay-probe 4 の全 fixture が現行 code で replay green
- package gates: 57 tests / coverage 95.34%（sandbox 専用 3 ファイル理由付き除外）/
  typecheck / lint green
- full CI: fresh 使い捨て DB（55432、3 DB 再作成）で `mise run ci` exit 0
  （log: scratchpad/p3t03-ci.log）
- 途中の失敗と是正:
  - workflowsPath が replayProbe.ts のままで approvalWorkflow が bundle 外
    → entry.ts に集約（"no such function is exported by the workflow bundle"）
  - 2-worker 交代での restart 記録は time-skipping env の graceful shutdown が
    drain せず hang（10 分無進行 ×2）→ maxCachedWorkflows=0 方式へ転換

## Round 1→2 (2026-08-13)

- Round-1 verdict: request_changes — 001(high) malformed signal wedge / 002(medium)
  recorded matrix 不完全 / 003(low) P3-T02 fixture churn。
- 是正 head `9d15092`:
  - 001: evaluateDecisionSignal を unknown 受け + 参照前形検証（malformed-payload）。
    codex 再現手順（null signal → RUNNING のまま）に対し、expired fixture が
    malformed 受信後の expired 終了を記録（回帰証跡）
  - 002: approved fixture = signal 8 件（全 6 拒否分類 + 受理 + 受理後 duplicate）、
    counters 完全一致 assert。signal 積み→worker 起動の順で決定化
  - 003: replay-probe 3 fixture を origin/main へ byte 復元（remote merge-base diff
    から不在確認済み）
- 検証: 58 tests green / typecheck / lint / fresh-DB `mise run ci` exit 0
