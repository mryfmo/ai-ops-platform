# Plan 007: Web・Excel・APIの認可、接続、入力境界、冪等性を強化する

> **Executor instructions**: trust boundaryの検証を削らない。新dependencyよりHono/Next/pg/Node標準機能を優先する。SQL側scopeのない実装は完了扱いしない。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- packages/web packages/server/src/http packages/server/src/db packages/shared/src/xlsxImport packages/shared/tests/xlsxImport.test.ts packages/server/tests/xlsxImportRoutes.test.ts`。

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — data leakage、DB exhaustion、duplicate GitHub writes、DoS。
- **Depends on**: Plans 001, 002
- **Category**: security / perf / correctness
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] Pool leak、post-fetch auth、raw event、Excel race/size、headersを測定。
- [x] positive/adversarial oracleを配置。
- [x] trust boundaryとscope filterを安全回帰へ固定。
- [ ] 完了時にload/body-limit/concurrency raw logsを保存。

## Why this matters

各Web requestがPoolを生成し、認可対象外rowもDBから全取得し、Excel uploadは無制限かつ並行claimがない。少数利用でも接続枯渇、情報露出、重複Issue、メモリDoSが起こり得るため、product traffic前に閉じる。

## Current state

- `packages/web/src/app/dashboard/page.tsx:54-59` — renderごとにnew Pool。
- `packages/web/src/app/api/data/manager-summary/route.ts:34-52` — requestごとにnew Pool。
- `packages/web/src/server/reportData/devopsReportData.ts:65-101` — 全project/incidents/events取得後filter。
- `packages/web/src/server/reportData/timeseriesHandler.ts:92-117` — period内全row取得後filter。
- `packages/web/src/server/reportData/agentActivityData.ts:44-63` — 全coding_tasks取得後filter。
- `packages/server/src/db/eventsRepo.ts:99-119` — raw payloadをsanitizeせず保存。
- `packages/server/src/http/routes/xlsxImport.ts:47-52` — bodyを無制限arrayBuffer化。
- `packages/server/src/db/importLedgerRepo.ts:32-38` — conflictを無視してclaim成否を返さない。
- `packages/server/Dockerfile:17` — Web build失敗を握り潰す。

## Commands you will need

| Purpose      | Command                                                      | Expected                     |
| ------------ | ------------------------------------------------------------ | ---------------------------- |
| Web tests    | `pnpm --filter @aiops/web test`                              | all pass                     |
| Server tests | `pnpm --filter @aiops/server test -- xlsx events webui`      | all pass                     |
| Shared tests | `pnpm --filter @aiops/shared test -- xlsxImport`             | all pass                     |
| Load test    | `pnpm --filter @aiops/web run test:load -- --connections 50` | pool total <= configured max |
| Full gate    | `mise run ci`                                                | exit 0                       |

## Scope

**In scope**: shared web Pool、data SQL、auth middleware/headers、request/body limits、rate limits、event sanitize、Excel ledger claim/recovery、persona UI、tests/docs/Docker fail-fast。

**Out of scope**: new dashboard design system、async import queue製品、RLS全面導入（必要ならSTOPして別plan）、production CDN/WAF（Plan 008）。

## Steps

### Step 1: Web DB Poolをprocess共有する

- [ ] `packages/web/src/server/db.ts` にlazy singleton Poolを置き全route/pageで再利用。
- [ ] max/acquire/statement/idle transaction timeoutをconfig化。
- [ ] test reset/end hookだけを明示提供。

**Verify**: Positive—100 requestsでPool instance 1、connections<=max。Adversarial—query hangはstatement timeout、acquire exhaustionは503で無限待ちしない。

### Step 2: SQL取得時にscopeを強制する

- [ ] allowed project IDs/user IDをparameterized WHERE/array overlapへ渡す。
- [ ] global managerの全件権限は明示branchにし、null project rowの公開規則を固定。
- [ ] response filterはdefense-in-depthとして残しても、SQL assertion testを必須化。

**Verify**: Positive—query text/paramsにscope条件。Adversarial—DB mockがscope外rowを返してもresponseに出ず、実DB EXPLAINで全表取得しない。

### Step 3: HTTP trust boundaryを制限する

- [ ] route別Content-Type、Content-Length/stream上限、timeout、authenticated rate limitを追加。
- [ ] proxy/chat/webhook/importの上限を設定し413/415/429を返す。
- [ ] CSP、frame-ancestors、HSTS（production）、nosniff、Referrer/Permissions policyを設定。

**Verify**: Positive—正規requestは成功。Adversarial—oversize/slow body、wrong type、burst、malformed forwarding headersを早期拒否しDB/Excel parser未呼出。

### Step 4: raw event保存をsanitizeする

- [ ] enqueue境界でdeep string sanitizeし、元payloadを後続正規化に使える形で保存。
- [ ] redaction count/sourceをsecretなしでaudit/metric化。
- [ ] payload size上限をDB schema/routeと一致させる。

**Verify**: Positive—normal webhookを保持。Adversarial—commit message/bodyのtoken/keyがevents/pm/audit/logのどこにも残らない。

### Step 5: Excel importをclaim/recover可能にする

- [ ] `INSERT ... ON CONFLICT ... RETURNING` またはrow lock/CASで1 workerだけsource keyをclaim。
- [ ] pending lease、failed retry、GitHub成功後ledger失敗のreconciliationを実装。
- [ ] file bytes、uncompressed workbook、sheet/row/cell length上限を設定。

**Verify**: Positive—2 worker同時実行でGitHub create 1回。Adversarial—crash各境界、zip bomb/oversize/大量row、stale pendingでduplicate 0か明示manual reconciliation。

### Step 6: persona UXとbuild fail-fastを閉じる

- [ ] multiple persona selectorとPRF-01/02/05/M/Lの明示view/denied stateを実装。
- [ ] Docker Web buildの `|| echo` を削除。
- [ ] accessibility keyboard/label/landmark testsを追加。

**Verify**: Positive—全profile fixtureが対応view。Adversarial—URL/queryで未所有personaを選んでも403、Web build失敗でimage build非0。

## Test plan

- Pool singleton/load/timeout tests。
- exact SQL scope query+実DB data isolation tests。
- 413/415/429/security headers tests。
- secret-in-payload persistence scan。
- Excel two-worker/crash/zip/row-limit tests。
- persona switch/accessibility/Docker build negative test。

## Done criteria

- [ ] Pool instance 1、configured maxを超えない。
- [ ] 全data queryがSQL側scopeを持つ。
- [ ] oversize/rate/content/security header testsが通る。
- [ ] raw secret persistence testが0 match。
- [ ] concurrent Excelで外部create 1回。
- [ ] 全persona view/denied stateが存在。
- [ ] Docker buildがfail-fast。
- [ ] `mise run ci` green、README 007更新。

## STOP conditions

- allowed project setがquery時点で確定できない。
- global/null project visibility規則が未定。
- reverse proxyの実client IP/trusted proxy設定が未定。
- Excel最大サイズ/row数の業務上限が承認されない。
- GitHub create後の検索/reconciliation APIが使えない。
- persona別表示要件が競合する。

## Maintenance notes

- rate limitは単一process MapでなくPlan 008のshared store/edgeと整合させる。
- SQL scope helperはPrjOps/DevOps既存permission関数と同じ意味をcontract testする。
- Excel上限はconfig+docs+testsを同時変更。

## 安全回帰

- [ ] trust boundary validationを省略しない。
- [ ] scope外rowをDBから取得しない。
- [ ] secretをraw queue/logへ保存しない。
- [ ] import retryでduplicateを作らない。
- [ ] security headersとaccessibilityを維持。
- [ ] build failureを成功扱いしない。
