---
name: db-migration
description: packages/devops/src/db/schema.sql の変更（テーブル追加・列追加）とロールバック手順を規約に沿って生成する。DBスキーマを変更する必要があるとき常に使用。
---

# db-migration: DBスキーマ変更

## 制約（違反禁止）

- `audit_log` へのUPDATE/DELETE権限をアプリロールに付与するDDLを書かない（SPEC-INT-056）
- 既存テーブルのDROP・破壊的変更は人間の明示承認なしに行わない
- 監査系テーブルは追記専用を維持する

## 手順

1. 変更内容を確定: 新テーブルか既存テーブルへの列追加か
2. `packages/devops/src/db/schema.sql` はfresh-DBの最新形だけを編集:
   - 新テーブル: `CREATE TABLE IF NOT EXISTS` で追記。各テーブルの直前に根拠ID（SPEC-INT-xxx / ADR-xxxx）コメントを付ける
   - 列追加: schema.sql本体のテーブル定義を更新する。schema.sqlへinline `ALTER TABLE` は書かない
3. 既存DB用に `packages/devops/src/db/migrations/NNN_description.sql` を新規作成:
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` など冪等DDLを書く
   - ロールバックDDLを同ファイルにコメントとして併記（`-- rollback: ...`）
4. 対応するリポジトリ層を追加/更新: `packages/server/src/db/{table}Repo.ts`
   - pg Poolを引数注入（テストはモックPoolで実行）
   - INSERT/SELECTのみか、UPDATEが必要かを仕様から判断（論理削除は deleted_at / revoked_at パターン）
5. リポジトリ層のテストを `packages/server/tests/` に追加
6. 保持期間・purgeが必要なテーブルは `runbooks/` への手順追記も同一PRで行う
7. 検証: `mise run ci` green
