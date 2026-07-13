<!-- 根拠: REQ-018 / AC-018-1 / REQ-041 / SPEC-INT-068 / REQ-042 / AC-042-1 -->

# 負荷検証ベースライン（2026-07-13）

## 実行条件

- commit: `c72c7fd` (`origin/agent/T-P0-01`)
- runtime: Node.js 20.20.2 / pnpm 9.15.4 / Vitest 2.1.9
- functional command: `pnpm run verify:load`
- real PostgreSQL command: `AIOPS_LOAD_TEST_DATABASE_URL=<dedicated-test-db-url> AIOPS_LOAD_TEST_CONFIRM_DATABASE=<exact-db-name> pnpm run verify:load:postgres`
- PostgreSQL: 16.14、`127.0.0.1:55435/aiops_load`（資格情報は記録しない）

Graph stubへの2,000件配信と `app.request()` によるingest→dispatchのwall-clockは、コードパスの結線と
退行を観測する機能ベースラインであり、本番SLAを証明しない。2時間および5分という期限そのものは、
決定的な純粋関数について「境界値ちょうどは合格、1ms超過は不合格」をassertした。

## 結果

| 測定                                |                                                 実測 | 判定                         |
| ----------------------------------- | ---------------------------------------------------: | ---------------------------- |
| Graph stub配信（機能ベースライン）  |                                   2,000件 / 12.264ms | PASS（全件が逐次処理された） |
| ingest→dispatch（機能ベースライン） |                                             19.115ms | PASS（callbackまで到達した） |
| web data API mock連投               |                               500 request / 22.409ms | PASS（本番routeの結線）      |
| web pool mock                       |                  constructor 1回、stub query 1,000回 | PASS（process-wide再利用）   |
| 2時間期限の純粋関数                 |               7,200,000ms: true / 7,200,001ms: false | PASS                         |
| 5分期限の純粋関数                   |                   300,000ms: true / 300,001ms: false | PASS                         |
| 実PostgreSQL API連投                |                                          500 request | PASS（全レスポンス200）      |
| 実PostgreSQL物理接続                | before 0 / peak 1 / requests後 1 / `pool.end()` 後 0 | PASS（固定・解放を確認）     |
| 実PostgreSQL `pool.totalCount`      |                                               peak 1 | PASS                         |

実PostgreSQL試験はURLのDB名と `AIOPS_LOAD_TEST_CONFIRM_DATABASE` の完全一致を破壊的DDLの前に要求し、
専用の `application_name` で `pg_stat_activity` を各リクエスト後に観測した。
再実行可能なassertionと測定値出力は `packages/server/tests/loadBaseline.test.ts`、
`packages/web/tests/dataApiPoolLoad.test.ts`、`packages/web/tests/dataApiPoolRealPgLoad.test.ts` にある。

## 測定対象ソース

commit後の未確定差分も再現可能に識別するため、測定対象ファイルのSHA-256を記録する。

| ファイル                                           | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `package.json`                                     | `b33d1d8c57a5f7962e4dcc5d259241e0bd5e46328cf0ba24c74417be39abb7bd` |
| `packages/server/tests/loadBaseline.test.ts`       | `283c8a250e2ef2027266551107746a9da4bf721fb4a7896202e63f55ecbb0735` |
| `packages/server/src/lib/loadThresholds.ts`        | `db7efd928c05be982c2864f50aa59f655c77ff561d59e88a8c353d47c23c768c` |
| `packages/web/tests/dataApiPoolLoad.test.ts`       | `178967b59e306ccfc103be2df1b47a0bbc43e6a17e20a29ed2800b8f9359f1d8` |
| `packages/web/tests/dataApiPoolRealPgLoad.test.ts` | `29e3d770e6c866ad4a65c0f3499b28948bb8175ab44e33e84fa4621e86aa665b` |
| `packages/web/src/app/api/data/projects/route.ts`  | `f8c35fd379752f45cb9a36919fea8cfaca9d3bcaf6c338295f5ec4ae46ab9f6f` |
| `packages/web/src/server/db/pool.ts`               | `38b2af658960464d6430b7bf0f0ff7d82f3340cf11b51a37d61e6d56f05526cf` |

## 適用限界

この結果が確認するのは、Nodeプロセス内の結線、逐次配信ロジック、HMAC ingest、process-wide `getPool()`
再利用、および明示確認した専用ローカルPostgreSQL内の一時schemaに限る接続数不変条件である。
確認値は誤接続時のDDLを防ぐ補助ゲートであり、専用DB・最小権限ユーザー・バックアップの代替ではない。
Microsoft Graph/SMTPのrate limit、
実ネットワーク遅延、本番データ量、同時実行、scheduler capacity、冗長化構成を含む本番SLAは保証しない。
