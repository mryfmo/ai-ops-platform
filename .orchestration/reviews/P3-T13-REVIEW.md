# P3-T13-REVIEW — approve at `b61af7f`

- task_id: P3-T13 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: b61af7f1c87d7e1e1a63c0763ef36b2e9f9d46ea
- verdict: **approve**

## 独立再検証

- `@aiops/control-plane` 277/277（新規 4 test file: state matrix 222 行・
  workflow 363 行・schedules・replay）/ `@aiops/server` 906 pass 再実行
- shadow evidence 実データ検分: inventory **15**（名前集合不変・
  `TEMPORAL_CUTOVER_TASK_NAMES` parity CI 継続）、matches 12 /
  reasoned 3 / **unreasoned 0**、temporalOnlyPlans 1
- **12-state 保存の機械確認**: 新 `DEPLOYMENT_STATES` 定数と schema.sql の
  CHECK 制約が完全一致、**schema.sql の diff は 0 行**（state machine 不変）

## 検分（acceptance 対応）

- **no duplicate dispatch across cutover**:
  - `DeploymentsRepo.transition` を union receipt（created|stale）化。
    created は target state 到達を検証、stale は再読して
    `observed === from` の矛盾（lost update 兆候）を throw、>1 行も throw
  - 並行 test 実測: legacy claimant × Temporal workflow を同一 CAS authority に
    同時実行し dispatch は厳密に 1 回（approvedDeployTask.test 161 行 /
    dispatched_at CAS winner のみ created receipt 269 行）
- **deployments table remains the state authority**: workflow 内に並行 state
  なし（判定は pure lib、遷移はすべて repo CAS 経由）。approval 消費は既存
  transaction（dispatched_at CAS + approved row insert）のまま
- **D-04 / D-16 preserved**: D-04（workflow 不在/確認失敗 → dispatch 試行
  ゼロで dispatch_failed）の既存 test 系を維持・拡張。D-16 は upstream
  TH-001 境界のまま — workflow contract が staging-promote / critical-count
  fallback を型・実行時とも拒否する負 test を確認
- **P3 不変条件**: runExternalSideEffect（single-attempt+reconcile）、
  三値 ledger（pending 非再送・非成功）、E-CP-CONTRACT 変換、決定的
  correlation ID、replay fixtures 3 本（unique sequence 7001-7003:
  dispatch-reconcile / cutover-CAS-stale / monitor-rollback）
- amendments 3 件の条件遵守: lib 配置（逆依存なし）/ shadow（inventory
  不変・AST guard 意味論不変・evidence 再生成）/ coverage exclude 1 行のみ

## 妥当性判断

P3 の残タスクとして、確立済み不変条件を全て踏襲した正統な移行。
stale receipt の矛盾検出（observed===from を anomaly として fail）は
既存 planeSync の CAS 規範をさらに強めており良い。
