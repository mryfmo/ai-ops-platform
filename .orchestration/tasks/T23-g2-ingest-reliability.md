# T23 (G2): ingest 信頼性 — キュー再試行/DLQ + webhook 冪等 + Graph lifecycle

## Objective

ベストプラクティス監査 `.orchestration/audit/2026-07-09-bestpractice-A-ops.md` の A-6 / A-7 / A-8(HIGH×2 + MED)を是正。**必読**。敵対的レビューでも見逃した「イベント無音損失」を含む ingest 信頼性の中核。

## ブランチ

- `agent/T23` を `agent/T22` から作成、PR base は `agent/T22`。着手前に `/compact`。**G1 の申し送り(ゲート配線の退行テスト)も余力があれば拾ってよいが必須でない**

## 是正項目(バグ再現テスト先行)

### A-6 HIGH: イベントキューの無音損失
- `events` に `attempts INT DEFAULT 0`、`next_attempt_at TIMESTAMPTZ`、terminal `dead` 状態を追加(schema.sql、G3 で入れるマイグレーション基盤より前だが CREATE 追記の既存流儀で。G3 と衝突しないよう列追加は IF NOT EXISTS)
- 失敗イベント: status を 'delayed' で終端させず、attempts++ / next_attempt_at=now()+backoff(指数+ジッタ)で **再クレーム可能**にする。claimNextQueued の WHERE を「queued かつ next_attempt_at<=now()」等に拡張(既存の SKIP LOCKED は維持)
- N 回(設定可能、既定 5)超で status='dead' + 監査 + (可能なら)アラート用の明示ログ。dead は再クレームしない
- **dispatched の stranded 回収**: claim 時に claimed_at を記録し、`status='dispatched' AND claimed_at < now()-lease` を再クレーム対象に(visibility timeout、lease は設定可能)
- テスト: dispatch 失敗→再試行される、N 回超→dead、markDone 前クラッシュ相当(dispatched のまま)→lease 超過で再クレーム

### A-7 HIGH: webhook 冪等キー
- `events` に `dedupe_key TEXT` + unique 制約(部分 unique 可)。GitHub は `X-GitHub-Delivery` ヘッダ、Graph は各通知の一意 id を dedupe_key に
- enqueue を `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING`。0 行なら重複として 202 を返し再 enqueue しない(report_delivery_log の既存冪等パターンを踏襲)
- テスト: 同一 X-GitHub-Delivery の再送で 1 件しか処理されない、Graph 通知 id 重複でも同様

### A-8 MED: Graph lifecycle
- `/webhooks/graph` で lifecycle 通知(`reauthorizationRequired` / `subscriptionRemoved` / `missed`)を分類・処理: reauth→renew、removed→(再作成は CLI 運用だが)明示監査+アラート、missed→該当チャネルの delta/list backfill を起動
- テスト: 各 lifecycle 種別の分岐、missed→backfill 呼び出し

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし。実 API 呼び出しなし(テストはモック)。マージ禁止。`.orchestration/` は commit しない。audit_log への UPDATE/DELETE なし(events の状態遷移は events テーブルの UPDATE で、audit_log は不変)
- **無音スタブ・過大申告禁止**。未設定/未到達分岐は明示監査
- schema.sql の列追加は G3 のマイグレーション基盤と衝突しない IF NOT EXISTS 方式(G3 で正式なマイグレーション化)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T23-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T23-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T23-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T23 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
