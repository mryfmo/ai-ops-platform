# Plan 010: 推奨仕様・推奨環境で残存製品化工程を完了する

> Planned at: `main` commit `88b365324b10a7891d3bbe39b4281e65820d62e7`
> Decision source: `docs/spec/productization-decisions.md`（2026-07-13 ACCEPTED）
> Executor: Codex `gpt-5.6-sol high` orchestrator

## Status

`BLOCKED — PLAN 011 HUMAN/ENV`

- Priority: P0
- Risk: CRITICAL
- Scope: 監査資料の収載、未確定仕様の固定、Plans 002-008の残実装、Microsoft 365 sandbox、Azure staging/go-live
- Supersedes: `docs/audit/09-remediation-plan.md` の「作業の正本」という位置づけ
- Supplements: `plans/009-remaining-productization-execution.md`。本Planが上書きしていないF04-F09の詳細はPlan 009を使用する。

## Goal

`docs/audit/00`〜`08`で検出した残件を、推奨仕様と推奨環境に固定して実装し、ローカル実装・外部環境証跡・人間承認を混同せずにgo-live判定まで閉じる。後続executorが別の意味を補ったり、ENV未検証を実装完了と読み替えたりできない状態を作る。

## Scope

含むもの:

- `docs/audit/00`〜`09`の履歴監査資料としての収載
- 既存`docs/AI_Ops_Platform_Summary.pptx` 12枚版の保持と、未実装主張を含む14枚候補の不採用記録
- namespaced traceability、ViewSpec/report runtime契約、PrjOps stable identity、production provider、project picker、read-only Kanban、承認基盤
- Graph smoke実adapterとMicrosoft 365 sandbox証跡
- Plans 003/004/006/007の未実装
- Azure Container Apps/PostgreSQL/Key Vault/Front Door/observabilityのBicep、staging、E2E、DR、go-live

含まないもの:

- `.agents/worklog/**`、`.codex/hooks.json`、古い作業ブランチ生成のtraceability matrix
- productionデータを使った試験、productionへの試験書込み
- 後続PRの自動マージ。このPlanを導入するPRだけが2026-07-13の一回限り例外
- 実トークン、メールアドレス、氏名、メッセージ本文を証跡やGitへ保存すること

## Assumptions

- 仕様値は `docs/spec/productization-decisions.md` が確定済みであり、executorは変更しない。
- 実tenant/repository/subscription/resource ID、credential、owner署名はENV入力であり、未提供なら該当external taskだけを`BLOCKED`にする。
- `prjops-data`のURLが未提供でも、versioned schema、validator、migration、DI、negative testは実装できる。
- Microsoft 365/Azureの実操作はsandbox/staging allowlist、no-write preflight、明示opt-in、cleanupが揃った場合だけ行う。
- repository内にPlan quality validator、Make target、hook、reviewer agent定義は存在しない。Planの機械検証を成功と偽装せず、手動構造検査とfresh-context `gpt-5.6-sol high` reviewで代替する。
- Definition of Doneは `mise run ci`。mise lock/shimの環境不整合があれば、解消して同コマンドを実行する。direct pnpm成功だけで最終DoDを代替しない。

## Design

### 1. 正本と衝突処理

実行時の優先順位は次の通り。

1. `AGENTS.md`とaccepted ADR
2. `docs/spec/productization-decisions.md`
3. 本Plan
4. Plan 009のうち本Planが上書きしていないtask本文
5. Plans 002-008
6. `docs/audit/09-remediation-plan.md`（履歴ledger）

同じ作業を複数文書が指示した場合は一度だけ実装し、下位文書に上位task IDと受入SHAを記録する。二重実装は禁止する。

### 2. task状態

各taskは `TODO -> ASSIGNED -> IMPLEMENTED -> REVIEWED -> ACCEPTED` の順にのみ進む。外部入力不足は `BLOCKED`、独立review findingは `REVISE` とする。

`ACCEPTED`に必要な証跡:

```text
task_id
target_commit
allowed_files
worker_model_verified
commands_and_exit_codes
focused_red_reason       # code taskのみ
focused_green_result     # code taskのみ
negative_cases
independent_review_model
review_findings
review_outcome
artifact_paths_and_sha256
environment_scope        # external taskのみ
cleanup_result           # external taskのみ
human_approval_reference # human gateのみ
```

空欄を`N/A`にする場合は理由を書く。ログやartifactがない自己申告は受入れない。

### 3. モデル選択と否定的精査

- Orchestrator: `gpt-5.6-sol high`。依存判定、task packet、成果物全読、再実行、accept/rejectを担当する。
- High-risk worker: `gpt-5.6-sol high`。auth、DB migration、concurrency、secret、外部副作用、IaC、CIを担当する。
- Mechanical worker: runtimeで確認できる最小モデル。限定docs、既知annotationの機械移行、fixture整形だけを担当する。
- Reviewer: workerと別contextの `gpt-5.6-sol high`。correctness/security/privacy/operations/negative pathをread-onlyで確認する。
- Escalation: 明示修正後に同じ`root_cause_key`が再発したときだけ、利用可能な次の上位reasoning tierへ修正依頼する。利用可能な名称をruntimeで確認できなければ推測名を書かずSTOPする。

Orchestratorはworkerの要約だけで受入れず、diff、変更ファイル全文、test、schema、生成物を直接読む。レビューでは少なくとも「認証なし」「foreign tenant」「scope外」「inactive」「重複/並行」「期限切れ/replay」「secret/PII漏洩」「partial failure」「cleanup failure」を否定的に検討する。

### 4. atomic task規則

- task packetの`allowed_files`は実在する個別パスへ展開する。directory wildcardは使わない。
- code taskは先にtestを追加し、意図した理由でREDを確認する。実装と無関係なcompile errorをRED証跡にしない。
- 1 taskは1つのobservable boundaryだけを変更する。別schema、別external system、別runtime boundaryが必要なら次taskへ分ける。
- scope外変更が必要になったらworkerは変更せずSTOPし、orchestratorが新task packetを発行する。
- schema変更はfresh `schema.sql`、新migration、repository、fresh/upgrade/idempotency testを同じPRに含める。
- external taskはpreflight、operation、correlation、cleanupを分け、cleanup failureもFAILとする。

### 5. task DAG

下表の`requires`がすべて`ACCEPTED`になるまで対象taskを`ASSIGNED`にしない。カンマはAND、`A|B`は明記した場合だけORを意味する。本Planでは暗黙のphase継承や「先行taskがたぶん済んでいる」という解釈を禁止する。

| Task/range          | Requires                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| F00-T01/T02/T03     | Plan 001 DONE; each may run independently                                                        |
| F00-T04             | F00-T01, F00-T02, F00-T03                                                                        |
| F01-T01             | F00-T04                                                                                          |
| F01-T02             | F01-T01                                                                                          |
| F01-T03             | F01-T02                                                                                          |
| F01-T04             | F01-T03                                                                                          |
| F01-T05             | F01-T01                                                                                          |
| F01-T06             | F01-T05                                                                                          |
| F01-T07/T08/T09     | F01-T01; each may run independently                                                              |
| F01-T10             | F01-T01 through F01-T09                                                                          |
| F01-T11             | F01-T10                                                                                          |
| F02-T01/T03/T05     | F01-T11; each may run independently                                                              |
| F02-T02             | F02-T01                                                                                          |
| F02-T04             | F02-T03                                                                                          |
| F02-T06             | F02-T03, F02-T05                                                                                 |
| F02-T07             | F02-T01, F02-T02, F02-T06                                                                        |
| F02-T08             | F02-T06, F02-T07                                                                                 |
| F02-T09             | F02-T04, F02-T05, F02-T06, F02-T08                                                               |
| F02-T10             | F02-T06, F02-T07, F02-T08                                                                        |
| F02-T11             | F02-T10                                                                                          |
| F02-T12             | F02-T05, F02-T06, F02-T07, F02-T08, F02-T10, F02-T11                                             |
| F02-T13             | F02-T09, F02-T10, F02-T11, F02-T12                                                               |
| F02-T14             | F02-T09 through F02-T13                                                                          |
| F03-T01/T02/T03     | F02-T03, F02-T05, F02-T06; each may run independently                                            |
| F03-T04             | F03-T01, F03-T02, F03-T03                                                                        |
| F03-T05             | F03-T04                                                                                          |
| F03-T06             | F03-T05                                                                                          |
| F03-T07             | F03-T06                                                                                          |
| F03-T08             | F03-T07                                                                                          |
| F04-T01/T04         | F01-T11; local T01 and external T04 may run independently                                        |
| F04-T02             | F04-T01                                                                                          |
| F04-T03             | F04-T02                                                                                          |
| F04-T05             | F04-T03, F04-T04                                                                                 |
| F04-T06             | F04-T05                                                                                          |
| F04-T07             | F04-T06                                                                                          |
| F04-T08             | F04-T07                                                                                          |
| F05-T01 through T05 | F02-T14, F03-T08, F04-T08; then numeric order                                                    |
| F05-T06 through T09 | Plan 001 DONE, F03-T08, F04-T08; then numeric order                                              |
| F05-T10 through T14 | F02-T14, F03-T08; then numeric order                                                             |
| F05-T15 through T20 | F02-T14, F03-T08; then numeric order                                                             |
| F06-T01 through T08 | F02-T14, F03-T08, F04-T08, F05-T20; then numeric order except T02-T05 may follow T01 in parallel |
| F06-T09 through T18 | F06-T08; then numeric order                                                                      |
| F07-T01             | F00-T04, F01-T11, F02-T14, F03-T08, F04-T08, F05-T20, F06-T18                                    |
| F07-T02             | F07-T01                                                                                          |
| F07-T03             | F07-T02                                                                                          |

`numeric order`は各range内で直前番号のACCEPTEDを要求する。例外として明示したparallel task以外を並列化しない。

## Current State

`main@88b3653`で確認済み:

- Plan 001のPostgreSQL/audit baselineとPlan 005のローカルGraph coreは実装済み。
- integration PR #76とDependabot policy PR #78はmerge済み。open PRは前回同期時0件。
- Web production compositionはPrjOpsのempty in-memory providerを使用し、authorizationはemail主体。
- Graph smoke harnessは存在するがCLI mainは実adapter不在を示す`E-SMK07`でfail-closedする。
- Azure IaC、real-environment E2E harness、acceptance manifest validatorは存在しない。
- Plan 009は古いplanned-at/current-stateを含むため、本Planのdrift taskで現mainへ同期する必要がある。
- `docs/audit/00`〜`09`は未追跡、primary checkoutのPPTX 14枚候補は既存12枚と追加2枚から成るが、追加slideに未実装機能の現在形主張があり導入PRから除外する。primary checkoutは古いdirty branchとして保全対象。

## Implementation

### Phase 0: decisionと監査資料を正本化する

#### P010-F00-T01 監査bundleを履歴資料として収載する

- Type/model: docs / mechanical model、reviewはhigh
- Allowed files: `docs/audit/00-summary.md`〜`docs/audit/09-remediation-plan.md`
- Work:
  1. 00-08を内容変更せず追加する。
  2. 09の冒頭だけに、基準commit、履歴ledger、現行正本へのlink、未完checkboxはcurrent statusでない旨を追記する。
  3. 00から09、09からdecision/Plan 010の相対linkが解決することを確認する。
- Complete: 「作業の正本」という有効宣言がdecision record/Plan 010以外に0件。68 `AUD-*` IDが欠落せず、credential-shaped valueが0件。
- Verify: Prettier check、relative-link scan、secret/absolute-path scan、`git diff --check`。
- Negative: 39b9594時点の監査結果を現mainの未修正件数と表現したらREVISE。

#### P010-F00-T02 decision recordと本Planを追加する

- Type/model: decision+docs / high
- Allowed files: `docs/spec/productization-decisions.md`, `docs/adr/0016-azure-platform.md`, `plans/009-remaining-productization-execution.md`, `plans/010-recommended-spec-environment-execution.md`, `plans/README.md`
- Work: accepted仕様/環境値、SPEC/ENVの区別、Azure architecture/supersession、全task universe、優先順位、Plan README statusを同期する。Plan 009冒頭へdecision record/Plan 010優先と補助ledger範囲を明記し、Plan 009本文を別の正本として残さない。
- Complete: open questionに推奨値の選択余地が残らず、ENV ID/credentialだけが入力欄として残り、Plan 009/010/README/audit 09の優先順位が相互に矛盾しない。
- Verify: required section grep、task ID uniqueness/order、全source path存在確認、fresh-context high review ACCEPT。
- Negative: `TBD`、`適切な`、`必要に応じて`、`等`だけで実装判断を委ねる記述があればREVISE。

#### P010-F00-T03 PPTX 14枚候補を否定検証し既存12枚版を保持する

- Type/model: docs/binary review / mechanical worker + high visual/claim review
- Allowed files: repository変更なし。primary checkoutの候補はread-only、`origin/main`の`docs/AI_Ops_Platform_Summary.pptx`を保持する。
- Work: 14枚候補をQuick Look HTML/画像へ展開し、既存12枚とのslide XML比較、追加2枚の主張、重なり、切れ、文字化け、秘密/個人metadataを確認する。未実装を現在形で述べる「重要報告の人間承認」「全操作監査」「途中失敗後の安全再開」を理由付きでrejectする。
- Complete:導入PRのPPTX diff 0、保持する12枚版SHA-256が`b5451e0417b77220f45a5193f0097ec2f72849aef4a1d7388cac043e4a2055f9`、14枚候補はprimary checkoutから変更/削除されず、reject理由が本taskに記録される。
- Verify: `git diff origin/main -- docs/AI_Ops_Platform_Summary.pptx` empty、12枚版`unzip -t`/slide count/hash、14枚候補の既存1-12 slide XML一致、追加2枚XML text/metadata/render review。
- Negative:未実装機能を現在形で記載したbinaryを「将来計画」と読み替えてcommitしない。14枚を再提案する場合は生成元、全claim source、全slide render evidenceを別PRで提出する。

#### P010-F00-T04 一回限りの導入PRをmergeする

- Type/model: Git/PR / high orchestrator
- Preconditions: T01-T03 ACCEPTED、最新`origin/main`へrebase、staged allowlist完全一致。
- Work: audit/decision/plan/ADRだけをcommitし、PPTX diff 0を確認してpush、`ai-generated` label付きPR、hosted checks、独立negative review、今回の明示例外をPRへ記録してmergeする。
- Complete: PR merged SHAが`origin/main`のancestor、open PR 0、primary dirty checkoutのhash/inventory不変。
- Verify: `git diff --cached --name-status` allowlist、`mise run ci`、GitHub checks/review threads、post-merge fetch/ancestry。
- STOP: `git add -A`、`.agents`/`.codex`/stale matrixのstage、CI red、unresolved review、base drift。

### Phase 1: traceability・ViewSpec・report契約を実装する

開始条件: F00-T04 ACCEPTED。

#### P010-F01-T01 canonical spec IDsをcatalogへ追加する

- Allowed files: `docs/spec/spec-id-catalog.md`, `packages/traceability/spec-ids/prjops.json`, `packages/traceability/spec-ids/devops.json`
- Work: DEC-SPEC-006の6 IDを定義し、system/category/idの一意性を維持する。
- Complete: six IDs appear exactly once in their system catalog; JSON parse succeeds。
- Verify: catalog grep/count、JSON parse、duplicate tuple scan。

#### P010-F01-T02 namespaced verifierのRED fixturesを追加する

- Allowed files: existing traceability test file(s) identified in the task packet only。
- Work: bare collision、wrong system、malformed namespace、valid dual reference、unknown IDをfixture化する。
- Complete: current verifier fails the intended collision/wrong-system tests and passes no false RED。
- Verify: focused Vitest command recorded with failing assertion names。

#### P010-F01-T03 exact canonical parser/verifierを実装する

- Allowed files: `packages/traceability/src/verifyTraceability.ts`, T02 test file, output formatter file if it already exists。
- Work: exact token parser、system-aware source/test indexes、bare ambiguous failure、unknown/malformed report、presence-not-behavior disclaimerを実装する。
- Complete: T02全GREEN。PrjOps reference cannot satisfy DevOps and vice versa。
- Verify: traceability package test/typecheck、malformed corpus negative CLI、`mise run traceability`。

#### P010-F01-T04 repository annotationsをcanonical化する

- Model: mechanical worker、review high
- Preconditions: T03 ACCEPTED。
- Allowed files: task assignment時にverifierが報告したsource/test fileを全件個別列挙する。
- Work:意味を変えず裸の衝突IDだけにsystem prefixを付ける。仕様根拠が判別不能なfileは変更せずSTOP listへ出す。
- Complete: ambiguous bare references 0、unrelated code diff 0。
- Verify: `mise run traceability`, package tests, semantic diff review。

#### P010-F01-T05 ViewSpec runtime schemaのRED testsを追加する

- Allowed files: `packages/web/tests/chat/tools.test.ts`, `packages/web/tests/chat/ChatPanel.test.tsx`, `packages/web/tests/chat/chatRoute.test.ts`, `packages/web/tests/DashboardClient.test.tsx`
- Work: unknown kind、extra data/metric/URL/HTML、invalid period、invalid periodDays、invalid/out-of-scope projectId、valid seven kindsを追加する。
- Complete: unsafe cast/manual parser経路で少なくとも1本が意図どおりRED。
- Verify: focused web tests。

#### P010-F01-T06 ViewSpec parserを全boundaryへ結線する

- Allowed files: `packages/web/src/server/viewSpec.ts`, `packages/web/src/server/chat/tools.ts`, `packages/web/src/server/chat/chatHandler.ts`, `packages/web/src/components/chat/ChatPanel.tsx`, `packages/web/src/components/DashboardClient.tsx`, T05 tests。
- Work: strict Zod schemaと`parseViewSpec/safeParseViewSpec`を1箇所に置き、manual parserと`as ViewSpec` trust castを削除して5 boundaryで再利用する。
- Complete: seven kindsのみ受理、`projectBoard`はcanonical projectId必須、additional property拒否、invalid stream outputはUI/actionを生成しない。
- Verify: focused tests、web typecheck、`rg -n 'as ViewSpec|function sanitizeViewSpec'`でunsafe duplicate 0。

#### P010-F01-T07 unavailable metric契約を実装する

- Allowed files: `packages/shared/src/reporting/reportSchema.ts`, `reportValidation.ts`, `reportGenerator.ts`, `packages/shared/tests/reporting.test.ts`, `packages/server/src/http/routes/reportIngest.ts`,対応server tests。
- Work: DEC-SPEC-007のmeasured/unavailable union、finite/source/asOf/evidence validation、version compatibilityをRED-firstで実装する。
- Complete: numeric 0とunavailableが区別され、LLM slotからmetric入力不可、旧payloadの処置が明示される。
- Verify: shared/server focused tests、typecheck、invalid NaN/Infinity/missing reason/source error cases。

#### P010-F01-T08 weekly snapshot semanticsを実装する

- Allowed files: existing snapshot pure-lib file、`packages/devops/src/agents/AGT_RPT.ts`, repository file、schema/migration if required、corresponding tests。task packetで実在pathへ展開する。
- Work: JST half-open period、exact scope/key、last valid observation、current/prior delta、unavailable reasonをpure lib→repo→AGT_RPTに結線する。
- Complete: hardcoded delta 0がなく、missing current/previous、scope mismatch、DST非影響、week boundaryが一意。
- Verify: boundary tests、fresh/upgrade migration tests if schema changed、DevOps tests/typecheck。

#### P010-F01-T09 incident labelとprofile narrative slotsを実装する

- Allowed files: `packages/web/src/components/views/ManagerSummaryView.tsx`, view tests, AGT-04 implementation/config files, AGT-04 tests。
- Work: manager summaryだけに固定速報label、DEC-SPEC-007の10 slotsをdata table化、数字/secret混入を既存sanitizerでrejectする。
- Complete: AGT_RPTにburndown sectionを新設せず、全5 profileが許可slot以外を生成/受理しない。
- Verify: all profile matrix、digit/Unicode digit/secret/empty fallback tests、PrjOps/Web tests。

#### P010-F01-T10 acceptance manifest validatorを実装する

- Allowed files: `scripts/validate-acceptance-manifest.mjs`, `tests/validate-acceptance-manifest.test.mjs`, `verification/acceptance-manifest.json`, root package script entry only。
- Work: 本Planのimmutable commit/blob hashからordered task universeを抽出し、`--through`と`--final`でtask ID、status、target SHA、command exit、artifact SHA、dependency ancestry、external/human fieldsを検証する。
- Complete:正規task headingは合計86件（F00=4、F01=11、F02=14、F03=8、F04=8、F05=20、F06=18、F07=3）。missing/extra/duplicate/out-of-order/blocked、plan hash mismatch、nonzero command、missing artifact、dependency non-ancestor、required nullをすべてexit 1にする。未来taskは`--through`で要求しない。
- Verify: Node testのvalid/各invalid fixture、既にACCEPTEDなtaskだけを含む実manifestを`--through P010-F01-T09`でgreenにする。T10自身のacceptance recordはこのcommand成功と独立review後にorchestratorが追加し、同じtaskの自己参照を禁止する。task universeは`^#### P010-F[0-9]{2}-T[0-9]{2} `だけを正規task見出しとして抽出し、expected task ID listのgolden fixtureと完全一致させる。
- Negative: symlink artifact、repo外path、hash mismatch、自己申告だけのreview/ENV evidenceを受理しない。

#### P010-F01-T11 Phase 1 acceptance

- Allowed files: `docs/reference/page-agent-tools.md`, `docs/reference/http-api.md`, spec catalog/output generated at final HEAD。
- Work: docs/schema/output同期、full CI、independent review。
- Complete: T01-T10 ACCEPTED、task universe golden fixture一致、P0/P1 finding 0、P2にowner/date/mitigation。
- Verify: clean checkout `mise run ci`, generated matrix no regression, `node scripts/validate-acceptance-manifest.mjs --through P010-F01-T10 verification/acceptance-manifest.json`, high review ACCEPT。成功後にorchestratorがT11 acceptance recordを追加し、F02-T01のpreflightが初めてT11までを検証する。

### Phase 2: Plan 002 stable identityとproduction data provider

開始条件: Phase 1 ACCEPTED。

#### P010-F02-T01 prjops-data machine contractを追加する

- Allowed files: `docs/contracts/prjops-data.md`, `docs/contracts/entra-subject-mapping.md`, `docs/contracts/persona-scope-matrix.md`, `docs/contracts/data-handling.md`, contract fixtures/schema files selected in packet。
- Work:最初にacceptance validatorを`--through P010-F01-T11`で実行し、T11 recordを含むPhase 1 closureを検証する。成功後、DEC-SPEC-001〜004をfield、type、path、owner、update、delete、checksum、migration dispositionへ展開する。checksumはDEC-SPEC-001のcanonical manifest bytesを実装言語に依存せず記述し、empty/one/multi/order/LF/CRLF/BOM/NFC-NFD/path/symlink/boundaryのinput bytes、expected canonical manifest bytes、expected SHA-256をgolden vectorへ固定する。
- Complete: valid/invalid fixturesを人の解釈なしに判定でき、owner/signature欄とENV値が区別される。
- Verify: `node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json`、link/schema validation、unknown field/duplicate/checksum negative fixtures。

#### P010-F02-T02 snapshot validatorを実装する

- Allowed files: `packages/prjops/src/lib/`の新validator、exports、tests、fixtures only。
- Work: schema version、sorted checksum、canonical IDs、cross-reference、duplicate identity、partial snapshotをpure functionでfail-closedにする。
- Complete: DEC-SPEC-001の全invalid conditionが固有error codeで失敗。
- Verify: RED/GREEN focused tests、PrjOps typecheck。

#### P010-F02-T03 stable subject schema/migrationを実装する

- Allowed files: `packages/devops/src/db/schema.sql`, new migration, recipient/stakeholder repository, DB tests。
- Work: tenant/object UUID、active、scope_mode、unique key、backfill disposition/stateを追加する。email unique/authorization dependencyを除く。
- Complete: fresh/upgrade/reapply green、duplicate/NULL/foreign tenant fail、audit UPDATE/DELETE権限不変。
- Verify: disposable PostgreSQL commands、catalog constraint queries、rollback rehearsal。

#### P010-F02-T04 legacy backfill dry-run/applyを実装する

- Allowed files: one backfill CLI/script, parser pure lib, tests, runbook。
- Work: signed mapping CSV/JSONをvalidateし、dry-run summary/hash、all-or-nothing apply、unresolved/duplicate/inactive/cross-tenant abortを実装する。
- Complete: apply requires exact dry-run digest and explicit sandbox database confirmation; no email-only row remains active。
- Verify: invalid matrix、dry-run no writes、digest mismatch、transaction rollback、idempotent reapply。

#### P010-F02-T05 Entra claimsをsession/callerへ伝播する

- Allowed files: `packages/web/src/auth.ts`, Auth.js type declaration, server auth boundary files, auth tests。
- Work: resource-server validated tid/oid/rolesをcanonicalizeし、sessionへstable subjectだけを渡す。email fallbackを削除する。
- Complete: missing/malformed/foreign tid/oid、expired/invalid issuer/audience、role conflictをデータ取得前に拒否。
- Verify: signed fixture matrix; logger/evidenceにraw token/PII 0。

#### P010-F02-T06 persona resolverをstable subjectへ変更する

- Allowed files: `packages/web/src/server/personaResolver.ts`, `authGuard.ts`, `personaSelectionHandler.ts`, relevant tests, PrjOps YAML provider/model files。
- Work: `resolveBySubject`、requestごとのactive lookup、multi-persona 409、deterministic selector order、fail-closed null/global semanticsを実装する。
- Complete: `resolveByEmail`はproduction interfaceから消え、email変更same oid PASS、same email foreign oid DENY。
- Verify: single/multiple/stale/inactive/cross-tenant/cross-project/global matrix。

#### P010-F02-T07 production report data providerを実装する

- Allowed files: provider interface/implementation、repository SQL、tests、config factory selected in packet。
- Work: pinned snapshotからprojects/issues/snapshots/investor inputsをvalidateしてロードし、subject/persona/project条件をprovider/SQL queryに含める。
- Complete:全件fetch後filter 0、snapshot commit/checksum不一致時503 fail-closed、request間active cache 0。
- Verify: allow/deny query spy、partial/corrupt snapshot、scope leakage tests。

#### P010-F02-T08 production compositionからempty providerを除く

- Allowed files: dashboard、chat、persona、executive/manager/investor/projects/timeseries/agent-activity route filesをpacketに全件列挙、composition tests。
- Work:共有poolとT06/T07 provider factoryを全routeへ注入し、InMemory providerをtest/dev-onlyに限定する。
- Complete: production sourceでempty `InMemory*Provider([])` matches 0、全routeが同じauth/provider policyを使用。
- Verify: repository `rg`、9+ route allow/deny integration matrix、connection pool reuse test。

#### P010-F02-T09 identity/data sandbox acceptance

- Type: external+review / high
- Preconditions: authoritative repo URL/commit/owner、mapping、PII approval、sandbox Entra identities。
- Work: dry-run owner review→sandbox apply→all persona/query negative matrix→independent security review。
- Complete: DEC-SPEC-001〜004のidentity/data criteria全件、unresolved mapping 0、PII violation 0。Plan 002の最終DONE判定はT14で行う。
- Verify: exact commit/checksum、DB queries、HTTP tests、`mise run ci`、redacted evidence。
- STOP: unsigned mapping/contract、production-only identity、scope leak。

#### P010-F02-T10 scoped project pickerを実装する

- Model: frontend/full-stack worker、review high。
- Preconditions: T06-T08 ACCEPTED、DEC-SPEC-008 ENV mapping fixture available。
- Allowed files: `packages/web/src/app/dashboard/page.tsx`, `packages/web/src/components/ProjectPicker.tsx`, `packages/web/src/server/projectSelection.ts`, `packages/web/src/server/reportData/projectsHandler.ts`, `packages/web/src/app/api/data/projects/route.ts`, `packages/web/tests/ProjectPicker.test.tsx`, `packages/web/tests/projectSelection.test.ts`, `packages/web/tests/reportData/projectsHandler.test.ts`。
- Work: scoped `{id,name}`と`portfolioAllowed`を取得し、`?project=PJ-*|all`をcanonical parserで分類する。projects APIはproject queryを拒否し、UIだけが`portfolioAllowed=true`時に`all` optionを合成する。1件auto-select、複数未選択409、URL back/forward/reload、label/focus/error announcementを実装する。このtaskはselection resolve/controlだけを実装し、domain endpointへの適用はT13で行う。
- Complete: client-supplied IDだけでdata queryを開始する経路0。one/many/global/stale/unknown/inactive/malformed/cross-tenant/cross-persona casesがDEC-SPEC-008どおり。
- Verify: component keyboard/accessible-name tests、handler query-spy tests、projects APIのparameter absent 200 / parameter present(empty/valid/malformed/all/repeated) 400 E-AUTH05かつdomain query 0、project-specific HTTP 200/409/400/403 matrix、`rg -n 'localStorage|project.*cookie' packages/web/src`の新authorization state 0。
- Negative: optionをDOMから改変、URL直打ち、別persona URL再利用、同名別ID、case/Unicode/encoded traversal、APIをpicker非経由で直接呼ぶ。

#### P010-F02-T11 ProjectV2 board snapshot contractを実装する

- Model: backend worker、review high/security。
- Preconditions: T10 ACCEPTED、sandbox ProjectV2 Status field inventory available。
- Allowed files: `packages/shared/src/clients/githubClient.ts`, `packages/shared/src/projectBoard.ts`, `packages/shared/src/index.ts`, `packages/shared/tests/githubClient.test.ts`, `packages/shared/tests/projectBoard.test.ts`, `packages/devops/src/db/schema.sql`, `packages/devops/src/db/migrations/202607130203_project_board_snapshots.sql`, `packages/server/src/config.ts`, `packages/server/src/index.ts`, `packages/server/src/db/pmTimeseriesRepo.ts`, `packages/server/src/scheduler/tasks/pmSnapshotReconcileTask.ts`, `packages/server/tests/pmTimeseriesRepo.test.ts`, `packages/server/tests/pmSnapshotReconcileTask.test.ts`。
- Work: owner-signed inventoryからStatus field option ID/name/color/ordinalを検証する。GraphQL `items(orderBy:{field:POSITION,direction:ASC})`を全page取得し、responseのzero-based ordinalをitem positionとして、type/title/repository/assignees/labels/authorized URL/archive/redaction/capturedAtとともにsanitize・validateして保存する。pagination前後のproject `updatedAt`が変化したsnapshotは破棄する。repository queryはstable subject/persona/canonical projectIdを条件に最新complete snapshotだけを返す。
- Complete: Status未設定だけが`未分類`、non-null unknown/changed optionは503。duplicate source/incomplete page/cursor loop/updatedAt change/snapshot mismatchはfail-closed。unmapped/foreign ProjectV2 node、archived/redacted/deleted item、scope外rowをboard結果へ含める経路0。
- Verify: GraphQL pagination/rate limit/POSITION ordinal/inventory fixtures、schema fresh/upgrade/reapply、SQL query-spy、secret/HTML/unsafe URL、corrupt/partial/duplicate/unknown-option/option add-delete-rename-recolor negative tests。

#### P010-F02-T12 read-only Kanban viewとnavigationを実装する

- Model: frontend worker、review high/accessibility。
- Preconditions: T05-T11 ACCEPTED。
- Allowed files: `packages/web/src/server/viewSpec.ts`, `packages/web/src/server/chat/tools.ts`, `packages/web/src/server/chat/systemPrompt.ts`, `packages/web/src/server/chat/chatHandler.ts`, `packages/web/src/components/chat/ChatPanel.tsx`, `packages/web/src/components/DashboardClient.tsx`, `packages/web/src/components/views/ProjectBoardView.tsx`, `packages/web/src/server/reportData/projectBoardHandler.ts`, `packages/web/src/app/api/data/project-board/route.ts`, `packages/web/tests/chat/tools.test.ts`, `packages/web/tests/chat/systemPrompt.test.ts`, `packages/web/tests/chat/chatRoute.test.ts`, `packages/web/tests/chat/ChatPanel.test.tsx`, `packages/web/tests/DashboardClient.test.tsx`, `packages/web/tests/ProjectBoardView.test.tsx`, `packages/web/tests/reportData/projectBoardHandler.test.ts`, `docs/reference/page-agent-tools.md`, `docs/reference/http-api.md`。
- Work: strict `projectBoard {projectId}` ViewSpec、scoped board endpoint、Status option order columns、final `未分類`、snapshot timestamp、authorized GitHub edit deep linkを結線する。card数/列数は受信済みboard JSONからcode算出する。drag/drop/mutationは実装しない。
- Complete: boardは単一selected projectだけを表示し、LLM embedded data/URL/status/cardを拒否する。keyboard/heading/list semantics、empty/loading/error/409/403を明示し、horizontal overflowでも操作可能。
- Verify: seven-kind boundary matrix、view/handler tests、axe相当accessibility assertions、mobile/desktop rendering、foreign deep-link/unsafe URL/HTML injection、GitHub mutation call 0、web typecheck。

#### P010-F02-T13 project selectionを全data boundaryへ強制する

- Model: backend/full-stack worker、review high/security。
- Preconditions: T09-T12 ACCEPTED。
- Allowed files: `packages/web/src/server/projectSelection.ts`, `packages/web/src/server/reportData/executiveSummaryHandler.ts`, `packages/web/src/server/reportData/managerSummaryHandler.ts`, `packages/web/src/server/reportData/investorSummaryHandler.ts`, `packages/web/src/server/reportData/timeseriesHandler.ts`, `packages/web/src/server/reportData/agentActivityHandler.ts`, `packages/web/src/server/reportData/prjopsReportData.ts`, `packages/web/src/server/reportData/devopsReportData.ts`, `packages/web/src/server/reportData/agentActivityData.ts`, `packages/web/src/app/api/data/executive-summary/route.ts`, `packages/web/src/app/api/data/manager-summary/route.ts`, `packages/web/src/app/api/data/investor-summary/route.ts`, `packages/web/src/app/api/data/timeseries/route.ts`, `packages/web/src/app/api/data/agent-activity/route.ts`, `packages/web/src/components/DashboardClient.tsx`, `packages/web/tests/projectSelection.test.ts`, `packages/web/tests/reportData/executiveSummaryHandler.test.ts`, `packages/web/tests/reportData/managerSummaryHandler.test.ts`, `packages/web/tests/reportData/investorSummaryHandler.test.ts`, `packages/web/tests/reportData/timeseriesHandler.test.ts`, `packages/web/tests/reportData/agentActivityHandler.test.ts`, `packages/web/tests/reportData/prjopsReportData.test.ts`, `packages/web/tests/reportData/devopsReportData.test.ts`, `packages/web/tests/reportData/agentActivityData.test.ts`, `packages/web/tests/DashboardClient.test.tsx`。
- Work: DEC-SPEC-008 endpoint matrixをそのままpolicy tableにし、page queryと各routeで同じresolverを呼ぶ。missing one auto、missing many 409、malformed 400、well-formed unknown/inactive/foreign/out-of-scope 403をdomain query前に返す。single selectionはprovider/SQLのproject predicateへ渡し、`all`はactive global PRF-04/PRF-Gの対象endpointだけで許可する。summary ViewSpecから別projectIdを受け取らない。
- Complete: pickerを経由しない直接API、改変URL、別persona/tabのstale URLでも同じstatus/policy。single project responseに他project row 0、unauthorized requestのdomain query call 0。
- Verify: endpoint×persona×one/many/all/missing/malformed/stale/inactive/cross-tenant/cross-persona matrix、provider/SQL query spy、Dashboard URL propagation/back-forward tests、web typecheck。
- Negative: `all`をPRF-03/PRF-05/investor/boardで使用、project name/node IDをPJの代用、client-side後段filter、summary toolからproject override、403後のcached data表示。

#### P010-F02-T14 project operations sandbox acceptance

- Type: external+review / high。
- Preconditions: T09-T13 ACCEPTED、two authorized and one unauthorized sandbox projects、owner-signed Status field inventory、GitHub App read permission。
- Work: one/many/global selection、reload/back/share、board columns/order/cards、GitHub deep link、snapshot reconciliation、revoked assignmentを実アカウントで検証する。
- Complete: authorized board matches the same ProjectV2 snapshot、foreign/unmapped/revoked leakage 0、write API call 0、accessibility/security review ACCEPT、Plan 002 criteria全件、README 002 DONE。
- Verify: redacted HTTP/DB/GraphQL correlation、exact ProjectV2 node/Status option hashes、negative account evidence、`mise run ci`。
- STOP: PJ↔ProjectV2 mapping/Status inventory unsigned、App write-only or overbroad permission、scope leak、source board mismatch。

### Phase 3: T-P0-13/T-P0-14 approval trust boundary

開始条件: F02-T03、F02-T05、F02-T06 ACCEPTED。stable subject schema、validated token propagation、persona resolutionのいずれか未完ならapproval routeを実装・公開しない。

#### P010-F03-T01 approval state schema/migration

- Allowed files: schema.sql、one new migration、approval repo skeleton、DB tests。
- Work: request/decision、requester/intended approver tid+oid、nonce hash、jti、issued/expires/consumed、status/reason、unique/CHECK/FKを追加する。
- Complete: fresh/upgrade/reapply、duplicate jti、invalid transition、NULL identity拒否。
- Verify: real PostgreSQL transaction/constraint tests、audit protections。

#### P010-F03-T02 pure approval authorization policy

- Allowed files: one `packages/server/src/lib/` module、tests、exports。
- Work: active entitlement、tenant/project/type、requester separation、expiry/statusをpure decisionとして実装する。
- Complete: every deny reason maps to a stable error without DB/network access。
- Verify: full decision table including foreign tenant/self/scope/inactive/expired。

#### P010-F03-T03 one-time token and CSRF primitives

- Allowed files: `confirmToken.ts` replacement/addition, CSRF pure lib, tests, config schema/docs。
- Work: crypto-random 256-bit nonce、SHA-256 storage hash、UUID jti、30-minute expiry、timing-safe verify、session-bound CSRFを実装する。callback/confirm secretsを分離する。
- Complete: deterministic task-ID-only HMAC is not used for new approvals; raw nonce never persists/logs。
- Verify: expiry boundary、tamper、wrong session/origin、replay input、secret scan。

#### P010-F03-T04 atomic decision repository

- Allowed files: approval repo、audit writer transaction adapter、DB tests。
- Work: one injected PG clientでBEGIN→CAS pending→consume nonce→insert decision→append audit→COMMIT。error時ROLLBACK。
- Complete: 20 concurrent POST simulations yield 1 committed decision/1 audit/1 enqueue eligibility。
- Verify: failure injection at each statement、rollback row counts、real PG concurrency。

#### P010-F03-T05 authenticated approval routes

- Allowed files: approval route、app registration、HTML helper、route tests。
- Work: authenticated GET/POST、same-origin/CSRF、escaped form、reason required、status mappingをT02-T04へ結線する。
- Complete: anonymous 401、unauthorized 403、invalid 400、expired 410、replay/concurrent 409、success 200。
- Verify: `app.request()` matrix、HTML injection、no PII/error leakage。

#### P010-F03-T06 AGT_CHG card composition

- Allowed files: `packages/devops/src/agents/AGT_CHG.ts`, server composition root/task, card tests。
- Work: composition rootがapproval request/jtiを作り、URLをAGT_CHG cardへ注入する。agentはtokenを生成しない。
- Complete: intended approver/project/request IDがDB/card/auditで相関し、cardなしrouteだけの孤立実装でない。
- Verify: DI mock wiring、unsafe URL、foreign host、expired reissue tests。

#### P010-F03-T07 external report approvalへ基盤を再利用する

- Allowed files: standard report schema/migration/repo、report ingest/delivery task、tests。
- Work: PRF-04/PRF-05/investor reportをpendingで保存し、T06と同じapproval基盤を使い、approved onlyを配信queryで取得する。
- Complete: pending/rejected 0 delivery、approved at-most-once、requester!=approver、inactive recipient再評価。
- Verify: concurrent approve/deliver、retry/restart、reason/audit、scope negative tests。

#### P010-F03-T08 approval sandbox acceptance

- Preconditions: sandbox Entra users/roles、public HTTPS origin、sandbox downstream workflow。
- Work: requester/approver/unauthorized/foreign userで実認証、link reissue/replay/concurrency、workflow correlationを実行する。
- Complete: security review ACCEPT、T-P0-13/14 evidence、no production side effect。
- Verify: redacted auth/DB/audit/workflow trace、cleanup/disable test request。

### Phase 4: Plan 005 Microsoft 365 adapterと実tenant受入

開始条件: DEC-ENV-001 resources available。adapter code tasks T01-T03はcredentialsなしで先行可。

#### P010-F04-T01 Graph adapter contract RED tests

- Allowed files: new `packages/server/tests/graphSmokeAdapter.test.ts`, existing graphSmoke test only。
- Work: subscription/root/reply/mail/fetch/DB correlation/cleanup、missing config、allowlist mismatch、adapter errorをfixture化する。
- Complete: current E-SMK07 placeholder against positive adapter case is intended RED。
- Verify: focused test log。

#### P010-F04-T02 GraphSmokeOperations real adapter

- Allowed files: new `packages/server/src/tools/graphSmokeAdapter.ts`, existing Graph client/repo exports only if necessary, T01 tests。
- Work: existing MSAL Graph client、subscription repo、channel message repo、audit correlationをDIで接続する。edit/delete write APIを実装しない。
- Complete: every operation returns allowlisted correlation metadata; secret/body absent; cleanup ownership enforced。
- Verify: networkless adapter tests、429/403/404/partial cleanup negatives。

#### P010-F04-T03 CLI/config/preflight wiring

- Allowed files: `graphSmoke.ts`, config, `.env.example`, configuration docs, tests。
- Work: `--sandbox` + `AIOPS_GRAPH_SMOKE_ENABLED=true`二重opt-in、exact IDs/evidence root、no-write preflight、T02 adapter接続を実装する。
- Complete: no opt-in/config mismatch/production-like ID/symlink/overwriteはnonzero E-SMK、valid mock adapter runs harness。
- Verify: CLI subprocess contract、server typecheck、secret scan。

#### P010-F04-T04 Microsoft 365 sandboxを準備する

- Type: human/external
- Work: dedicated tenant/app/team/channel/mailbox/recipient/delegated actor/public callback、RSC、Exchange RBAC、cleanup ownerを用意する。
- Complete: redacted inventoryとowner approval、unscoped Mail.Send 0、noninstalled team/nonallowlisted mailbox negative targets。
- Verify: RSC listing、`Test-ServicePrincipalAuthorization` allow/deny、callback TLS/reachability。

#### P010-F04-T05 no-write preflight

- Preconditions: T03/T04。
- Work: exact config presence/scopeだけを検査し、secret/valueを表示しない。
- Complete: positive resource PASS、negative team/mailbox DENY、write 0。
- Verify: command/exit、hash IDs、operator cross-check。

#### P010-F04-T06 subscription/Teams/Outlook smoke

- Work: subscription、root/reply、Outlook approved recipient、callback fetch、DB/audit correlationをexact opt-inで実行する。
- Complete: request IDs/hash resource refs/DB rows correlate; every created resource owned by run ID。
- Verify: smoke CLI exit 0、evidence schema/hash、nonallowlisted recipient deny。

#### P010-F04-T07 update/delete/lifecycle/renew/delta

- Work: delegated/UI actorでupdate/delete、lifecycle/renew、missed-window deltaを実行する。
- Complete: created→updated→deleted preserved、exact redelivery only skipped、renew/delta state matches。
- Verify: timeline correlation、out-of-order/duplicate negative、app-only unsupported success claim 0。

#### P010-F04-T08 cleanupとPlan 005 acceptance

- Work: run-owned resources cleanup、credential/evidence scan、child Plan criteria、independent tenant evidence review。
- Complete: cleanup 100%、Plan 005 DONE、README synced、local+tenant evidence ACCEPT。
- Verify: post-cleanup GET 404/absence、CI、high review。

### Phase 5: Plans 003/004/006/007の残実装

開始条件はDesign §5のDAGを正本とする。PrjOps列T01-T05はPlans 002/005とapproval受入、DevOps列T06-T09はPlan 001/005とapproval受入、agent列T10-T14とWeb/API/Excel列T15-T20はPlan 002とapproval受入をそれぞれ要求する。元Plan 009のphase開始条件はこのDAGへ包含され、緩和されない。

このPhaseでは各見出しの`Source`に指定したPlan 009 taskのWork/Complete/Verify/STOP全文を、名前を置き換えず作業仕様として使う。本Planのdecision/identity/approvalが衝突する箇所だけ、明記したOverrideを優先する。source taskを1件でも欠落、重複、隣接番号へずらすことを禁止する。

#### P010-F05-T01 PrjOps永続job state machineとCAS claim

- Source: Plan 009 `P009-F04-T01`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: fresh/upgrade、two-worker CAS、lease/restart、invalid transition。

#### P010-F05-T02 Outlook/Teams/GitHub intake正規化

- Source: Plan 009 `P009-F04-T02`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: three-channel valid/invalid/duplicateが同じrecord identity/state transitionを通り、raw text保存0。

#### P010-F05-T03 AGT-03/04/07分析・report・verify配線

- Source: Plan 009 `P009-F04-T03`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: code-calculated metric、sanitized narrative、全profile schema、source→report→audit trace。

#### P010-F05-T04 PrjOps approval・冪等配信・追跡

- Source: Plan 009 `P009-F04-T04`。
- Override: approval identity/token/atomic decisionはF03のaccepted基盤だけを再利用し、別実装を作らない。
- Work/Complete/Verify/STOP: Override以外はsource task全文。
- Completion oracle: preapproval send 0、retry/restart duplicate 0、active recipient request-time reread。

#### P010-F05-T05 Plan 003 sandbox受入

- Source: Plan 009 `P009-F04-T05`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: three-channel→master→analysis→approval→delivery→cleanupの単一trace、README 003 DONE。

#### P010-F05-T06 DevOps event/state repositories

- Source: Plan 009 `P009-F05-T01`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: normalized eventとbuild/deploy/incident/change stateのfresh/upgrade/dedupe/restart tests。

#### P010-F05-T07 BLD/DEP workflow実配線

- Source: Plan 009 `P009-F05-T02`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle:実sandbox runでstate遷移、echo/missing script failure、no approval no deploy。

#### P010-F05-T08 INC/CHG/RPT/SEC/ORCH実配線

- Source: Plan 009 `P009-F05-T03`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: webhook/monitor→state→approval→side effect→audit、failsafe/scope negative。

#### P010-F05-T09 Plan 004 sandbox受入

- Source: Plan 009 `P009-F05-T04`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: success/failure/cancel/timeout/rollback/manual recovery、README 004 DONE。

#### P010-F05-T10 coding-task confirmationとdispatch CAS

- Source: Plan 009 `P009-F06-T01`。
- Override: Entra subject、nonce/jti、expiry、secret separationはF02/F03のaccepted実装を再利用し、このtaskはcoding taskのqueued→running CASとdispatch correlationだけを追加する。
- Work/Complete/Verify/STOP: Override以外はsource task全文。
- Completion oracle: replay/expired/cross-user/double dispatch拒否、one committed dispatch。

#### P010-F05-T11 unprivileged agent runnerとartifact boundary

- Source: Plan 009 `P009-F06-T02`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: agent credential read 0、path/symlink/digest tamper deny、publisherだけがvalidated artifactを読む。

#### P010-F05-T12 Claude Code/Droid pinと予算強制

- Source: Plan 009 `P009-F06-T03`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: version/SHA/checksum pin、tool allowlist、max turns/timeout/concurrency/cost fail-closed。

#### P010-F05-T13 report metric extractionとingest

- Source: Plan 009 `P009-F06-T04`。
- Override: metric unavailable shapeとnarrative schemaはDEC-SPEC-007/F01のaccepted契約を使う。
- Work/Complete/Verify/STOP: Override以外はsource task全文。
- Completion oracle: DB/GitHub period/scope source、implicit zero 0、digest/run ID audit、missing adapter silent success 0。

#### P010-F05-T14 Plan 006 sandbox draft PR/report受入

- Source: Plan 009 `P009-F06-T05`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: Claude/Droid両方のpatch→validated draft PR、report→ingest、secret scan、README 006 DONE。auto-merge 0。

#### P010-F05-T15 shared Pool load/query boundary

- Source: Plan 009 `P009-F07-T01`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: per-request Pool 0、scope外row fetch 0、50 concurrent requestでconnection max内。

#### P010-F05-T16 HTTP trust boundary

- Source: Plan 009 `P009-F07-T02`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: 413/415/429、spoof/direct/slow body/proxy timeout matrix。

#### P010-F05-T17 raw event深層sanitize

- Source: Plan 009 `P009-F07-T03`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: nested object/array/stringを保存前・LLM前・出力前にsanitizeしraw secret永続化0。

#### P010-F05-T18 Excel claim/leaseとlimits

- Source: Plan 009 `P009-F07-T04`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: atomic claim/lease/heartbeat/crash recovery、bytes/rows/sheets/cells/archive ratio/time limit。

#### P010-F05-T19 Excel reconciliationとpersona UX

- Source: Plan 009 `P009-F07-T05`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: conflict/partial/retry state、persona route matrix、keyboard/name/status、UI/API scope leak 0。

#### P010-F05-T20 container fail-fastとPlan 007受入

- Source: Plan 009 `P009-F07-T06`。
- Work/Complete/Verify/STOP: source task全文。
- Completion oracle: build failure nonzero、load/security/Excel/Web E2E、container start/probe、README 007 DONE。

Phase 1 validatorは次のexact bijectionをgolden fixtureで検証する: `P010-F05-T01..T05 ↔ P009-F04-T01..T05`、`T06..T09 ↔ P009-F05-T01..T04`、`T10..T14 ↔ P009-F06-T01..T05`、`T15..T20 ↔ P009-F07-T01..T06`。source IDの欠落、重複、順序差、題名差はFAIL。

### Phase 6: Azure IaC、staging、DR、go-live

開始条件: F02-T14、F03-T08、F04-T08、F05-T20がすべてACCEPTED。IaC local taskもF05と並行開始せず、Design §5のDAGを厳守する。

#### P010-F06-T01 Azure ADR同期とnonsecret parameter schema

- Allowed files: `docs/adr/0016-azure-platform.md`, `infra/azure/parameters.schema.json`, nonsecret example only。
- Work:導入PRでACCEPTED済みのADR-0016とDEC-ENV-002を同期確認し、resource、region、network、identity、RPO/RTO/SLO、naming/tagをparameter schemaへ固定する。ADRの選択内容はこのtaskで再選定しない。
- Complete: ADR/decision drift 0、secret値0、staging/prod separation、Japan East/West、immutable digest、rollbackが一意。
- Verify: JSON schema validation、ADR link/reference review。

#### P010-F06-T02 network/identity/Key Vault Bicep

- Allowed files: main Bicep、network/identity/key-vault modules、Bicep tests/lint config。
- Work: VNet/subnets/private DNS/endpoints、user-assigned identity、least privilege role assignments、Key Vault refsを宣言する。
- Complete: plaintext secret output/parameter 0、public PostgreSQL 0、staging identity cannot access prod vault。
- Verify: `az bicep build`, lint, what-if fixture/static assertions。

#### P010-F06-T03 ACR/Container Apps/Front Door Bicep

- Allowed files: ACR/container-app/front-door modules、outputs、tests。
- Work: digest-only image、multiple revisions、0/10/50/100 traffic、probes、migration job、Front Door Premium WAF-only originを宣言する。
- Complete: mutable tag alone rejected、direct origin blocked、probe paths/ports match app。
- Verify: Bicep build/what-if、container build/run probe、policy scan。

#### P010-F06-T04 PostgreSQL backup/restore Bicep

- Allowed files: PostgreSQL/backup modules、DR runbook、tests。
- Work: Japan East flexible server、geo backup at creation、35-day retention、5-year weekly LTR、locks、roles/private networkを宣言する。
- Complete: audit app role no UPDATE/DELETE、restore creates new server、post-restore checklist exact。
- Verify: Bicep static assertions、schema role tests、runbook dry review。

#### P010-F06-T05 monitoring/SLO/alerts Bicep

- Allowed files: monitoring module、alert definitions、observability runbook。
- Work: DEC-ENV-002 metrics/alerts、owner/severity/runbook/paging/ack escalation、PII-safe dimensionsを宣言する。
- Complete: required signal missing 0、public unauthenticated metrics 0、secret/PII label 0。
- Verify: definition schema test、synthetic alert mapping review。

#### P010-F06-T06 OIDC release/plan workflows

- Allowed files: `.github/workflows/release-image.yml`, `staging-plan.yml`, reusable deploy workflow, action tests/pinning docs。
- Work: GitHub OIDC、environment approvals、digest/SBOM/provenance、Bicep validate/what-if、migration-before-traffic、rollbackを実装する。
- Complete: long-lived Azure secret 0、all actions SHA-pinned、prod job human environment gate required。
- Verify: actionlint、workflow policy tests、dry-run output review。

#### P010-F06-T07 real-environment E2E harness

- Allowed files: `verification/run_real_environment_e2e.sh`, contract test, scenario adapter interface, evidence schema/validator。
- Work: `--list`、sandbox allowlist、exact opt-in、timeout、redaction、immutable per-run artifact、finally cleanup、adapter missing/skip nonzeroを実装する。
- Complete: no-opt-in/invalid resource/adapter failure/cleanup failure/secret evidence all fail。
- Verify: shellcheck/shfmt、contract tests、executable/list command。

#### P010-F06-T08 local infrastructure acceptance

- Work: Bicep build/lint、container build/run、workflow checks、E2E contract、root CI、independent cloud/security review。
- Complete: T01-T07 ACCEPTED、P0/P1 finding 0。
- Verify: clean checkout commands and artifact hashes。

#### P010-F06-T09 staging inventory/OIDC federation

- Type: human/external
- Work: subscription/resource groups/DNS/cert/identities/GitHub environments/owners/budgets/on-callを作成・承認する。
- Complete: nonsecret inventory、least-privilege role listing、prod/staging identity negative test。
- Verify: redacted Azure/GitHub queries、owner signatures。

#### P010-F06-T10 empty staging what-if/apply

- Work: validated Bicepをempty stagingへwhat-if、差分review後applyする。Key Vaultへsecretをout-of-band投入する。
- Complete: unexpected delete/role broadening/public DB 0、all resources tagged/owned。
- Verify: immutable what-if/apply logs、resource graph inventory、secret output scan。

#### P010-F06-T11 migration/digest rollout/probes

- Work: migration job→0% direct label smoke→10→50→100。各stageでprobe/synthetic/error/latency/auditを判定する。
- Complete: same image digest/SBOM/provenance一致、failed stage auto-advance 0。
- Verify: revision/traffic query、trace IDs、negative bad image/probe。

#### P010-F06-T12 rollback rehearsal

- Work: synthetic bad revisionで前digestへtraffic rollbackし、DB compatibility windowを検査する。
- Complete: approved RTO内、data loss/duplicate side effect 0、old tag rebuild 0。
- Verify: before/after digest/traffic/DB checksums、audit timeline。

#### P010-F06-T13 HA scheduler/failure injection

- Work: 3 replicas、leader death、lease expiry、clock drift、long task、retry restartを実行する。
- Complete: active executor 1、external side effect at-most-once、failover within SLO。
- Verify: DB lease/audit/external IDs correlation。

#### P010-F06-T14 WAF/auth/metrics/alert acceptance

- Work: direct-origin、spoofed proxy、rate/oversize/unauthorized metrics、foreign tenant、synthetic alert/ack escalationを実行する。
- Complete: all negative denied before protected data/side effect; expected pages reach owner。
- Verify: Front Door/WAF/app/trace correlation、redacted alert timestamps。

#### P010-F06-T15 PITR/LTR/DR restore drill

- Work: PITRをnew clean serverへrestore、roles/network/parameters/alertsを再設定、row/artifact checksum、app reconnectを行う。可能なstaging DRでJapan West手順を演習する。
- Complete: same-region RPO<=5m/RTO<=60m、regional RPO<=60m/RTO<=4h、checksum一致。
- Verify: exact timestamps、restore server ID、row counts/hashes、post-restore negative role tests。

#### P010-F06-T16 credential rotation/revocation

- Work: Graph、GitHub App、LLM、agent CLI、Auth、HMAC/callbackを1種類ずつnew positive→old negativeへrotateする。
- Complete: privilege increase 0、rollback credential/window defined、old credential fails after approved overlap。
- Verify: redacted positive/negative request IDs and audit; no secret in command/artifact。

#### P010-F06-T17 E2E A-E

- Work: Plan 009 P009-F08-T17〜T21のdatabase/audit、M365、GitHub/agents、PrjOps/report/Web、Excel/API/performanceを順に実行する。
- Complete: skip 0、mock-only 0、cleanup success、same build digest、trace correlation。
- Verify: `verification/run_real_environment_e2e.sh --scenario <name> --sandbox` per scenario。

#### P010-F06-T18 security/operations/product reviewとgo/no-go

- Work:同一immutable SHA/evidence manifestを3 reviewerへ提示、P0/P1修正再review、人間decision makerへrisk/rollback/supportを提示する。
- Complete: 3 ACCEPT、P0/P1 0、human GO signature。GO前production traffic/write 0。
- Verify: review target SHA=deployed digest source SHA、receipt/evidence hashes。

### Phase 7: final reconciliation

開始条件: F00-T04、F01-T11、F02-T14、F03-T08、F04-T08、F05-T20、F06-T18がすべてACCEPTED。外部/human taskのBLOCKEDをDONEへ読み替えて開始しない。

#### P010-F07-T01 plans/audit/statusを実態へ同期する

- Allowed files: Plans 002-010、plans README、verification report、runbooks/reference docs。individual paths packetで列挙。
- Work:各task acceptance SHA/evidence/ENV statusを反映し、historical audit countとcurrent residual countを分離する。
- Complete: stale planned-at、merged PRだけの完了主張、二重正本、未検証success表記0。
- Verify: link checker、task/evidence one-to-one scan、independent docs review。

#### P010-F07-T02 final clean regression/adversarial review

- Work: clean checkout CI、audit、actionlint、container、fresh/upgrade DB、E2E、auth/secret/idempotency/HA/DR negative reviewをorchestratorが再実行する。
- Complete: first-run green、skip/continue-on-error/flaky rerun acceptance 0、P0/P1 0。
- Verify: immutable command logs、artifact hashes、review ACCEPT。

#### P010-F07-T03 Plans 002-010をDONEへ更新する

- Preconditions: human GO、T01/T02 ACCEPTED、all external gates accepted。
- Work: status/checkbox/evidenceを最終更新し、運用ownerへhandoffする。
- Complete: READMEと各Plan一致、ENV BLOCKED/TODO 0、production support/on-call/rollback ready。
- Verify: final CI、evidence manifest、Git history/ancestry、human signature。
- STOP:いずれかのmissing/blocked/reviseを例外承認で隠すこと。

## Tests

### 共通local gate

各code taskは次を実行する。

```bash
<focused RED command>
<focused GREEN command>
pnpm --filter @aiops/<package> run test
pnpm --filter @aiops/<package> run typecheck
git diff --check
mise run ci
```

最終受入ではclean checkoutの`mise run ci`を1回目からgreenにする。test件数は固定せず、commit SHA、実行日時、exit codeと一緒にlogから記録する。

### trust-boundary negative matrix

- 認証なし、署名不正、issuer/audience不正、missing/malformed/foreign `tid/oid`
- inactive subject/recipient、stale persona、multi-persona未選択、cross-project、NULL/global誤用
- same email/different oid、email変更/same oid、duplicate/unresolved backfill
- expired/replayed/tampered nonce、wrong origin/CSRF、requester self-approval、20 concurrent decisions
- unknown/extra ViewSpec、embedded data/metric/URL/HTML、NaN/Infinity、missing unavailable reason
- duplicate/out-of-order/429/5xx/timeout/restart/partial failure、cleanup failure
- raw/nested/Unicode-normalized secret、PII in log/DB/LLM/evidence/PR
- proxy spoof/direct origin、oversize/slow body/zip bomb/path traversal/symlink
- split brain、leader death、lease expiry、clock drift、backup corruption/restore misconfiguration

### external evidence integrity

- Evidence file is new, nonsymlink, immutable per run, SHA-256 recorded.
- IDs are hashed or classified nonsecret; raw secret/body/name/email is absent.
- Positive and negative results refer to the same tenant/subscription/build SHA.
- Request/trace IDs correlate ingress, DB, audit, external service, and cleanup.
- Missing adapter, skipped scenario, cleanup failure, hash mismatch, or overwritten artifact is FAIL.

## Done Criteria

- [ ] F00-F07の全taskがACCEPTED。
- [ ] `docs/spec/productization-decisions.md`と実装/環境のsemantic drift 0。
- [ ] production routeのemail authorization、empty provider、sample caller、fetch-all-then-filter 0。
- [ ] approvalはvalidated stable subject、one-time nonce、CSRF、atomic decision+audit、at-most-once dispatchを満たす。
- [ ] traceabilityはsystem namespaceを強制し、reference presenceとbehavior proofを区別する。
- [ ] ViewSpec/report metric/narrative contractをruntimeで共通検証し、LLMが数値を生成しない。
- [ ] project pickerは権限内PJだけを表示し、全requestでselectionを再検証し、複数未選択を409で停止する。
- [ ] KanbanはGitHub Projects v2の単一project snapshotをread-only表示し、Status option orderとitem positionを決定的に再現する。
- [ ] Microsoft 365 RSC/RBAC/subscription/change/lifecycle/delta/mail/cleanup実証済み。
- [ ] Azure IaC、digest deploy、WAF、private DB、managed identity、observability、HA、PITR/LTR/DR/rotation実証済み。
- [ ] real E2E A-E green、skip/mock-only 0。
- [ ] `mise run ci`、audit、actionlint、container、fresh/upgrade DB green。
- [ ] security/operations/product review ACCEPT、P0/P1 open 0。
- [ ] human GOと運用handoff完了。
- [ ] Plans 002-010とREADMEがDONEで事実と一致。

## Open Questions

仕様選択のOpen Questionはない。次はENV入力であり、値を推測しない。

- `prjops-data` repository URL、GitHub App installation、初回pinned commit SHA、Data Owner/PMO owner署名
- `PJ-*`↔ProjectV2 node/URL mapping、Status field ID/ordered option inventory、GitHub App Projects read permission
- Entra sandbox tenant/app/user mapping、approval role/group、Microsoft 365 team/channel/mailbox/recipient/delegated actor
- Azure subscription IDs、DNS zone/certificate、federated identity IDs、on-call/paging destinations、actual SKU sizing
- production go-live日時とhuman decision record

これらが未提供でも該当ENV task以外のlocal taskを続行する。ENV task到達時は`blocked_task_id / missing_value / safe_completed_work / exact_owner / resume_command`を報告する。
