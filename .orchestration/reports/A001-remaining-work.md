# A001 plans 精査・残作業インベントリ

- 基準: `origin/main@017f609b0274007178f8796d6142bbce990465fe`
- 判定日: 2026-07-18
- 状態編集: linked worktree `/private/tmp/ai-ops-platform-A001` の `agent/A001-plans-audit`
- 原則: `DONE` は実装、必要な外部証跡、受入条件が揃った場合だけとした。部分実装は残件を消さない。

## Plan 001

- 現 Status → 是正後 Status: `DONE` → `DONE`
- 残作業: Plan 001 自体にはなし。Plan 011 の遡及 governance receipt は受入信頼基盤側の残件であり、Plan 001 の実装完了を巻き戻さない。
- 根拠:
  - `6a6c1aaba279045268029f36c0b9f548df15b063` は `origin/main` の ancestor。
  - `verification/run_db_integration.sh`、`verification/test-results/P001-baseline-fresh-schema.txt`、`runbooks/audit-retention.md` が存在する。
  - audit mutation trigger は `packages/devops/src/db/migrations/202607110001_audit_log_block_mutation.sql` にある。

## Plan 002

- 現 Status → 是正後 Status: `TODO` → `TODO`
- 残作業（依存順）:
  1. Plan 011 と Plan 010 F01-T10/T11 を閉じる。
  2. P010-F02-T01〜T06: machine contract、stable subject schema/backfill、Entra claim、persona resolver。
  3. P010-F02-T07〜T13: production provider、empty provider除去、picker、ProjectV2 snapshot、read-only board、全data boundary。
  4. P010-F02-T14: sandbox identity/project operations acceptance。
- 根拠:
  - `packages/web/src/server/personaResolver.ts:32` ほかに `resolveByEmail` が残る。
  - `packages/web/src/app/dashboard/page.tsx:60,98` と各data routeに空の `InMemory*Provider([])` が残る。
  - YAML stakeholder providerは `2223fa4`/統合PR `61560c3` で入ったが、production compositionとstable subjectは未完。

## Plan 003

- 現 Status → 是正後 Status: `TODO` → `TODO`
- 残作業（依存順）:
  1. Plans 002/005の受入。
  2. 永続job state/CAS claim。
  3. Outlook/Teams/GitHub intake正規化。
  4. AGT-03/04/07分析・report・verify。
  5. approval、冪等配信、追跡、sandbox E2E。
- 根拠:
  - `packages/prjops/src/workflows/` は存在しない。
  - `packages/prjops/src/agents/AGT01_orchestrator.ts:8` が package-local scheduler 未実装を明記する。
  - server schedulerは存在するが、Plan 003のAGT-01〜07全DAGを閉じるproduction callerではない。

## Plan 004

- 現 Status → 是正後 Status: `TODO` → `TODO`
- 残作業（依存順）:
  1. Plans 001/005とapproval基盤を受入。
  2. event/state repositories。
  3. BLD/DEP workflow実配線。
  4. INC/CHG/RPT/SEC/ORCH実配線。
  5. sandbox end-to-endとmanual recovery。
- 根拠:
  - `packages/devops/src/workflows/deploy-prod.yml:38` はdeployを `echo` するだけ。
  - `packages/devops/src/workflows/on-workflow-failure-triage.yml:19` は未実装の `packages/devops/scripts/jobs/on-build-failure.mjs` を呼ぶ。
  - `packages/devops/scripts/jobs/` はREADMEのみ。

## Plan 005

- 現 Status → 是正後 Status: README `TODO` / plan本文 local accepted・ENV pending → `BLOCKED: ENV`
- 残作業（依存順）:
  1. dedicated M365 sandbox、public callback、RSC、Exchange Application RBAC、delegated/UI actorを準備。
  2. real `GraphSmokeOperations` adapterをCLIへ配線。
  3. subscription/root/reply/mail smoke。
  4. update/delete/lifecycle/renew/delta、cleanup、独立review。
- 根拠:
  - local coreは `39b9594`、review correction `3335bee`、PR #40 merge `9b6fbbb`、統合 `61560c3` に存在。
  - `packages/server/src/tools/graphSmoke.ts:321` は実adapter不在を `E-SMK07` でfail-closeする。
  - Plan本文の `Remaining acceptance` も実tenant evidence pendingを明記する。

## Plan 006

- 現 Status → 是正後 Status: `TODO` → `TODO`
- 残作業（依存順）:
  1. Plans 001/002とapproval基盤を受入。
  2. confirmation/dispatch CAS。
  3. unprivileged agent jobとprivileged publisherを分離。
  4. Claude Code/Droidをpinし予算・tool境界を強制。
  5. DB/GitHub実snapshotからreport metricsを抽出し、sandbox draft PR/reportを受入。
- 根拠:
  - `.github/workflows/coding-task.yml:138,165` で同workflowがpushとPR作成を行う。
  - `.github/actions/run-coding-agent/action.yml:33,48` はCLI起動だけで、install/version pinの実証がない。
  - `.github/workflows/report-generation.yml:104` はingest設定欠落をskipする。
  - `calculateReportMetrics.ts` は依然 `REPORT_*` 環境変数をsourceにする。

## Plan 007

- 現 Status → 是正後 Status: `TODO` → `TODO`
- 残作業（依存順）:
  1. Plan 002のproduction provider/SQL scopeを完成。
  2. shared Poolのtimeout/load boundary。
  3. HTTP trust boundaryとdistributed rate policy。
  4. raw eventのdeep sanitize。
  5. Excel atomic claim/lease/reconciliation。
  6. persona UX、container fail-fast、load/security受入。
- 根拠:
  - Pool singleton、body上限、headers等は統合PR `61560c3` で部分実装済み。
  - `packages/server/src/db/eventsRepo.ts:107,117` はpayloadを直接 `JSON.stringify` して保存する。
  - `packages/server/src/db/importLedgerRepo.ts:36` は `ON CONFLICT ... DO NOTHING` でclaim成否を返さない。
  - production empty providerとfetch-all経路が残るためDone criteria未達。

## Plan 008

- 現 Status → 是正後 Status: `TODO` → `TODO`
- 残作業（依存順）:
  1. Plans 001〜007の受入。
  2. CI parity/coverage/dependency risk。
  3. Azure IaC、immutable image/SBOM/provenance、migration rollout。
  4. HA scheduler/shared failsafe、observability/SLO。
  5. backup/PITR/DR、credential rotation。
  6. real-environment E2E A〜E、独立review、人間go/no-go。
- 根拠:
  - Node 22、pnpm 11.13.0、native `mise.lock`、hermetic actionlintは部分完了。
  - `infra/azure/`、`verification/run_real_environment_e2e.sh`、acceptance manifest validatorは存在しない。
  - Plans 002〜007がDONEでないため開始ゲートも未達。

## Plan 009

- 現 Status → 是正後 Status: `TODO` → `BLOCKED: SUPERSEDED`
- 残作業: Plan 009を直接実行しない。Plan 010が上書きしていないF04〜F09のtask本文だけをPlan 010から参照する。
- 根拠:
  - Plan 009冒頭は `docs/spec/productization-decisions.md` と Plan 010の優先を明記する。
  - `plans/README.md` Current notesも「detailed source ledger only」とする。
  - 同じtask universeを二重に実行する方が危険なため、実行状態としてはsuperseded blockerを明示した。

## Plan 010

- 現 Status → 是正後 Status: `IN PROGRESS` → `BLOCKED: PLAN 011`
- 残作業（依存順）:
  1. Plan 011 trust bootstrapを完了。
  2. P010-F01-T10 acceptance manifest validatorを信頼境界込みで実装。
  3. P010-F01-T11 Phase 1 acceptance。
  4. F02 stable identity/data、F03 approval、F04 M365、F05 Plans 003/004/006/007。
  5. F06 Azure/go-live、F07 final reconciliation。
- 根拠:
  - F01-T01〜T09は `f52ebeb`〜`468d947`、統合 `69945a3`/`e1d0fa3` で実装済み。
  - worklog todoはT10をworker-minted fake receiptでgreenにできるためREVISE/BLOCKED、T11も連鎖BLOCKEDと記録。
  - `scripts/validate-acceptance-manifest.mjs` は存在しない。

## Plan 011

- 現 Status → 是正後 Status: `BLOCKED: HUMAN/ENV` → `BLOCKED: HUMAN/ENV`
- 残作業（依存順）:
  1. P011-F00-T01: Enterprise Organization slug、billing owner、maintenance window、policy admin 2名、別人reviewerを確定。
  2. private repository移管、ruleset/CODEOWNERS/Environment/OIDC。
  3. runner/reviewer/governance workflows、bootstrap epoch、verifier、rotation。
  4. Plan 001 retrospective receipt、adversarial matrix、T10 handoff。
- 根拠:
  - `3bb40da` でplanは追加済みだが、実行成果物ではない。
  - plan Current stateはOrganization 0、collaborator 1、environment 0、branch protection API 403を記録。
  - Done criteria 19件が未完。

## Plan 012

- 現 Status → 是正後 Status: README `TODO` / plan本文に状態値なし → `IN PROGRESS`
- 残作業（依存順）:
  1. `P012-PLAN-R15-01..03` と独立cold reviewを反映し、origin/main上のplan/DAGを再同期。
  2. P012-F00残task、Phase 1〜7を依存順に実装。
  3. Plan 010/011のstable identity、approval、Graph、coding publisher、trust gateを満たす。
  4. full external acceptance、cleanup、final CI/go-live。
- 根拠:
  - PR #91 / `ce912e6` で `P012-F00-T01` baseline inventoryと`mise.lock`がmerge済み。
  - origin/mainのPlan 012は99 task headingsだが、active todoはレビュー後115 taskへの改訂と残114 taskを記録しており、plan正本の再同期が未完。
  - `.orchestration/evidence/P012-F00-T01/` は存在する。

## Plan 013

- 現 Status → 是正後 Status: README未掲載 / untracked plan `TODO` → `TODO`
- 残作業（依存順）:
  1. drift check、ADR-0018収載、README登録、owner承認。
  2. 全persona到達性とboard公開gate。
  3. PRF-L agent activity。
  4. conversation audit。
  5. floating panel UX、最終検証。
- 根拠:
  - primary repoのuntracked `plans/013-page-agent-pptx-parity.md` は21 taskを持ち、StatusはTODO。
  - 現コードは `page.tsx:178` に「準備中」、`tools.ts:170` に未稼働board tool、PRF-L非公開を残す。
  - origin/mainにはPlan 013/ADR-0018が未収載。

## Plan 0018

- 現 Status → 是正後 Status: README未掲載 / plan番号としてのStatusなし → `BLOCKED: HUMAN`
- 残作業: Plan 013 F00のdecision PRで正しい `docs/adr/0018-page-agent-architecture.md` へ収載し、owner承認後に「提案」から「採用」へ更新する。
- 根拠:
  - primary repoのuntracked `plans/0018-page-agent-architecture.md` は実体が `# ADR-0018` で、実装Planではない。
  - statusは「提案」で、Plan 013 P013-F00-T04の人間承認待ち。
  - READMEへは未収載であることと人間gateを可視化するため暫定行を追加した。正規収載時はADRを`docs/adr/`へ移し、この擬似Plan行の扱いをownerが整理すべき。

## 横断サマリ: 次にやるべき残作業

1. **Trust bootstrap gate**: Plan 011 F00-T01の人間入力を確定し、Plan 010 F01-T10/T11を再開する。
2. **Plan正本同期**: Plan 012のR15-01〜03を反映し、99/115 task universeの乖離を解消する。
3. **独立に進められるP1決定**: Plan 013 F00でADR-0018を正規収載しowner承認を得る。Plan 010/012と同じweb filesの実装は並行させない。
4. **Identity/data gate**: Plan 010 F02を完了しPlan 002を受入。
5. **Approval/M365 gate**: Plan 010 F03/F04を完了しPlan 005を受入。
6. **Runtime/product hardening**: Plans 003/004/006/007を順に閉じる。
7. **Production gate**: Plan 008/Plan 010 F06-F07のAzure、HA、DR、rotation、E2E、human GOを閉じる。

## docs/audit/09 チェックリスト乖離

1. **T-P1-06が未チェックのまま実装済み**  
   `docs/audit/09-remediation-plan.md:765` は未チェックだが、canonical source抽出 `116a997` とcatalog/verifier hardening `e1d0fa3` がorigin/mainへmerge済み。少なくとも「旧仕様原本未提供」「PRなし」は現在事実ではない。
2. **H-04 blockerが解消済みなのに残存**  
   `:729` は旧仕様原本文書提供をblockerにするが、`docs/PrjOps.zip` / `docs/DevOps.zip` と展開物は `116a997` で収載済み。Plan 010/T-P1-06の残件と混同しない。
3. **完了行がdraft stack URLのまま**  
   T-P0-01〜07等は個別draft PRを根拠に `[x]` だが、現mainへの実際の統合点はPR #76 / `61560c3`。履歴ledgerでも最終merge SHAを併記しないとancestor判定に使えない。
4. **T-P0-03は完了と実環境未検証が同居**  
   `:745` は `[x]` だが `:170` はDocker build/runとhealthzを未実施とする。local implementation acceptedとenvironment verification pendingを分離すべき。
5. **T-P0-02のexact version指示が現状と矛盾**  
   ledgerはpnpm 10へ固定するがorigin/mainはpnpm 11.13.0。歴史資料としては保持できるが、現在の実行手順に使えないため冒頭の「非正本」注意を必ず維持する。
6. **詳細checkboxと総覧checkboxの粒度が不一致**  
   例: T-P0-04総覧は `[x]` だが本文のmode/test/共通完了checkboxは未更新。T-P2-06も総覧は`[x]`、本文完了条件は未チェック。総覧だけで受入条件充足を推論できない。

## primary repoのuntracked docs/audit差分

- `docs/audit/05-traceability.md`: origin/main比 `3 insertions / 3 deletions`。local版は旧仕様原本が「repo外で参照不能」という古い説明へ戻っており、`116a997`後の事実と矛盾する。
- `docs/audit/09-remediation-plan.md`: origin/main比 `3 insertions / 11 deletions`。local版は冒頭の「履歴資料・非正本」注意を削除して「これが作業の正本」に戻し、T-P1-06をHUMAN原本待ちへ巻き戻す。
- これらprimary untracked filesは指示どおり変更していない。origin/main版を正とし、local版を上書きに使わないこと。
