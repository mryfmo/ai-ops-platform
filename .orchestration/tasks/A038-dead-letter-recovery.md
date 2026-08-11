# A038: dead letter の検知と復旧手段を作る

- task_id: A038
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree で作業。開始時に `git checkout main && git pull --ff-only origin main`）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol / reasoning high）
- レビュー・受入: claude-deep-dot（orchestrator。merge はタスクに含めない）
- max_turns: 30
- 根拠: `docs/audit/2026-08-05-adversarial-review/05-ops-readiness.md` **ADV-OPS-008 [Medium]**
- 経緯: A035 撤回に伴う第3分割。**A037 の受入完了後に着手**（同一 worktree のため直列）。

## 問題

`aiops_events_queue_depth{status="dead"}` は出ている。しかし `ops/prometheus-rules.yml` に
dead 深度のアラートが無く、dead → queued へ戻す関数・CLI・ルートがどこにも無い
（`eventsRepo.ts` に該当メソッド無し）。全 runbook に "dead" の扱いが登場しない。
max attempts 到達イベントが永久に放置される。

## 実装要件

1. `ops/prometheus-rules.yml` に dead 深度のアラートを追加（閾値と for 期間の根拠をコメントに）。
2. `eventsRepo` に dead → queued へ戻すメソッドを追加。attempts をリセットするか維持するかを
   決め、**監査上の意味（何回試行されたかの履歴が消えるか）を実装コメントで明示**。
3. `runbooks/manual-ops.md` に復旧手順（検知 → 原因確認 → 再投入 → 監視復帰）を記載。
4. **HTTP ルートは追加しない**（外部から叩ける再実行経路は別途の判断が要る。リポジトリ層まで）。
5. テスト: 再投入対象の選別（dead のみ）、他 status への非干渉、attempts 方針を検証。

## 判断が必要になったら

- attempts リセット可否が監査の意味を変えると判断した場合は**推測せず `status=blocked`**。
- 既存 runbook 構成に収まらず新規 runbook ファイルが要ると判断した場合も同様。

## 品質要件

- 新規ファイル先頭に根拠IDヘッダ。衝突IDは namespace 付き
- `mise run ci` green（実 PostgreSQL 必須）
- traceability matrix が変化するなら再生成してコミット
- ブランチ `agent/a038-dead-letter-recovery` → push → PR（base=main、`ai-generated` ラベル）→ checks green
- PR 作成後、作業ツリーを `git checkout main` で戻す
- **merge は行わない**

## forbidden_actions

- allowed_files 以外の編集
- dead letter 再投入の HTTP ルート追加
- 依存関係の追加・更新
- merge、force push、他ブランチへの push

## allowed_files

```
packages/server/src/db/eventsRepo.ts
packages/server/tests/eventsRepoDeadLetter.test.ts
ops/prometheus-rules.yml
runbooks/manual-ops.md
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A038 status=ready_for_review|blocked report=.orchestration/reports/A038-report.md validation=.orchestration/validation/A038-validation.md sandbox=.orchestration/sandboxes/A038-sandbox.md learning=.orchestration/learning/A038-learning.md autoskill=.orchestration/autoskill/runs/A038-autoskill.md
```
