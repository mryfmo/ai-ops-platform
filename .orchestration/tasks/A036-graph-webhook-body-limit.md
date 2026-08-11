# A036: /webhooks/graph に body サイズ上限を入れる

- task_id: A036
- repo: /Users/mryfmo/Workspace/ai-ops-platform（main worktree で作業。開始時に `git checkout main && git pull --ff-only origin main`）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: codex-deep-dot（herdr pane w1D:p3, `codex --profile deep` = gpt-5.6-sol / reasoning high）
- レビュー・受入: claude-deep-dot（orchestrator。merge はタスクに含めない）
- max_turns: 25
- 根拠: `docs/audit/2026-08-05-adversarial-review/02-integration-seams.md` **ADV-INT-054 [Low]**
- 経緯: A035 は無関係な3所見を束ねていたため撤回済み。本タスクはその第1分割。

## 問題

`bodyLimit` は xlsxImport（`packages/server/src/http/routes/xlsxImport.ts:123`）にしか無い。
`graphNotifications`（`packages/server/src/http/routes/graphNotifications.ts:92`）は
**無認証のまま** `c.req.json()` で全部読む。LB/WAF の実設定は未確定（T-P1-07）なので、
アプリ側が唯一の防壁である。

## 実装要件

1. `/webhooks/graph` に `hono/body-limit` の `bodyLimit` を入れる。
2. 上限値は Graph change notification の現実的な最大サイズ（バッチ配送・validationTokens を含む）を
   踏まえて決め、**根拠を定数のコメントに書く**。xlsxImport の既存値を盲目的に流用しない。
3. 超過時の応答コード（bodyLimit 既定は 413）と、超過が監査ログに残るか否かを実装コメントで明示する。
   監査に残さない判断をするならその理由（無認証経路で attacker-controlled な高頻度イベントを
   追記専用ログに書かない等）を書く。
4. テスト: 上限以下は従来どおり、上限超過は 413。describe/it に仕様IDを含める。

## 判断が必要になったら

- Graph の仕様上、上限値が明確に決まらない場合は**推測せず `status=blocked` で報告**。

## 品質要件

- 新規ファイル先頭に根拠IDヘッダ。衝突IDは namespace 付き（bare は `ambiguous bare reference` で落ちる）
- `mise run ci` green（実 PostgreSQL 必須。未設定なら `mise run db:require` が手順を表示）
- `packages/traceability/output/traceability_matrix.md` が変化するなら再生成してコミット
- ブランチ `agent/a036-graph-body-limit` → push → PR（base=main、`ai-generated` ラベル）→ checks green
- PR 作成後、作業ツリーを `git checkout main` で戻す
- **merge は行わない**（受入は orchestrator）

## forbidden_actions

- allowed_files 以外の編集
- `/webhooks/graph` の認証方式（clientState 検証設計）の変更
- 依存関係の追加・更新
- merge、force push、他ブランチへの push

## allowed_files

```
packages/server/src/http/routes/graphNotifications.ts
packages/server/tests/graphNotificationsBodyLimit.test.ts
packages/traceability/output/traceability_matrix.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A036 status=ready_for_review|blocked report=.orchestration/reports/A036-report.md validation=.orchestration/validation/A036-validation.md sandbox=.orchestration/sandboxes/A036-sandbox.md learning=.orchestration/learning/A036-learning.md autoskill=.orchestration/autoskill/runs/A036-autoskill.md
```
