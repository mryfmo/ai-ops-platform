# Plan 014: Plane CEを人間・エージェント共用作業台として統合し、GitHub正本へ安全に昇格する

> Planned at: `main` commit `ffffd75d82c340e6ef47c77893c7c9c71661c2d3`
> Decision source: `docs/adr/0019-plane-workflow-backend.md`（本Planと同一PRの提案。採用とDEC-SPEC-008改訂はowner gate）
> Executor: Claude Code orchestrator / Codex autonomous worker

## Status

`TODO`

- Priority: P1
- Effort: XL
- Risk: HIGH — self-hosted運用、personal access token、workflow正本切替、PIIを含み得るdiscussion、
  agent write、Git recordへの昇格を扱う。
- Depends on: ADR-0019承認、Plan 001。Phase CはPhase BとDEC-SPEC-008改訂承認、Phase DのGit昇格は
  Plan 012 typed proposal/approval/publisher受入にも依存する。
- Category: direction / integration / security / operations

## Plan quality self-audit

| Check                          | Evidence                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Scope-proportional detail      | XLの外部system/正本切替をPhase A〜D、18 task、各taskのallowlistとgateへ分解した                                   |
| Required sections              | Status、Goal/Why、Current State、Commands、Scope、Design/Steps、Test plan、Done、STOP、Maintenance、Safetyを収載  |
| Measured current state         | current `main@ffffd75`の実在`file:line`をCurrent Stateへ記録した                                                  |
| Positive/adversarial Verify    | 各taskのVerifyと横断negative matrixでsuccess/attack/failure oracleを定義した                                      |
| Specific STOP conditions       | #5757、AGPL、foreign scope、partial snapshot、owner decision、Plan 012 driftを明記した                            |
| Acceptance quality             | TODO planのためacceptance recordは未作成。各phase acceptanceと最終reviewで生証跡を要求する                        |
| Available quality entry points | 本repositoryに専用validator/Make target/hook/reviewer定義はないため、Plan 010/013との比較とmanual checklistを使う |

## Goal

Plane CEを、Kanban位置、担当、cycle、discussion、日々のtaskに対する権威ある共用作業台として
稼働させる。GitHubのrecord-grade truth、Planeのoperating flux、platformの観測・監査・派生・昇格を
混同せず、AGT-02/03/06と人間が同じ作業面を使えるようにする。記録級変更はPlan 012のtyped proposalと
別人承認を通したdraft PRだけでGitHubへ戻し、直接write、自動merge、dual truthを作らない。

## Why this matters

Gitだけへ寄せると、担当変更や日々のdiscussionまでPR待ちになり、作業台として使えない。Planeだけへ
寄せると、報告・監査が引用する正式recordからPR review、署名、immutable SHA、typed approvalが失われる。
統治重量で権威を分けることで、人間とagentの操作性と記録の説明責任を同時に成立させる。

踏み外してはいけない不変条件は、`PJ-*`だけを認可キーにすること、同じfieldのdual truthを作らないこと、
LLMに数値・state・position・認可・昇格可否を決めさせないこと、Git mainへ直接write/auto mergeしないこと、
Planeのraw token/secret/unsanitized payloadを保存しないことである。

## Scope

含むもの:

- Plane CEのpinned sandbox、license/security/data governance/backup/upgrade gate、#5757 negative probe（Phase A）
- `PJ-*`からPlane workspace/project UUIDへの署名済みmapping contract（Phase A）
- `PlaneClient`、webhook、既存`events` queue、`pm_events`追記、full reconcile（Phase B）
- DEC-SPEC-008のboard/workflow sourceをProjectV2からPlaneへ置換するowner decisionとread-only board
  開通（Phase C）
- AGT-02のWork Item起票、AGT-03のanalysis comment、AGT-06のitem reminder（Phase D）
- Plane運用流動をrecord-grade factへ昇格するPlan 012 typed proposal→draft PR→Git merge→再投影（Phase D）
- `PrjOps/DevOps:REQ-045`、`SPEC-INT-091`、`AC-045-1`のcatalog/traceability登録

含まないもの:

- DEC-SPEC-001、project picker、`PJ-*`認可、URL selection、domain data boundaryの変更
- Planeを`PJ-*`/`ORG-*`/`ST-*` registry、questionnaire、投資家データ、正式台帳、報告書、議事録の正本にすること
- Plane source/library/image内容のvendor、copy、link、未承認fork
- Plane Commercial、Plane AI、MCP Serverの導入
- Plane操作だけによるGit main、production、deployment、approval stateの変更
- 自動merge、ProjectV2 board mutation、独自Kanban DB、新しいapproval table

## Assumptions

- ADR-0019は提案である。Phase Aのlocal contract test以外はowner承認まで開始しない。
- Phase CまではPlaneをshadow observationとして扱い、DEC-SPEC-008のProjectV2 source記述を変更しない。
- Plane API keyはworkspace-scoped credentialではなくuser credentialとして扱う。integration userは
  allowlisted workspaceだけのmemberとし、workspace membershipをreleaseごとにreadbackする。
- current latestの`v1.3.1`を調査基準とするが、Phase A実行時はその時点のowner承認済みversionと
  image/setup asset digestを固定する。`latest`をruntime参照に残さない。
- Plane Work Itemの`external_source`/`external_id`はmodelに存在するが、一意制約はplatform側でも検証する。
- Plane-native taskへ架空の`ISSUE-*`/`ACT-*`を割り当てない。Git merge後のcanonical IDだけを再投影する。
- Plan 012のoperation proposal path/exportが計画値と異なる場合、Phase Dを実装せず本Planを改訂する。
- schema変更はfresh schemaと新migrationを同じPRで更新し、既存tableへのinline ALTERをschemaへ書かない。
- Definition of Doneはclean checkoutの`mise run ci`。external gateをmock成功で代替しない。

## Design

### 1. Authority matrix

| Data                                                                                    | Authority               | Projection/consumer                                  | Conflict rule                             |
| --------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `PJ-*`/`ORG-*`/`ST-*`、正式`ISSUE-*`/`ACT-*`、questionnaire、投資家データ、報告・議事録 | review済みGit commit    | Plane Work Item、platform provider                   | Git-wins。PlaneのGit管理fieldを再投影     |
| state、position、assignee、cycle、discussion、intake、日々のtask                        | Plane CE                | `pm_events`、`pm_snapshots`、dashboard、report input | Plane-wins。platform snapshotを更新       |
| authorization、audit、決定的metric、report、promotion eligibility                       | platform codeと追記台帳 | UI、report、typed proposal                           | 上流を変更せず派生。promotionだけ別人承認 |

Git管理fieldとPlane管理fieldを明示的に分ける。再投影はGit管理fieldだけを更新し、Planeのstate、
position、assignee、cycle、discussionを保持する。platform snapshotはcache/履歴でありPlaneの代替正本にしない。

### 2. Identity and mapping

新規`plane-environment-mapping` contractはA020のprovenance形状を再利用し、projectごとに
`plane_workspace_id`、routing用`plane_workspace_slug`、`plane_project_id`、`authorized_url`を持つ。
runtimeはrequestごとにactive subject/personaの`PJ-*` scopeを先に解決し、その後だけPlane UUIDへ写像する。
UUID、slug、display name、list positionから`PJ-*`を逆算して認可しない。

投影済みrecordは`external_source=prjops-data`、`external_id=<canonical ID>`で照合する。
Plane-native record候補はPlane UUIDとsource revisionで追跡し、Git merge後にcanonical ID mappingを確定する。
同一project内外を問わずcanonical external pairの重複をcomplete snapshot不成立として扱う。

### 3. Integration placement

- `packages/shared/src/clients/planeClient.ts`: `PlaneTokenProvider`、`FetchLike`、base URL注入。
  既存`withTimeout`/`fetchWithBackoff`を再利用し、GETだけretryする。
- `packages/server/src/lib/planeEnvironmentMapping.ts`: owner public keyを注入し、mapping digestとdetached
  signatureをstartup時に検証する。runtime callerは検証済みmapping objectだけをDIで受け取る。
- `packages/server/src/http/routes/planeWebhook.ts`: raw body HMAC、delivery UUID、event allowlist、size gate。
- 既存`events` table/`EventsRepo`/`eventsPollingTask`: source=`plane`を追加し、別queueを作らない。
- 既存`pm_events`/`pm_snapshots`/`PmTimeseriesRepo`: Plane subject typeを追加し、別timeseries tableを作らない。
- `packages/server/src/lib/planeEventRouter.ts`: untrusted webhookからID、event/action、revisionだけの
  allowlisted envelopeを決定的に作る。comment body、name、email、avatar、raw payloadは保存しない。
- `packages/server/src/scheduler/tasks/planeSnapshotReconcileTask.ts`: cursor全page、rate-limit budget、
  mapping/external ID重複、snapshot revisionを検証し、全rowを一つのDB transactionで追記する。
  各rowのpayloadに同一`capture_id`/`capture_complete=true`を持たせ、transaction rollbackにより
  complete snapshotだけを可視化する。
- Phase Cのboard endpointは最新complete Plane snapshotだけをSQL側`PJ-*` predicateで取得する。

予定する最小interfaceは次のとおり。実行時のofficial OpenAPIと異なる場合は合わせ込まずSTOPしてPlanを改訂する。

```ts
interface PlaneTokenProvider {
  getToken(): Promise<string>;
}

class PlaneClient {
  constructor(
    tokenProvider: PlaneTokenProvider,
    fetchImpl?: FetchLike,
    baseUrl?: string,
    options?: { retry?: RetryOptions; timeoutMs?: number },
  );
  listWorkItems(input: { workspaceSlug: string; projectId: string; cursor?: string }): Promise<PlaneWorkItemPage>;
  createWorkItem(input: PlaneCreateWorkItemInput): Promise<PlaneWorkItemRef>;
  createComment(input: PlaneCreateCommentInput): Promise<PlaneCommentRef>;
  updateWorkItemGitProjection(input: PlaneGitProjectionInput): Promise<PlaneWorkItemRef>;
}

function loadVerifiedPlaneEnvironmentMapping(
  serialized: string,
  detachedSignature: string,
  ownerPublicKey: string,
): VerifiedPlaneEnvironmentMapping;
function verifyPlaneWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean;
function normalizePlaneWebhookEvent(event: QueuedPlaneWebhookEvent, traceId: string): PmEventRecordInput | null;
function projectGitRecordToPlane(input: GitRecordProjectionInput): PlaneGitProjectionInput | null;
function classifyPlaneRecordPromotion(input: PlaneRecordCandidate): PlaneRecordProposal | null;
```

既存tableを拡張し、別queue/timeseries tableは作らない。migrationの論理形は次に限定する。

```sql
ALTER TABLE events DROP CONSTRAINT events_source_check;
ALTER TABLE events
  ADD CONSTRAINT events_source_check
  CHECK (source IN ('github', 'monitor', 'inbound', 'plane')) NOT VALID;

ALTER TABLE pm_events DROP CONSTRAINT pm_events_subject_type_check;
ALTER TABLE pm_events
  ADD CONSTRAINT pm_events_subject_type_check
  CHECK (subject_type IN (
    'issue', 'pull_request', 'milestone', 'project_item', 'project_status', 'deployment',
    'plane_project', 'plane_work_item', 'plane_cycle', 'plane_comment'
  )) NOT VALID;
```

既存rowを検証後に`VALIDATE CONSTRAINT`し、migration rollbackは従来集合へ戻す。`schema.sql`はfresh DBの
最終形だけを持ち、inline ALTERを書かない。

### 4. Write boundaries

- Plane operating writeは対象`PJ-*`のmappingとagent action allowlistを検証し、idempotency keyを持つ。
  response不明のPOST/PATCH/DELETEを自動再送しない。webhook/reconcileで結果を確定する。
- Git record writeはPlan 012のproposal、approval、single-attempt、terminal/readbackを再利用する。
  新しい`record.propose` kindはbase SHA、record path、canonical patch digest、Plane revisionを固定し、
  allowlisted `prjops-data` pathのbranch commitとdraft PRだけを許す。
- proposal時またはpublisher直前にGit/Plane revisionが変われば`stale`。main writeとmerge権限は0。
- AGT-02/03/06はPlaneClientを注入された薄いorchestrationだけを持ち、判定・validationは既存libまたは
  新規pure libへ置く。

### 5. Phase dependency

```text
ADR-0019 owner approval
  └─ Phase A: mapping + pinned CE sandbox/security/license
       └─ Phase B: verified mapping + client + webhook + event/snapshot shadow observation
            └─ Phase C: DEC-SPEC-008 decision PR + Plane board cutover
                 └─ Phase D: agent workbench + Plan 012 typed promotion
```

Phase Bまでの成果は外部writeを開通しない。Phase Cはowner decisionなしに開始しない。Phase DのPlane writeは
Phase C acceptance後、Git promotionはPlan 012 acceptance後だけ有効化する。

## Current State

- `plans/010-recommended-spec-environment-execution.md:371`〜`415`: A019でT10 picker/controlは実装済み。
  T11〜T14はProjectV2 snapshot/read-only board/data boundary/sandbox acceptanceの未完taskである。
- `packages/web/src/components/DashboardClient.tsx:275`: `projectBoard`は
  `E-VIEW02: project board data endpoint is not available`をthrowする。
- `packages/web/src/server/chat/tools.ts:171`: `show_project_board`自体はToolSetへ公開される。
- `docs/reference/page-agent-tools.md:42`: 文書もboard data endpoint未実装を明記する。
- `packages/server/src/config.ts:100`、`packages/server/src/index.ts:261-280`:
  ProjectV2 reconcileは`GITHUB_PROJECT_NODE_ID`未設定時に監査付きdisabledとなる。
- `docs/contracts/schema/projectv2-environment-mapping.schema.json:1`:
  A020 mappingは`PJ-*`→ProjectV2 node/URLとdevelopment provenanceを持つがPlane属性はない。
- `packages/shared/src/clients/githubClient.ts:112`: `GitHubClient`はtoken provider、fetch、base URL、
  timeout/backoffを注入する既存client patternである。
- `packages/server/src/http/routes/githubWebhook.ts:28`: GitHub raw webhook HMAC routeがある。
- `packages/server/src/db/eventsRepo.ts:10`: queue sourceは`github|monitor|inbound`だけでPlaneはない。
- `packages/devops/src/db/schema.sql:34`、`packages/server/src/db/pmTimeseriesRepo.ts:41`:
  `pm_events`/`pm_snapshots`はGitHub PM履歴向けでPlane subject typeを持たない。
- `packages/prjops/src/agents/AGT02_collector.ts:149`: AGT-02は構造化outcomeを返すがPlane callerはない。
- `packages/prjops/src/agents/AGT03_analyzer.ts:78`: AGT-03の重要度提案は監査追記まででitem commentはない。
- `packages/prjops/src/agents/AGT06_tracker.ts:43`: AGT-06はGraph通知を送り、Plane itemを更新しない。
- `plans/012-conversational-github-operations-and-minutes.md:218,1215-1229`:
  typed proposal initializerとsingle-attempt executorは計画済みだが未受入である。
- Plane upstream [#5757](https://github.com/makeplane/plane/issues/5757)は2026-07-19時点でOPEN。
  API tokenはprofile settingsのpersonal access tokenで、作成元workspaceをscope証拠にできない。

## Commands you will need

| Purpose            | Command                                                                                                          | Expected                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| upstream issue     | `gh issue view 5757 --repo makeplane/plane --json state,updatedAt,comments,url`                                  | stateとmaintainer説明を取得      |
| mapping contract   | `node scripts/validate-plane-environment-mapping.mjs docs/contracts/fixtures/plane-environment-mapping.dev.json` | exit 0                           |
| shared client      | `pnpm --filter @aiops/shared run test -- planeClient`                                                            | focused GREEN                    |
| server integration | `pnpm --filter @aiops/server run test -- plane`                                                                  | mapping/webhook/reconcile GREEN  |
| PrjOps agents      | `pnpm --filter @aiops/prjops run test -- plane`                                                                  | AGT-02/03/06 GREEN               |
| Web board          | `pnpm --filter @aiops/web run test -- projectBoard`                                                              | selection/board GREEN            |
| type/format        | `mise run typecheck && mise run format`                                                                          | exit 0                           |
| traceability       | `mise run traceability`                                                                                          | new 6 IDs and existing IDs GREEN |
| final gate         | `mise run ci`                                                                                                    | exit 0                           |
| forbidden source   | `rg -n 'ProjectV2                                                                                                | addProjectV2Item                 | updateProjectV2Item' packages/web packages/prjops` | accepted residualだけ                                  |
| auth state         | `rg -n 'localStorage                                                                                             | project.*cookie                  | plane_.*(id                                        | slug).*authoriz' packages/web/src packages/server/src` | new authorization state 0 |

## Phase A: mapping contractと安全なPlane CE sandboxを確立する

ブランチ `agent/p014-fa-plane-sandbox`。開始条件: ADR-0019 owner承認。

### P014-FA-T01 実行基準とupstream inventoryを固定する

- Owner: orchestrator
- Preconditions: clean checkout、`origin/main` fetch済み、ADR-0019承認記録。
- Allowed files: `plans/014-plane-integration.md`の`Planned at`行、`.orchestration/evidence/P014-FA-T01/**`
- Work: current Plane CE release/tag/commit、setup asset/image digest、AGPL license digest、official API/webhook
  docs revision、#5757 state、repository security advisoryをread-only取得し、承認対象versionを固定する。
- Complete: mutable `latest`参照0、version/digest/owner/upgrade owner/rollback ownerが一意。
- Verify: GitHub release/tag署名、asset SHA-256、license SPDX、公式docs URL、#5757 readbackを相関する。
- STOP: unsigned asset、license不明、known critical advisory未修正、ADR未承認、versionを固定できない。

### P014-FA-T02 Plane mapping contractをtest-firstで作成する

- Owner: worker
- Preconditions: P014-FA-T01完了。
- Allowed files: `docs/contracts/schema/plane-environment-mapping.schema.json`,
  `docs/contracts/fixtures/plane-environment-mapping.dev.json`,
  `tests/validate-plane-environment-mapping.test.mjs`,
  `scripts/validate-plane-environment-mapping.mjs`, `package.json`
- Work: A020 provenance shapeを再利用し、canonical `PJ-*`ごとのimmutable workspace UUID、routing slug、
  project UUID、authorized HTTPS URLをstrict schemaで定義する。最初にmalformed/duplicate/foreign/unsigned/
  go-live replacement不足のRED fixture testを追加し、stdlibだけのvalidatorでGREENにする。
- Complete: UUID/slug/nameだけをauthorization keyにする経路0。development fixtureは
  `replace_before_go_live=true`、productionはowner署名必須。
- Verify: positive fixture、unknown property、duplicate UUID、cross-project UUID、HTTP/userinfo URL、
  noncanonical PJ、unsigned production、stale contract versionを拒否する。
- STOP: A020 fixtureを破壊的に変更する、development defaultをgo-live可能にする、secretをfixtureへ書く。

### P014-FA-T03 disposable CE sandboxと#5757/license/backup gateを実証する

- Owner: orchestrator（security/operations review必須）
- Preconditions: P014-FA-T01〜T02完了。非production host、二つのworkspace、専用integration user。
- Allowed files: `.orchestration/evidence/P014-FA-T03/**`, `docs/security/plane-data-governance.md`
- Work: pinned公式CEを未改変で起動し、integration userをtarget workspaceだけへ参加させる。先に
  data ownerがevent/snapshotのfield allowlist、purpose、retention、erasure、backup purge、access roleを承認し、
  discussion本文/name/email/avatar/raw payloadはplatformへ保存しない。target/foreign
  workspaceのread/write matrix、token expiry/rotation、60 req/min headers、webhook HMAC/replay、
  backup/restore、upgrade/rollback、telemetry/egress inventory、data deletionを実測する。
- Complete: targetだけpositive、foreign workspaceのproject/item/member/comment read/write 0、raw token/log 0、
  保存fieldが承認済みallowlistと一致、retention/erasure/backup purge実証、backup/restore equality、cleanup完了。
  Plane source改変0。
- Verify: #5757再現probe、invalid/expired token、removed membership、workspace slug改変、direct UUID、
  webhook signature改変、delivery replay、61st request、service restart、restore後mapping一致。
- STOP: 非参加foreign workspaceを読める、membership scopeを証明できない、secret漏えい、backup不能、
  data owner未承認、PII/raw discussion保存が必要、retention/erasure不能、cleanup不能、Plane改変が必要、
  AGPL対応owner不在。

### P014-FA-T04 Phase A acceptance

- Owner: orchestrator
- Preconditions: P014-FA-T01〜T03 REVIEWED。
- Allowed files: `.orchestration/evidence/P014-FA-T04/**`
- Work: contract diff、external evidence、cleanup、license/security/data-impact reviewを独立に照合する。
- Complete: mappingとsandboxがACCEPTED。Phase Bへ渡す値はsecret storeのreferenceとredacted IDだけ。
- Verify: mapping validator、`mise run ci`、evidence schema、negative matrix全件。
- STOP: mock-only、#5757未実行、unsigned mapping、data governance未承認、open critical finding、CI red。

## Phase B: Planeをshadow observationとしてplatformへ接続する

ブランチ `agent/p014-fb-plane-observation`。開始条件: P014-FA-T04 ACCEPTED。

### P014-FB-T01 PlaneClientのRED contract testを追加する

- Owner: worker
- Allowed files: `packages/shared/tests/planeClient.test.ts`
- Work: token/header、base URL、cursor pagination、fields/expand、60 req/min budget、429 reset、
  timeout、GET 5xx retry、非冪等response不明の再送0、malformed JSON、foreign workspaceのtestを先に追加する。
- Complete: client不在を理由にRED。既存fetch policy testはGREEN。
- Verify: injected fake fetch/token/sleepだけを使いnetwork 0。
- STOP: live token、new dependency、POST/PATCH/DELETE retryを期待するtest。

### P014-FB-T02 PlaneClientを既存HTTP policyで実装する

- Owner: worker（security review必須）
- Preconditions: P014-FB-T01完了。
- Allowed files: `packages/shared/src/clients/planeClient.ts`, `packages/shared/src/index.ts`,
  `packages/shared/tests/planeClient.test.ts`
- Work: `PlaneTokenProvider`、`FetchLike`、base URLを注入し、`withTimeout`/`fetchWithBackoff`を再利用する。
  list/get、create Work Item/commentに必要な最小methodだけを実装し、cursor全pageとrate-limit headerを扱う。
- Complete: T01 GREEN。credentialはrequest header以外へ出ず、errorへbody/tokenを含めない。
- Verify: shared test/typecheck、100-item page boundary、429 reset、AbortSignal、unsafe URL、invalid response。
- STOP: Plane SDK追加、global fetch mock、unbounded pagination、non-idempotent automatic retry。

### P014-FB-T03 署名済みmappingをruntimeで検証してDIする

- Owner: worker（security review必須）
- Preconditions: P014-FB-T02完了、P014-FA-T04で承認されたmapping/signature/public key。
- Allowed files: `packages/server/src/config.ts`, `packages/server/src/index.ts`,
  `packages/server/src/lib/planeEnvironmentMapping.ts`,
  `packages/server/tests/config.test.ts`, `packages/server/tests/planeEnvironmentMapping.test.ts`
- Work: startup時にcanonical serialized mappingのdigestとdetached owner signatureを検証し、schema validation後の
  `VerifiedPlaneEnvironmentMapping`だけをreconcile/route/agent adapterへDIする。active `PJ-*` scopeを先に解決し、
  mappingのworkspace/project UUIDはその後だけ取得する。
- Complete: unsigned/tampered/stale mappingではstartup fail-closed。runtime callerがraw JSON/pathを直接読む経路0。
- Verify: valid signature/readback、1-byte改変、wrong key、unknown PJ、duplicate UUID、stale version、
  startup reload、mapping revoke、raw UUIDからの逆引き拒否。
- STOP: private keyをruntimeへ配布、signature未検証fallback、display name/slug/UUIDによるauthorization。

### P014-FB-T04 webhookを既存queue/pm_eventsへ結線する

- Owner: worker（security review必須）
- Preconditions: P014-FB-T03完了、P014-FA-T04 data governance ACCEPTED。
- Allowed files: `packages/devops/src/db/schema.sql`,
  `packages/devops/src/db/migrations/202607190001_plane_workflow_events.sql`,
  `packages/server/src/config.ts`, `packages/server/src/index.ts`,
  `packages/server/src/db/eventsRepo.ts`, `packages/server/src/db/pmTimeseriesRepo.ts`,
  `packages/server/src/http/routes/planeWebhook.ts`, `packages/server/src/http/app.ts`,
  `packages/server/src/lib/planeEventRouter.ts`,
  `packages/server/src/scheduler/tasks/eventsPollingTask.ts`,
  `packages/server/tests/config.test.ts`, `packages/server/tests/eventsRepo.test.ts`,
  `packages/server/tests/pmTimeseriesRepo.test.ts`, `packages/server/tests/planeWebhook.test.ts`,
  `packages/server/tests/planeEventRouter.test.ts`, `packages/server/tests/eventsPollingTask.test.ts`
- Work: source=`plane`とPlane subject typesをfresh schema/new migrationへ追加する。raw bytesのHMAC-SHA256を
  timing-safe比較し、署名検証後に承認済みfieldだけをallowlistしてdelivery UUIDでdedupeする。pollerは
  ID/event/action/revisionだけをnormalize/sanitize後`pm_events`へ追記し、raw bodyをqueue/DB/logへ残さない。
- Complete: valid delivery 1 queue/1 pm_event、replay 0、invalid request DB 0。既存GitHub/Graph/monitor経路不変。
- Verify: fresh/upgrade/reapply DB、signature length/case/raw whitespace、missing delivery/event、payload size、
  unsupported event/action、secret/HTML、comment body/name/email/avatarのDB 0、concurrent replay、crash/reclaim。
- STOP: parsed/re-stringified bodyで署名検証、raw payload/secret/ordinary PII保存、別queue/table追加、
  audit UPDATE/DELETE。

### P014-FB-T05 complete snapshot reconcileとPhase B acceptance

- Owner: worker（acceptance: orchestrator）
- Preconditions: P014-FB-T04完了。
- Allowed files: `packages/server/src/scheduler/tasks/planeSnapshotReconcileTask.ts`,
  `packages/server/src/db/pmTimeseriesRepo.ts`, `packages/server/src/index.ts`,
  `packages/server/tests/planeSnapshotReconcileTask.test.ts`,
  `packages/server/tests/pmTimeseriesRepo.test.ts`, `.orchestration/evidence/P014-FB-T05/**`
- Work: DIされたverified mappingのprojectだけをcursor全page取得し、Work Item/activity/comment/cycle revisionと
  external pairを検証する。承認済みallowlistへ最小化した全rowへ同じ`capture_id`、
  `capture_complete=true`、`captured_at`を付け、一つのDB transactionでbatch insertする。例外時は全rowを
  rollbackし、latest queryはcomplete markerを持つcaptureだけを返す。
- Complete: webhook取りこぼしをreconcileし、partial/duplicate/foreign/stale snapshotをpublishしない。
  Planeはまだdashboard sourceでもagent write先でもない。
- Verify: cursor loop、missing page、updated_at変化、duplicate external pair、mapping drift、429 budget、
  timeout、N row目でDB例外後のvisible row 0、transaction commit後の全row、comment body/name/email/avatar 0、
  Plane停止、webhook/reconcile一致、`mise run ci`。
- STOP: incomplete snapshotをlatest扱い、foreign UUID、rate-limit無視、DEC-SPEC-008を先行変更。

## Phase C: owner decision後にboard/workflow sourceをPlaneへ切り替える

ブランチ `agent/p014-fc-plane-board`。開始条件: P014-FB-T05 ACCEPTED。

### P014-FC-T01 DEC-SPEC-008改訂decision PRを作成する

- Owner: orchestrator（human gate）
- Preconditions: Phase B external evidence、脅威・データ影響・accessibility review。
- Allowed files: `docs/spec/productization-decisions.md`,
  `plans/010-recommended-spec-environment-execution.md`, `plans/014-plane-integration.md`
- Work: board/workflow sourceだけをProjectV2からPlaneへ置換し、T11〜T14をPlane snapshot/read-only board/
  selection enforcement/sandbox acceptanceへ同一commitで更新する。picker/authorization matrixは変更しない。
- Complete: ownerがPRで承認し、変更理由、rollback、data migration、GHP read/write停止条件が明示される。
- Verify: 3文書の用語/task ID/依存が一致し、既存T10 acceptanceを壊さない。hosted checks green。
- STOP: owner承認なし、DEC-SPEC-001変更、picker/`PJ-*`認可緩和、脅威/データ影響review欠落。

### P014-FC-T02 Plane board data boundaryのRED testを追加する

- Owner: worker
- Preconditions: P014-FC-T01 merge/ACCEPTED。
- Allowed files: `packages/web/tests/reportData/projectBoardHandler.test.ts`,
  `packages/web/tests/ProjectBoardView.test.tsx`, `packages/web/tests/DashboardClient.test.tsx`
- Work: latest complete Plane snapshot、column/state/position、single selected `PJ-*`、409/400/403、foreign row、
  stale/incomplete snapshot、unsafe URL、empty/error/accessibilityを先にtestする。
- Complete: data path不在の`E-VIEW02`を理由にRED。picker既存testはGREEN。
- Verify: provider/SQL query spyでunauthorized domain query 0、ProjectV2 API call 0。
- STOP: client-side filter、LLM embedded data、既存selection assertの緩和。

### P014-FC-T03 read-only Plane boardを最小差分で開通する

- Owner: worker（security/accessibility review必須）
- Preconditions: P014-FC-T02完了。
- Allowed files: `packages/web/src/server/viewSpec.ts`, `packages/web/src/server/chat/tools.ts`,
  `packages/web/src/server/chat/systemPrompt.ts`, `packages/web/src/server/chat/chatHandler.ts`,
  `packages/web/src/components/chat/ChatPanel.tsx`, `packages/web/src/components/DashboardClient.tsx`,
  `packages/web/src/components/views/ProjectBoardView.tsx`,
  `packages/web/src/server/reportData/projectBoardHandler.ts`,
  `packages/web/src/app/api/data/project-board/route.ts`,
  `packages/web/tests/reportData/projectBoardHandler.test.ts`,
  `packages/web/tests/ProjectBoardView.test.tsx`, `packages/web/tests/DashboardClient.test.tsx`,
  `packages/web/tests/chat/tools.test.ts`, `packages/web/tests/chat/systemPrompt.test.ts`,
  `packages/web/tests/chat/chatRoute.test.ts`, `packages/web/tests/chat/ChatPanel.test.tsx`,
  `docs/reference/page-agent-tools.md`, `docs/reference/http-api.md`,
  `docs/spec/spec-id-catalog.md`, `packages/traceability/spec-ids/prjops.json`,
  `packages/traceability/spec-ids/devops.json`
- Work: strict`projectBoard {projectId}`と既存selection resolverを使い、latest complete Plane snapshotから
  board JSONを返す。codeで列/card数を算出し、Plane authorized URLを編集deep linkにする。新規6 IDを登録する。
- Complete: T02 GREEN、`E-VIEW02`除去、ProjectV2 board read/write call 0、LLM由来card/status/URL 0。
- Verify: seven-kind ViewSpec matrix、keyboard/heading/list/mobile、HTML/URL injection、selection negative matrix、
  web test/build/typecheck、traceability。
- STOP: drag/drop、Plane mutation、project UUIDをauthorization keyにする、Git管理fieldをUIから編集する。

### P014-FC-T04 board cutover sandbox acceptance

- Owner: orchestrator
- Preconditions: P014-FC-T01〜T03 REVIEWED、二つの認可projectと一つの非認可project。
- Allowed files: `.orchestration/evidence/P014-FC-T04/**`, `verification/VERIFICATION_REPORT.md`
- Work: picker→board、Plane human operation→webhook→snapshot→UI、revoked assignment、Plane停止、
  rollbackを実アカウントで検証する。
- Complete: Plane UIとdashboardが同じrevision、foreign/revoked leakage 0、ProjectV2 board mutation 0、
  rollbackで旧read-only状態へ戻せる。
- Verify: HTTP/DB/Plane相関、accessibility/security review、`mise run ci`、hosted checks。
- STOP: source mismatch、stale snapshotをcurrent表示、scope leak、rollback不能、unreviewed migration。

## Phase D: agent workbenchとGit record昇格を開通する

ブランチ `agent/p014-fd-plane-agents`。開始条件: P014-FC-T04 ACCEPTED。Git昇格taskはPlan 012の
generic proposal/approval/publisherがACCEPTEDするまで開始しない。

### P014-FD-T01 AGT-02/03/06 Plane adapterのRED testを追加する

- Owner: worker
- Allowed files: `packages/prjops/tests/planeWorkbench.test.ts`,
  `packages/prjops/tests/collector.test.ts`, `packages/prjops/tests/analyzer.test.ts`,
  `packages/prjops/tests/tracker.test.ts`
- Work: accepted intake→Work Item 1、analysis→comment 1、reminder/escalation→comment 1、replay 0、
  unknown/foreign/inactive PJ write 0、secret sanitize、response不明再送0を先にtestする。
- Complete: Plane adapter不在を理由にRED、既存agent testはGREEN。
- Verify: injected PlaneClient/AuditLogだけを使いnetwork 0。LLMがstate/position/authorizationを決めない。
- STOP: existing decision test緩和、email/display nameをauthorization keyにする。

### P014-FD-T02 agentをPlane共用作業台へ結線する

- Owner: worker（security review必須）
- Preconditions: P014-FD-T01完了。
- Allowed files: `packages/prjops/src/lib/planeWorkbench.ts`,
  `packages/prjops/src/agents/AGT02_collector.ts`,
  `packages/prjops/src/agents/AGT03_analyzer.ts`, `packages/prjops/src/agents/AGT06_tracker.ts`,
  `packages/prjops/tests/planeWorkbench.test.ts`, `packages/prjops/tests/collector.test.ts`,
  `packages/prjops/tests/analyzer.test.ts`, `packages/prjops/tests/tracker.test.ts`,
  `packages/server/src/index.ts`
- Work: mapping/active scope/idempotency/action allowlistをpure libへ置き、agentsは注入clientを呼ぶだけにする。
  AGT-02はaccepted intake、AGT-03は判定結果、AGT-06は既存期限判定を対象itemへ反映する。
- Complete: T01 GREEN。Plane writeはoperating field/commentだけでGit record fieldを変更しない。
- Verify: PrjOps全test、server composition test、concurrent replay、mapping revoke、Plane 429/5xx/timeout、
  audit/sanitize、`mise run ci`。
- STOP: agentへtokenを渡す、Git direct write、state/positionをLLM出力から設定する、Graph通知を無断削除する。

### P014-FD-T03 Git merge SHAをPlaneへtest-firstで再投影する

- Owner: worker（security review必須）
- Preconditions: P014-FD-T02完了。Git main merge webhookとverified mappingを利用可能。
- Allowed files: `packages/shared/src/clients/githubClient.ts`,
  `packages/shared/src/clients/planeClient.ts`, `packages/shared/tests/githubClient.test.ts`,
  `packages/shared/tests/planeClient.test.ts`,
  `packages/prjops/src/lib/planeGitProjection.ts`, `packages/prjops/tests/planeGitProjection.test.ts`,
  `packages/server/src/scheduler/tasks/planeGitProjectionTask.ts`,
  `packages/server/src/lib/githubEventRouter.ts`, `packages/server/src/index.ts`,
  `packages/server/tests/githubEventRouter.test.ts`, `packages/server/tests/planeGitProjectionTask.test.ts`
- Work: 先にmerge SHA replay、base/main drift、foreign PJ、mapping revoke、partial response、
  Plane-owned field preservationのRED testを追加する。`GitHubClient`へPR changed-file一覧と、allowlisted
  record pathをexact refで読むread-only methodを追加する。既存GitHub dispatcherは
  `pull_request.closed && merged=true && base.ref=main`だけからrepository、PR number、`merge_commit_sha`を
  normalized projection inputとしてtaskへ渡す。taskはそのSHAでchanged canonical recordを読み、
  `ISSUE-*`/`ACT-*`/record title/link/external pairだけを決定的に抽出し、Git-owned fieldだけを
  create/updateする。Planeのstate、position、assignee、cycle、discussionはrequest bodyへ含めない。
- Complete: 同一merge SHAの再実行はwrite 0、Git-owned fieldはmainと一致し、Plane-owned fieldはbyte-for-byte不変。
  promotionされたPlane-native itemはmerge後にcanonical external pairへ一度だけ結び付く。webhook bodyだけを
  canonical record内容として使う経路0。
- Verify: contents-at-exact-SHA、changed-file path traversal/size/encoding、create/update/no-op、merge SHA replay、
  missing merge SHA、out-of-order merge、non-main/unmerged SHA、mapping revoke、duplicate external pair、
  Plane concurrent operating edit、response不明、rate limit、outage、readback不一致。
- STOP: Plane-owned fieldをPATCH、unreviewed branchを投影、response不明POST/PATCHを再送、Git外IDをcanonical化。

### P014-FD-T04 Plane record promotionをPlan 012 typed proposalへ接続する

- Owner: worker（approval/security review必須）
- Preconditions: P014-FD-T03、Plan 012 operation proposal/approval/single-attempt publisher ACCEPTED。
  Plan 012実pathが次のAllowed filesと一致すること。
- Allowed files: `packages/prjops/src/lib/planeRecordPromotion.ts`,
  `packages/prjops/tests/planeRecordPromotion.test.ts`,
  `packages/server/src/agents/planePromotionAgent.ts`,
  `packages/server/src/lib/operationProposal.ts`,
  `packages/server/src/db/operationProposalsRepo.ts`,
  `packages/server/src/scheduler/tasks/approvedOperationDispatchTask.ts`,
  `packages/server/src/index.ts`, `packages/server/tests/planePromotionAgent.test.ts`,
  `packages/server/tests/operationProposalsRepo.test.ts`,
  `packages/server/tests/approvedOperationDispatchTask.test.ts`
- Work: formal close、週次status、正式issue/action/decisionだけをcodeで`record.propose`へ分類する。
  base Git SHA、allowlisted path、canonical patch digest、Plane item/revision、source external pairを固定し、
  Plan 012 initializerでproposal/approval/notificationをatomic作成する。publisherはbranch commitとdraft PR
  だけをsingle-attemptで作る。
- Complete: approval前Git write 0、approval後draft PR 1、main write/merge 0。Git/Plane driftは`stale`。
- Verify: ambiguous/non-record operation、requester=approver、expired/rejected、base SHA drift、Plane revision drift、
  duplicate proposal、publisher response不明、path traversal、foreign repo/project、restart/concurrency。
- STOP: Plan 012の別approval/attempt tableを作る、automatic merge、arbitrary patch、agent-held Git credential。

### P014-FD-T05 end-to-end acceptanceとPlan close

- Owner: orchestrator
- Preconditions: P014-FD-T01〜T04 REVIEWED、sandbox Plane/Git/Entra identities。
- Allowed files: `.orchestration/evidence/P014-FD-T05/**`, `verification/VERIFICATION_REPORT.md`,
  `runbooks/manual-ops.md`, `plans/README.md`, `plans/014-plane-integration.md`のStatus/checkboxのみ
- Work: human/AGT-02/03/06 operating flow、webhook/reconcile、typed proposal、別人承認、draft PR、
  human merge、Git-wins再投影を実環境で相関する。backup/restore、token rotation、Plane outage、
  disable/rollback runbookをtabletopする。
- Complete: new 6 spec IDsのpositive/negative matrix、secret/PII leak 0、foreign leakage 0、direct Git write 0、
  unresolved P0/P1 0、Plan/README statusが実態と一致。
- Verify: clean checkout `mise run ci`、hosted checks、independent security/accessibility/data/license review、
  exact merge SHA/Plane revision/pm_event/proposal/approval/PR correlation。
- STOP: mock-only、self-approval、unmerged recordをformal reportが引用、#5757 regression、backup/rollback不能、
  CI red、owner NO-GO。

## Test plan

各code taskは失敗するfocused testを先に確認し、最小実装後にfocused GREEN、package test/typecheck、
`git diff --check`を実行する。各phase acceptanceはclean checkoutで`mise run ci`を1回目から通す。

本Plan固有negative matrix:

- mapping: unsigned/stale version、duplicate Plane UUID、same external pair、foreign PJ、slug/display name auth
- mapping runtime: 1-byte改変、wrong key、raw mapping direct read、startup reload/revoke、UUID reverse lookup
- API: invalid/expired token、removed membership、#5757、61 req/min、429 reset、timeout、5xx、
  non-idempotent response unknown
- webhook: missing/invalid signature、raw whitespace、wrong secret、delivery replay、missing event、payload過大、
  unsupported event/action
- ingestion privacy: comment body、name、email、avatar、raw payloadのqueue/pm_events/pm_snapshots/log 0、
  retention expiry、erasure、backup purge
- reconcile: cursor loop、missing page、mid-read revision change、N-row DB failure rollback、incomplete marker、
  webhook差分、Plane outage
- board: missing/malformed/stale/cross-persona project、foreign row、unsafe URL/HTML、incomplete snapshot、
  ProjectV2 call/mutation 0
- agents: duplicate intake、unknown/inactive sender/PJ、LLM state/position、secret、mapping revoke、Plane response unknown
- projection: main merge SHA replay、out-of-order/unmerged SHA、Git/Plane field ownership、concurrent operating edit、
  response unknown、readback mismatch
- promotion: ambiguous candidate、unapproved/rejected/expired/self-approved、Git/Plane drift、path traversal、
  publisher response unknown、main write/merge 0
- operations: backup/restore、upgrade/rollback、token rotation、integration user removal、Plane disable、
  AGPL source modification 0

既存回帰としてshared/server/prjops/webの全suite、fresh/upgrade/reapply DB、traceability、format/build/typecheckを
`mise run ci`で通す。external testはsandboxのtarget/foreign workspaceとdedicated integration userを使い、
実行していない項目をskip成功として扱わない。

## Done Criteria

- [ ] ADR-0019がowner承認され、Phase A〜Dが全てACCEPTED。
- [ ] Git/Plane/platformのauthority fieldが文書・code・testで一致し、同一fieldのdual truthがない。
- [ ] `PJ-*`だけがauthorization keyで、Plane UUID/slug/nameを使ったscope bypassが0。
- [ ] Plane webhook全件がHMAC/delivery dedupe後に`pm_events`へ追記され、reconcileで取りこぼしを検出する。
- [ ] runtimeはowner署名を検証済みのmappingだけをDIし、raw mapping/UUID逆引きauthorization経路が0。
- [ ] Plane由来のcomment body/name/email/avatar/raw payloadがplatform DB/log/backupへ保存されず、
      retention/erasure/backup purgeが実証済み。
- [ ] dashboardはlatest complete Plane snapshotだけを表示し、ProjectV2 board call/mutationが0。
- [ ] AGT-02/03/06と人間がPlaneを共用し、agent actionはallowlist/idempotency/sanitize/auditを満たす。
- [ ] record-grade変更はPlan 012 typed proposal→別人承認→draft PRだけで、direct main write/auto mergeが0。
- [ ] human merge SHA後のGit-owned field再投影が冪等で、Plane-owned operating fieldを変更しない。
- [ ] #5757、rate limit、outage、backup/restore、upgrade/rollback、AGPL境界の実環境証跡がある。
- [ ] clean checkout `mise run ci`とhosted checksがgreen、新規6 IDのtraceabilityがgreen。
- [ ] `plans/README.md`と本Plan Statusが実態に一致する。

## STOP conditions

- ADR-0019またはPhase CのDEC-SPEC-008改訂にowner承認がない。
- #5757が再現する、integration userのworkspace membershipを一意に証明できない、foreign dataが1件でも返る。
- Plane version/image/license digestを固定できない、または改変版に必要な公開fork/legal ownerがいない。
- `PJ-*`以外をauthorization keyにする、同一fieldをGit/Plane双方から編集する、platform snapshotを正本にする。
- raw token、secret、unsanitized payload、不要なPIIがDB/log/evidenceへ残る。
- unsigned/tampered/stale mappingをruntimeが受理する、またはraw mapping/Plane UUIDから認可を逆引きする。
- webhook署名をraw bytes以外で検証する、delivery replayが重複event/writeを作る、partial reconcileをpublishする。
- Plane non-idempotent writeをresponse不明時に自動再送する。
- Git main merge SHA以外をPlaneへ再投影する、または再投影がPlane-owned fieldを変更する。
- Plan 012 acceptance前に別proposal/approval/attempt境界を作る、Git mainへ直接writeする、自動mergeする。
- allowlist外file、dependency、production resource変更が必要になる。
- focused/`mise run ci`/hosted check/Crit reviewがredまたはunresolvedのまま進める。

## Maintenance notes

- Plane upstream releaseごとに#5757、security advisory、API/webhook contract、license digest、migration/rollbackを
  Phase Aと同じnegative matrixで再検証する。`latest`を自動追随しない。
- data governanceのallowlist/retention/erasure/backup purgeをreleaseごとに再承認し、discussion本文や
  identity fieldを「便利だから」という理由でplatformへ複製しない。
- authority matrixまたは昇格条件を変える場合はADR-0019/DEC-SPEC-008/Plan 014を同じdecision PRで更新する。
- API limitが実測で不足するまでは60 request/minute前提のcursor/batchを維持し、独自queueやcacheを増やさない。
- Work Item API名称のdeprecated `issues` pathを新規codeへ導入せず、`work-items` pathを使う。
- new event table、new approval table、Plane SDKは追加しない。既存`events`、`pm_events`、Plan 012境界を再利用する。
- Plane-native taskをrecord-gradeへ昇格しないまま長期引用しない。正式reportが必要ならtyped proposalを要求する。

## Safety regression invariants

- project/persona scopeは取得側で強制し、UI後段maskや全件fetch後filterを許さない。
- Git/Plane外部文字列はDB保存前、LLM入力前、外部出力前にsanitizeする。
- 数値、色、state、position、authorization、promotion eligibilityはcodeで決め、LLM出力を信頼しない。
- audit/PM eventは追記専用。既存audit rowのUPDATE/DELETEを追加しない。
- integration user、Plane token、Git publisher、approval actorを分離し、agent processへcredentialを渡さない。
- approval前Git mutation 0、draft PR後automatic merge 0、ProjectV2 board mutation 0を継続検査する。
- Plane停止・mapping revoke・provider不明時はstale dataを成功表示せずfail-closedにする。

## Open Questions

仕様境界はADR-0019で提案済みであり、値を推測しない。

### TBD(HUMAN)-1 ADR-0019とDEC-SPEC-008改訂の承認

- blocked_task_id: `P014-FA-T01`、`P014-FC-T01`
- missing_value: ADR-0019採用と、Phase B証跡後のboard/workflow source改訂に対するowner承認
- safe_completed_work: 本decision/Plan草案と、承認後のlocal contract test
- exact_owner: repository owner
- resume_command: ADR承認後Phase A、DEC-SPEC-008 decision merge後Phase Cを開始

### TBD(HUMAN)-2 Plane CE runtime owner

- blocked_task_id: `P014-FA-T03`
- missing_value: sandbox/production host、backup、upgrade、vulnerability response、public fork時のowner
- safe_completed_work: pinned upstream inventoryとmapping contract
- exact_owner: platform operations ownerとlegal owner
- resume_command: owner/host/budget/retention確定後P014-FA-T03を実行

### TBD(ENV)-1 Plane sandbox

- blocked_task_id: `P014-FA-T03`
- missing_value: disposable base URL、target/foreign workspace、専用integration user、secret-store token reference、
  webhook secret reference
- safe_completed_work: local client/contract test
- exact_owner: sandbox administrator
- resume_command: 値をsecret storeへ設定後、#5757を含むPhase A external probeを実行

## Official References

- Plane releases: https://github.com/makeplane/plane/releases
- Plane AGPL-3.0 license: https://github.com/makeplane/plane/blob/preview/LICENSE.txt
- Plane API introduction/auth/rate limit: https://developers.plane.so/api-reference/introduction
- Plane Work Item model/API: https://developers.plane.so/api-reference/issue/overview
- Plane webhooks: https://developers.plane.so/dev-tools/intro-webhooks
- Plane CE self-host: https://developers.plane.so/self-hosting/methods/docker-compose
- Plane #5757: https://github.com/makeplane/plane/issues/5757
