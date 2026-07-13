# Plan 001: PostgreSQL初期化・監査台帳・migrationを実DBで成立させる

> **Executor instructions**: 本planだけを実行する。テストを先に追加し、各Verifyが期待どおりになるまで次Stepへ進まない。STOP条件では推測修正せず証拠を報告する。完了後に `plans/README.md` の001だけを更新する。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- packages/devops/src/db packages/devops/tests packages/server/src/db packages/server/tests runbooks/database-migrations.md`。差分があればCurrent stateと突合し、DDLまたはmigration順序が変わっていればSTOP。

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — 誤ったmigrationはデータ損失または監査停止を起こす。
- **Depends on**: none
- **Category**: migration / correctness / compliance
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] Current stateを現行 `file:line` で測定した。
- [x] Commands、Scope、Test plan、Maintenance notesを含む。
- [x] 各実装StepにPositive/Adversarial Verifyを含む。
- [x] 監査追記専用、secret非保存、rollback安全性を安全回帰へ記載した。
- [ ] 実装完了時に同じ観点で再監査し、受入証跡へraw logを保存する。

## Why this matters

現行fresh schemaは `audit_log(log_id PRIMARY KEY) PARTITION BY RANGE(at)` であり、PostgreSQLのpartitioned table制約に反する。さらに実partitionがコメント例しかない。DB初期化と最初の監査INSERTが失敗する状態では、上位agent、Webhook、配信をいくら実装しても製品は起動しない。

不変条件は、監査ログがappend-onlyであること、PrjOps 5年とDevOps 1年の保持区分が機械的に判別できること、既存DBを破壊せずmigrationできること。

## Current state

- `packages/devops/src/db/schema.sql:186-195` — partition keyを含まない `log_id` 単独PK。
- `packages/devops/src/db/schema.sql:198-201` — REVOKE/GRANTはコメントだけで実適用されない。
- `packages/devops/src/db/schema.sql:213-216` — partition作成・13か月削除は例示のみ。
- `packages/shared/src/auditLog.ts:5-7` — PrjOps 5年、DevOps 1年を要求。
- `packages/server/src/db/pgAuditLog.ts:19-32` — domain/retention classなしで単一表へINSERT。
- `packages/devops/src/db/migrate.ts:47-91` — migration transaction/advisory lockは実装済み。
- `packages/devops/tests/migrate.test.ts:1` — mock queryのみで実PostgreSQL DDLを検証しない。
- `verification/VERIFICATION_REPORT.md:43-49` — 実DB E2E未実施。

## Commands you will need

| Purpose       | Command                                                                                         | Expected                               |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| Baseline      | `mise run ci`                                                                                   | exit 0                                 |
| DB start      | `docker compose -f verification/postgres.compose.yml up -d --wait`                              | PostgreSQL healthy                     |
| Fresh schema  | `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/devops/src/db/schema.sql`             | exit 0                                 |
| Migrations    | `DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @aiops/devops run db:migrate`                  | applied/skipped summary, exit 0        |
| Focused tests | `pnpm --filter @aiops/devops test -- migrate && pnpm --filter @aiops/server test -- pgAuditLog` | all pass                               |
| Diff          | `git diff --check && git diff --name-only`                                                      | no whitespace errors; only Scope files |

## Scope

**In scope**

- `packages/devops/src/db/schema.sql` — valid latest fresh-DB shape。
- `packages/devops/src/db/migrations/` — existing DBをvalid audit schemaへ移行する新規SQL。
- `packages/devops/src/db/migrate.ts` —必要な場合のみmigration metadata/lockingを最小修正。
- `packages/server/src/db/pgAuditLog.ts` — domain/retention classを保存する契約。
- `packages/shared/src/auditLog.ts` — audit record domain型が必要な場合のみ。
- `packages/devops/tests/migrate.test.ts`, `packages/server/tests/pgAuditLog.test.ts`。
- `verification/postgres.compose.yml`, `verification/run_db_integration.sh` — disposable実DB検証。
- `runbooks/database-migrations.md`, `runbooks/audit-retention.md`。

**Out of scope**

- 他テーブルの業務スキーマ変更。
- production DBへのmigration実行。
- audit recordのUPDATE/DELETE API追加。
- ORM導入。既存 `pg` とSQLを使用する。

## Steps

### Step 1: 実PostgreSQL失敗テストを固定する

- [ ] disposable PostgreSQL composeと検証scriptを追加する。
- [ ] schema適用、全migration適用、再適用、audit INSERT/SELECTを順番に実行する。
- [ ] 現行HEADでschema適用がPK制約により失敗することをraw logで確認する。

**Verify**

- Positive: 修正前テストが意図したDDL箇所で非0終了する。
- Adversarial: scriptから `ON_ERROR_STOP=1` を一時的に外すとテスト自身が検出して失敗する。

### Step 2: audit schemaと保持区分を決定する

- [ ] PKを `(at, log_id)` 等、partition keyを含む有効形にする。
- [ ] `domain` または `retention_class` をNOT NULL CHECK付きで追加し、`prjops_5y|devops_1y` を区別する。
- [ ] current month、next month、DEFAULT quarantineのpartitionを作る。採用形はmigrationとrunbookで同一にする。
- [ ] app roleへINSERT/SELECTのみを付与するSQLを運用migrationとして用意する。

**Verify**

- Positive: fresh schema→audit INSERT→trace_id SELECTが成功する。
- Adversarial: 不正retention class INSERT、親表UPDATE/DELETEをapp roleで実行すると拒否される。

### Step 3: 既存DB migrationを安全化する

- [ ] 既存非partition/partition table双方の検出条件をSQLで明示する。
- [ ] migrationはtransaction内で実行し、データcopy件数を移行前後で照合する。
- [ ] 破壊的DROPは照合後に限定し、rollback手順をrunbookへ記載する。

**Verify**

- Positive: fixture旧schemaに3 recordsを入れ、migration後も3 recordsとJSON内容が一致する。
- Adversarial: copy件数を意図的に不一致にしたfixtureではmigrationがCOMMITせず旧表を保持する。

### Step 4: partitionローテーションを実装する

- [ ] 月次partition作成関数/scriptを追加し、二重実行を冪等にする。
- [ ] retention class別に削除対象をdry-run表示し、人間承認なしにproduction DROPしない。
- [ ] UTC/JST境界をテストする。

**Verify**

- Positive: 14か月fixtureでDevOps対象だけがdry-run列挙され、PrjOpsは残る。
- Adversarial: current/future partitionをDROP対象へ含める入力ではscriptが拒否する。

### Step 5: 全回帰と証跡を閉じる

- [ ] `mise run ci`、fresh/upgrade DB integrationを連続実行する。
- [ ] raw logをsecret redactedで `verification/test-results/` に保存する。
- [ ] runbookにbackup/PITR checkpointとrestore確認を追記する。

**Verify**

- Positive: 全command exit 0、二回目migrationは全件skipped。
- Adversarial: partitionなし月へINSERTしてもDEFAULTへ隔離されalert対象になるか、明示失敗する。黙って消失しない。

## Test plan

- `packages/devops/tests/migrate.test.ts`: transaction、advisory lock、再実行、rollback。
- `packages/server/tests/pgAuditLog.test.ts`: domain必須、append/read、UPDATE/DELETE非提供。
- 実DB script: fresh schema、旧schema upgrade、invalid class、role権限、partition境界。
- `mise run traceability`:仕様ID参照を維持。

## Done criteria

- [ ] fresh PostgreSQLへschemaがexit 0で適用される。
- [ ] fresh/upgrade双方で全migrationが成功し、再実行が冪等。
- [ ] audit INSERT/SELECTが成功し、app roleのUPDATE/DELETEが失敗する。
- [ ] PrjOps 5年/DevOps 1年を列単位で識別できる。
- [ ] partition作成・dry-run retention testが成功する。
- [ ] `mise run ci` がgreen。
- [ ] Scope外のsource変更がない。
- [ ] `plans/README.md` の001が更新される。

## STOP conditions

- 既存production DBの実schemaがplan記載と異なる。
- audit_logに既存データがあり、domainを決定的にbackfillできない。
- migrationでtable rewrite/lock時間が許容値未定のまま必要になる。
- backup/PITR checkpointを取れない環境へ適用する必要が出る。
- app role名・所有権・managed PostgreSQL制約が不明。
- Scope外テーブル変更なしにmigrationできない。

## Maintenance notes

- partition作成はcalendar jobとdeployment前checkの両方で検証する。
- audit PKを参照する外部consumer追加時は `(at, log_id)` 契約を明示する。
- retention変更はコード定数でなくDB policy/runbookと同時に変更する。
- reviewerはデータcopy照合、lock、role権限を重点確認する。

## 安全回帰

- [ ] audit logはappend-onlyでUPDATE/DELETE APIを追加しない。
- [ ] secret-like dataは保存前に拒否またはredactする。
- [ ] 理由必須操作は `validateReasonRequirement` を通す。
- [ ] PrjOps/DevOps retentionを混同しない。
- [ ] migration失敗時に旧データを失わない。
- [ ] production適用は人間承認とbackup確認後のみ行う。
