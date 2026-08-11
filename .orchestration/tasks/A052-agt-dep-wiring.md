# A052: AGT_DEP をランタイムに結線する（14エージェント結線の最終ピース）

- task_id: A052
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/a052-agt-dep-wiring`）
- 発行: claude-deep-dot（orchestrator）2026-08-09
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 40
- 根拠: ADV-WIR-001 系（残） / 委任裁定 R-02-1 / DevOps:REQ-003/010/012 / TH-001/TH-003 /
  AC-010a（PR→本番直行の禁止）
- 前提: A044（approvals: type=change の decide が存在）、A048（HTTP RED metrics = TH-003 入力）
  が main に merge 済みであること

## 結線対象（3経路。D-04 未裁定の境界は degraded で正直に切る）

### 1. staging 昇格評価（TH-001）— workflow_run(success) 起点

- index.ts の AGT_DEP スタブを実ハンドラへ: workflow_run 成功イベント → TH-001 入力
  （CI success / coverage% / critical count）を組み立て → `promoteToStagingIfEligible`
- **coverage% と critical count のランタイム正本を調査で特定**（workflow artifacts /
  checks API / 既存 DB）。一意に定まらなければ blocked。**推測値・固定値の注入は禁止**
- Teams channel 未設定は既存 degraded パターン

### 2. 本番デプロイ実行 — approvals(change)=approved 起点

- A044 の approvals 決定（approved）を購読/検知して `executeProdDeploy` を起動する結線。
  検知方式は既存機構（events キュー / scheduler ポーリング）から選び、理由を書く。
  **decide ルート内から直接デプロイを呼ばない**（承認記録とデプロイ実行の分離を保つ）
- `deploy-prod.yml` は D-04 未裁定で実体が無い。dispatch 先 workflow が存在しない場合は
  **fail-closed: 監査 + degraded capability（prod_deploy）+ 状態を dispatch 失敗として記録**。
  echo スタブを .github/workflows へ移す等の「動いた振り」は禁止
- deploy 対象 owner/repo の正本（approvals.project_id → repo マッピング）が一意に
  定まらなければ blocked

### 3. ロールバック監視（TH-003）— scheduled task

- A048 の RED metrics から 5xx 率・p95 を取得する scheduled task →
  `monitorAndRollbackIfNeeded`。デプロイ実体が無い間は評価のみ実行し、
  rollback dispatch は経路2と同じ fail-closed 境界
- stable version 履歴の正本を調査（deployments テーブル?）。無ければ blocked

## 品質要件

- 仕様IDヘッダ / describe に仕様ID / `mise run ci` green（実PG）/ matrix 再生成
- テスト: 3経路の DI モック結線・TH 判定の境界・fail-closed 境界（workflow 不在・
  マッピング不在・metrics 不足）・AC-010a（approved 以外から executeProdDeploy が
  呼ばれないこと）
- 証跡5ファイルは基準ヘッダ付きで PR に含める（A048 で確立した本リポジトリ規約）
- PR（ai-generated）→ checks green（merge 前スレッドゲート込み）。merge はしない

## forbidden_actions

- allowed_files 外編集、deploy-prod.yml の新規作成・移設（D-04 事項）、依存追加、
  merge、force push

## allowed_files（調査結果により拡張要求可）

```
packages/server/src/agents/devopsEventHandlers.ts
packages/server/src/scheduler/tasks/prodMonitorTask.ts
packages/server/src/scheduler/tasks/approvedDeployTask.ts
packages/server/src/lib/degradedCapabilities.ts
packages/server/src/index.ts
packages/server/src/db/approvalsRepo.ts
packages/server/tests/devopsEventHandlers.test.ts
packages/server/tests/prodMonitorTask.test.ts
packages/server/tests/approvedDeployTask.test.ts
packages/server/tests/degradedCapabilities.test.ts
packages/traceability/output/traceability_matrix.md
.orchestration/**（A052 証跡）
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A052 status=ready_for_review|blocked report=.orchestration/reports/A052-report.md validation=.orchestration/validation/A052-validation.md sandbox=.orchestration/sandboxes/A052-sandbox.md learning=.orchestration/learning/A052-learning.md autoskill=.orchestration/autoskill/runs/A052-autoskill.md
```
