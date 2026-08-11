# T10: Phase I1 — GitHub 時系列スナップショット基盤 + 動的期間ダッシュボード(ADR-0007 実装)

## Objective

ADR-0007(webhook 駆動スナップショット蓄積)を実装し、非 GitHub ユーザーが Web で週/月/四半期/半年/年を自由に切り替えて閲覧できる動的ダッシュボードのデータ基盤と機能を完成させる。調査根拠: `.orchestration/research/2026-07-09-deep-research.md` 論点 1。**webhook 取得は forward-only のため、本基盤の稼働開始が最優先**。

## ブランチ戦略(重要)

- `agent/T10` を main から作成し、**origin/agent/T05 と origin/agent/T09 を merge してから着手**(T05 の githubEventRouter/eventsPollingTask と T09 のビュー刷新に依存。T09 は T07 を含む)
- PR 説明に「PR #1, #4, #6 を含むスタック PR。それらのマージ後に rebase 可」と明記

## スコープ(この順で)

### 1. スナップショット蓄積(server + devops)

- DB: `schema.sql` に追加(CREATE TABLE IF NOT EXISTS、対応リポジトリ層+テスト同一 PR):
  - `pm_events`(webhook 由来の正規化イベント: projects_v2_item の from/to、projects_v2_status_update、issues/PR/milestone イベント。生ペイロードは 3 箇所サニタイズ)
  - `pm_snapshots`(定期フルスナップショット: issue/PR/milestone/project item の状態。reconcile 用)
- webhook 経路: 既存 `githubWebhook` ルート + T05 の `githubEventRouter` を拡張し、projects_v2_item / projects_v2_status_update / issues / pull_request / milestone イベントを `pm_events` に正規化保存する dispatch 先を追加
- reconcile: scheduler に定期フルポーリングタスク(既存 scheduler/tasks の流儀。間隔は設定可能、既定 6 時間)を追加。GraphQL は 2 段ページネーション(items→fieldValues、first 100)、**rate limit は rateLimit オブジェクトを実行時参照**し残量僅少時はスキップして次回へ。取りこぼし検知(webhook 由来と snapshot の差分)は監査ログに記録
- 認証・org 制約: projects_v2 系 webhook が org レベル限定である旨を README/runbook に明記(runbooks/ に設定手順を追加 — new-runbook スキルの流儀)

### 2. 期間集計 lib(prjops または shared — 配置理由を report に)

- `periodBuckets.ts`: 週(ISO 週 — 既存 `isoWeekOf` 再利用)/月/四半期/半年/年のバケット定義と、pm_events/pm_snapshots からの決定的集計(オープン/クローズ推移、ステータス遷移数、マイルストーン消化、バーンダウン系列、DORA 入力系列)。全て純粋関数+境界値テスト(期首/期末、JST — 既存 businessCalendar/nowIsoJst 再利用)

### 3. 動的期間ダッシュボード(web)

- `app/api/data/timeseries` ルート: period(week|month|quarter|half|year)+ 基準日 + persona を受け、期間集計 lib の結果を返す(権限フィルタはデータ取得側)
- DashboardClient に期間切替 UI(週/月/四半期/半年/年 + 前後ナビゲーション)を追加し、各ペルソナビュー(executive/manager/investor)が選択期間のデータで再描画されるよう接続
- チャートは既存手書き SVG 流儀の最小限(時系列ライン+バーンダウン)。**ビジュアル刷新は Phase I5 で行うため装飾はしない**。データ整形は lib に置く

### 4. 仕様 ID

- ADR-0007 記載の予定 ID(REQ-036/SPEC-INT-062/AC-036-1、DevOps REQ-031/SPEC-INT-081/AC-031a — ADR を確認して正確に)を登録し traceability green

## 規約

- DoD: `mise run ci` green(レース時 -j 1、記録)。GitHub checks green まで確認
- テストは全てモック(実 GitHub API 呼び出し禁止)、describe/it に仕様 ID、lib/agents 分離、監査ログ追記専用
- Conventional Commits、PR(`ai-generated`)、マージ禁止、`.orchestration/` は commit しない

## Forbidden actions

- 依存追加、main への push、PR マージ、force push、実 GitHub/LLM API 呼び出し
- ビジュアル装飾(I5 の先取り)、Recharts 導入

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T10-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T10-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T10-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T10 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
