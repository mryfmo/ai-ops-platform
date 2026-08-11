# A048: 監視の App Insights 統一・HTTP RED metrics・アラート移植

- task_id: A048
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。ブランチ `agent/a048-monitoring-unification`）
- 発行: claude-deep-dot（orchestrator）2026-08-09
- 担当: codex-deep-dot（herdr pane w1D:p4, `codex --profile deep` = gpt-5.6-sol high）
- レビュー・受入: claude-deep-dot
- max_turns: 40
- 根拠: ADV-OPS-003 / ADV-OPS-005 / 委任裁定 R-03-1〜3 / ADR-0016

## 実装要件

### 1. 仕様改訂（R-03-1。本タスクに限り仕様文書の編集を許可）

- `docs/spec/spec-id-catalog.md:277` と `docs/spec/devops/06_運用環境表.md:15` の
  **Datadog 前提記述を Log Analytics / App Insights（ADR-0016 採択）へ改訂**。
  改訂箇所には「ADR-0016 採択に伴う改訂（委任裁定 R-03-1）」の脚注/注記を残す。
  他の仕様文書に Datadog 参照が残っていないか grep し、あれば同様に改訂

### 2. HTTP RED metrics（R-03-3）

- Hono middleware で件数・レイテンシ・ステータス分布を計測し
  `observability/metrics.ts` に載せる（例: `aiops_http_requests_total{method,route,status}` /
  `aiops_http_request_duration_seconds`。ラベルは**ルートパターン**であり raw path を使わない
  — cardinality と secret 混入の両面から。根拠コメント必須）
- /healthz・/metrics 自身の自己計測は除外か含めるかを決めて理由を書く
- 99.9% / p95 / 5xx が PromQL / KQL で導出可能であることをコメントに例示

### 3. アラート移植（R-03-2）

- `ops/prometheus-rules.yml` の全ルール（5+ A038 の dead-letter 分）を
  **Azure Monitor（KQL）アラート定義**として `ops/azure-monitor-alerts/` に移植。
  形式は宣言的（bicep が無い現状では JSON/YAML 定義 + 適用手順 doc。D-04 で infra が
  実体化した際に IaC へ取り込める形にする）
- **移植完了をもって `ops/prometheus-rules.yml` を削除**（二重正本禁止 = R-03-2）。
  `/metrics` エンドポイント自体は維持
- 各アラートの閾値・for 期間は原本の意図を保存し、変換根拠をファイル内コメントに記す
- runbook の監視参照（observability-slo.md 等）を新定義へ同期

## 判断が必要になったら（blocked）

- 原本アラートに App Insights 側で表現不能なもの（メトリクス粒度の不足等）がある場合
- HTTP メトリクスのルートパターン取得が Hono の構造上決定的にできない場合

## 品質要件

- 仕様IDヘッダ / describe に仕様ID / `mise run ci` green（実PG）/ matrix 再生成
- middleware はテストで: 計測の実在・ルートパターンラベル・raw path 非使用・
  除外判断どおりの挙動を固定
- PR（ai-generated）→ checks green（merge 前スレッドゲート込み）→ main へ戻す。merge はしない

## forbidden_actions

- allowed_files 外編集、ADR 本文の書き換え、依存追加、merge、force push

## allowed_files

```
docs/spec/spec-id-catalog.md
docs/spec/devops/06_運用環境表.md
docs/spec/**（Datadog 参照の改訂に限る。編集したファイルを report に列挙）
packages/server/src/observability/metrics.ts
packages/server/src/observability/httpMetrics.ts
packages/server/src/http/app.ts
packages/server/tests/httpMetrics.test.ts
packages/server/tests/metrics.test.ts
ops/azure-monitor-alerts/**
ops/prometheus-rules.yml
runbooks/observability-slo.md
runbooks/manual-ops.md
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A048 status=ready_for_review|blocked report=.orchestration/reports/A048-report.md validation=.orchestration/validation/A048-validation.md sandbox=.orchestration/sandboxes/A048-sandbox.md learning=.orchestration/learning/A048-learning.md autoskill=.orchestration/autoskill/runs/A048-autoskill.md
```
