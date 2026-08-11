# 概要

PrjOps AGT-03 weekly analysis と AGT-06 daily tracking を resident server scheduler に結線し、AGT-01 の 10 分間隔・2 回 retry と 3 回目 PMO escalation を適用します。owner-pinned immutable PrjOps snapshot を runtime 入力にし、通知成功状態だけを新しい PostgreSQL operational table に保存することで canonical YAML を read-only のまま維持します。report generation と AGT-04/05/07 delivery path は変更・重複実装していません。

Merge gate reviewで検出された3点を追加修正しています。PMO escalationをreport deliveryとは独立して明示allowlist検証し、通知成功後のstate write失敗でも同日再送しないJST日次dedupeを追加し、daily/weekly job slotはPMO送信成功またはdegraded audit完了後にだけ完了します。

## 根拠となる仕様ID

- PrjOps:REQ-001 / PrjOps:REQ-002 / PrjOps:REQ-006 / PrjOps:REQ-007 / PrjOps:REQ-009
- PrjOps:SPEC-INT-010 / PrjOps:SPEC-INT-020 / PrjOps:SPEC-INT-025 / PrjOps:SPEC-INT-032 / PrjOps:SPEC-INT-040
- PrjOps:SPEC-EXT-034 / PrjOps:SPEC-EXT-035
- PrjOps:ASM-006 / ADR-0003 / ADR-0014 / DEC-SPEC-001

## チェックリスト

- [x] 新規/変更ファイルの先頭に根拠IDヘッダを記載した
- [x] 根拠IDの要求内容を満たすことをテストで示した（describe/itタイトルにsystem名前空間付き仕様IDを含む）
- [x] `mise run ci` がローカルでgreen（governance / lint / traceability / format / build / typecheck / test:coverage）
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] 決定的ロジックは `src/lib/`（純粋関数）に配置し、agents/HTTPハンドラに埋め込んでいない
- [x] 外部作用（GitHub操作・メール送信・権限変更）には監査ログ記録がある
- [x] schema.sql変更を含む場合: Repo層+テスト+ロールバックDDLコメントを同梱した

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（ブランチ `agent/*`、ラベル `ai-generated` 付与済み）
- [ ] 人間が作成した

指示元 task_id: `A046`（agmsg orchestration）。

## Validation

- PostgreSQL-backed `mise run ci`: green (server 747 tests; repository全工程green)
- Merge-fix regression tests: 64 green（delivery-off escalation allowlist、同日reminder dedupe、daily/weekly PMO retry ordering）
- Crit data review: merge-fix scopeを含むresolved records 2件、unresolved 0件
