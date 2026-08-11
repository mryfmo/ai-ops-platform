# A037: 祝日カレンダーの有効期限切れを検知可能にする

- task_id: A037
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree で作業。開始時に `git checkout main && git pull --ff-only origin main`）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol / reasoning high）
- レビュー・受入: claude-deep-dot（orchestrator。merge はタスクに含めない）
- max_turns: 25
- 根拠: `docs/audit/2026-08-05-adversarial-review/05-ops-readiness.md` **ADV-OPS-010 [Low]**
- 経緯: A035 撤回に伴う第2分割。**A036 の受入完了後に着手**（同一 worktree のため直列）。

## 問題

`packages/shared/src/calendar/jp_holidays.yaml` は 2027-11-23 まで収録。データは足りているが、
`businessCalendar.ts` にも起動時にもカバレッジ検証が無い。期限を過ぎると
**祝日が silently 営業日扱い**になり、報告・督促のタイミングが狂う。年1回の手動PRだけが頼り。

## 実装要件

1. カレンダー最終日と現在日からの残日数判定を**純粋関数**として
   `packages/server/src/lib/calendarCoverage.ts` に置く（CLAUDE.md 原則1。now は引数注入）。
2. 起動時に評価し、閾値未満なら warn ログ + メトリクス（例: 残日数 gauge）を出す。
   閾値はハードコードでよいが根拠をコメントに書く（手動PRのリードタイムを考慮）。
3. テスト: 境界値（閾値ちょうど・前後・期限超過・データ空）を網羅。describe/it に仕様ID。

## 判断が必要になったら

- 既存 metrics 構成に gauge を素直に足せない構造上の問題を見つけた場合は `status=blocked`。

## 品質要件

- 新規ファイル先頭に根拠IDヘッダ。衝突IDは namespace 付き
- `mise run ci` green（実 PostgreSQL 必須）
- traceability matrix が変化するなら再生成してコミット
- ブランチ `agent/a037-calendar-coverage` → push → PR（base=main、`ai-generated` ラベル）→ checks green
- PR 作成後、作業ツリーを `git checkout main` で戻す
- **merge は行わない**

## forbidden_actions

- allowed_files 以外の編集
- jp_holidays.yaml のデータ変更
- 依存関係の追加・更新
- merge、force push、他ブランチへの push

## allowed_files

```
packages/server/src/lib/calendarCoverage.ts
packages/server/src/index.ts
packages/server/src/observability/metrics.ts
packages/server/tests/calendarCoverage.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A037 status=ready_for_review|blocked report=.orchestration/reports/A037-report.md validation=.orchestration/validation/A037-validation.md sandbox=.orchestration/sandboxes/A037-sandbox.md learning=.orchestration/learning/A037-learning.md autoskill=.orchestration/autoskill/runs/A037-autoskill.md
```
