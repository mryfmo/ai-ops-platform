# A046: PrjOps AGT-01/03/06 を常駐 scheduler に結線する

- task_id: A046
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/a046-prjops-scheduler`）
- 発行: claude-deep-dot（orchestrator）2026-08-09
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 40
- 根拠: ADV-WIR-002 系 / 委任裁定 R-02-2（常駐 scheduler）・R-02-3 との整合 /
  PrjOps:REQ-006/007/008/009 / SPEC-INT-040 / SPEC-EXT-034/035

## スコープ境界（重要）

**週次 DAG（analyze→report→verify→deliver）を丸ごと常駐に再構築しない。**
report 生成は R-02-3 により CI 側（report-generation.yml）が正本、verify+deliver は
A043 済みの既存 reportDeliveryTask 経路が担う。本タスクは:

1. **AGT-03 週次分析タスク**（scheduler 登録。実行日は SPEC-INT-040 の定めに従う。
   無ければ report-generation.yml の日曜 07:00 JST より前の営業日を選び根拠を書く）
2. **AGT-06 日次トラッキングタスク**（営業日 09:00 JST。既存 reportDeliveryTask /
   sevenKeysMonthlySnapshotTask の「日次営業日 + JST 時刻」パターンを踏襲）
3. **AGT-01 のリトライ/エスカレーション方針の結線**: `decideOnJobFailure()`（10分×2、
   3回目で PMO エスカレーション = REQ-006）を上記2タスクの失敗処理として適用

## 調査を先に（blocked ゲート）

- **active projects の正本**: AGT-03 の入力となるプロジェクト一覧・selfStatus の
  ランタイム正本を特定する（プロジェクトマスタ data record / DB / ingest 済みレポート）。
  一意に定まらなければ blocked
- **open actions の正本**: AGT-06 の TrackedAction[]・assignee・managerEmailByProject の
  正本を特定する（PDCA 永続化 / DB テーブル / それ以外）。一意に定まらなければ blocked
- **ジョブ状態の永続化**: REQ-006 のリトライ回数がプロセス再起動を跨ぐ必要があるかを
  仕様から判定。新テーブルが必要なら schema 手順（migration + repo + テスト）に従う。
  仕様が再起動跨ぎを要求しないなら in-memory + 監査で足り、その判断を記録する

## 実装要件

- 各タスクは既存 `ScheduledTask` 形式で `scheduler/tasks/` に置き、判定ロジックは
  lib の純粋関数（原則1）。LLM は AGT-03 のエスカレーション理由文のみ（既存設計どおり）
- provider 注入（原則7）。データ源未設定時は degraded capability + 監査（ADR-0014）
- エスカレーション通知（PMO）は Graph 経由。宛先の正本も調査対象（stakeholder master 等）
- **ASM-006 の改訂**: PrjOps=Actions cron 前提の記述を、本結線（常駐）へ改め、
  理由（secrets/DB/監査の二重化回避 = R-02-2）を記す。該当ドキュメントを特定して更新
- テスト: 各タスクの営業日/時刻ゲート、AGT-01 リトライ遷移、degraded 経路、
  エスカレーション経路（DI モック）
- `mise run ci` green（実PG）/ matrix 再生成 / PR（ai-generated）→ checks green → main へ戻す
- merge はしない

## forbidden_actions

- allowed_files 外編集（調査で必要が判明した場合は具体名を挙げて拡張要求）、
  AGT-04/05/07 の再実装・重複結線、依存追加、merge、force push

## allowed_files（初期。調査結果により拡張要求可）

```
packages/server/src/scheduler/tasks/prjopsWeeklyAnalyzeTask.ts
packages/server/src/scheduler/tasks/prjopsDailyTrackerTask.ts
packages/server/src/lib/prjopsJobPolicy.ts
packages/server/src/index.ts
packages/server/src/lib/degradedCapabilities.ts
packages/server/tests/prjopsWeeklyAnalyzeTask.test.ts
packages/server/tests/prjopsDailyTrackerTask.test.ts
packages/server/tests/prjopsJobPolicy.test.ts
packages/server/tests/degradedCapabilities.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A046 status=ready_for_review|blocked report=.orchestration/reports/A046-report.md validation=.orchestration/validation/A046-validation.md sandbox=.orchestration/sandboxes/A046-sandbox.md learning=.orchestration/learning/A046-learning.md autoskill=.orchestration/autoskill/runs/A046-autoskill.md
```
