# 概要

AUD-OPM-001 を解消する承認基盤を追加します。Auth.js で検証済みの Entra subject を専用 HMAC envelope で Hono へ伝搬し、承認の生成・配信後可視化・CAS 判断・追記専用監査を WebUI と AGT_CHG へ結線します。

## 根拠となる仕様ID

- DevOps:SPEC-EXT-010
- DevOps:REQ-010 / DevOps:REQ-028 / DevOps:AC-010c
- ADR-0005 / DEC-SPEC-002 / AUD-OPM-001

## 主な変更

- 90秒 TTL の request-bound identity envelope、専用 `WEB_BFF_IDENTITY_SECRET`、欠落時 503/degraded、logger redaction
- `approvals` schema/migration/repository、pending 重複防止、配信後可視化、decision+audit の同一 transaction CAS
- request-time active recipient 解決と変更承認 PRF-L/PRF-G gate。project membership は操作者裁定により A051 へ延期し、`project_id` 列は本 PR で追加
- Web BFF/UI と AGT_CHG の approval URL 結線。report/JIT decision は後続結線まで 403 fail-closed

## 検証

- `mise run ci` green（実 PostgreSQL migration/integration 含む）
- `codex review --uncommitted` 3 回。actionable 指摘は是正済み
- 依存・lockfile 変更なし

## チェックリスト

- [x] 新規/変更ファイルの先頭に根拠IDヘッダを記載した
- [x] 根拠IDの要求内容をテストで示した
- [x] `mise run ci` がローカルでgreen
- [x] 秘密情報が差分に含まれていない
- [x] 決定的ロジックは外部 I/O 非依存モジュールに配置した
- [x] 外部作用に監査ログ記録がある
- [x] schema.sql 変更と Repo層+テスト+ロールバックDDLを同梱した

## AI生成の明示（ADR-0006）

- [x] このPRはAIコーディングエージェントが生成した（`agent/a044-approvals-foundation`、`ai-generated`）
- [ ] 人間が作成した

task_id: A044
trace_id: A044
