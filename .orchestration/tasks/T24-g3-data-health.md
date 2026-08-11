# T24 (G3): データ健全性 — マイグレーション基盤 + プール設定 + T23 繰り越し nit

## Objective

監査 `.orchestration/audit/2026-07-09-bestpractice-A-ops.md` の A-11(HIGH マイグレーション)/A-11b(MED プール)を是正。あわせて T23 から繰り越した DB トランザクション nit を拾う。**監査必読**。

## ブランチ

- `agent/T24` を `agent/T23` から作成、PR base は `agent/T23`。着手前に `/compact`

## 是正項目(バグ再現テスト先行)

### A-11 HIGH: マイグレーション基盤
- **node-pg-migrate を導入**(既存の pg ショップ、最小の新規 dev 依存)か、それが過大と判断するなら `schema_migrations(version, applied_at)` テーブル + 順序化した `packages/*/migrations/NNN_*.sql` + 適用スクリプトを自作。どちらを選んだか report に理由付きで(node-pg-migrate 推奨だが判断はワーカーに委ねる)
- 既存 schema.sql の `-- MIGRATIONS` 節の内容を、選んだ仕組みの初期マイグレーション群に移行(既存 DB を壊さない冪等な形。CREATE TABLE IF NOT EXISTS 相当の安全性を保つ)
- **NOT VALID 制約の VALIDATE パス**を用意(既存行に対する検証を別マイグレーションで。ロック影響を注記)
- マイグレーション適用手順を runbook 化(起動時自動適用か手動かを決め、docs/reference/configuration.md と runbook に記載)
- **依存追加の許可はこのタスクに限り node-pg-migrate(または同等の 1 ライブラリ)のみ**

### A-11b MED: プール設定
- `packages/server/src/db/pool.ts` に `max`、`statement_timeout`(例 30s)、`idle_in_transaction_session_timeout`、`connectionTimeoutMillis` を追加。値は config 経由で調整可能に(config.ts に env 追加、既定値を documented)
- テスト: プールが設定値で構築されること

### T23 繰り越し nit(T23.acceptance.md 記載)
- **エラー→ROLLBACK→release 経路のテスト**を eventsRepo に追加(UPDATE が reject するモックで、最終 query が ROLLBACK・client が release されることを検証)
- 失敗 ROLLBACK 時の接続破棄: `catch` の ROLLBACK が throw したら `client.release(err)` で poison 接続をプールから破棄(握り潰さない)
- LIMIT 10 → コメント(ponytail: worker 競合が出たら LIMIT 1)を付す。挙動変更は不要

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。**依存追加は node-pg-migrate(または同等 1 つ)のみ**。実 API 呼び出しなし。マージ禁止。`.orchestration/` は commit しない。audit_log への UPDATE/DELETE なし
- **無音スタブ・過大申告禁止**。既存 DB を壊すマイグレーションを書かない(冪等・後方互換)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T24-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T24-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T24-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T24 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
