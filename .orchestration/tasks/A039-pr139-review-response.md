# A039: PR #139 レビュー指摘対応（縮退可観測性の構造是正）

- task_id: A039
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。開始時に `git fetch origin && git checkout agent/a034-degraded-observability && git pull --ff-only origin agent/a034-degraded-observability`）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol / reasoning high）
- レビュー・受入: claude-deep-dot（orchestrator。GitHub スレッドへの返信・resolve・merge は orchestrator が行う）
- max_turns: 30
- 対象: PR #139（`agent/a034-degraded-observability`）の未解決レビュースレッド3件（chatgpt-codex-connector）

## 指摘1 [P1] capability 判定を src/lib へ移す（index.ts:462 周辺）

`reportDegradation()` は既に判定済みの boolean を filter するだけで、**どの設定から各 capability が
有効と判定されるか**という本体のロジックが composition root（index.ts）に埋まっている。
このため unit テストは `github_outbound`（GitHub 認証 + project node ゲート合成）等の重要な対応を
一切検証していない。CLAUDE.md 原則1違反。

要求: 判定述語を `packages/server/src/lib/degradedCapabilities.ts`（または同 lib 配下の新ファイル）へ
移し、**config から CapabilityState を導く純粋関数**にする。index.ts は結線のみ。
重要な合成（github_outbound / pm_snapshot_reconcile / graph_subscriptions 等）をテストで固定する。

## 指摘2 [P2] graph_subscriptions メトリクスが /readyz 依存（index.ts:486 周辺）

購読数の gauge が /readyz の依存チェック内でしか更新されず、Prometheus が /metrics だけを
scrape する構成では起動後の変化（CLI が最初の行を入れた・operator が最後の行を消した）が
反映されない。

要求: /readyz のトラフィックに依存しない更新経路にする（メトリクス収集時に読む、または既存
scheduler の周期タスクで更新する。どちらを選んだかの理由をコメントに書く）。

## 指摘3 [P2] isReady() が throw すると degraded が消える（health.ts:46 周辺）

PostgreSQL 障害時など `isReady()` が throw する経路では catch 側が `{ ready: false }` だけを
返し、**まさに縮退情報が最も必要な場面で** `degraded` フィールドが落ちる。

要求: catch 経路でも `degraded` を返す。`docs/reference/http-api.md` の /readyz 行の記載と
実挙動が一致することを確認（#138 側で文言更新済み。矛盾があれば報告）。

## 品質要件

- 新規ファイルには根拠IDヘッダ。衝突IDは namespace 付き
- `mise run ci` green（実 PostgreSQL 必須）
- traceability matrix が変化するなら再生成してコミット
- **同一ブランチ `agent/a034-degraded-observability` へ push**（PR #139 が更新される）
- push 後、作業ツリーを `git checkout main` で戻す
- **GitHub スレッドへの返信・resolve・merge は行わない**（orchestrator 側）

## forbidden_actions

- allowed_files 以外の編集
- 依存関係の追加・更新
- merge、force push、他ブランチへの push

## allowed_files

```
packages/server/src/lib/degradedCapabilities.ts
packages/server/src/index.ts
packages/server/src/http/routes/health.ts
packages/server/src/observability/metrics.ts
packages/server/tests/degradedCapabilities.test.ts
packages/server/tests/health.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A039 status=ready_for_review|blocked report=.orchestration/reports/A039-report.md validation=.orchestration/validation/A039-validation.md sandbox=.orchestration/sandboxes/A039-sandbox.md learning=.orchestration/learning/A039-learning.md autoskill=.orchestration/autoskill/runs/A039-autoskill.md
```
