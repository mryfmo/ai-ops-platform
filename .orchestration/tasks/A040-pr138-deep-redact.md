# A040: PR #138 レビュー指摘対応（任意深度の秘密キー redact）

- task_id: A040
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree。開始時に `git fetch origin && git checkout agent/a033-metrics-auth-log-redact && git pull --ff-only origin agent/a033-metrics-auth-log-redact`）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol / reasoning high）
- レビュー・受入: claude-deep-dot（orchestrator。GitHub スレッドへの返信・resolve・merge は orchestrator が行う）
- max_turns: 25
- 対象: PR #138（`agent/a033-metrics-auth-log-redact`）の未解決レビュースレッド1件 [P2]（logger.ts:42）

## 指摘

現在の redact パスは `name` と `*.name` の2形だけで、深さ2以上
（例: `logger.info({ request: { headers: { authorization: token } } })`）の秘密キーが素通りする。

## 要求

1. まず **fast-redact（pino の redact 実装）が多段ワイルドカード（`*.*.name` 等）を
   どこまでサポートするかを実際にテストで確認**し、結果を validation に記録する。
   ドキュメントの記憶で判断しない。
2. その結果に基づき方式を選ぶ:
   - 多段ワイルドカードが機能するなら、現実的な深さ（例: 3段）まで path を生成して張る。
     「なぜその深さで十分か」の根拠（当リポジトリのログ呼び出し実態の grep 結果）をコメントに書く
   - 機能しない・性能が許容外なら、再帰 censor（カスタム serializer / formatter）へ切り替える
3. テスト: 深さ2・3 の `authorization` / `GRAPH_CLIENT_SECRET` 等が `[redacted]` になることを
   **修正前に落ちる形で**先に書き、修正後に通ることを固定する。既存の深さ0/1 テストは維持。
4. logger 生成のホットパスに極端なコストを足さない（ベンチは不要だが、方式選択の理由に言及）。

## 品質要件

- `mise run ci` green（実 PostgreSQL 必須）
- **同一ブランチ `agent/a033-metrics-auth-log-redact` へ push**（PR #138 が更新される）
- push 後、作業ツリーを `git checkout main` で戻す
- **GitHub スレッドへの返信・resolve・merge は行わない**（orchestrator 側）

## forbidden_actions

- allowed_files 以外の編集
- 依存関係の追加・更新（fast-redact は pino 経由の既存依存のみ使用）
- merge、force push、他ブランチへの push

## allowed_files

```
packages/server/src/observability/logger.ts
packages/server/tests/logger.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A040 status=ready_for_review|blocked report=.orchestration/reports/A040-report.md validation=.orchestration/validation/A040-validation.md sandbox=.orchestration/sandboxes/A040-sandbox.md learning=.orchestration/learning/A040-learning.md autoskill=.orchestration/autoskill/runs/A040-autoskill.md
```
