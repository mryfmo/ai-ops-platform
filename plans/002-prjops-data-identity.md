# Plan 002: PrjOps正本データとEntra主体による認可を本番配線する

> **Executor instructions**: データソース形式を推測しない。既存 `prjops-data` 契約を取得できなければSTOPする。テスト先行、各Verify後に進む。完了時はREADMEの002のみ更新する。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- packages/web/src/server packages/web/src/app packages/server/src packages/prjops/src docs/reference/configuration.md`。provider/recipient schemaの不一致はSTOP。

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — 認可誤りは別project/投資先データを漏洩する。
- **Depends on**: Plan 001（実DBと監査が利用可能）
- **Category**: security / correctness / integration
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] 空provider、sample stakeholder、email照合の根拠を測定。
- [x] Positive/Adversarial認可検証を各Stepへ配置。
- [x] Scope/STOP/安全回帰を明記。
- [ ] 完了時に実tenant IDをredactした受入証跡を保存。

## Why this matters

WebのPrjOps/投資家表示は空配列、Teams認可はサンプル1名固定で、正しい利用者が正しいprojectを閲覧できない。先に正本データと安定したEntra主体を確立しなければ、後続agentとdashboardは誤認可を内包する。

不変条件は、メールアドレスでなくtenant+object IDを認証正本とすること、権限条件をデータ取得クエリで強制すること、inactive変更をrequestごとに反映すること。

## Current state

- `packages/web/src/server/personaResolver.ts:41-59` — email完全一致でDevOps persona解決。
- `packages/web/src/server/personaResolver.ts:74-92` — PrjOps本番providerなし。
- `packages/web/src/app/dashboard/page.tsx:54-59` — 空stakeholder provider。
- `packages/web/src/app/dashboard/page.tsx:77-104` — 空PrjOps report provider。
- `packages/web/src/app/api/data/projects/route.ts:24-36` — requestごとに空providerとPoolを生成。
- `packages/server/src/index.ts:122-136` — SAMPLE_STAKEHOLDERS固定。
- `packages/server/src/index.ts:228-239` — Teams caller profileをsampleで解決。
- `packages/devops/src/db/schema.sql:141-154` — recipientsはemail/user_id/projectsを保持。

## Commands you will need

| Purpose            | Command                                                                                 | Expected                                  |
| ------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| Focused tests      | `pnpm --filter @aiops/web test -- personaResolver reportData`                           | all pass                                  |
| Server tests       | `pnpm --filter @aiops/server test -- stakeholderProfileResolver teamsConversationAgent` | all pass                                  |
| Typecheck          | `mise run typecheck`                                                                    | exit 0                                    |
| Full gate          | `mise run ci`                                                                           | exit 0                                    |
| Forbidden fixtures | `rg -n 'SAMPLE_STAKEHOLDERS                                                             | InMemoryStakeholderMasterProvider\(\[\]\) | InMemoryPrjopsReportDataProvider\(\[\]' packages/{server,web}/src` | no production matches |

## Scope

**In scope**

- `packages/web/src/auth.ts`, `packages/web/src/server/personaResolver.ts`。
- `packages/web/src/server/reportData/prjopsReportData.ts` と全data route composition。
- `packages/web/src/server/db.ts`（共有PoolをPlan 007より先に最小導入してよい）。
- `packages/server/src/lib/stakeholderProfileResolver.ts`, `packages/server/src/index.ts`。
- `packages/server/src/db/` のPrjOps master/provider repo。
- DB migration、configuration docs、provider/route/auth tests。

**Out of scope**

- UI persona切替（Plan 007）。
- agent scheduling（Plan 003）。
- prjops-dataの形式変更や新しいmaster体系の発明。
- tenant間共有、SCIM provisioning。

## Steps

### Step 1: 正本契約をfixtureで固定する

- [ ] project、stakeholder、assignment、issue/action、questionnaire、financial inputの必須/任意項目をschema化する。
- [ ] version/checksum/updatedAtを持たせ、壊れたデータを全件黙って採用しない。
- [ ] sanitized test fixtureを追加する。

**Verify**: Positive—valid fixtureを全型へ変換できる。Adversarial—未知profile、重複ID、存在しないproject assignment、101% ownershipは拒否される。

### Step 2: 安定した認証主体へ切替える

- [ ] Entra profileのtenant IDとobject IDをJWT/sessionへ伝播する。
- [ ] recipient/stakeholder schemaに `(tenant_id, object_id)` 一意キーを追加する。
- [ ] emailは表示・通知先属性に限定し、認可lookupに使わない。

**Verify**: Positive—email変更後も同じobject IDで同personaを解決。Adversarial—同email別tenant、inactive、object ID不一致は403。

### Step 3: production providerを実装する

- [ ] 選定済み正本（DBまたはversioned GitHub data）からproviderを実装する。
- [ ] configでproduction provider不在時は起動/routeをfail closedにする。空データ成功を返さない。
- [ ] request単位でactive/assignmentを再読込する。

**Verify**: Positive—2 projects/3 personas fixtureで許可対象だけ取得。Adversarial—source timeout、invalid checksum、stale version時は503/監査となり空200を返さない。

### Step 4: 全production compositionを差替える

- [ ] dashboard、executive/manager/investor/projects route、Teams caller resolverを同provider factoryへ統一する。
- [ ] production sourceからInMemory/SAMPLE参照を除去する。
- [ ] testだけは明示DIでInMemoryを利用可能にする。

**Verify**: Positive—各personaのfixture dataがrouteに出る。Adversarial—別project IDを要求してもresponse JSONにもquery resultにも現れない。

### Step 5: auditと運用導線を追加する

- [ ] master sync成功/失敗、認可拒否、inactive変更をsecretなしで監査する。
- [ ] sync/rollback/runbookを追加する。
- [ ] masterの初期投入とownership review手順を記載する。

**Verify**: Positive—sync後に件数/checksum auditが残る。Adversarial—PII/secret patternをdetailへ入れるとaudit guardが拒否する。

## Test plan

- auth callback: tenant/object ID伝播、email非依存。
- provider contract: valid/invalid/stale/duplicate/reference integrity。
- persona resolver: PRF-01〜05、investor、inactive、複数persona、別tenant。
- handlers: SQL/source側scope、empty authorized set、source failure。
- Teams: AAD object IDからproject assignmentを解決。

## Done criteria

- [ ] production sourceに空InMemory/SAMPLE参照がない。
- [ ] tenant/object IDが認可正本で、email変更testが通る。
- [ ] 全persona/profileのpositive/denied testsが通る。
- [ ] source障害時にfail closedする。
- [ ] `mise run ci` がgreen。
- [ ] 実sandbox dataで認可matrixを確認する。
- [ ] Scope外変更なし、README 002更新。

## STOP conditions

- prjops-dataの正本schema/owner/更新方式が確認できない。
- Entra tokenからtenant/object IDを一意に取得できない。
- 既存recipientをobject IDへbackfillする対応表がない。
- query/source層でscopeを強制できない。
- 1利用者の複数persona優先規則を仕様から確定できない。
- PII保持/越境要件が未承認。

## Maintenance notes

- providerは1つのproduction実装とtest fixtureに留め、不要なfactory階層を作らない。
- schema version変更はconsumer全routeのcontract testを先に更新する。
- auth claim名はprovider固有値を1箇所で正規化する。

## 安全回帰

- [ ] inactive recipientはrequestごとに除外。
- [ ] scope外projectを取得しない。
- [ ] emailを認可キーにしない。
- [ ] source障害を空データとして扱わない。
- [ ] PII/secretをauditへ保存しない。
- [ ] investor/manager/memberの境界を混同しない。
