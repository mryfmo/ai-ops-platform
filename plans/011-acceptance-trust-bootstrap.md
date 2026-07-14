# Plan 011: 受入証跡の信頼基盤を構築する

> Planned at: `agent/010-phase1-contracts` commit `4dceb333be784084760acd626d759858df546ef4`
> Plan 010 immutable source: commit `bdeb6ace8c64a660f1ca6f6252a81a397e2a82ca`, blob `9fb20ad2e271ba7f7c5ad5d50f48d80ee53d6f81`
> Decision date: 2026-07-14
> Executor: Codex orchestrator

## Status

`BLOCKED — HUMAN/ENV`

- Priority: P0
- Risk: CRITICAL
- Effort: XL（GitHub契約・Organization移管・別人reviewer・workflow実装・攻撃試験）
- Blocks: `P010-F01-T10`、`P010-F01-T11`、Plan 010 Phase 2以降
- Does not replace: Plan 010の86 task universe。Plan 010のimmutable commit/blobは変更しない。

## Goal

Plan 010の受入manifestが、作業者自身のJSON・hash・review自己申告ではgreenにならない信頼基盤を作る。command、独立review、ENV実証、人間承認をGitHub管理の別主体が発行し、repository、target commit、workflow SHA、issuer role、run/deployment、artifact digestを検証できるようにする。

## Scope

含むもの:

- private repositoryを維持したGitHub Organization + Enterprise Cloudへの移管
- `mryfmo`以外のnamed reviewerを含むtwo-person rule
- main ruleset、CODEOWNERS、required checks、private protected Environment
- immutable GitHub OIDC subjectとpinned reusable workflow
- GitHub Artifact Attestationsの生成、online/offline検証、失効手順
- runner/reviewer/environment/governance roleの分離
- Plan 001 DONEの遡及governance receipt
- Plan 010 T10 validatorが消費するtrust policy、schema、fixture、negative matrix

含まないもの:

- repositoryのpublic化
- agentまたは同一workerが生成・保管するprivate signing key
- 自己署名JSON、hashだけのreceipt、ローカルEd25519鍵を真正性の根とすること
- GitHub Enterprise Cloudの契約、請求承認、Organization作成、別人reviewer招待をagentが完了扱いすること
- T10の4 allowed filesを本Planの実装担当が先回りして変更すること

## Current state

2026-07-14にGitHub APIで直接確認した値:

- repository: `mryfmo/ai-ops-platform`
- visibility: `PRIVATE`
- repository ID: `1294672520`
- repository node ID: `R_kgDOTSsiiA`
- owner ID: `11512262`
- default branch: `main`
- environments: 0
- collaborators: `mryfmo` 1名のみ
- `mryfmo` repository permission: admin
- authenticated userのOrganizations: 0
- OIDC customization: `use_default=true`、`use_immutable_subject=false`、prefix `repo:mryfmo/ai-ops-platform`
- main branch protection API: HTTP 403、GitHub Proへのupgradeまたはpublic化を要求

再確認コマンド:

```bash
gh repo view mryfmo/ai-ops-platform --json visibility,nameWithOwner,defaultBranchRef
gh api repos/mryfmo/ai-ops-platform
gh api repos/mryfmo/ai-ops-platform/environments
gh api repos/mryfmo/ai-ops-platform/collaborators
gh api user/orgs
gh api repos/mryfmo/ai-ops-platform/actions/oidc/customization/sub
gh api repos/mryfmo/ai-ops-platform/branches/main/protection
```

## Official basis

確認日はいずれも2026-07-14。

- GitHub Artifact Attestations: private/internal repositoryはGitHub Enterprise Cloudが必要。
  - https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
- Artifact Attestations offline verification:
  - https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline
- reusable workflowとSLSA provenance:
  - https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/increase-security-rating
- GitHub OIDC claimsとsubject customization:
  - https://docs.github.com/en/actions/reference/security/oidc
  - https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows
- private repositoryのEnvironment required reviewersはFree/Pro/Teamでは利用不可。Enterpriseが必要。
  - https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- protected branchesはprivate repositoryでPro/Team/Enterpriseが必要。
  - https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

## Decision

### 採用: A — private + Organization + GitHub Enterprise Cloud

GitHub native Artifact Attestations、private protected Environmentのrequired reviewer、prevent self-review、main ruleset、immutable OIDC subjectを一つの管理境界で使う。repositoryはOrganizationへ移管し、`mryfmo`以外の人間reviewerを最低1名登録する。

採用理由:

- GitHubがworkflow identity、commit、repository、environment、attestation signingを管理する。
- workerにprivate signing keyを渡さずに済む。
- private repositoryを公開しない。
- requesterとapproverをGitHub側で分離できる。
- `gh attestation verify`とbundleでonline/offline双方を検証できる。

### 不採用: B — private + GitHub Pro + 外部Sigstore keyless

技術的代替として残すが第一推奨にはしない。private Environmentのrequired reviewerが不足し、外部Fulcio/Rekorへの依存、certificate identityやrepository情報の露出評価、別の可用性・保持・失効運用が増える。Enterprise Cloudを採用できない場合だけ新しい仕様決定として再評価する。

### 不採用: C — repositoryをpublic化

Freeでも保護機能とnative attestationを利用できる可能性はあるが、privateを維持する要件、設計資料、運用情報、将来のtenant情報の機密性を壊す。公開前の全履歴secret/PII/IP reviewも別工程になるため採用しない。

### 却下: D — repository内Ed25519鍵

workerが鍵生成、公開鍵正本、receiptを同時に変更できるため「署名付き自己申告」にしかならない。test fixture用鍵はnegative testにだけ使用し、production trust rootにしない。

### 却下: E — JSON + SHA-256

内容整合性は確認できてもissuer真正性を証明できない。既存T10候補に対し、同じworkerがfake command/review/environment receiptとhashを作りvalidatorをgreenにできる攻撃が再現済み。

## Assumptions

- Organization slug、Enterprise契約、請求owner、別人reviewerは未提供のENV入力であり推測しない。
- repository移管後はrepository IDが維持されるかをAPIで再取得し、値が変われば新値をtrust policyへ固定する。
- workflowはGitHub-hosted runnerで実行する。self-hosted runnerは別のtrust decisionなしに使わない。
- acceptance producerは対象commitをcheckoutし、自身でcommandを実行してartifactを生成する。caller提供の「成功済みlog」をそのままattestしない。
- requester `mryfmo` は移管後にrepository admin、ruleset管理、Environment管理、Organization owner権限を持たない。通常開発に必要なwrite以下へ下げる。
- Enterprise/Organization policy adminはrequesterおよびacceptance reviewerと異なるnamed humanとし、最低2名でrotationできるようにする。
- workflowとtrust policyを変更するPRにはCODEOWNERS approvalと最新pushの別人approvalを必須にする。
- T10 validatorはPlan 010 original commit/blobから86 taskを抽出し続け、本Planを87件目として混ぜない。

## Trust model

役割と発行物:

| Role        | 発行主体                                | 発行物                              | workerによる代替 |
| ----------- | --------------------------------------- | ----------------------------------- | ---------------- |
| runner      | pinned GitHub Actions workflow          | command/result/artifact attestation | 不可             |
| reviewer    | 別人PR review + protected Environment   | review/deployment approval receipt  | 不可             |
| environment | protected Environment job               | sandbox/staging correlation receipt | 不可             |
| governance  | CODEOWNER/owner workflow                | Plan/GO/retrospective receipt       | 不可             |
| verifier    | T10 validator + `gh attestation verify` | policy判定                          | receipt発行不可  |

### 権威claimとpredicate

検証値を次の3層へ分離する。

1. **verified envelope/certificate claim**: GitHub/Sigstore検証結果から取得する `iss`、`aud`、repository/owner ID、actor ID、ref、workflow ref/SHA、`job_workflow_ref`、`job_workflow_sha`、subject digest。caller inputやcheckout済みfileから生成しない。
2. **GitHub API readback**: run ID/attempt、PR head SHA、review ID/actor/state/submitted_at、deployment ID/environment/state/approver、ruleset/Environment/OIDC config、Enterprise audit log。
3. **custom predicate**: task、command、exit code、artifact digest等。1と2の同名値へcross-checkし、不一致を拒否する。署名されていることだけで権威claim扱いしない。

各receiptは少なくとも次をbindする:

```text
schema_version
bootstrap_epoch
policy_epoch
acceptance_request_id
receipt_nonce
attestation_id
task_id
role
repository_id
repository_owner_id
target_commit
workflow_ref
workflow_sha
run_id
run_attempt
environment
deployment_id
review_id
requester_id
approver_id
command
exit_code
artifact_digest
issued_at
not_before
expires_at
predicate_type
```

不要なfieldは欠落させず明示的`null`とし、task type別schemaがnull可否を決める。

`bootstrap_epoch`はrepository/owner IDs、ruleset ID+config digest、Environment config digest、OIDC config digest、reviewer/policy-admin IDs、workflow SHAs、policy SHAを含む。別人policy adminが承認し、全receiptへbindする。発行前後にEnterprise audit logを読み、未承認のsettings変更が1件でもあればacceptanceをfreezeしてepochを更新する。

`policy_epoch`は単調増加とし、`not_before`、`expires_at`、revoked workflow SHA、attestation digest、失効時刻、最新許容offline時刻を持つ。offline検証は暗号学的真正性だけでは完了とせず、24時間以内に更新されたgovernance署名済みpolicy/revocation bundleを併用する。stale bundleはSTOPする。

`acceptance_request_id`とnonceはgovernance workflowが生成し、task ID、PR head SHA、run attempt、review/deployment IDsへbindする。requesterはverified OIDC `actor_id`とGitHub APIのdeployment creatorが一致するidentity、approverはapproval時点でreviewer team memberである別identityとする。serialized governance workflowがGitHub Attestations APIの既存governance subjectを照会してone-time consumptionを登録し、duplicate nonce、旧attempt、latest push以前のapproval、別taskへのreplayを拒否する。

## Phase 0: HUMAN契約・移管ゲート

全taskのredacted API readbackは `.orchestration/evidence/<task-id>/readback.json`、command/exitは同directoryの `commands.json`、attestation bundle digestとGitHub URLは `evidence.json` に保存する。これは作業証跡でありissuer真正性の根ではない。Complete判定はGitHub verified envelope、API readback、audit log、別人approvalを使う。

#### P011-F00-T01 Enterprise移管decision recordを確定する

- Preconditions: 本Planがreview済み。
- Allowed files: `docs/decisions/acceptance-trust-bootstrap.md`
- Work: Organization slug、Enterprise Cloud契約owner、請求承認、移管日時、rollback window、named reviewer、requesterと異なるpolicy admin 2名、Apps/Secrets/Actions/Pages/Packages影響ownerを記録する。
- Complete: 全required fieldが非nullで、人間decision maker、2名のpolicy admin、別人reviewerのGitHub IDと決定日時があり、3 roleがrequesterと一致しない。
- Verify: repository ownerが内容をreviewし、別人reviewer候補がGitHub account所有を確認する。
- Negative: agent名、架空account、後日入力予定、self-approvalを受理しない。
- STOP: 契約費用、移管先、別人reviewerのいずれかが未確定。
- Evidence: GitHub issue/PR URLとattestation導入前のhuman decision record。

#### P011-F00-T02 OrganizationとEnterprise Cloudを用意する

- Preconditions: P011-F00-T01 decision receipt digestが存在する。
- Allowed files: なし。GitHub billing/Organization settingsのみ。
- Work: Organization作成または既存Organization指定、Enterprise Cloud有効化、billing owner、2名のpolicy admin、security managerを設定する。requesterをOrganization ownerにしない。
- Complete: API/UI readbackがEnterprise機能を示し、private Artifact Attestationsとprivate Environment required reviewersを利用でき、policy admin IDsがT01 recordと一致する。
- Verify: test private repositoryでattestation生成とrequired reviewer待機を実証する。
- Negative: Pro/Team、trial期限不明、public testだけの結果を受理しない。
- STOP: 課金承認またはEnterprise entitlementがない。
- Evidence: secretを含まない契約tier readback、test run URL、environment deployment URL。

#### P011-F00-T03 別人reviewerを登録する

- Preconditions: P011-F00-T02 entitlement receipt digestが存在する。
- Allowed files: なし。Organization membership/team settingsのみ。
- Work: `mryfmo`以外の人間をreviewer teamへ招待し、read以上の必要最小権限を与える。`mryfmo`はrepository write以下とし、Organization owner、repository admin、ruleset/Environment管理roleを与えない。
- Complete: team membership readbackに2名以上、reviewerはbot/agent/service accountでなく、requester permission readbackにadminがない。
- Verify: requester tokenによるruleset/Environment変更がHTTP 403になり、`mryfmo`起動runは`mryfmo`自身がapproveできず、別人reviewerだけがapproveできる。
- Negative: alternate personal account、共有account、token所有者不明を受理しない。
- STOP: 別人reviewerが参加・責任受諾していない。
- Evidence: member/team ID、role readback、prevent-self-review negative run URL。

#### P011-F00-T04 repositoryをOrganizationへ移管する

- Preconditions: P011-F00-T03 membership/permission receipt digestが存在し、maintenance window承認済み。
- Allowed files: なし。GitHub repository transferと外部integration settingsのみ。
- Work: privateを維持して移管し、remote URL、GitHub App installations、Actions secrets/variables、webhooks、Pages、Packages、branch/default settingsをinventoryと突合する。transfer cutover timestampとpre/post repository/owner IDsを固定する。
- Complete: clone/fetch、Actions、App auth、webhook deliveryが新ownerでgreen。旧URL redirectだけに依存しない。
- Verify: repository ID/node ID/owner ID/nameWithOwner/default branch/visibilityをAPI再取得し、before/after表とrollback判断を記録する。
- Negative: visibility public化、secret値の証跡出力、installation欠落、cutover後の旧owner/repository name subject・receipt・workflowをfailにする。
- STOP: transferによるID/installation/permission変化を復旧できない。
- Evidence: before/after metadata、integration smoke run、rollback decision。

## Phase 1: GitHub信頼境界

#### P011-F01-T01 main rulesetとCODEOWNERSを強制する

- Preconditions: P011-F00-T04 transfer receipt digestとpost-transfer IDsが存在する。
- Allowed files: `.github/CODEOWNERS`、`docs/security/acceptance-trust-policy.md`
- Work: policy adminがmainへのPR必須、required workflow/check、CODEOWNER review、dismiss stale approvals、latest pushの別人approval、conversation resolution、force push/delete禁止、bypass actorなしを設定する。required checkはnameだけでなく期待GitHub App ID、workflow path、workflow SHAをbootstrap policyへbindする。
- Complete: ruleset API readbackが全条件と一致し、workflow/trust policy pathのownerがreviewer teamで、requesterにruleset編集権限がない。
- Verify: direct push、未review PR、stale review、failing check、requester settings変更を拒否し、同名checkを別workflowから発行してもverified `job_workflow_sha`不一致でacceptanceを拒否する。
- Negative: ruleset JSONをrepositoryへ置いただけ、UI screenshotだけ、bypass actor有効、check nameだけの判定を受理しない。
- STOP: Organization policyがadmin bypass禁止を許さない。
- Evidence: ruleset ID/readback、各negative operationのHTTP status。

#### P011-F01-T02 protected acceptance Environmentを作る

- Preconditions: P011-F01-T01 ruleset receipt digestが存在する。
- Allowed files: `docs/security/acceptance-trust-policy.md`
- Work: policy adminが `acceptance` Environmentにreviewer team、prevent self-review、admin bypass禁止、protected mainのみを設定する。secretは置かない。
- Complete: API readbackがreviewer IDs、deployment branch policy、protection rulesを一致させ、requesterにEnvironment管理権限がない。
- Verify: requester self-approval拒否、別人approval前job停止、approval後だけjob開始を実証する。
- Negative: reviewerなしEnvironment、repository secretでの代用、任意branch deployをfailにする。
- STOP: private required reviewersが利用できない、または別人reviewer不在。
- Evidence: environment readback、pending/rejected/approved deployment IDs。

#### P011-F01-T03 immutable OIDC subjectを設定する

- Preconditions: P011-F01-T02 Environment receipt digestが存在する。
- Allowed files: `docs/security/acceptance-trust-policy.md`
- Work: policy adminがowner/repository ID、context、`job_workflow_ref`、`job_workflow_sha`を含むimmutable subjectへ変更し、旧default subjectを廃止する。これはtoken発行制御ではなくclaim固定であるとpolicyに明記する。
- Complete: API readbackが`use_default=false`、`use_immutable_subject=true`と承認済みclaim keysを示す。
- Verify: fork/別workflow/別environmentもtokenを取得し得る前提で、そのattestationをverified claim不一致としてverifierがexit 1にする。正規workflow claimだけを受理する。
- Negative: repository名だけ、branch名だけ、mutable tagだけのsubjectを受理しない。
- STOP: GitHubが選択claimを発行しない、または移管後IDsが未固定。
- Evidence: customization readback、allow/deny OIDC claim summaries。生tokenは保存しない。

#### P011-F01-T04 bootstrap candidateを作成する

- Preconditions: P011-F01-T01、P011-F01-T02、P011-F01-T03のreceipt digestがすべて存在する。
- Allowed files: `docs/security/acceptance-trust-policy.md`、`verification/policy/acceptance-bootstrap.json`
- Work: policy adminがrepository/owner IDs、ruleset/App identity、Environment/reviewer IDs、OIDC config digest、cutover timestamp、旧owner deny、requester permission、予定workflow path/roleをcanonical candidateへ固定する。未作成workflow SHAとepoch attestationは明示的nullにする。
- Complete: candidate digestを2名のpolicy adminがGitHub decision recordで承認し、requester tokenのsettings変更attemptがHTTP 403。作成前後のEnterprise audit logに未承認設定変更0件。まだ`bootstrap_epoch`またはattestedとは呼ばない。
- Verify: `gh api` readbackをcanonical JSONとfield単位で比較し、1 field改変、旧owner ID、requester admin復元、未承認audit eventをそれぞれfailにする。
- Negative: requester自己承認、同一policy adminの作成+承認、UI screenshotだけ、audit log未取得を受理しない。
- STOP: API config、audit log、permissionのいずれかがcanonical epochと不一致。
- Evidence: `.orchestration/evidence/P011-F01-T04/{readback,commands,evidence}.json`、2名のpolicy admin decision URLs。attestation bundleはこのtaskでは存在しない。

## Phase 2: contract・producer・verifier実装

#### P011-F02-T01 trust policyとschema interfaceを先に固定する

- Preconditions: P011-F01-T04 bootstrap candidate digestと2名のpolicy admin decision URLsが存在する。
- Allowed files: `docs/security/acceptance-trust-policy.md`、`verification/schemas/acceptance-receipt.schema.json`、`verification/schemas/acceptance-policy.schema.json`、`verification/fixtures/acceptance-trust/contract/**`
- Work: verified envelope claim、API readback、custom predicateを別objectにし、cross-check、bootstrap/policy epoch、nonce、expiry、one-time consumption、role別required/null fieldをstrict schemaへ固定する。
- Complete: schema SHAとpolicy SHAが別人security reviewを受け、producerが任意fieldやissuerを追加できない。Plan 010 T10 workerはこのfilesetを変更できない。
- Verify: valid contract fixtureとunknown/extra/missing/null/wrong provenance/epoch rollback fixturesを独立JSON Schema validatorとNode parserの双方で判定する。
- Negative: custom predicateだけでrepository/workflow/actor identityを満たすfixture、self-signed key、hash-only JSONをfailにする。
- STOP: field provenance、expiry上限、offline freshness、revocation authorityのいずれかが未決定。
- Evidence: `.orchestration/evidence/P011-F02-T01/**`、policy/schema blob SHA、independent review URL。

#### P011-F02-T02 runner reusable workflowを実装する

- Preconditions: P011-F02-T01 policy/schema receipt digestが存在する。
- Allowed files: `.github/workflows/acceptance-runner.yml`
- Work: T01とは別worker/commitで、target SHAをcheckoutし、allowlisted commandを自身で実行し、result artifactをattestする。callerは `<org>/ai-ops-platform/.github/workflows/acceptance-runner.yml@<40hex>` だけを許可する。bootstrap modeの出力はcandidate digestへbindしてnon-consumableとし、通常receiptはF02-T05完了まで拒否する。
- Complete:最小permissions、GitHub-hosted runner、SHA-pinned actions、concurrency、timeout、nonzero fail、artifact no-overwriteがある。relative call、branch/tag ref、caller成功logを受け付けず、final bootstrap epoch前に通常acceptanceを発行しない。
- Verify: actionlint、permissions inspection、正規command、nonzero、wrong target、mutable caller ref、artifact substitution、same-path/different-SHA signer。
- Negative: `pull_request_target`でuntrusted code実行、write-all、self-hosted runner、caller提供exit codeをfailにする。
- STOP: Enterprise private attestationまたはpinned reusable workflow claimをverified bundleから取得できない。
- Evidence: `.orchestration/evidence/P011-F02-T02/**`、workflow blob SHA、run URL、bundle digest、別人review receipt。

#### P011-F02-T03 reviewer reusable workflowを実装する

- Preconditions: P011-F02-T02 merge SHAとreview receipt digestが存在する。
- Allowed files: `.github/workflows/acceptance-review.yml`
- Work: T01/T02と異なるworker/commitで、PR head SHA、latest push、review ID/actor/state、Environment deployment/approverをGitHub APIから取得し、requester≠approverをattestする。bootstrap modeはcandidate digestへbindしてnon-consumable、通常modeはfinal bootstrap epoch一致を必須にする。
- Complete: fully-qualified `@<40hex>` callerのみ、latest push後の別人approvalとapproved deploymentだけを受理し、final bootstrap epoch前に通常review receiptを発行しない。
- Verify: self-review、stale approval、dismissed review、wrong head、old run attempt、wrong environment、same-name workflow spoofをfailにする。
- Negative: review JSONのcaller input、comment、agent self-review、UI screenshotをauthorityにしない。
- STOP: reviewer actorまたはdeployment approvalをGitHub APIで一意にcorrelateできない。
- Evidence: `.orchestration/evidence/P011-F02-T03/**`、workflow blob SHA、review/deployment IDs、bundle digest、別人review receipt。

#### P011-F02-T04 governance reusable workflowとconsumption ledgerを実装する

- Preconditions: P011-F02-T03 merge SHAとreview receipt digestが存在する。
- Allowed files: `.github/workflows/acceptance-governance.yml`、`verification/policy/acceptance-revocations.json`、`verification/schemas/acceptance-consumption.schema.json`
- Work: T01-T03と異なるworker/commitで、serialized concurrency下でrequest ID/nonceを生成し、GitHub Attestations APIで同じgovernance subjectが未発行であること、policy epoch、revocation/freshness、audit logを確認してone-time governance artifactをattestする。bootstrap modeではF01-T04 candidate digestとcurrent API readbackだけを入力にし、通常acceptance/consumptionはF02-T05完了まで拒否する。repository fileを消費状態の正本にしない。
- Complete: duplicate nonce/attestation ID、旧attempt、旧policy epoch、revoked workflow/digest、24時間超のoffline bundle、未承認settings audit eventをfailにする。
- Verify: 20 concurrent requestで1件だけconsume、replay、epoch rollback、revocation直後、stale offline、cutover前owner receiptをfailにする。
- Negative: ledgerをcaller checkoutから読み書きして成功扱い、force update、期限なし例外を禁止する。
- STOP: consumptionをatomic/serializedにできない、またはEnterprise audit logを取得できない。
- Evidence: `.orchestration/evidence/P011-F02-T04/**`、workflow blob SHA、concurrency run IDs、governance bundle、別人review receipt。

#### P011-F02-T05 最終bootstrap epochを発行する

- Preconditions: P011-F01-T04 candidate digestと、P011-F02-T01からP011-F02-T04の各merge SHA、workflow blob SHA、別人review receipt digestが揃う。
- Allowed files: `docs/security/acceptance-trust-policy.md`、`verification/policy/acceptance-bootstrap.json`
- Work: candidateのnull workflow SHAを実merge SHAで埋め、policy/schema SHA、App/integration ID、reviewer/policy-admin IDs、current API config digest、audit-log cutoffをcanonicalizeする。policy admin Aが作成し、policy admin Bがprotected Environment経由のfully-qualified governance workflow `@<40hex>` で承認・attestする。
- Complete: `bootstrap_epoch=1`のverified governance bundleがあり、candidate digestと全current readbackをbindする。requesterは作成、承認、settings変更のいずれも実行できない。
- Verify: verified envelopeのgovernance workflow path/SHA、approver、Environment、repository/owner IDsをAPIとcross-checkし、candidate改変、wrong SHA、self-approval、発行前後の未承認audit eventをfailにする。
- Negative: unsigned candidateをepochとして受理、governance workflow自身のSHA自己申告、同一policy adminの作成+承認、workflow merge前発行を禁止する。
- STOP: merge SHA、API config、audit log、2名のpolicy admin approvalのいずれかが欠落または不一致。
- Evidence: `.orchestration/evidence/P011-F02-T05/**`、final bootstrap JSON/blob SHA、governance bundle、approval/deployment URLs。

#### P011-F02-T06 verifier adapterを別workerが実装する

- Preconditions: P011-F02-T05 final bootstrap epoch bundle digestが存在する。
- Allowed files: `scripts/verify-acceptance-attestation.mjs`、`tests/verify-acceptance-attestation.test.mjs`、`package.json`
- Work: producerを実装していない別workerが、`gh attestation verify --format json`のverified envelope、GitHub API readback、custom predicateを分離してcross-checkする。`--signer-workflow` pathに加えverified `job_workflow_sha`を40hex policy値へ照合する。
- Complete: issuer/pathが正しくてもSHAが違えばexit 1。online final acceptanceを必須とし、offlineはfresh governance policy/revocation bundleが24時間以内の場合だけ判定可能。
- Verify: Node tests、online正規bundle、network遮断offline+fresh policy、tampered/foreign/stale/revoked/replayed bundle、wrong envelope/predicate cross-check。
- Negative: `.git/**`、repo外、manifest/artifact symlink、realpath escape、同一inode overwrite、package alias/wrapper自己検証をfailにする。
- STOP: verified outputから必要claimを抽出できない、またはGitHub API readbackとcorrelateできない。
- Evidence: `.orchestration/evidence/P011-F02-T06/**`、test log、verifier blob SHA、positive/negative bundle digest、独立review URL。

#### P011-F02-T07 rotation・revocation・incident runbookを実装する

- Preconditions: P011-F02-T06 ACCEPT receipt digestが存在する。
- Allowed files: `runbooks/acceptance-trust-rotation.md`
- Work: workflow変更、compromise、reviewer離任、Organization transfer、GitHub outage、trusted root更新時のpolicy epoch増加、revocation、receipt再検証、acceptance freezeを定義する。
- Complete: old workflow SHA/digest deny、new SHA allow、`not_before/expires_at`、最大offline 24時間、emergency freeze、RACI、audit log queryが一意。revoked SHAへrollbackしない。
- Verify: tabletopでcompromised workflow SHAをrevokeし、online/offline双方で拒否、stale revocation bundleでSTOP、過去receipt inventoryの再判定を確認する。
- Negative: repository内private key rotation、削除だけで履歴消去、epoch減少、期限なし例外を禁止する。
- STOP: revoke authority、policy admin、incident ownerのいずれかが不明。
- Evidence: `.orchestration/evidence/P011-F02-T07/**`、tabletop log、before/after policy SHA、revoked fixture。

## Phase 3: 遡及証跡・攻撃試験・引渡し

#### P011-F03-T01 Plan 001 retrospective governance receiptを発行する

- Preconditions: P011-F02-T07 receipt digestと最新policy epochが存在する。
- Allowed files: `docs/verification/acceptance/001.md`
- Work: Plan 001 DONE commit `6a6c1aaba279045268029f36c0b9f548df15b063`、README blob `8a93e5aa1165d7497e7fe95fd08dc978810e058e`、既存PostgreSQL/CI/review evidenceを現在再検証し、`retrospective_revalidation`として別人governance approval後にattestする。
- Complete: `git cat-file -e`と`git ls-tree`で両objectが一致し、historical claimと現在再実行したcommandを区別し、missing evidenceを推測で埋めない。
- Verify: clean checkout CI、PostgreSQL checks、artifact digests、governance workflow、offline verification。
- Negative: commit/READMEのDONE表示だけ、agent自己review、現在の別commit結果の流用をfailにする。
- STOP: required historical evidenceが復元不能ならPlan 001 acceptanceをBLOCKEDへ戻す。
- Evidence: `.orchestration/evidence/P011-F03-T01/**`、acceptance document、governance bundle、run/deployment URLs。

#### P011-F03-T02 adversarial acceptance matrixを実証する

- Preconditions: P011-F03-T01 governance receipt digestが存在する。
- Allowed files: `tests/verify-acceptance-attestation.test.mjs`、`verification/fixtures/acceptance-trust/**`
- Work: self-mint、replay、wrong role/issuer/workflow path/workflow SHA/repository/target、requester=self approver、requester settings mutation、stale approval、old attempt、nonzero command、artifact replacement、`.git` path、symlink、manifest symlink、package alias/wrapper self-validation、offline stale/revoked/tamperを実装する。
- Complete: 正規fixtureだけexit 0、全negative fixtureがそれぞれ固有理由でexit 1。
- Verify: isolated temp repositoryと実GitHub negative runsの両方を使い、testがvalidator内部定数を期待値として共有しない。
- Negative: mockだけ、同じgeneratorでexpectedとactualを作る、未実行skipをgreenにしない。
- STOP: workerが正規receiptを自力生成できる攻撃が1件でも成功。
- Evidence: `.orchestration/evidence/P011-F03-T02/**`、test log、negative run URLs、fixture SHA一覧。

#### P011-F03-T03 T10へtrust contractを引き渡す

- Preconditions: P011-F03-T02 independent security ACCEPT receipt digestが存在する。
- Allowed files: `docs/security/acceptance-trust-policy.md`、本Planのstatus/checkboxのみ
- Work: T10 task packetにverifier command、policy SHA、allowed predicate/workflow SHA、Plan 001 receipt、positive/negative fixtures、offline fallbackを固定する。T10の4 filesはT10 workerが別commitで変更する。
- Complete: T10 workerがissuer追加、policy緩和、workflow変更、self-signed fixture生成をできない。
- Verify: clean cloneでT10 candidateを除いたtrust bootstrap CIとattestation verificationがgreen。独立security reviewがACCEPT。
- Negative: T10とtrust bootstrapを同一commit/worker/reviewで閉じない。
- STOP: reviewerとworkerが同一identity、またはpolicy/workflow SHAがmain未merge。
- Evidence: `.orchestration/evidence/P011-F03-T03/**`、main merge SHA、policy/workflow blob SHA、independent review URL。

## Dependency order

```text
F00-T01 -> F00-T02 -> F00-T03 -> F00-T04
        -> F01-T01 -> F01-T02 -> F01-T03 -> F01-T04
        -> F02-T01 -> F02-T02 -> F02-T03 -> F02-T04 -> F02-T05 -> F02-T06 -> F02-T07
        -> F03-T01 -> F03-T02 -> F03-T03
        -> P010-F01-T10 revision
```

並列化しない。各taskは前taskのexternal readbackを入力にする。

## Safety regression invariants

- repository visibilityは常にprivate。
- main direct push、force push、delete、admin bypassは常に拒否。
- requesterは自身のacceptance deploymentをapproveできない。
- requesterはruleset、Environment、OIDC、repository admin設定を変更できない。
- workerはreceipt issuer、workflow、trust policy、validatorを同時に支配しない。
- verified envelope/API由来claimとcustom predicateを同一のauthorityとして扱わない。
- raw OIDC token、credential、email、氏名、tenant payloadをartifact/commit/logへ保存しない。
- attestationはtarget commitとartifact digestを同時にbindする。
- workflowはuntrusted PR codeへwrite tokenを渡さない。
- reusable workflow callerはfully-qualified path + 40hex SHAだけを許可する。
- offline判定はfresh policy/revocation bundleなしに完了しない。
- cleanup failure、skipped test、missing adapter、network fallbackはgreenにしない。

## Tests

最終検証:

```bash
pnpm run acceptance:trust:test
gh attestation verify <artifact> --repo <org>/ai-ops-platform --signer-workflow <pinned-workflow>
gh attestation verify <artifact> --bundle <bundle> --custom-trusted-root <trusted-root>
mise run ci
git diff --check
```

GitHub実証:

- main direct push拒否
- PR approvalなしmerge拒否
- latest push後のstale approval拒否
- requester self-approval拒否
- 別人approval前のEnvironment job停止
- wrong workflow/repository/owner/environment OIDC拒否
- wrong workflowはtoken/attestationを取得し得るがverified claim不一致でacceptance拒否
- same workflow path/different SHA拒否
- nonzero commandのattestation acceptance拒否
- revoked workflow SHA拒否
- offline tampered bundle拒否
- stale policy/revocation bundle拒否
- requester ruleset/Environment変更HTTP 403

## Rollback

- 移管前: 変更しない。
- 移管中障害: maintenance window内に旧ownerへ戻せるかGitHubのtransfer制約を確認し、不可なら新ownerでintegrationを復旧する。旧URL redirectだけを成功条件にしない。
- ruleset/workflow障害: acceptanceをfreezeし、保護を外して進めない。承認済みrollback PRで直前のpinned workflow/policyへ戻す。
- attestation障害: acceptanceをBLOCKEDにし、hash-only receiptへ降格しない。
- reviewer不在:代替named reviewerを同じtwo-person手順で登録するまで停止する。

## Done Criteria

- [ ] Enterprise Cloud Organizationと請求ownerが確定している。
- [ ] repositoryがprivateのままOrganizationへ移管済み。
- [ ] `mryfmo`以外のnamed human reviewerが参加済み。
- [ ] `mryfmo`はwrite以下で、Organization owner/repository admin/ruleset/Environment管理権限を持たない。
- [ ] requesterと異なるpolicy admin 2名が登録済み。
- [ ] main ruleset、CODEOWNERS、required checks、admin bypass禁止がAPI readbackと一致。
- [ ] private `acceptance` Environmentでrequired reviewer、prevent self-review、bypass禁止が有効。
- [ ] OIDC subjectがimmutable IDs、environment、workflow ref/SHAをbindする。
- [ ] governance署名済みbootstrap epochと単調増加policy epochがある。
- [ ] 3 role workflowがmainへ別人review付きでmerge済み。
- [ ] 3 role workflowは別task・別worker・別commitで、fully-qualified 40hex callerだけを許可する。
- [ ] online/offline attestation verificationがgreen。
- [ ] rotation/revocation tabletopがgreen。
- [ ] one-time consumption、replay、stale offline bundleのnegative testsがgreen。
- [ ] Plan 001 retrospective receiptが別人承認とattestationを持つ。
- [ ] self-mintを含む全negative matrixが固有理由でfailする。
- [ ] `mise run ci`がclean checkoutでgreen。
- [ ] independent security reviewがACCEPT。
- [ ] T10 handoff policy/workflow SHAがimmutableに固定されている。

## Maintenance

- workflow/action更新は月次、GitHub trusted root/CLI更新は四半期、reviewer membershipは月次で確認する。
- GitHubのplan availability変更時は公式Docsと実APIの両方を再確認する。
- workflow SHA rotation後はtrust policyとoffline bundle手順を同じPRで更新する。
- bootstrap設定変更はacceptanceをfreezeし、Enterprise audit log review後にbootstrap epochを増加させる。
- expired/revoked receiptは削除せず、判定不能または失効として履歴を保持する。
- Organization/repository transfer時は全receiptをrepository IDとowner IDで再評価する。

## Open Questions

仕様選択はAに固定済み。次は推測できないHUMAN/ENV入力:

- Enterprise Cloud Organization slug
- billing/contract ownerと承認記録
- repository移管maintenance window
- `mryfmo`以外のnamed reviewer GitHub login
- Organization security manager
- GitHub App installationとsecret migration owner
- GitHubのprivate attestation retention/export方針に対する組織要件

未提供時の報告形式:

```text
blocked_task_id
missing_value
safe_completed_work
exact_human_owner
resume_command
```

## Plan quality self-audit

- [x] Goal、Scope、Status、Assumptions、Decision、Tests、Done Criteria、Open Questionsがある。
- [x] 実API値と公式source URLを記録した。
- [x] 各taskにPreconditions、Allowed files、Work、Complete、Verify、Negative、STOP、Evidenceがある。
- [x] HUMAN/ENV taskをagent完了として扱わない。
- [x] positive、adversarial、rollback、maintenance、safety invariantsがある。
- [x] Plan 010のimmutable 86 task universeを変更しない。
- [x] T10実装前にtrust bootstrapを独立mergeする。
- [x] 自動validator/Make/hook/subagent/CI entryが当repositoryに存在しないため、独立manual reviewが必要であることを明示した。
