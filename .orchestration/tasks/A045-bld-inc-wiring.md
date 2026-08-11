# A045: AGT_BLD / AGT_INC をランタイムに結線する（Critical ADV-WIR-001 系）

- task_id: A045
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/a045-bld-inc-wiring`）
- 発行: claude-deep-dot（orchestrator）2026-08-08
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 40
- 根拠: ADV-WIR-001（Critical）/ ADV-WIR-002 / 委任裁定 R-02-1。
  **AGT_DEP は本タスクに含めない**: TH-001/TH-003 の入力（coverage%・5xx率・p95）の正本が
  A048（監視統一）に依存するため、A052 として監視実装後に結線する。

## 現状（orchestrator 事前調査済み）

- ルーティング（`githubEventRouter.ts:187` selectDevopsAgentForGithubEvent）・5秒ポーリング・
  retry/dead-letter は完備。**`index.ts:274-304` の3ハンドラだけが audit 1行のスタブ**。
- AGT_BLD entry: `classifyBuildFailure(logText, deps)` / `generateFixSuggestionIfApplicable(...)`
  （LLM は confidence ≥0.6 ガード付き）。**GitHubClient に workflow run ログ取得メソッドが無い**。
- AGT_INC entry: `classifyIncident(alertText, metricsSummary, similarIncidentsSummary, deps)` /
  `triageAndNotify(...)`（sev1 は候補どまり AC-015c、出力サニタイズ済み）。
- クライアントは全て注入済み（GitHubClient/GraphClient/AnthropicStructuredClient/AuditLog。
  fetchWithBackoff の retry・LLM コストガードあり）。

## 実装要件

### AGT_BLD（workflow_run failure → 分類 → 提案）

1. `GitHubClient` に workflow run ログ取得メソッドを追加（`fetchWithBackoff` 準拠・サイズ上限を
   決めて根拠コメント。zip 解凍が要る場合は依存追加禁止のため Node 標準の範囲で。
   不可能なら jobs API のステップ要約で代替し、選択理由を記録）。
2. index.ts の AGT_BLD ハンドラ: workflow_run(failure) → ログ/要約取得 →
   `classifyBuildFailure` → 該当時 `generateFixSuggestionIfApplicable` → 結果を
   **PR コメント（対象 PR が特定できる場合）または issue** として投稿。投稿前サニタイズ（原則4）。
   LLM 未設定（ANTHROPIC_API_KEY なし）は capability degraded + 監査でスキップ（ADR-0014 準拠）。
3. push / pull_request イベントは**受信監査のみ維持**（分類対象は failure のみ。過剰結線しない）。

### AGT_INC（issues → 分類 → トリアージ通知）

4. index.ts の AGT_INC ハンドラ: issues(opened) → `classifyIncident` → `triageAndNotify`。
   - `metricsSummary`: 既存 `MetricsRegistry` のスナップショットから決定的に生成（新規収集はしない）
   - `similarIncidentsSummary`: 監査ログ（devops_1y）の直近 `triage` レコードから決定的に生成。
     **専用テーブルの新設はしない**（YAGNI）。それが仕様と矛盾する場合は blocked
   - Teams channel: 既存の default channel 設定を使用。未設定は degraded スキップ + 監査
5. 両ハンドラとも: 1イベントの失敗は既存 retry/dead-letter 機構に委ね、ハンドラ内で握り潰さない。

## 判断が必要になったら（blocked）

- ログ取得 API の応答形式が依存追加なしで扱えない場合
- similarIncidents の正本について仕様（SPEC-INT-030）が別の定義を持つ場合
- 投稿先（PR コメント vs issue）の決定規則がイベント payload から一意に定まらないケースの扱い

## 品質要件

- 仕様IDヘッダ / describe に仕様ID / `mise run ci` green（実PG）/ matrix 再生成
- テスト: ハンドラ結線（DI モックで LLM/GitHub/Graph を注入、原則7）。分類→投稿の
  happy path、confidence 不足時の不投稿、LLM 無し degraded、issues 以外の無視、
  サニタイズ通過の各経路
- PR（ai-generated）→ checks green → `git checkout main`。merge はしない

## forbidden_actions

- allowed_files 外編集、AGT_DEP の結線、依存追加、merge、force push

## allowed_files

```
packages/server/src/index.ts
packages/server/src/lib/devopsEventHandlers.ts
packages/shared/src/clients/githubClient.ts
packages/shared/tests/githubClient.test.ts
packages/server/tests/devopsEventHandlers.test.ts
packages/server/src/lib/degradedCapabilities.ts
packages/server/tests/degradedCapabilities.test.ts
packages/traceability/output/traceability_matrix.md
```

（結線ロジックの本体は `devopsEventHandlers.ts` に置き、index.ts は組み立てのみ。原則1）

## 完了報告

```
AGMSG-RESULT v1 task_id=A045 status=ready_for_review|blocked report=.orchestration/reports/A045-report.md validation=.orchestration/validation/A045-validation.md sandbox=.orchestration/sandboxes/A045-sandbox.md learning=.orchestration/learning/A045-learning.md autoskill=.orchestration/autoskill/runs/A045-autoskill.md
```
