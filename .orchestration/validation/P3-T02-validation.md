# P3-T02 validation

- unit/replay: `pnpm --filter @aiops/control-plane run test` → 8 files / 45 tests green
  - TMP-003: lost-response で execute 1 回・外部 object 1 個・reconciled 回収 / 不在時
    UnresolvedError（cause 保持）
  - TMP-001: executed / reconciled 両 history の replay 成功 + 負 fixture
    （構造の食い違う workflow）で reject を確認
- coverage: 94.8% lines / 92.63% branch / 97.14% funcs / 94.7% stmts（閾値 85/74/83/82）
- record 再現: `pnpm --filter @aiops/control-plane run record:replay-history`
  （dev-only、time-skipping test server DL あり）→ 2 fixtures 再生成、結果文字列
  `v2:executed:obj:fixture` / `v2:reconciled:obj:fixture`
- full CI: fresh 使い捨て DB（55432, aiops_test/aiops_load_test/aiops_p001 再作成）で
  `mise run ci` exit 0（2026-08-13、log: scratchpad/p3t02-ci.log）
- 途中の失敗と是正:
  - idempotency parse で `Number("")===0` を許す欠陥をテストが検出 → sequence 部を
    `/^\d+$/` で検証
  - toTemporalRetryPolicy の readonly 配列が SDK RetryPolicy 型と不整合 → 複製して返す
  - workflow-sandbox 実行分の coverage 欠落 → 検証パス直接テスト追加 + probe 除外

## Round 1→2 (2026-08-13)

- Round-1 verdict: request_changes — findings 001..004（blocking: 001, 002）。
- 是正 head `565689b`:
  - 001: cancellationProbeWorkflow + recorded history 第 3 fixture。cancel 要求後は
    createExternalObject を一切 schedule せず（データ assert `["findExternalObject"]`）、
    CANCEL_REQUESTED/CANCELED イベント存在 + replay 成功を検証
  - 002: 負 fixture assert を `rejects.toThrow(DeterminismViolationError)` に強化
  - 003: traceability_matrix.md を merge-base へ復元（`mise run ci` の traceability が
    再生成するため、復元は push 前の最終 commit で実施し remote merge-base diff で不在確認）
  - 004: 未使用 @temporalio/activity・common devDep 除去
- 検証: 46 tests green / coverage 94.8% 維持 / fresh 使い捨て DB 再作成のうえ
  `mise run ci` exit 0（1 回目の fail は DB 残骸の schema 再適用衝突 = "audit_log is not
  partitioned"。使い捨て DB は run 毎に再作成が必須という運用則を再確認）
- PR #200 本文を新 head 基準に更新（test 数 46、devDep 一覧、3 fixtures、負 assert 型）
