# A014 acceptance record

- task_id: A014
- verdict: accepted
- reviewer: orchestrator-fable5 (claude-code)
- date: 2026-07-19
- review_source: .orchestration/validation/A014-validation.md(crit 自己レビュー P1=1 resolved)

## 検証(独立・実測)

- **orchestrator 自身の使い捨て PostgreSQL 16(port 55433、TCP-only、検証後に完全破棄)で再実測**:
  devops suite 201/201 pass(fresh/upgrade/reapply/catalog/negative/rollback を含む)、
  server suite 477/477 pass。worker の port 55432 実測と独立に二重確認。
- 構造: PR #108 は task 許可の 5 ファイルのみ。schema.sql に inline ALTER なし。
  audit_log の `REVOKE UPDATE, DELETE, TRUNCATE` + `GRANT INSERT, SELECT` 維持(357-359 行)。
  migration は規約どおり `202607180000_recipients_stable_subject.sql`。
- rollback DDL: PR 本文とテスト内 DDL の両方に存在。
- worker 自己レビューの P1(project allowlist 付き PRF-04 recipient が backfill で global scope へ
  昇格しうる)は「global-capable profile かつ空 allowlist」の二条件化 + regression fixture で是正済み
  — セキュリティ上意味のある本質修正であることを確認。
- hosted checks 全 SUCCESS。

## next_action

- PR #108 merge → ancestry 確認 → F02-T04(legacy backfill dry-run/apply)へ。
