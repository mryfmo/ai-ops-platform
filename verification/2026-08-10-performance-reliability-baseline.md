<!-- 根拠: PRD-010 / GOV-001 / P0-T05 / PrjOps:REQ-030 / AC-018-1 / PrjOps:REQ-041 / PrjOps:REQ-042 / PrjOps:AC-042-1 -->

# Performance and reliability baseline (2026-08-10)

## 結論

現行 main `e41e6e67cf5f42b70b8aa0b15c2b2266fcdd3862` で、既存の
100案件・2,000受信者、stub配信、local API、実PostgreSQL pool の再現可能な
baseline を再測定した。測定対象は local functional path であり、production SLA の達成証明ではない。
実 LLM と Microsoft Graph の latency は承認済み実環境・資格情報がないため `ENV-blocked` とし、
green や 0ms として扱わない。

## 実行条件

- commit: `e41e6e67cf5f42b70b8aa0b15c2b2266fcdd3862`
- tree: `7321c5a2b40078921496ec145e2526fbd7b87562`
- runtime: Node.js 22.23.1 / pnpm 11.13.0 / Vitest 4.1.10
- database: PostgreSQL 16.14、task-owned loopback cluster、専用DB `aiops_load`
- 実行日: 2026-08-10 JST

## 実測値

| 対象                                    |                                                                実測 | 判定            | 適用範囲                                                             |
| --------------------------------------- | ------------------------------------------------------------------: | --------------- | -------------------------------------------------------------------- |
| 100案件の分析 + 2,000受信者の生成・検証 |                                                            44.469ms | PASS            | pure/local functional baseline                                       |
| Graph stub 逐次配信                     |                               2,000件 / 20.347ms / 98,295.797 msg/s | PASS、失敗0件   | stubのみ。Graph rate limit・network latencyを含まない                |
| ingest→dispatch callback                |                                                            11.843ms | PASS            | Hono `app.request()` + injected callback。実networkなし              |
| web data API mock連投                   |                                                    500件 / 15.917ms | PASS            | mock DB query、pool constructor 1回、query 1,000回                   |
| 実PostgreSQL付きproduction GET route    |                                           500件 / test body 1,019ms | PASS            | 各GET後の `pg_stat_activity` 観測を含むため純粋なAPI latencyではない |
| 実PostgreSQL物理接続                    |                before 0 / peak 1 / requests後 1 / `pool.end()` 後 0 | PASS            | task-owned local PostgreSQL                                          |
| PostgreSQL `SELECT 1` client round-trip | 200 samples: mean 0.145ms / p50 0.139ms / p95 0.247ms / max 0.367ms | PASS            | warm-up 10回後、loopback、単一client、逐次実行                       |
| 実 Anthropic LLM latency                |                                                                   — | **ENV-blocked** | `ANTHROPIC_API_KEY=unset`。実model/providerを呼び出していない        |
| 実 Microsoft Graph API latency          |                                                                   — | **ENV-blocked** | 承認済みtenant・mailbox・資格情報・rate-limit試験枠が未提供          |

2時間と5分の期限は既存の決定的関数により、境界値ちょうどを合格、1ms超過を不合格として検証した。
local wall-clock をこの期限と比較して production AC を green にすることはしない。

## 再現コマンド

WBS記載の次のコマンドは exit 0 だったが、Vitest 4.1.10 では `--` 後の
`loadBaseline` が file filter として効かず、server 全74 files（807 passed / 4 skipped）を実行した。

```bash
pnpm --filter @aiops/server run test -- loadBaseline
```

既存 root script `pnpm run verify:load` も同じ `vitest run -- <file>` 形式のため、server 74 files と
web 38 files を実行した。対象測定値は、repositoryを変更せず次の direct Vitest commands で取得した。

```bash
pnpm --filter @aiops/server exec vitest run loadBaseline.test.ts --reporter=verbose
pnpm --filter @aiops/web exec vitest run dataApiPoolLoad.test.ts --reporter=verbose
env AIOPS_LOAD_TEST_DATABASE_URL=<task-db-url> \
  AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load \
  pnpm --filter @aiops/web exec vitest run dataApiPoolRealPgLoad.test.ts --reporter=verbose
```

PostgreSQL round-trip は既存 `pg` dependency を使う repository-external Node one-linerで、warm-up 10回後に
`SELECT 1` を200回逐次実行して計測した。URLはtask-owned loopback DBのみで、資格情報は記録していない。

## Reliability baseline

- 100案件・2,000受信者の分析→生成→検証は2,000件すべて成功した。
- Graph stub配信は2,000件すべて成功し、delivery failure は0件だった。
- web data APIの500回連投でprocess-wide pool constructorは1回のままだった。
- 実PostgreSQLの500回連投でroute connectionはpeak 1、終了後0に戻った。
- sandbox内の最初の実DB commandはloopback接続を `EPERM` で拒否された。このrunはgreenに数えず、
  同一task-owned DBへのsandbox外rerunのみを合格証跡とした。

## Repository gate

- local `mise run ci`: exit 0、約60秒、182 test files、2,274 passed、0 skipped、
  `P001 PostgreSQL integration passed`
- local build: Codex runnerのTurbopack port-bind制限を避けるため、repository外の一時
  `NODE_OPTIONS` shimでNext公式 `--webpack` selectorのみを追加。repository fileとdependencyは変更なし
- normal Turbopack: merge base `e41e6e6` の
  [main CI run 31345396762](https://github.com/mryfmo/ai-ops-platform/actions/runs/31345396762) が
  build-test / gitleaks ともsuccess

## ENV-blocked の解除条件

| 項目                      | 必須条件                                                                                             | 合格証跡                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| LLM latency               | 承認済みprovider/model/region、非production test credential、固定prompt、sample数・timeout・cost上限 | provider request ID、成功/失敗数、p50/p95、token数、測定commit  |
| Graph API latency         | 承認済みtenant/mailbox、非production recipients、throttle/retry条件、送信副作用の明示承認            | Graph request ID、成功/失敗数、p50/p95、429/retry数、測定commit |
| production API/DB latency | representative deployment、production-like dataset、認証session、同時実行条件                        | route別p50/p95/p99、5xx率、DB wait/connection、期間・commit     |

条件が揃うまで、これらの項目は `ENV-blocked` のままである。

## 過去baselineとの関係

[`2026-07-13-load-baseline.md`](./2026-07-13-load-baseline.md) は Node 20 / pnpm 9 / Vitest 2 と
別commitで取得した履歴証跡である。本書は現行toolchainでの再測定であり、単発local wall-clockの差だけから
性能改善・劣化を判定しない。

## 測定対象ソース SHA-256

| ファイル                                           | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `package.json`                                     | `cf11d684bb12172c16456102d50b87b832b1105a82d7004ac13ff0af18d169b9` |
| `packages/server/tests/loadBaseline.test.ts`       | `61791e6f8f380ccb6ec96ad24c0ab023ba07db3091a5930f7cbcd50d47e4e837` |
| `packages/server/src/lib/loadThresholds.ts`        | `a0e8ecd3a97aedcb6ce710963571e544d739d048ebd0948ab95830c518a6989d` |
| `packages/web/tests/dataApiPoolLoad.test.ts`       | `8408d080d586c4d17fe2f4d3f86c26afe3e5703fc5aa120fafc26d7c8d501ed1` |
| `packages/web/tests/dataApiPoolRealPgLoad.test.ts` | `f84fde2bc9b2d14c5eff3083f4ee062a78c1918dc3c0975fa6f744e6e3d464cc` |
| `packages/web/src/app/api/data/projects/route.ts`  | `c0678e963151289b50f15b93bd9d1f25cb4169c18599377e6707716db659164c` |
| `packages/web/src/server/db/pool.ts`               | `1cf6db5800916b37ff190f7c262970cb0910ac0fc79ff32dff803e373acc9c5b` |

## 制約

本書は実装、dependency、production configurationを変更しない。local/stub数値はhardware、process負荷、
JIT、fixture規模に依存するため、capacity planningやSLO判定には使用しない。
