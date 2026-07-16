# Plan 012: 自然言語GitHub操作と議事録同期を承認付きで安全に稼働させる

> **Executor instructions**: このPlanは、Teams・Claude Code・Droidからの自然言語操作、Outlook/Teams議事録からの更新提案、Project picker/Kanban、AIコーディングPRを一つの運用として閉じる。各taskを番号順とDAGどおりに実行し、各Verifyの期待結果を保存してから次へ進む。要約だけで受理せず、diff、変更ファイル全文、テスト、外部証跡をorchestratorが直接読む。STOP条件に該当したら変更を追加せず、task ID・観測値・不足入力を報告する。完了時は`plans/README.md`のPlan 012行だけを更新する。
>
> **Drift check (run first)**: `git diff --stat 5d48752..HEAD -- .mise.toml package.json pnpm-lock.yaml pnpm-workspace.yaml packages/*/package.json packages/shared/src/clients packages/prjops/src/lib packages/prjops/src/agents packages/server/src packages/devops/src/db packages/web/src .github .agents/skills .claude .factory .codex docs runbooks plans/006-agent-report-workflows.md plans/010-recommended-spec-environment-execution.md plans/011-acceptance-trust-bootstrap.md`。差分が1件でもあれば、下記Current stateの該当箇所を現HEADで再計測する。symbol、route、schema、既存Plan task IDが一致しなければ実装せずPlan改訂へ戻す。tool version、package manager、manifest、lockfileに差分があればCommandsとCI compatibilityも再検証し、Plan改訂の独立reviewが終わるまでSTOPする。

## Status

- **Priority**: P0
- **Effort**: XL
- **Risk**: HIGH — LLM誤分類、権限昇格、別project更新、二重副作用、議事録PII、外部API partial failureを同時に扱う。
- **Depends on**: Plan 010の`P010-F02-T09..T14`（stable identity、picker、complete ProjectV2 snapshot、read-only board）、`P010-F03-T01..T08`（承認境界）、`P010-F04-T01..T08`（Graph sandbox）、`P010-F05-T10..T14`（coding workflow）；外部受入はPlan 011のtrust bootstrapにも依存する。
- **Category**: security / correctness / direction / integration / operations
- **Planned at**: commit `5d48752`, 2026-07-15
- **Wireframe/抽出**: N/A — 新規画面設計ではなく、既存Teams/Outlook/agent/Web Kanban surfaceの運用・承認境界を扱う。
- **Official references checked**: 2026-07-15。GitHub REST/GraphQL/Actions/CLI、Microsoft Graph/Teams SDK/Outlook ImmutableId、AKS/Kubernetes Job、Anthropic commercial retention/ZDR、OpenAI Responses data controls/data residency/GPT-5.6 Sol、Claude Code、Factory Droid、Codex manualを一次資料で確認。

## Plan quality self-audit

- [x] `main@5d48752`の現行実装を直接読み、Current stateへ`file:line`を記録した。
- [x] 初期plan基準と比較し、本PlanはXL scopeに対して99 executable task（5件の非実行gate-group summaryを除外）を持つ。複合だったTeams/AKS/provider/raw/Outlook単位を40 formal atomic taskへ分解し、cutover permission feasibility、publisher break-glass recovery、final target Entra acceptanceを独立追加して各taskのobservable boundaryと敵対oracleを確認した。
- [x] 既存Plan 006/010/011と重複する実装を前提taskとして参照し、新規差分は会話操作・議事録proposal・agent資産に限定した。
- [x] 各taskを一つのobservable boundaryへ限定し、Preconditions、Allowed files、Work、Complete、Positive/Adversarial Verify、STOPを明記した。
- [x] 全write intentはproposalで停止し、Entra認証済み別人承認後だけ副作用を許可する。
- [x] source revision、project/repository/ProjectV2 mapping、expected state、idempotencyを確認時と実行時に再検証する。
- [x] local mockを外部受入として扱わず、Teams/Outlook/GitHub/Claude/Droidのsandbox証跡を別gateにした。
- [x] GitHub Pages、PR merge、main直接push、任意REST/GraphQL/shell、Kanban drag-and-dropを明示的に除外した。
- [x] `plan-quality-gate`のvalidator/hook/subagentは本repositoryに存在しないため、同skillの必須節・独立review checklistを手動適用する。存在しないentry pointを実装完了と偽らない。
- [x] 2026-07-14の初稿は、別contextの`gpt-5.6-sol high` reviewerが初回HIGH 8件、再review HIGH 2件を指摘し、全是正後のcold reviewで`ACCEPT`、CRITICAL/HIGH 0を記録した。2026-07-15に依存更新PR #85/#87/#80/#81統合後の`main@5d48752`へ再baseし、Current stateと一次資料を再検証した。

## Why this matters

現状はTeamsからPR/Issue一覧、Issue作成、確認リンク付きcoding taskまでの骨格がある。しかし自由文Issue作成はLLM解釈後に即時実行され、チャネルのprojectとLLM出力projectを一致確認せず、Claude/Droid workflowは実稼働証跡とcredential分離を持たない。Outlookは送信のみ、AGT-02はproduction callerなし、Project picker/KanbanはPlan 010上の未完taskである。したがって「自然言語で運用できる」と「安全に意図どおり更新できる」はまだ同義ではない。

本Planの推奨仕様は、readは認可後に即時応答、writeは型付きproposalを作成して停止、Entra認証済みの別人が30分以内に一度だけ承認した後に適用、という一つの境界へ統一する。議事録は自動でproposalを作るが、自動でGitHubを書き換えない。承認後の適用、readback、監査、Teams返信までを自動化する。これにより「自動更新」は人間の確認を失わず、LLM誤分類を権限根拠にしない。

ProjectV2 Status更新にはprovider側CAS、version、If-Match相当がなく、事前readとmutationの間の外部更新を安全に防げない。したがって推奨初期scopeでは`project_v2.status.set`を許可せず、Web Kanbanと自然言語board操作はread-only、編集は認可済みGitHub deep linkに固定する。GitHub Projects v2を唯一のworkflow正本とし、第二のKanban DBや独自task state machineは作らない。将来writeを追加するには、provider CAS提供またはownerによるlast-writer risk受容を別ADR/Planで決定する。

## Current state

基準は`main@5d48752`。以下の行番号は同commitで実測した。

基盤versionはNode.js 22、pnpm 11.13.0、Next.js 16、Vite 8へ更新済みである。これらはPlan 012の機能scopeを増やさず、後続executorは`.mise.toml`とlockfileの固定値をそのまま使う。

- `packages/server/src/lib/freeTextIntent.ts:15-35` — 自由文intentは`gh_pr_list`、`gh_issue_list`、`gh_issue_create`、`code_task`、`unknown`のみ。
- `packages/server/src/agents/teamsConversationAgent.ts:139-175` — 実行可能intentも同じ4種に限定される。
- `packages/server/src/agents/teamsConversationAgent.ts:198-200` — source channelから`channel.projectId`を認可対象として解決する。
- `packages/server/src/agents/teamsConversationAgent.ts:240-250` — caller profileは`channel.projectId`に対して解決する。
- `packages/server/src/agents/teamsConversationAgent.ts:331-362` — 自由文LLM結果をproposalなしで`executeIntent`へ渡す。
- `packages/server/src/agents/teamsConversationAgent.ts:401-411` — 自由文由来`gh_issue_create`が確認なしでGitHubへ書き込む。
- `packages/server/src/agents/teamsConversationAgent.ts:431-440` — `code_task`はintent側project IDを台帳へ保存でき、channel projectとの一致検証がない。
- `packages/server/src/http/routes/codingTasks.ts:125-184` — HMAC URL所持者がworkflowをdispatchし、Entra session、CSRF、期限、別人承認、CASがない。
- `packages/server/src/db/codingTasksRepo.ts:114-121` — `markConfirmedAndDispatched`は`WHERE status='queued'`を持たない。
- `packages/server/src/index.ts:158-177` — `createPool(config.DATABASE_URL)`で作る単一poolを全repositoryへ注入している。したがって`channel_messages`だけの接続先切替は不可能で、replacementは全プラットフォームDB単位で行う。
- `packages/shared/src/clients/githubClient.ts:142-163` — Issue/PR共通コメント作成とIssue作成は存在する。
- `packages/shared/src/clients/githubClient.ts:200-248` — ProjectV2 snapshot readはpagination単位で、complete snapshot契約はPlan 010未完。
- `packages/shared/src/clients/githubClient.ts:251-283` — ProjectV2 item追加とfield updateは存在するが、会話承認境界には未接続。
- `packages/shared/src/clients/githubClient.ts:339-405` — PR/Issue readは存在するが、Issue PATCH/close/reopen APIはない。
- `packages/shared/src/clients/graphClient.ts:350-369` — Outlook操作は`sendMail`だけで、mail receive/delta/get messageはない。
- `packages/shared/src/clients/graphClient.ts:371-572` — Teams channel subscription、delta、reply listは存在する。
- `packages/server/src/http/routes/graphNotifications.ts:89-97` — Graph webhookはbody limitとtop-level runtime schemaを持たずにJSONを読む。
- `packages/server/src/http/routes/graphNotifications.ts:51-78` — lifecycle通知は耐久queueへ入れず、未await background Promiseで処理する。
- `packages/server/src/scheduler/tasks/channelPollingTask.ts:257-276` — delta backfillはroot messageを保存するがthread repliesを完全補完しない。
- `packages/devops/src/db/schema.sql:371-384` — `channel_messages`は現在値1行のみで、proposalが根拠にしたsource hash/revisionを固定できない。
- `packages/prjops/src/agents/AGT02_collector.ts:43-60` — `email|teams|github`入力型はあるがsource ID/revision/dedupeがない。
- `packages/prjops/src/agents/AGT02_collector.ts:149-218` — 進捗6項目を構造化して返すだけで、production callerとGitHub proposal生成はない。
- `packages/server/src/lib/githubEventRouter.ts:131-184` — GitHub eventからIssue/PR/Project状態を`pm_events`へ正規化する逆方向経路はある。
- `packages/server/src/index.ts:353-364` — GitHub event dispatcherは常駐serverへ結線済みだが、DevOps agent handlerの完成はPlan 010依存。
- `packages/web/src/server/chat/tools.ts:127-140` — `projectBoard` ViewSpec toolは存在する。
- `packages/web/src/components/DashboardClient.tsx:245-276` — 現状`projectBoard` endpoint unavailableを返すため、Plan 010 T10-T14未完のままwriteを先行できない。
- `.github/actions/run-coding-agent/action.yml:6-8,23-50` — Claude/Droid CLI引数・認証は未検証と明記され、install/version pinがない。
- `.github/workflows/coding-task.yml:80-170` — AI実行とpush/PR credentialが同一jobにあり、Plan 006/010で分離予定。
- `.github/workflows/coding-task.yml:176-224` — callbackの`curl`はHTTP errorをfailにせず、発行元run相関もない。
- `.claude/skills/`には6 skill、`.claude/agents/`には2 reviewer、`.factory/skills/`には1 skill、`.factory/droids/`には1 droidがtracked。
- `.claude/settings.json`、`.claude/hooks/typecheck-after-edit.mjs`、`.agents/skills/github-operations/`、`.codex/config.toml`、`.codex/hooks.json`、`.codex/agents/`、`.codex/rules/`は存在しない。
- remote確認時、coding-task runは0件、report-generationはfailure 1件、Actions secrets/variables/Environmentsは各0件、Pages APIは404だった。workflowファイルの存在を稼働証明にしてはならない。

## Exact product contract

後続executorは以下を変更せず実装する。変更が必要ならPhase 0 decision recordを改訂し、owner承認を得るまでSTOPする。

| Surface                             | User intent                                     | Behavior                                                     | Confirmation                      | Result                                 |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | --------------------------------- | -------------------------------------- |
| Teams                               | Issue/PR/board一覧                              | stable subject・persona・project scope確認後にread           | 不要                              | Teams threadへsanitized reply          |
| Teams                               | Issue作成、Issue/PRコメント、Issue close/reopen | 1 intent = 1 typed proposal                                  | Entra認証済み別人、30分、one-time | GitHub readback後にTeamsへ結果         |
| Teams                               | coding task                                     | 既存coding task proposal                                     | Plan 010承認基盤                  | isolated agent artifactからdraft PR    |
| Outlook/Teams議事録                 | 決定・action・対象を抽出                        | 1 proposed mutationごとに別proposal。曖昧項目はclarification | proposalごとに別人承認            | 承認分だけ適用、未承認分は不変         |
| Claude Code/Droid/Codex interactive | Issue/PR/Project操作                            | readは認可済み`gh`、writeはdraft JSON表示→人間browser paste  | serverのEntra認証済み別人承認     | server executorのGitHub履歴。mergeなし |
| Claude/Droid CI                     | 自然言語coding task                             | unprivileged jobはpatch artifactのみ                         | publisher前のworkflow gate        | draft PRのみ                           |
| Web Kanban                          | board表示                                       | GitHub Projects v2 complete snapshotをread-only表示          | 不要                              | 編集は認可済みGitHub deep link         |
| GitHub Pages                        | Pages作成・設定変更・公開                       | 対象外                                                       | —                                 | 実行しない                             |

許可するtyped operation kindは次のexact setとする。

```text
issue.create
issue.comment
issue.close
issue.reopen
pull_request.comment
query.issues
query.pull_requests
query.project_board
coding_task.create
unknown
```

禁止するoperationは、PR merge/approve/close、PR title/body/base変更、main直接push、force push、repository/org/permission/environment/pages設定、Project作成/削除、ProjectV2 item追加/削除/archive/reorder/全field変更、任意REST/GraphQL/shellである。

### Operation schema and permission matrix

全requestは`{version:1, kind, projectId, payload}`だけを受け付け、unknown keyを400で拒否する。`projectId`は`^PJ-[0-9]{3,}$`、1発話/1API requestにつきkindは1件である。`tenantId`、`repository`、GitHub node ID、requester/approver、source identityはclient/LLM payloadから受け取らず、Entra session、source channel/mailbox、署名済みproject/repository mapping、署名済み単一intended-approver masterからserverが補完する。文字数はUnicode code point数、integerはJSON numberの安全な正整数として検証する。

| Kind                   | Exact payload                                                                 | Requester               | Approver                                                | GitHub permission                         | Target and expected state                                |
| ---------------------- | ----------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `query.issues`         | `{state:"open"\|"closed"\|"all", limit:1..50}`。`limit`省略時20               | active `PRF-01\|02\|03` | 不要                                                    | Issues: read                              | channel/projectから解決した単一repo。cursor入力は禁止    |
| `query.pull_requests`  | `{state:"open"\|"closed"\|"all", limit:1..50}`。`limit`省略時20               | active `PRF-01\|02\|03` | 不要                                                    | Pull requests: read                       | 同上                                                     |
| `query.project_board`  | `{}`                                                                          | active `PRF-01\|02\|03` | 不要                                                    | Projects: read                            | signed mappingの単一ProjectV2、最新complete snapshotだけ |
| `issue.create`         | `{title:string[1..256], body:string[0..65480]}`                               | active `PRF-02\|03`     | 署名済みmasterの単一active `(tid,oid)`。requesterと別人 | Issues: write                             | repo mapping/source revisionがproposal時と実行時で一致   |
| `issue.comment`        | `{number:int[1..2147483647], body:string[1..65480]}`                          | active `PRF-02\|03`     | 同上                                                    | Issues: write                             | repoとissue node IDが一致し、targetが存在                |
| `issue.close`          | `{number:int[1..2147483647], reason:string[1..1024]}`                         | active `PRF-02\|03`     | 同上                                                    | Issues: write                             | expected state=`open`、target=`closed`                   |
| `issue.reopen`         | `{number:int[1..2147483647], reason:string[1..1024]}`                         | active `PRF-02\|03`     | 同上                                                    | Issues: write                             | expected state=`closed`、target=`open`                   |
| `pull_request.comment` | `{number:int[1..2147483647], body:string[1..65480]}`                          | active `PRF-02\|03`     | 同上                                                    | Pull requests: write                      | repoとPR node IDが一致し、targetが存在                   |
| `coding_task.create`   | `{instruction:string[1..4000], agent:"claude-code"\|"droid", baseRef:"main"}` | active `PRF-02\|03`     | 同上                                                    | 下記3-identity coding credential contract | signed project→repo mapping、base SHAを固定              |
| `unknown`              | `{}`                                                                          | なし                    | なし                                                    | なし                                      | proposal/API/GitHub callを作らずclarificationだけ        |

Coding identityは相互注入不能な3件に分離する。(a) Plan 012 coding-dispatch GitHub App/tokenはrepository 1件、Metadata/Contents readとActions writeだけでworkflow dispatchし、Contents/PR writeなし。(b) unprivileged agent jobはcheckout用Contents readだけでpublisher/dispatch tokenなし。(c) protected P010 publisher App/tokenだけがbranch allowlist上のContents write+Pull requests writeを持ちdraft PRを作るが、Actions/merge/admin/deploy権限なし。startupと各jobでApp ID/installation/cache namespace/permission exact setをreadbackし、同一identity、cross-injection、main/既存branch write、non-draft PRをfail-closeする。

read responseは`{operationId,kind,status:"succeeded",projectId,items,nextPageUrl:null|string}`、write proposal responseは`{operationId,kind,status:"pending",projectId,statusUrl,expiresAt}`、terminal resultは`{operationId,kind,status:"succeeded"|"failed"|"stale"|"verification_failed"|"indeterminate"|"rejected"|"expired",targetUrl:null|string,errorCode:null|string}`に固定する。status GETは全terminalをHTTP 200で返し、proposal POST成功は202、request時のschema不正は400、認証/認可失敗は401/403、source/mapping conflictは409、business validationは422、必須provider read不能は503に固定する。raw provider body、email/name、token、stack traceは返さない。`failed`はmutation request送信前の非verification失敗、`stale`はsource削除またはsource/mapping/expected state不一致、`verification_failed`はbounded read-only preflightを3回（既存retry policyのbackoff/cap）試してもprovider状態を確定できずmutation未送信の場合、`indeterminate`はmutation request送信後に結果を確定できない場合だけである。`rejected`はintended approverの明示否認、`expired`は30分無決定とし、どちらもGitHub mutation/attempt row 0とする。generic proposalのrequester cancel APIは提供しない。coding taskの`cancelled`はP010固有statusでこのunion外である。

### Side-effect and recovery contract

- approval transactionはPlan 010の`approval_requests`/`approval_decisions`を唯一の正本とし、`operation_proposals.approval_request_id`で参照する。Plan 012は別のnonce、approval status、approval routeを作らない。
- approval完了と別transactionで動くrecoverable dispatcherを正本とする。dispatcherはPlan 010のaccepted decisionと`operation_proposals.approval_request_id`をjoinし、同じPostgreSQL transaction内で`operation_execution_queue`へ`INSERT ... SELECT ... ON CONFLICT (operation_id) DO NOTHING`し、proposalを`pending→approved`へCASする。定期走査するためapproval response直後のprocess停止でもevent lost 0、重複queue 0である。Plan 010のdecision transactionやapproval tableを変更しない。
- proposal初期化は`operationProposalsRepo.initializeWithApprovalAndNotifications()`を唯一の入口とし、1つのinjected PostgreSQL client/transactionでproposal 1、Plan 010 approval request 1、requester status outbox 1、intended-approver outbox 1を順にinsertする。全unique keyはoperation ID、`ON CONFLICT`時は4 rowのdigest/FK/cardinalityが完全一致する場合だけ既存結果を返し、1件でも欠落/相違ならrollbackして`initialization_corrupt`とする。intended-approver outboxはcontext provider登録までは`blocked_context`で配送不能とする。Plan 010 raw nonceは永続化せず、Key Vault管理AES-256-GCM keyとsealごとにCSPRNG生成する96-bit IVで`{nonce,approvalPath}`を暗号化する。AADはapproval request ID、delivery digest、expiry、key versionのcanonical bytes、DB uniqueは`(key_version,iv)`とし同一key/IV再利用を拒否する。decrypt keyringはcurrent/previous固定ではなく、未期限ciphertextが参照する全versionを保持し、該当row 0かつ最大expiry+24時間経過後だけowner承認でkeyを廃棄する。各statement後crash、再起動、20 concurrent initializerでcardinality 1/1/1/1、partial commit 0、未観測event 0とする。外部deliveryはexactly-onceを主張せず`sent|failed|indeterminate|expired`を必ず記録する。Teams、Outlook、interactive agentの全proposalがこのmethodを使う。coding taskは同じ不変条件をP010 `codingTasksRepo.initializeWithApprovalAndNotifications()`で満たし、generic proposal rowだけ作らない。
- context providerがinitializer時に未登録ならoperation proposalまたはcoding taskのprovider kind/version/digest/timestampはNULL、approver outboxは`blocked_context`でcommitする。1分周期のdurable activation taskだけがruntime provider artifactと照合して4列を一度固定し、同一transactionでoutboxを`pending`へCASする。30分期限まで登録されないoperationはproposal/approvalを`expired`、codingは`queued→expired`+`dispatch_error_code=context_provider_expired`、Plan 010 approvalを`expired`へCASし、payload/instruction redaction、audit、terminal notificationをsubject-kind別の同一transactionで作る。process crashやdeploy順序に依存して永久blockedにしない。
- 外部mutation attemptの唯一の正本は`operation_execution_attempts`の`operation_id UNIQUE` rowである。`operation_proposals`と`operation_execution_queue`にattempt counterを持たせない。queueはeligibility/lease/statusだけを持つ。
- write executorはbounded read-only preflight成功後、queue rowとproposalをlockし、同じDB transactionでproposalを`approved→executing`、queueをclaimed、`operation_execution_attempts`へ`INSERT(operation_id,attempt_started_at)`してcommitする。unique conflict、proposal/queue/attempt不一致、corruptionならexternal call 0でfail-closedにする。commit後だけ外部mutation requestを最大1回送る。meeting-source operationだけは専用DB sessionで固定`MINUTES_GATE_ADVISORY_KEY=12012`のsession-level shared advisory lockを最終gate確認前に取得し、attempt commit→single-attempt request→terminal/indeterminate commitまで保持してfinally releaseする。detectorは同keyのexclusive advisory lockを取得してからdisable transactionをcommitする。executor process/connection crashではshared lockが自動解放され、残存attempt rowにより再送0となる。
- mutationとTeams/Outlook notificationは新規single-attempt transportだけを使い、既存`withRetry`/`fetchPolicy`を通さない。injected `FetchLike`をexact 1回呼び、429、403+Retry-After、5xx、timeout、connection reset、invalid responseを一切再送しない。read-only preflight/reconciliationだけは既存idempotent retry policyを使用できる。
- request送信前のsource削除/不一致は`stale`、3回のbounded read-only preflightで状態を確定できなければ`verification_failed`とし、attempt rowを作らない。mutation request送信後は、2xxとreadback一致だけを`succeeded`とする。non-2xx、timeout、connection reset、process crash、応答parse不能、marker不在、readback不能、外部成功後DB失敗は`indeterminate`とし、自動retryしない。
- create/commentにはexact separator+marker `\n\n<!-- aiops-op:<36文字canonical lowercase UUID> -->`（56 code points）を付ける。`MAX_USER_BODY=65536-56=65480`をschema/parser/UIの共通定数とし、最終GitHub bodyを最大65,536 code pointsにする。Issue探索はstate=`all`の全page、comment探索は全pageをread-only reconciliationする。marker不在は「未実行」の証明ではなく`indeterminate`のまま。再実行には人間がprovider readbackを確認し、新UUIDのproposalを新たに承認する。
- Issue state updateはexpected current valueとtarget valueをreadbackする。target既達はsucceeded、expected以外はstale、readback不能はindeterminate。既存operationを再送しない。
- Teams/Outlook結果通知もoutbox rowをwrite-ahead claimし、Teams SDK proactive、approval mailのGraph `sendMail`、source mailのGraph `/users/{mailboxObjectId}/messages/{immutableMessageId}/reply`を最大1回だけ送る。response不明は`notification_indeterminate`で自動再送せず、operation status/APIから利用者が確認できる。GitHub結果を通知失敗でrollbackしない。
- intended approverへの`approval_request`がvalidationまたはdefinitive transport non-2xxで未配送と確定した場合はsubject kindでatomic分岐する。operationはproposalをattempt 0の`verification_failed`、codingは`queued→failed`+`dispatch_error_code=approval_delivery_failed`かつinstruction redaction、いずれもPlan 010 approval requestを既存terminal `expired`、outboxを`failed`、append-only auditを`approval_delivery_failed`へCASしてrequester terminal outboxを同一transactionで作り、queue/attempt/workflow dispatchを0とする。response不明だけはlink到達可能性があるためsubject/approvalを期限までpending/queuedに保ち、visible `notification_indeterminate`として自動再送しない。
- operation terminal更新、text payload redaction、append-only audit、notification outbox insertは`operationProposalsRepo.completeAndEnqueueNotification()`が同じinjected PostgreSQL client/transactionでcommitする。statement失敗時は4件すべてrollbackし、recoverable dispatcherがterminal済みoperationを再enqueueしない。
- したがって受入条件は「provider exactly-once」ではなく「各operation IDについてapplicationが外部mutation requestを最大1回送信し、結果不明を自動再送しない」である。

`coding_task.create`はgeneric executor対象外で、P010 `coding_tasks`/approval/publisherを唯一のstate machineとする。Plan 012は`queued→dispatching→running→publish_authorized→publish_delivering→publishing→pr_created`を正常経路とし、`queued→expired`、`dispatching→indeterminate`、`running→failed|cancelled|indeterminate`、`publish_authorized→publish_delivering|expired|failed`、`publish_delivering→publishing|failed|indeterminate`、`publishing→pr_created|failed|indeterminate`だけを許可する。confirmation transactionはinstructionをDBに保持したまま`queued→dispatching` CASし、opaque inputだけでworkflow dispatchをsingle-attempt送信する。API `2026-03-10`の200 run detailsはrun correlationを`dispatching`へ保存するだけでrunningにしない。unprivileged jobのOIDC claims+provider readbackを検証したone-time brokerがinstructionをmemoryへ最大1回配送する。ACK identityはexact `(taskId,deliveryId,instructionSha256,workflowRunId,runAttempt,workflowSha,oidcSubject,agent,repository,workflowRef,audience)`、同一tupleだけをidempotently replayできる。最初のACK transactionはinstructionをNULL+SHAへredactして`dispatching→running`とし、Key Vault non-exportable EC P-256 keyでRFC 8785 canonical `{purpose:"aiops-coding-start-v1",taskId,deliveryId,instructionSha256,workflowRunId,runAttempt,workflowSha,oidcSubject,agent,repository,workflowRef,audience,receiptId,issuedAt,expiresAt,alg:"ES256",kid,keyVersion}`全体を署名したpersisted start receiptを返す。canonical UTF-8 bytesをSHA-256し、Key Vault Signへ32-byte digestを渡す。応答はRFC 7518の固定64-byte raw `R||S`だけをbase64url paddingなしで保存し、DER、padding、P-256以外、`alg!=ES256`、`expiresAt>key.validUntil`を拒否する。JWKはexact `kty=EC,crv=P-256,alg=ES256,kid,keyVersion,x,y,validFrom,validUntil,revoked`である。runnerはoffline owner署名済みimmutable environment masterのcurrent/next JWKだけをpinし、unknown/revoked/expired keyを拒否する。rotationはnext事前配布→validFrom後current化→未期限receipt 0かつvalidUntil+24時間後にold revoke/deleteの順である。同tupleの再ACK/GET readbackは同じreceipt/signatureを返し、新規deliveryやinstruction再配送はしない。runnerはinstructionをmemoryに保持したままACKを最大3回だけbounded retryし、matching signed receiptとDB readbackを得た後、instruction/tool accessをまだ与えないgated child wrapperをspawnする。runnerはexact receiptId/child launch nonceを`instruction:started`へPOSTしmatching readback後だけinstructionをchild stdinへ1回渡し、30秒ごとにheartbeat、終了時terminal callbackを送る。receipt readbackはauthorization証跡でlivenessには数えない。1分sweeperは`dispatching`のno pickup/ACK、`running`で30秒以内に`agent_started_at`なし、またはterminal前のheartbeatが90秒超staleならreceipt readback有無に関係なく`indeterminate`+`instruction_delivery_indeterminate|dispatch_orphaned`へCASする。全ACK応答が不明/不一致ならmemoryを破棄してagent/artifact/publisher call 0。204/dispatch response不明もindeterminateとし、generic proposal/attempt rowを作らない。

verified terminal callbackはexact task/run/repository/base SHA/artifact SHAとserver受信時刻基準30秒以内のfinal heartbeatをCAS照合し、成功時だけ`running→publish_authorized`へ遷移して5分expiry付きopaque one-time `publishAuthorizationId`を保存する。publisherはprotected-environment OIDCとexact task/run/repo/artifact tupleを提示し、前段のbounded DB/mint contractを満たした場合だけGitHub App tokenを最大1回mintする。token-attempt stateはexact `minting|deliverable|delivery_consumed|revoking|revoked|expired|orphaned_suspending|orphaned_suspended|orphaned_expired|indeterminate`である。mint definitive failureは`failed+publisher_failed`とする。2xxはtrusted DB `response_received_at=clock_timestamp()`を固定し、`response_received_at<provider_expires_at<=response_received_at+PT60M`だけを受理する。異なるCSPRNG IV/AAD purposeのdelivery ciphertextとserver-only revocation ciphertext、provider expiry、token digestを一transactionでatomic保存して`deliverable`へCASする。invalid/malformed 2xxまたはseal definitive failureではmemory tokenがあればwrite-ahead `revoking`後にrevokeを最大1回送る。seal commit response不明はreadbackだけでcommit/rollbackを確定し、完全一致する既存`deliverable`だけを再利用してmint/sealを再送しない。

installation tokenはopaque UTF-8 stringとして扱い、prefix/length/segment/JWT/character-classをparse・正規表現検証しない。plaintext DB columnは0、digestはSHA-256、binary ciphertext/IV/tagは可変長`bytea`とし、transportは1..16384 UTF-8 bytes、ciphertext envelopeは32768 bytesまでを受理して超過時はdelivery/write 0でrevokeまたはsuspendへfail-closeする。classic tokenと2026 stateless `ghs_APPID_JWT`（約520文字、`.`/`_`/`-`を含む）を同じopaque pathでmint→seal→delivery→Authorization Bearer→revoke/suspendする。temporary per-request format overrideはsandbox両format試験だけに使い、production format selectionへ依存しない。

mint response不明、process crash、またはdurable revocation copyなしでtoken発行時刻・expiryが不明な場合は時間推定でexpiredにしない。attemptを`orphaned_suspending`、taskを`indeterminate+publisher_result_indeterminate`へCASし、専用installationのpublisher work/token delivery/writeを即時0にする。App JWTによるinstallation suspendをwrite-ahead記録後に最大1回送り、response不明でも再送せずread-only GETだけで`suspended_at`を確認する。確認時のtrusted DB時刻を`suspension_confirmed_at`へ固定し`orphaned_suspended`へCASする。provider E2Eで既発行・後着tokenのwrite拒否を確認し、suspendを`suspension_confirmed_at+PT65M`まで維持した後だけ`orphaned_expired`へCASする。suspendを確認できなければSEV-1/STOP、人手deleteまでpublisher writeを永続0にする。unsuspendは自動化せず、orphaned_expired、人間security ownerの新規承認、open attempt 0を満たす別operationだけが行い、その後は新しいtask/authorization/attemptだけを許可する。

前記「別operation」は自然言語operation kindではなくP012-F02-T07Rのprotected break-glass recoveryだけを指す。App JWTでsuspendしたinstallationは、同じGitHub App owner/manager authorityとApp JWT APIだけでunsuspendし、installation account ownerのWeb UIやpublisher jobには解除権限を与えない。

orphan suspension開始transactionはinstallation rowをlockし、単調増加`suspension_generation=previous+1`とexact `orphan_token_attempt_id`をtoken attemptへ固定する。同じinstallationの将来generationは新しいrecovery rowを持てるが、同一orphan attempt/generationのrecoveryはexact 1、installation当たり`state=unsuspending`はpartial uniqueで同時1件だけとする。approval、App JWT request、readback、auditはinstallation ID、generation、orphan attempt IDへbindingし、旧generation replayを拒否する。

同tupleだけが同じdeliveryをGET replayできる。ACK transactionは`publish_delivering→publishing`、attempt=`delivery_consumed`、delivery consumed/timeをCASし、以後GET redeliveryを拒否しながらrevocation ciphertextを保持する。publisherはreadback後だけwriteし30秒heartbeatを送る。terminal、ACKなし60秒、known provider expiry、publishing heartbeat 90秒stale時は`revoking`をwrite-ahead CASしてrevokeを最大1回送る。204は`revoked`、known provider expiry経過は`expired`とし、そのときだけciphertextを消去する。revoke 5xx/timeout/response不明は`indeterminate`、自動retry/redelivery 0でknown provider expiryまで保持する。stale sweeperはmarker reconciliation→known-token失効またはorphan suspension収束→`pr_created|indeterminate`の順で閉じる。publisherはdeterministic `agent/<taskId>` branch、base/artifact SHA、exact PR marker、unique write-ahead push/PR attemptを使い、各external requestを最大1回送る。response不明はread-only reconciliationだけを行い、不在・競合・曖昧なら`indeterminate+publisher_result_indeterminate`、resend 0とする。late/indeterminate/expired/failed/cancelled childのtoken/write/PRは0である。既存`dispatch_error_code` compatibility、terminal status/error、attempt、consumed authorizationはimmutableである。

publisherは専用GitHub App installationごとにserializeし、merge/admin/deploy権限0とする。mint前DB transactionは`lock_timeout=PT2S`、`statement_timeout=PT5S`、application total deadline PT10Sとし、最終statementのtrusted `clock_timestamp()`でauthorizationを再検証し`expires_at>clock_timestamp()+PT30S`、attempt state=`minting`、`attempt_started_at`を固定する。commit/readback後に`attempt_started_at+PT1S`以内の場合だけ別CASで`mint_transport_started_at=clock_timestamp()`を固定し、そのcommit後PT1S以内にPT30S client deadlineのmint requestを最大1回開始する。一つでも超過・不明ならmint 0でSTOPする。response不明tokenをclient時刻で失効推定せず、専用installationのsuspend確認とその後のPT65M維持だけで収束させる。

### Plan 010 ownership contract

Plan 010 F03のaccepted成果は`approval_requests`、`approval_decisions`、`packages/server/src/lib/approvalAuthorizationPolicy.ts`、`packages/server/src/lib/approvalToken.ts`、`packages/server/src/db/approvalRequestsRepo.ts`、`packages/server/src/http/routes/approvals.ts`を正本とする。Plan 012は`packages/server/src/lib/operationApprovalAdapter.ts`でoperation payload/request typeとlive-source context providerを正本APIへcompositionする。accepted routeにcontext-provider extension pointがなければ同じrouteへ汎用DI hookだけを追加し、第二のapproval table/route/stateを作らない。Plan 010が別path/symbolでaccepted済みなら実装せず、Phase 0で実path/symbolを本節へ置換して再reviewする。coding taskはP010-F05-T10..T14のrepo/route/CAS/publisherを唯一のstate machineとして使い、workflow dispatch transportだけをsingle-attempt化する。

### Intended approver routing contract

- proposal作成時、serverは署名済みproject masterの`operationApprover`から単一のactive Entra `(tid,oid)`を解決し、Plan 010 `intended_approver_tid/oid`へ固定する。request/LLM payload、email、display name、列挙順、最初に応答した人物から選ばない。
- authoritative masterはowner管理のprivate `prjops-data` repositoryに`operation-approvers.v1.json`とdetached signatureとして置き、protected environmentが指定するimmutable 40-character commit SHAからread-only machine identityで取得する。mutable branch/latest/local fallbackを禁止する。
- master recordは`projectId`、approver `(tid,oid)`、exact `approvalDelivery` union、1..32件のexact `sourceEntitlements` union、validity/version/signerを持つ。Teams outboundはSDK 2.0.13 `app.send/app.reply`だけ、Key Vault bot credential、事前installを必須とする。`teams_conversation_references`はpersonal/channel discriminated union、tenant/bot/recipient、conversation ID、HTTPS `service_url_base`、install/revoke/versionを持つ。`service_url_base`はuserinfo/query/fragmentなし、approved exact host+normalized nonempty pathを保持し、末尾slashだけ除去する。origin-onlyやpath除去は禁止する。SDK Appのfull `serviceUrl`とstored baseが完全一致するreferenceだけ送信できる。active keyはpersonal `(tenant,bot,approver)`、channel `(tenant,bot,team,channel)`各exact 1、raw activity/body/card/address 0。Graph chat POST、delegated token、`Teamwork.Migrate.All`は禁止。opaque ID/UUID、same-tenant/container/client/profile、memory-only mail address、RFC8785+Ed25519、active record exact 1の検証を行う。
- Teams command ingressはSDK/Graphの共通durable `teams_intent_ingress`をCASする。schemaは前段のPK/source IDs/revision/int-index/origin bits/status/lease/timestamps/nullable subject mapping/result correlationとexact unique keyを持つ。`source_revision_sha256`はUTF-8 `aiops-teams-command-revision-v1\n`+RFC8785 canonical `{tenantId,teamId,channelId,messageId,etag,lastModifiedDateTime,sanitizedTextSha256}`+LFのSHA-256で、single source messageだけを対象にしthread/replyを含めない。same etag duplicateは同row、same-text new-etag、edit→revertは各new row、bot replyはsource message revisionを変えない。SDK executionはactivity IDだけでなくetag/lastModified/text hashがGraph値と一致するsandbox proofがある場合だけ有効、なければGraph-onlyとする。claim/reclaim/loser/self-bot/system拒否は前段contractどおりで、text-only ID推測とbot loopを禁止する。
- protected environmentにはoffline owner rootのEd25519 public-key fingerprintだけをpinする。root署名済みdelegated keyring/revocation listも同じimmutable SHAから取得し、unknown/revoked keyを拒否する。startupと明示SHA変更時だけ全artifactを検証してatomic swapし、refresh失敗時は旧snapshotの`validUntil`までは維持、期限後はfail-closedにする。network failureからmutable source/local cacheへfallbackしない。
- requesterとintended approverが同じ、候補0件、候補2件以上、inactive/expired、署名不正、key revoked、validity gapの場合はproposal/approval requestを作らず`approver_unavailable`でclarificationする。
- 休職・代理は既存recordへのfallbackではなく、ownerが新versionのmasterを署名・発行し、旧versionを失効させる。発行済みpending proposalはapprover mapping versionが変われば`stale`となり、新proposalを必要とする。
- approval時とexecution直前にも同じmaster version/signature/active subjectを再検証する。Plan 010 routeは固定済みintended approver以外を403で拒否する。
- approval notificationはmasterのexact `approvalDelivery`へsingle-attempt送信する。Teams proactiveはactive conversation referenceとbot credentialを送信直前に再検証し、mailはExchange Application RBACで限定したsender/recipient mailboxを再解決する。Teams sourceのapproval GET/POSTはintended approverのdelegated Graph session、Outlook sourceはintended approverのdelegated Graph sessionまたはowner承認済みshared-mailbox access contextでexact container entitlementとlive source hashを再検証する。interactive agentはGraphを要求せずauthenticated requester `(tid,oid,clientId)`、active profile、one-time POST body hash、stored derived payload hashを再検証する。coding taskは元source kindと同じ検証を行う。no-store画面はmemory-only sanitized sourceまたはderived payloadだけを表示し、scope/access/hash不一致、live fetch不能、delivery不能はapproval不可かつattempt 0の`verification_failed`とする。

### Interactive agent credential contract

`agent-github-read-operations.v1`のcanonical command setは次の4件だけである。`GH_HOST`、`OWNER`、`REPO`、`PROJECT_NUMBER`はsigned launch mappingから固定し、agent入力で変更できない。各argvをpinned `gh 2.96.0`でcaptureし、normalized GraphQL documentのactual SHA-256、operation/root、exact variable name/type/value source、field set、depth/costをcontract JSONへ値付き保存する。未capture/placeholder hashではgateを開かない。

| ID                 | Exact argv                                                                                                                 | Provider contract                                                                     | Pagination/target oracle                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `repo-view-v1`     | `gh repo view "$OWNER/$REPO" --json nameWithOwner,url,defaultBranchRef`                                                    | captured read-only operation、fields exact `nameWithOwner,url,defaultBranchRef{name}` | signed owner/repo、single object            |
| `issue-list-v1`    | `gh issue list --repo "$OWNER/$REPO" --state all --limit 100 --json number,title,state,url,updatedAt`                      | captured read-only operation、fields/variables exact actual capture                   | signed owner/repo、101件目で422+stdout 0    |
| `pr-list-v1`       | `gh pr list --repo "$OWNER/$REPO" --state all --limit 100 --json number,title,state,url,updatedAt,headRefName,baseRefName` | captured read-only operation、fields/variables exact actual capture                   | signed owner/repo、101件目で422+stdout 0    |
| `project-items-v1` | `gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --limit 100 --format json`                                        | captured ProjectV2 read operation、root/fields/variables exact actual capture         | signed owner/project、101件目で422+stdout 0 |

全commandはargv、environment allowlist、normalized document SHA、variables/root/fields/depth/page/costの全一致を要求する。alias、config default、extension、`gh api`、追加flag、target省略、arbitrary cursor、自動next pageは拒否する。

- interactive Codex/Claude/DroidのホストOS直実行を禁止する。承認済みの外部隔離sandbox（ephemeral container/VM/service account、新規UID、空のHOME、read-only sanitized source export、host PID/IPC/user namespace非共有、Docker socketなし）から専用launcherでだけ起動する。`.git`、host `/Users`/`/home`、SSH agent/socket、Keychain、Git credential helper/store、`~/.ssh`、`~/.git-credentials`、通常`GH_CONFIG_DIR`、browser/cloud config、publisher/deploy/server tokenをmount/inheritしない。
- sandboxはsystem/global/local Git configを無効化し、credential-bearing remoteを持たず、egressをinternal GitHub-read/LLM gatewayだけに限定する。agentはEntra/browser proposal sessionへ接続せず、draft JSONをterminalへ表示するだけである。人間browserだけが別端末/sessionからproposalをpaste/POSTする。
- sandbox外のbrokerだけがrepository-selected read-only GitHub App installation tokenをmintし、sealed server-side credentialとして保持する。Azure Container Apps Jobはresource identity/egressがJob全体でcontainer別に強制できないため採用しない。実行基盤はJapan East private AKS、Azure CNI powered by Cilium、Pod Sandboxing `runtimeClassName: kata-vm-isolation`とする。untrusted agentは1 request/1 Kubernetes Job/1 Kata Pod、trusted credential proxyはagent Jobとは別の固定`agent-gateway` namespaceにlaunch固有Pod/Serviceとして起動する。agent Podは`automountServiceAccountToken:false`、Workload Identity label/UAMIなし、default-deny Cilium policyで同launch proxy Service:443とcluster DNS以外のingress/egress 0とする。proxy Podだけが専用service accountのaudience=`api://aiops-agent-proxy-v1`、10分以下、Pod UID binding付きprojected Kubernetes service-account JWTを持ち、raw GitHub/provider tokenではなくlaunch ID/proxy Pod UID/repo/provider/model/budget/immutable `lease_generation`付き10分gateway JWTをone-time取得する。proxy ACK後にbrokerが`agent_launches.state=active`をcommit/readbackする。launcherは決定的DNS-safe名`aiops-agent-<launch-idのlowercase UUIDからdash除去>`の`spec.suspend:true` Jobだけをcreateし、timeout/409時は同名GETでreconcileして別名Jobを作らない。GETしたJobのUID、resourceVersion、image digest、runtimeClass、securityContext、service account、labels、network-policy selectorの完全一致をreadbackしてJob UIDと`job_spec_attested=true`をCAS保存した後だけUID/resourceVersion precondition付きで`suspend:false`へpatchする。Podにはnoncredential init gateを必須化し、gatewayの`/launch-ready/<launch-id>`がreadyになるまでprovider entrypointを開始しない。unsuspend後、brokerが実Pod UID/image/runtime/security/service-account/Cilium selectorをreadbackして`pod_attested=true`をCASした時だけreadyを返す。不一致、admission mutation、Pod timeout、broker crashはready=falseのままlaunchを`indeterminate`、token revoke、同名Job deleteへ進める。作成前に存在しないJob UIDをJWTへ入れない。brokerはKey Vault管理private CAでlaunch固有Service DNS SAN・10分以下のcertificateを署名し、launch固有Kubernetes TLS Secretをproxy namespaceへ作成する。CA private keyはcluster/Podへexportせず、agentはpublic CA bundleだけをread-only mountする。agentはprivate-CA TLSの`GH_HOST=github-read-<launch>.agent-gateway.svc.cluster.local`、private CA bundle `SSL_CERT_FILE`、非secret固定値`GH_ENTERPRISE_TOKEN=proxy-placeholder`だけを受ける。proxyはplaceholderを除去してJWTをinternal gatewayへ付与し、agentからtoken値を取得できるcredential endpointを公開しない。全gateway requestはJWT/proxy projected service-account JWTのissuer/audience/namespace/service-account/Pod UID/signature/expiryとsource namespace+Pod UID/Kubernetes API readbackに加え、DBのimmutable `lease_generation`、`state=active`、`job_spec_attested=true`、`pod_attested=true`、lease未満、revokedでないことを再検証し、row versionはCAS専用としてJWT bindingに使わない。`lease_delivering|indeterminate|revoked|expired`を403にする。GitHub-read gatewayはREST exact method/path allowlistと、pinned GitHub CLIから抽出したGraphQL persisted-query SHA-256/variables/root/field/depth/page/cost contractだけをfixed `github.com` repo/projectへproxyしてserver-side tokenを注入する。任意GraphQL query、`node|nodes|search|viewer` root、project列挙、aliasでのforeign target混在、REST POST/PATCH/PUT/DELETE、GraphQL mutation/subscription/introspectionを拒否する。provider token expiryは1時間、job/gateway leaseは10分、終了時brokerが`DELETE /installation/token`をbest-effort実行する。launcherはambient `GH_TOKEN`、`GITHUB_TOKEN`、PAT、`SSH_AUTH_SOCK`、publisher/deploy token、browser/Entra session、cloud credential変数を拒否する。
- launch順序は、(1) `pending` rowをKubernetes UID全てNULL、`job_spec_attested=false`、`pod_attested=false`でcommit、(2) certificate/proxy Deployment/Serviceをcreate、(3) proxy Pod UIDをCAS保存してKubernetes readback、(4) `issuing→issued→lease_delivering`、(5) proxy ACK、(6) `active` commit/readback、(7) deterministic suspended Job create/reconcile、(8) Job UID/spec readback→`job_spec_attested=true`、(9) unsuspend、(10) init gate待機中PodのUID/runtime/security/policy readback→`pod_attested=true`、(11) ready応答→provider entrypoint、のexact順とする。Jobは`parallelism:1`、`completions:1`、`backoffLimit:0`、`restartPolicy:Never`、`activeDeadlineSeconds<=gateway lease`、有限`ttlSecondsAfterFinished`でcontroller replacement Podを許さず、launchあたりPod/provider process最大1とする。proxy作成後の途中crashはorphan sweeperがresourceを削除し、token mint前なら`expired`、mint後ならstate machineどおり`indeterminate|revoked`へ閉じる。
- trusted brokerはprivate AKSの固定`agent-control` namespace、dedicated `agent-broker` service account、broker UAMIとfederated identity credentialで実行する。broker自身の10分以下projected service-account tokenをrotationし、private API server endpointとcluster CAをpinする。cluster-scope権限は`authentication.k8s.io/tokenreviews create`だけ。namespace権限は`agent-executions`/`agent-gateway`のJob/Pod/ServiceAccount/NetworkPolicy get、`agent-executions`のJob create/get/patch/delete、`agent-gateway`のlaunch固有Deployment/Service/TLS Secret create/get/deleteだけである。Secret list/watch、Role/RoleBinding mutation、Pod exec/attach、cross-namespace、ClusterRoleBinding/cluster-adminを禁止する。SecretのresourceName制約でcreateを限定できない部分はdeterministic name+launch label+admission/code allowlistを全て満たす場合だけ許可する。TokenReviewは`authenticated=true`、exact `status.audiences`、username/UID/groups、issuer/audience/namespace/service-account/Pod UID/expiryをAPI readbackとoffline JWKSの双方で照合し、片方だけ成功してもrejectする。broker egressはprivate API server、Entra token endpoint、Key Vault private endpoint、DB、GitHub、launch gateway、cluster DNSのexact destinationだけで、proxy/agentへこのauthorityを継承しない。
- read-only GitHub AppはMetadata: read、Contents: read、Issues: read、Pull requests: read、Projects: readだけで、Actions/Workflows/Deployments/Administration/Pagesはno accessとする。provider expiry、job lease、repository selection、App ID、permission snapshotをredacted evidenceへ保存する。
- Codex/Claude/Droidはraw long-lived provider API key/OAuth sessionもgateway JWTも受け取らない。internal `agent-llm-gateway`だけがKey Vaultからprovider credentialを読み、launch専用credential proxyだけが10分gateway JWTを付与する。Claudeは公式`ANTHROPIC_BASE_URL`+`apiKeyHelper`、Droidは`customModels[].baseUrl`+environment参照`apiKey`を`https://llm-<launch>.agent-gateway.svc.cluster.local`へ向け、agent-visible keyは非secret固定値`proxy-placeholder`とする。Codexはprovider/authを無視するproject `.codex/config.toml`へ書かず、launcherがfresh job-only `$CODEX_HOME/config.toml`を0400で生成し、`model = "gpt-5.6-sol"`、`model_reasoning_effort = "high"`、`model_provider = "aiops_gateway"`、`[model_providers.aiops_gateway]`の`base_url = "https://llm-<launch>.agent-gateway.svc.cluster.local/openai/v1"`、`env_key = "AIOPS_GATEWAY_PLACEHOLDER"`、`wire_api = "responses"`、`request_max_retries = 0`、`stream_max_retries = 0`と非secret`AIOPS_GATEWAY_PLACEHOLDER=proxy-placeholder`を設定する。proxy TLS certificateはprivate CA署名、launch固有Service DNS SAN、10分以下とし、そのprivate CA bundleだけをagentへread-only mountする。実CLIがこの方式をsandboxで実証できないproviderは有効化せずSTOPする。gatewayはproxy projected service-account JWT/Pod UID、live launch state/lease generation、model allowlist、request/response byte、rate/cost budgetを検証し、provider secretをjobへ返さない。OpenAI Responses upstreamはowner承認済み単一organization/project/API key、Japan endpoint、`gpt-5.6-sol`、ZDR適格性をproduction readbackし、gatewayが`store:false`、`background:false`を強制する。conversations/files/batch/code interpreter/remote MCP/extended prompt caching (`prompt_cache_retention=24h`) は拒否し、gateway自身のbody log/trace/replay/local cacheは0とする。standard in-memory prompt cachingを「無効」と偽らず、ZDRまたはownerが明示受容したMAM/default retention以外へfallbackしない。proxy/model/provider/data-sharing/region/retention例外のdriftはfail-closeする。agent process/environment/filesystem/`/proc`からgateway JWTが観測されないこと、Kubernetes API/service-account/IMDS 403、proxy filesystem/PID/volume非共有、model providerへの業務prompt送信とretention例外をDEC-ENV-004 owner acceptanceへ記録する。
  private CA trustはClaude/Droid=`NODE_EXTRA_CA_CERTS`（Droidはpinned CLI sandbox証明必須）、Codex=`SSL_CERT_FILE`をexact bundle pathへ設定する。TLS bypass env/flagは禁止し、Droidが検証不能ならそのproviderをSTOPする。
  OpenAI upstream originはexact `https://jp.api.openai.com/v1`とする。このendpointはstorage residency Japan=yes、regional processing=noであり、MAM/ZDR契約を必須とし、nonregional processingをData Ownerが明示受容する。startup/readbackはorigin、organization、project、model、ZDR、data sharing offを検証し、「Japanで処理される」と記載しない。
- agentのwriteはcredential・filesystem・networkの3境界で拒否される。`git credential fill`、`ssh -T git@github.com`、Keychain query、`gh auth status`、`gh issue create/comment/edit/close/reopen`、`gh pr comment/merge/edit`、GraphQL mutation、REST POST/PATCH/PUT/DELETE、workflow dispatch、`git push`をcredential canary付きsandboxで失敗させ、server executorの別GitHub App tokenだけがallowlisted mutationを成功させる。
- hook、skill、ruleは補助防御であり、このcredential境界を緩和しない。unsafe/bypass modeでもread-only tokenのprovider permissionは変わらない。

### Evidence contract

各taskの権威ある証跡は`.orchestration/evidence/<task-id>/`の`commands.json`、`readback.json`、`evidence.json`の3ファイルに固定する。各JSONはPlan 011 schemaに従い、task ID、target SHA、command/exit、redacted resource ID、artifact SHA-256、review outcome、human/ENV gate reference、cleanupを記録する。`verification/`は人が読む非権威な集約reportだけに使い、Plan 011 verifierの入力や外部受入の根拠にしない。

### Meeting source, revision, and retention contract

- Teams/Outlook本文、subject/title、author raw ID/display name、content type、source excerptはPostgreSQL、proposal、audit、log、trace、fixture、evidence、backupへ保存しない。legacy rawが一度でも存在した環境は、全プラットフォームDBを同一SHAのfresh schemaへ置換する。catalog manifestはschema/table/column/partition/sequence/type/domain/enum/constraint/index/view/materialized-view/function/procedure/trigger/extension/RLS policy/default privilege/role/owner/grantを列挙し、function/procedureはnormalized definition、owner、ACL、volatility、parallel、leakproof、security-definer、search_pathを含む。source/target PostgreSQL engine majorと`pg_auth_members`/`pg_db_role_setting` column digestをsigned environment masterへ固定し、unsupported major/column driftを拒否する。cluster-level role manifestはexact `{rolesSorted:[{name,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,validUntil:{mode:"infinity"|"timestamp",valueUtc:null|RFC3339-UTC},authBinding:null|{roleName,type:"entra_oid"|"managed_identity_oid",tenantId,objectId,validFrom,validUntil,artifactSha256,ownerSignature}}],membershipEdgesSorted:[{roleName,memberName,grantorName,adminOption,inheritOption,setOption}],ownershipEdgesSorted:[{ownerRoleName,databaseName,schemaName:null|string,objectKind,objectName,identityArguments:[{position,typeSchema,typeName,mode}]}],roleSettingsSorted:[{databaseName:null|string,roleName:null|string,settingsSorted:[{name,value}]}]}`である。catalog stringはSQL quote/連結せずUnicode NFCの個別JSON fieldにし、rolesはname、membershipは`(roleName,memberName,grantorName)`、ownershipは全field+identityArguments position、settings rowは`(databaseName null-first,roleName null-first)`、settingsはnameのUTF-8 code point順かつ各key duplicate 0とする。`setconfig`は最初の`=`だけでname/valueへ分割して残余`=`をvalueに保持する。database-only settingは`roleName=null`、global role settingは`databaseName=null`でexact 1件だけ置く。authBinding.roleNameは外側role nameと完全一致し、`rolcanlogin=false` iff null、true iff signed Entra/MI binding exact 1件とする。password hash/credentialはcopyせずtarget `rolpassword`はNULLである。対象は全non-system schema/object、application/user role、extension+versionである。provider-managed除外はengine-version別signed allowlist/digest一致時だけ許し、未知kind/owner/role属性はfail-closeする。migration ledgerはaccepted version/name/checksum/orderを正本とし、Gで両DBをaccepted set exactへ一致させる。全retained dataをcopyし、`channel_messages`だけmetadata-only変換する。raw dump/staging/temp/log/evidenceを作らず、旧隔離後は全copyをrestore-negativeまで破棄する。legal hold中はBLOCKEDを維持する。
- 全プラットフォームDB接続先の唯一の正本は、signed environment masterが固定する専用Azure App Configuration store resource IDとexact identity `(key="aiops/prod/platform-database/connection-secret-uri",label=null)`である。他labelは0件。valueはUTF-8/RFC8785/no-whitespace/no-LFのexact `{"uri":"https://<vault>.vault.azure.net/secrets/<name>/<version>"}`、content typeはexact `application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8`、revisionはquoted opaque ETagで、dequote/base64/requoteせず`If-Match`へ渡す。runtime UAMIはData Reader/current secret/current DB runtime roleだけを恒常保持し、rollback window中だけold/new secret/DB runtime roleを持つ。migration UAMIはwindow中だけold/new secret/network/schema-copy role、App Configuration write 0。cutover authorityはgrant generationごとに新規作成して再利用しないephemeral UAMI/FICで、secret/DB 0、fresh owner-approved one-shot deployment中だけstore Data Ownerを得る。IaC既定値とtracked desired stateはfalseである。grantは外部journalの30秒renew/60秒stale/世代別90分absolute expiryへ結合する。旧新DBから独立したprivate Azure Blobと、zone-redundant ACA Environment、public ingressなし/private VNet/minReplicas=3で5秒loopするtrusted Azure Container App guardがG/Hの成否に関係なくcurrent generationをrevokeし、stale検出65秒、DELETE受理95秒、Azure propagation込みPUT403 11分をSLOとする。SLOはJapan EastとAzure Storage/Entra/management planeがavailableである間だけ成立し、cutover前Service Health greenを必須化する。regional outage中はAppConfig writer 0、復旧後guardのPUT403前にwriter/regrant 0とし、この残存riskをData OwnerがPhase 0で署名受容しなければSTOPする。Iも最初にcurrent generation revokedをreadbackする。将来切替はfresh approval、新generation、新principalを必須とする。
- cutover journalの唯一の正本は旧新DB/App Configurationと別resource groupのdedicated storage account/container `platform-db-cutover-journal`である。private endpoint、distinct CMK、blob versioning、version-level 5年immutable retentionを固定し、deterministic blob keyは`cutovers/<cutoverId>.json`とする。exact RFC 8785 schemaは`{version:1,cutoverId,targetSha,branch,phaseStatus,step,rowVersion,receiptHash,oldResourceId,newResourceId,oldRoutingEtag,newRoutingEtag,routeCasWinningLastModified,cutoverCompletedAt,rollbackDeadline,closedAt,leaseOwner,leaseExpiresAt,grantGeneration,grantApprovalDigest,grantPrincipalResourceId,grantFicResourceId,grantRoleAssignmentResourceId,grantIssuedAt,grantAbsoluteExpiresAt,grantStatus,revokeRequestedAt,revokeCompletedAt,revokeProviderReadbackHash,updatedAt}`で、未確定timestamp/resource/digestはnull、generation初期値0、`grantStatus=none`とする。`phaseStatus`は`preparing|copying|cutting_over|rollback_open|rollback_running|closed|blocked|indeterminate`、`grantStatus`は`none|granting|active|revoking|revoked|expired|indeterminate`である。PUT 2xxまたはresponse-loss後のGETがexpected new URI+winning quoted ETagを返した場合、そのApp Configuration key-value responseのexact `last_modified`だけを切替時刻の正本とする。次のjournal CASで`routeCasWinningLastModified`と`cutoverCompletedAt`へ同値で一度だけ保存し、`rollbackDeadline=cutoverCompletedAt+PT60M`を固定する。Blob response `Date`、client送受信時刻、recovery観測時刻、updatedAtを切替時刻へ代用しない。last_modified欠落/parse不能、winner value/ETag不一致、後続CAS/readback不一致はwriter 0でSTOPする。`closedAt`はrollbackDeadline以後またはvalid early-closeで一度だけ設定する。fresh G/H grantごとにgenerationを+1し、fresh approval digest、新規ephemeral UAMI/FIC/resource IDs、grantIssuedAt、`grantAbsoluteExpiresAt<=grantIssuedAt+PT90M`を固定する。live generationのexpiry延長、resource ID再利用、generation rollbackを禁止する。createはquoted `If-None-Match: *`、更新は直前GETのquoted blob ETagを変換せず`If-Match`へ渡し、phaseStatus/step/rowVersion/grantGeneration/grantStatusの許可済み単調遷移と同payload replayだけを許す。journal/guard UAMIにはcontainer-scoped custom roleのexact DataActions `Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read`と`Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write`だけを与え、delete/add/listとcontrol-plane権限0にする。runtime/cutover/migration UAMIはblob権限0である。guardはrevoke request、role/FIC delete response、provider readback hash、completionをjournalへCASし、失敗/不明は`grantStatus=indeterminate,phaseStatus=blocked`へ固定する。証跡JSONは非権威なcopyでblob version ID/ETag/content SHA-256と一致しなければfail-closeする。
- runtime target secretはlegacy期間だけ既存password/DSN payloadを許し、cutover targetはcredential-free exact RFC 8785 `{version:1,auth:"entra",hostAsciiLower,port,database,sslmode:"verify-full",roleName,tenantId,objectId,tokenScope:"https://ossrdbms-aad.database.windows.net/.default"}`とする。resolverはlive runtime UAMIの`(tenantId,objectId)`、role manifestの外側`roleName`とauthBinding exact 1件、DB self-query、catalog digestを照合する。新規physical PostgreSQL connectionごとにinjected `@azure/identity`のasync password callbackでopaque tokenを取得し、SDK `expiresOnTimestamp`だけをtoken response fieldとして検証する。missing expiry、取得時刻から5分以下または60分超を拒否する。token cacheはsingle-flight、refresh margin 5分で、margin内tokenを新規connectionへ再利用しない。pool `maxLifetimeSeconds=2700`でconnectionをrecycleし、既存sessionは自然終了まで許す。new targetを有効化する前にreal Entra login、時計61分前進後のpool expansion、全replica restartを実証する。legacy password→Entra境界、rollback target version、activation SHAをsigned masterへ固定する。
- Entra access tokenはopaque stringとして扱い、JWT decode、claim/audience解析、token内容のlog/trace/hash以外の永続化を禁止する。principalはARM/provider readback済みtenantId/objectIdとfallbackなしの`ManagedIdentityCredential({objectId})`構築、scopeは`getToken(tokenScope)`へ渡したexact引数で固定し、token自身から推測しない。有効期限はSDK `expiresOnTimestamp`だけを検証する。最終identity oracleはreal login後の`current_user===roleName`とAzure PostgreSQL Entra mapping provider readbackである。
- cutoverはserverを0 replica・active request/DB session 0へdrainし、current journal generationのleaseを30秒ごとにrenewしながら(1)F old→new full copy、(2)oldへD migration適用、(3)F new→old idempotent full rehydrate、(4)新旧catalog/data/accepted-ledger/raw0 equality、(5)quoted ETag CAS、(6)new writer再開の順とする。journal stepは`drained→forward_copied→old_schema_applied→old_rehydrated→equality_verified→route_cas→new_writer_started`だけで、restartはblob正本とprovider readback済みstepだけをskipする。runner交代はlease expiry後、同じcutoverId/target SHA/branch/resource IDs/generationと全provider readbackが一致する場合だけ新leaseOwnerをCASする。revoke済みgenerationは再開せずfresh approval+fresh generation+fresh ephemeral UAMI/FICを要求する。step 4 exact一致前のroute CASを禁止する。cutover-guardは旧新DB非依存、zone-redundant ACA Environment、public ingressなし、private VNet、minReplicas=3のtrusted Azure Container Appで、同じtarget-SHA server image digestの`node packages/server/dist/cutoverGuardMain.js`だけを起動して5秒loopする。startup/readiness/liveness probeは各`/health/startup|ready|live`、interval 5秒、failure threshold `12|2|3`で、readyは直近journal scanが10秒以内の場合だけ200とする。revision更新はnew revision 3 replica ready+連続2 scan後にだけold revisionを停止する。各replicaはjournal ETag CASでrevoke winnerを1件に収束させる。lease 60秒stale、grant absolute expiry、G terminal/STOP、CAS indeterminate、またはH BLOCKED/closedを検出するとfreshnessよりrevokeを優先する。最悪poll位相でstale検出65秒、DELETE受理30秒、Azure RBAC/FIC propagation込みPUT 403 readback 11分をSLOとする。403未確認中はwriter/rollback/regrant 0、超過はSEV-1/STOPとする。guardはPhase 0でsandbox証明したcondition/topologyでcurrent generationのnamed assignment/FICだけを削除する。実障害注入は単一replica killとrevision handoffまでとし、ACAのzone-selective faultが公式Chaos Studio fault libraryにないため単一zone outageを注入済みと主張しない。zone redundancyはprovider `zoneRedundant=true` readbackで保証し、zone outageはData Owner署名のnon-injectable residual riskとする。regional/control-plane outageも前段risk契約へ従う。60分rollbackはjournalのrollbackDeadline/current blob versionだけを使う。H close後Iはcurrent generation revoked/PUT403→migration access→runtime old access→old networkの順にrevoke/readbackし、その後だけkey/copyを破棄する。same-clusterはdrain中にD/readbackだけを行いApp Configuration/journal request 0。resource/manifest/data/ledger/ETag/journal/session/identityの一つでも不明ならwriterを再開しない。
- ここでmetadata-only replacementは原則として新しいPostgreSQL cluster/storageとdistinct customer-managed keyへのcutoverを意味する。同一cluster内のtable replacementを許すのは、legacy tableへrawが一度も書かれておらず、heap/toast/WAL/PITR/replica/backup全てraw 0を事前証明した場合だけである。旧keyが他dataと共有ならcrypto-shredを主張せず、全legacy copyのprovider deletion/expiryとrestore negative readbackが終わるまでBLOCKEDとする。
- main DBへ保存できるsource evidenceはtenant/team/channel/mailbox/message ID、Teams authorまたはOutlook sender/from stable subjectのkey-versioned HMAC-SHA-256、meeting-sender master version/digest、Graph etag、UTC created/lastModified、deleted flag、sanitized text SHA-256、thread/message SHA-256、source URLのopaque ID、proposal IDだけである。HMAC keyはDB/logへ保存せずprotected secret providerから注入する。proposalは抽出済みoperation payloadだけを持ち、原文引用を持たない。
- Teams/Outlook text normalization version 1は、Graph bodyの`contentType=text`をそのまま、`html`をexact `parse5@7.3.0`の`parseFragment(html,{scriptingEnabled:false,onParseError})`へ通す。parse error、non-HTML namespace、またはallowlist外elementは`source_html_unsupported`でproposal 0とする。allowlistは`html|head|body|meta|title|style|div|p|br|span|b|strong|i|em|u|s|strike|ul|ol|li|blockquote|pre|code|h1|h2|h3|h4|h5|h6|table|thead|tbody|tfoot|tr|th|td|a`、`head|meta|title|style|script`内容は出力0、`br`はLF、block end=`div|p|li|blockquote|pre|h1..h6|tr|th|td|table`はLF、text nodeはparse5がdecodeしたUnicode textを順に連結する。`script`は内容除去対象としてのみ認識し、実行/出力しない。その後Unicode NFC、NBSP→U+0020、CRLF/CR→LF、各行末のU+0020/TAB除去、先頭末尾の空行除去をこの順で行う。内部spaceと連続空行は保持し、UTF-8 bytesのSHA-256を`sanitizedTextSha256`とする。`subjectSha256`はsubjectをHTML解釈せず、Unicode NFC、CRLF/CR→LF、UTF-8 encodeの順で正規化したexact bytesのSHA-256とする。golden fixtureでparser/version/options/element/block/entity/malformed byte driftを拒否する。Teams thread canonical serialization version 1はUTF-8で、header `aiops-thread-v1\n`の後にrootと全replyを`createdDateTime UTC昇順`、同値なら`messageId`のUnicode code point昇順で並べ、各行を`kind<TAB>messageId<TAB>etag<TAB>lastModifiedDateTime<TAB>deleted(0|1)<TAB>sanitizedTextSha256\n`とする。rootは`kind=root`、replyは`kind=reply`。追加、編集、削除、tombstone、ID/etag/time/hash/order変更はthread SHA-256を必ず変える。
- `script`だけはallowlist外element拒否の例外としてdrop-onlyで受理し、elementと全descendant textを出力しない。属性値は全elementで出力せず、URL取得、CSS解釈、script実行、network accessを行わない。
- Outlook message canonical serialization version 1は全GET/delta pageへ`Prefer: IdType="ImmutableId"`を付け、UTF-8 header `aiops-outlook-message-v1\n`の後へRFC 8785でcanonicalizeした`{tenantId,mailboxObjectId,parentFolderId,immutableMessageId,changeKey,etag,receivedDateTime,lastModifiedDateTime,deleted,subjectSha256,bodyTextSha256,senderSubjectHmac,fromSubjectHmac,senderMasterVersion,senderMasterDigest}`とLFを連結してSHA-256する。moveでimmutable message IDが維持されても`parentFolderId`変更で必ずstaleとなる。初期scopeのGraph `sender/from.emailAddress.address`はExchange owner承認済みinternal ASCII SMTP addr-specだけを許可し、WHATWG/Unicode/IDNA変換を行わず、ASCII全体をlowercaseしたUS-ASCII bytesをprotected key/versionでHMACしてraw addressを破棄する。non-ASCII、quoted local-part、comment、display-name混在、invalid addr-spec、external domainはrejectする。runtime tenant-wide directory lookupは行わない。immutable SHAから取得してRFC 8785/Ed25519検証した`meeting-senders.v1.json`だけがaddress HMAC→same-tenant Entra subject OID/shared-mailbox object IDと期限付きdelegate OID→shared mailbox規則を解決する。通常送信はsender/from HMACが同じactive subject、代理送信はsenderがactive delegate、fromとtarget mailboxがactive shared mailbox、delegate ruleが全て一致する場合だけ受理する。external/unresolved/ambiguous/expired/revoked mapping、display name/email文字列だけの一致を拒否する。
- serializerはfull GETまたはfull delta active itemの`deleted=false`だけを受ける。Graph delta `@removed`は欠落fieldを補完して新message hashを捏造しない。同じImmutableIdを`Prefer: IdType="ImmutableId"`付きでGETし、200ならmove/editとして現parentFolderId/full itemを再canonicalize、404/410なら既存source evidenceのprior message hashを参照するmetadata-only `deleted=true` tombstoneをappendしてpending proposalをstaleにする。tombstone unique keyは`(mailboxObjectId,immutableMessageId,priorEvidenceId,deleted=true)`、`observedAt`はapplication観測時刻でsource timestampではない。同prior retryはexact 1、new active evidence後の再削除はnew priorEvidenceIdでexact 1。429/5xx/timeoutは`verification_failed`、unknown ImmutableId tombstoneは監査だけでmetadata/proposal 0とし、全分岐でGitHub write 0。
- Teams/Outlookは各ingestion開始時に`readAndAssertIngestionEnabled()`でenabled+epochを取得し、disabledならGraph/LLM/metadata/proposal callを全て0にする。proposal作成時、approval POST直前、execution直前にGraphからroot/reply全pageまたはmessageを再取得し、署名済みsender masterの同一immutable source/version/digest/validity/revocationを再検証してsource hashを再計算する。一致しなければ`stale`、proposal作成前のGraph/master readback不能はproposalを作らずHTTP 503 `{status:"verification_failed",errorCode:"source_read_unavailable"}`+clarification、approval/execution前はattempt row 0の`verification_failed`とし、いずれもGitHub write 0とする。proposal commit直前は取得済みepochを`FOR SHARE` lock下で再検証する。executionではさらにsession-level shared minutes gate lockをattempt commit前からexternal terminal/indeterminate commit後まで保持し、detectorのdisable commitを排他する。これによりdisable commit時点以降の新規/既存meeting mutationを0にする。`indeterminate`はexternal mutation request送信後だけである。interactive agentはGraph sourceを要求せず、authenticated requester `(tid,oid,clientId)`、one-time POST body SHA-256、signed project mappingを同じ3時点で検証し、stored derived payloadだけをno-store reviewへ表示する。coding taskはこのverified master/source contextをP010 approval context providerへ必須入力し、approval/dispatch直前に同じ規則で再検証する。
- applicationがraw本文を保持しないため、90日raw retentionと5年LTRは衝突しない。legal holdはMicrosoft 365/Purviewのsource-system policyだけを正本とし、本applicationに第二のhold table/APIを作らない。sourceがhold/retentionにより再取得不能ならpending proposalを`stale`へ終了し、hashだけを監査に残す。
- 移行前inventoryでlive heap/toast、replica、WAL/PITR、snapshot/base backup/export/provider backupの全対象にraw本文が存在しないと証明できる場合だけ自動移行できる。1件以上またはinventory不明なら前記replacement cutoverとcrypto-shred/delete/expiry/readbackを完了するまでSTOPする。Records/Data Ownerの例外はhold継続理由を記録できるがproduction gate/Doneを解除できない。migration後のdirect SQLで旧raw/display columnへINSERT/UPDATEするとPostgreSQLが`undefined_column`で拒否しなければならない。
- raw non-persistence SLOはraw/display column 0、raw write privilege/path 0を常時維持すること。singleton `minutes_ingestion_gate(id=1,enabled,epoch,incident_id)`をDB正本とし、各pollerは外部Graph read前のepochを記録し、metadata/proposal write直前の短いtransactionでgate rowを`FOR SHARE` lockして`enabled=true`かつepoch一致を検証してからwriteする。detectorは同rowをexclusive lockし、incident open、`enabled=false`、epoch incrementを同一transactionでcommitする。これにより外部read中にdisableされたworkerはwrite 0で停止する。startup/毎時schema guardが禁止column/pathを検出したらdurable `raw_content_incidents`をexact 1件openして全minutes ingestionをdisableし、即時SEV-1/Data Owner通知する。schema cleanup、live/replica/WAL/PITR/backup復元不能readback、root-cause evidence、Plan 010の別人owner承認が揃いincidentをcloseするまで、restartしても再開しない。
- 抽出済みoperation text payloadはraw sourceではないがPII/業務記録として扱う。generic proposalはpending期限30分とsweep遅延上限24時間だけ暗号化済みPostgreSQLへ保持し、全terminal時はterminal/audit/outbox transaction内でtitle/body等をSHA-256へredactする。coding task `instruction`はqueued/dispatching中だけ最大30分/5分保持する。workflow dispatch 2xxはrun correlationだけを保存し、OIDC brokerのidempotent ACK transaction、5分orphan/ACK不明のindeterminate transaction、または他terminal transactionだけが`instruction=NULL`、SHA-256、redacted_atをatomic更新する。runnerはmatching signed start receipt+DB readback前にagent/artifact/publisherを開始しない。sweep ownerは`codingTaskRetentionTask`、実行間隔1分、遅延SLO 5分とし、source-system holdで延長しない。kind、numeric target、payload/instruction hash、provider ID、sanitized reason/audit metadataは既存5年LTR policyで保持する。

議事録sourceのexact triggerは次のとおり。

- Teams: allowlist済み`project_channels`で`minutes_ingestion_enabled=true`、root messageのplain textが`[議事録]`または`[MINUTES]`で始まる場合だけ。通常会話、reply単体、添付だけの投稿は対象外。
- Outlook: Exchange Application RBACで限定したmailbox/folderに届き、subjectが`[PJ-nnn][議事録]`または`[PJ-nnn][MINUTES]`で始まる場合だけ。senderはstakeholder masterでexact matchする。
- Teams transcript API、録画、添付ファイルOCR、DOCX/PDF parsing、private channel meetingは初期scope外。必要性とtenant権限が承認された別Planで追加する。
- source本文はDB保存前に`sanitizeSecrets()`、LLM前に`sanitizeForLlmInput()`、返信/コメント前に再度`sanitizeSecrets()`する。
- source-system legal holdとnon-persistenceは上記contractだけを使用する。proposal/auditへ本文全文やexcerptを保存しない。

## Commands you will need

| Purpose                 | Command                                                                                                                                                                                                                                                                                                                            | Expected on success                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Baseline SHA            | `git rev-parse --short HEAD`                                                                                                                                                                                                                                                                                                       | planned SHAまたはdrift確認済みSHA                                     |
| Scope check             | `git diff --name-only origin/main...HEAD`                                                                                                                                                                                                                                                                                          | task packetのAllowed filesだけ                                        |
| Focused shared tests    | `pnpm --filter @aiops/shared test -- githubClient graphClient`                                                                                                                                                                                                                                                                     | all pass                                                              |
| Focused PrjOps tests    | `pnpm --filter @aiops/prjops test -- commandParser minutes`                                                                                                                                                                                                                                                                        | all pass                                                              |
| Focused server tests    | `pnpm --filter @aiops/server test -- teamsConversation operationProposal graphNotifications minutes`                                                                                                                                                                                                                               | all pass                                                              |
| Focused web tests       | `pnpm --filter @aiops/web test -- ProjectPicker ProjectBoard`                                                                                                                                                                                                                                                                      | all pass                                                              |
| Workflow lint           | `mise run actionlint`                                                                                                                                                                                                                                                                                                              | pinned actionlint v1.7.12、workflow filesだけを検査してexit 0         |
| Composite action policy | `pnpm --filter @aiops/server test -- agentOperationAssets.test.ts`                                                                                                                                                                                                                                                                 | composite metadataとcredential/command policyがgreen                  |
| Agent asset inventory   | `git ls-files '.agents/skills/**' '.claude/**' '.factory/**' '.codex/**'`                                                                                                                                                                                                                                                          | expected golden list only                                             |
| Codex rule positive     | `codex execpolicy check --pretty --rules .codex/rules/default.rules -- gh pr view 1`                                                                                                                                                                                                                                               | allowまたはpromptのexpected decision                                  |
| Codex rule negative     | `codex execpolicy check --pretty --rules .codex/rules/default.rules -- gh pr merge 1`                                                                                                                                                                                                                                              | forbidden                                                             |
| Migration fresh/upgrade | existing Plan 001 PostgreSQL harness                                                                                                                                                                                                                                                                                               | fresh、upgrade、second run all exit 0                                 |
| Full gate               | `MISE_LOCKED=1 mise install && MISE_LOCKED=1 mise run ci`                                                                                                                                                                                                                                                                          | network再解決なし、checksum lock使用、exit 0                          |
| Diff whitespace         | `git diff --check`                                                                                                                                                                                                                                                                                                                 | no output, exit 0                                                     |
| Crit gate               | `make require-crit-review`                                                                                                                                                                                                                                                                                                         | pass、またはtarget不在を明記してCrit data/manual review receiptへ代替 |
| GitHub sandbox run      | Teams/API sandboxでinstruction付きcoding taskを作成→別人承認し、serverのopaque-input自動dispatchを待つ。診断時だけ`gh workflow run coding-task.yml --repo "$AIOPS_SANDBOX_REPO" -f task_id="$APPROVED_TASK_ID" -f project_id="$AIOPS_SANDBOX_PROJECT_ID" -f base_ref=main -f agent=claude-code`を使い、instruction inputは渡さない | draft PR、workflow inputs/logにinstruction 0、main mutation 0         |
| Remote state            | `gh run list --workflow coding-task.yml --limit 5 --json databaseId,status,conclusion,url`                                                                                                                                                                                                                                         | completed success evidence                                            |

## Suggested executor toolkit

- Orchestrator/reviewer/high-risk worker: Codex Models公式ページのexact CLI slug `model=gpt-5.6-sol`、`model_reasoning_effort=high`に固定する。`/model`またはagent metadataで実際に解決されたslugとreasoning effortを証跡へ記録する。runtime inventoryにexact slugがなければ別modelへ黙ってfallbackせずSTOPする。
- Mechanical worker: current public Codex manualの`gpt-5.6-terra`、`model_reasoning_effort=medium`を、read-only探索、既知fixture、docs parityだけに使える。runtime inventoryに表示されない場合は強制せず、利用可能なモデルをorchestratorが比例性に基づいて選び、resolved slugを記録する。認証、migration、concurrency、外部write、CI publisherは担当させない。
- Escalation: high workerの明示修正後に同じ`root_cause_key`が再発した場合だけ、runtimeで利用可能と確認できる`xhigh`/`max`へ上げる。名称やavailabilityを確認できなければSTOPする。
- Reviewerはworkerと別thread・別contextでread-only実行し、correctness/security/privacy/operations/accessibility/negative pathを確認する。
- Ponytail full: 既存`GitHubClient`、Graph subscription/delta、events queue、Plan 010 approval、GitHub Projects v2 snapshotを再利用する。MCP server、第二のboard DB、汎用operation DSLは追加しない。新dependencyはexact `@microsoft/teams.apps@2.0.13`、`parse5@7.3.0`、`@azure/app-configuration@1.12.1`、`@azure/identity@4.13.1`、`@azure/keyvault-secrets@4.11.2`、`@azure/keyvault-keys@4.10.2`、`@azure/storage-blob@12.33.0`、`@kubernetes/client-node@1.4.0`だけを許可し、`pnpm-lock.yaml`で固定する。各SDK client/fetch/credentialはconstructorまたは引数で注入し、unit testはnetwork 0で実行する。

## Scope

**In scope**:

- `docs/adr/`または`docs/spec/productization-decisions.md` — conversational ProjectV2 write boundaryとmeeting source contract。
- `packages/prjops/src/lib/commandParser.ts`、`packages/server/src/lib/freeTextIntent.ts` — exact intent schemaとpermission matrix。
- `packages/shared/src/clients/githubClient.ts`、`packages/shared/src/clients/graphClient.ts` — allowlistされた最小read/write API。
- `packages/server/src/lib/operationProposal.ts`、`packages/server/src/db/operationProposalsRepo.ts`、`packages/server/src/agents/teamsConversationAgent.ts`、`packages/server/src/agents/meetingMinutesAgent.ts` — pure policy、永続state、thin orchestration。
- `packages/devops/src/db/schema.sql`と各schema taskが明記する独立migration — proposal/queue/attempt/outbox、metadata-only replacement source evidence、durable ingestion gate/raw incidentのfresh/upgrade形。
- `packages/server/src/lib/operationApprovalAdapter.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts` — Plan 010の既存approval route/repoへcomposition接続。新approval routeは作らない。
- Graph lifecycle/event queue、Outlook receive/delta、Teams reply backfillの必要最小修正。
- `packages/*/tests/`のtask別unit/integration/real PostgreSQL tests。
- `.agents/skills/github-operations/SKILL.md`、`.claude/skills/github-operations/SKILL.md`、`.factory/skills/github-operations/SKILL.md` — 同一operation allowlistを参照する薄いprovider wrapper。
- `.codex/agents/`、`.codex/rules/default.rules`、`.claude/settings.json`、`.claude/hooks/typecheck-after-edit.mjs`、`.factory/droids/github-operations.md` — 必要最小のagent/review/policy資産。
- `infra/agent-sandbox/`、`scripts/run-isolated-readonly-agent.mjs` — host credentialから分離したephemeral interactive-agent実行境界。
- `runbooks/conversational-github-operations.md`、`runbooks/meeting-minutes-intake.md`、既存HTTP/agent reference。

**Out of scope**:

- GitHub Pages。Pagesはstatic HTML/CSS/JS hostingで、認証済みNext/Hono/PostgreSQL dashboardの実行基盤ではない。public/static docs公開のowner要件が確定した場合だけ別Planを作る。
- PR merge、自動merge、PR approval、main直接push、force push。今回までの過去merge例外を継承しない。
- Kanban drag-and-drop、keyboard reordering、ProjectV2 item追加/削除/archive/reorder/全field mutation。
- 任意REST/GraphQL/shellを自然言語から実行する汎用tool。
- 新しいMCP server、message broker、workflow engine、第二のproject registry、第二のKanban DB。
- Teams meeting transcript/recording、private channel meeting、添付ファイル/OCR、SharePoint/OneDrive文書取込。
- production tenant/repositoryへ直接書くtest。全外部writeは破棄可能sandboxだけ。
- provider/model追加、LLMによる数値/権限/project/repository/Status option IDの決定。

## Git workflow

- taskごとに`agent/p012-fNN-tNN-<slug>` branchを作る。mainへ直接pushしない。
- schema変更taskはschema、migration、repo、fresh/upgrade/idempotency testを同一PRに含める。
- AI PRは`ai-generated` label、draftで作成し、人間reviewerの承認前にmergeしない。
- commitはConventional Commits。例: `feat(ops): add confirmed issue comment proposals`。
- task packetに列挙した個別Allowed files以外を変更しない。必要になったらSTOPして新packetを発行する。

## Dependency and model assignment

`docs/contracts/plan-012-task-dag.json`は次のdirect prerequisite集合を完全一致でmachine-readable化する。rangeの暗黙展開、表にない依存、推測した並列化は禁止する。

| Task     | Direct prerequisites                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| F00-T01  | clean isolated checkout、`origin/main`                                                            |
| F00-T02  | F00-T01                                                                                           |
| F00-T03  | F00-T02、DEC-SPEC-008                                                                             |
| F00-T04  | F00-T03                                                                                           |
| F00-T05  | F00-T04,DEC-ENV-002                                                                               |
| F00-T05P | F00-T01                                                                                           |
| F00-T06  | F00-T01,F00-T02,F00-T03,F00-T04,F00-T05,F00-T05P                                                  |
| F01-T01  | F00-T06                                                                                           |
| F01-T02  | F01-T01                                                                                           |
| F01-T03  | F01-T01                                                                                           |
| F01-T04  | F01-T02,F01-T03                                                                                   |
| F01-T05  | F01-T04,P010-F03-T05                                                                              |
| F01-T06  | F01-T05                                                                                           |
| F01-T07  | F01-T06,P010-F03-T08                                                                              |
| F01-T08  | F01-T07                                                                                           |
| F01-T09  | F01-T01,F01-T02,F01-T03,F01-T04,F01-T05,F01-T06,F01-T07,F01-T08                                   |
| F02-T01A | F01-T09,P010-F02-T14                                                                              |
| F02-T01B | F02-T01A                                                                                          |
| F02-T01C | F02-T01B                                                                                          |
| F02-T01D | F02-T01B                                                                                          |
| F02-T01E | F02-T01C,F02-T01D                                                                                 |
| F02-T01F | F02-T01E                                                                                          |
| F02-T02  | F02-T01F,P010-F05-T14                                                                             |
| F02-T03  | F02-T02,P010-F03-T08                                                                              |
| F02-T04  | F02-T03                                                                                           |
| F02-T05  | F02-T04                                                                                           |
| F02-T06  | F02-T05                                                                                           |
| F02-T07  | F02-T06,P010-F05-T10,P010-F05-T11,P010-F05-T12,P010-F05-T13,P010-F05-T14                          |
| F02-T07R | F02-T07                                                                                           |
| F02-T08  | F02-T07R                                                                                          |
| F02-T09  | F02-T01F,F02-T02,F02-T03,F02-T04,F02-T05,F02-T06,F02-T07,F02-T07R,F02-T08                         |
| F03-T01  | F00-T06,F01-T09,F02-T04,P010-F03-T08,P010-F04-T03                                                 |
| F03-T02  | F03-T01                                                                                           |
| F03-T03A | F03-T02                                                                                           |
| F03-T03B | F03-T03A                                                                                          |
| F03-T03P | F03-T03B                                                                                          |
| F03-T03Q | F03-T03P                                                                                          |
| F03-T03C | F03-T03Q                                                                                          |
| F03-T03D | F03-T03C                                                                                          |
| F03-T03E | F03-T03D                                                                                          |
| F03-T03S | F03-T03C,F00-T05P                                                                                 |
| F03-T03R | F03-T03D,F03-T03S                                                                                 |
| F03-T03T | F03-T03R                                                                                          |
| F03-T03F | F03-T03E,F03-T03T                                                                                 |
| F03-T03G | F03-T03F                                                                                          |
| F03-T03H | F03-T03G                                                                                          |
| F03-T03I | F03-T03H                                                                                          |
| F03-T03J | F03-T03I                                                                                          |
| F03-T03K | F03-T03J                                                                                          |
| F03-T03L | F03-T03K                                                                                          |
| F03-T03M | F03-T03L                                                                                          |
| F03-T03N | F03-T03M                                                                                          |
| F03-T03O | F03-T03N                                                                                          |
| F03-T04A | F03-T03O,DEC-ENV-001                                                                              |
| F03-T04B | F03-T04A                                                                                          |
| F03-T05  | F03-T04B                                                                                          |
| F03-T06  | F03-T05                                                                                           |
| F03-T07  | F03-T06                                                                                           |
| F03-T08  | F03-T07                                                                                           |
| F03-T09  | F03-T08                                                                                           |
| F03-T10  | F03-T09,F01-T09                                                                                   |
| F03-T11  | F03-T10                                                                                           |
| F03-T12  | F03-T01,F03-T02,F03-T03O,F03-T04B,F03-T05,F03-T06,F03-T07,F03-T08,F03-T09,F03-T10,F03-T11         |
| F03-T13  | F03-T01,F03-T02,F03-T03O,F03-T04B,F03-T05,F03-T06,F03-T07,F03-T08,F03-T09,F03-T10,F03-T11,F03-T12 |
| F04-T01  | F00-T06,F01-T09,F02-T04,P010-F03-T08                                                              |
| F04-T02  | F04-T01                                                                                           |
| F04-T03  | F04-T02                                                                                           |
| F04-T04  | F04-T03                                                                                           |
| F04-T05A | F04-T04,DEC-ENV-004                                                                               |
| F04-T05B | F04-T05A                                                                                          |
| F04-T05C | F04-T05B                                                                                          |
| F04-T05D | F04-T05A,F04-T05C                                                                                 |
| F04-T05E | F04-T05B,F04-T05D                                                                                 |
| F04-T05F | F04-T05D                                                                                          |
| F04-T05G | F04-T05D                                                                                          |
| F04-T05H | F04-T05E,F04-T05F,F04-T05G                                                                        |
| F04-T06A | F04-T04,F04-T05H                                                                                  |
| F04-T06B | F04-T06A                                                                                          |
| F04-T06C | F04-T06A                                                                                          |
| F04-T06D | F04-T06A                                                                                          |
| F04-T06E | F04-T06B,F04-T06C,F04-T06D                                                                        |
| F04-T07  | F04-T04,F04-T05H,F04-T06E                                                                         |
| F04-T08  | F04-T01,F04-T02,F04-T03,F04-T04,F04-T05H,F04-T06E,F04-T07                                         |
| F05-T01  | P010-F02-T10                                                                                      |
| F05-T02  | F05-T01,P010-F02-T11                                                                              |
| F05-T03  | F05-T02,P010-F02-T12,P010-F02-T13,P010-F02-T14,P012-F00-T03                                       |
| F06-T01  | F02-T09,F03-T13,F04-T08,F05-T03,P010-F05-T14,Plan 011 acceptance                                  |
| F06-T02  | F06-T01                                                                                           |
| F06-T03  | F06-T02                                                                                           |
| F06-T04  | F06-T03                                                                                           |
| F06-T05  | F06-T04                                                                                           |
| F06-T06  | F06-T05                                                                                           |
| F06-T07  | F06-T06                                                                                           |
| F06-T08  | F06-T01,F06-T02,F06-T03,F06-T04,F06-T05,F06-T06,F06-T07                                           |
| F06-T09  | F06-T01,F06-T02,F06-T03,F06-T04,F06-T05,F06-T06,F06-T07,F06-T08                                   |
| F07-T01  | F06-T09                                                                                           |
| F07-T02  | F07-T01                                                                                           |
| F07-T03  | F07-T02                                                                                           |
| F07-T04  | F07-T01,F07-T02,F07-T03                                                                           |

### Formal atomic tasks for decomposed gate groups

直後の40 formal task節が実行指示・Allowed filesの正本である。全formal taskは各節のAllowed filesに加え、task IDを大文字のまま代入したexact 3 path `.orchestration/evidence/P012-<TASK-ID>/commands.json`、`.orchestration/evidence/P012-<TASK-ID>/readback.json`、`.orchestration/evidence/P012-<TASK-ID>/evidence.json`だけを常に変更できる。この3件は実行command/exit、provider readback、SHA/receipt/cleanupの必須証跡であり、欠落taskはACCEPTEDにできない。後段の旧F02-T01/F03-T03/F03-T04/F04-T05/F04-T06節はcontractをまとめる非実行gate-group summaryで、変更を直接行わない。各groupは末尾task ACCEPTED時だけaccepted aliasとなる。

#### P012-F02-T01A Teams SDK/config/manifest/IaCを固定する

- **Preconditions**: F01-T09、P010-F02-T14 ACCEPTED。
- **Allowed files**: `packages/server/package.json`、`pnpm-lock.yaml`、`.env.example`、`packages/server/src/config.ts`、`packages/server/tests/config.test.ts`、`packages/server/tests/teamsAppManifest.test.ts`、`docs/teams-app/manifest.json`、`docs/teams-app/README.md`、新規`infra/bicep/main.bicep`、新規`infra/bicep/modules/teams-bot.bicep`、新規`packages/server/tests/infraBicepComposition.test.ts`だけ。
- **Work**: SDK 2.0.13 pin、5 exact config、AppOptions.token rotation、manifest、teams-bot Bicepを実装する。
- **Complete**: config/manifest/Bicepが同じtenant/app/object ID/full service base/Key Vault URIを参照する。
- **Verify Positive**: existing `teamsAppManifest.test.ts`を含むmanifest ID/scope/RSC、old/new secret overlap中のno-restart rotation、legacy RSC regressionがgreen。
- **Verify Adversarial**: manifest app/object ID substitution、scope/RSC欠落、plain secret env、origin-only URL、module overwriteをredにする。
- **STOP**: official token callbackでrotationできない。

#### P012-F02-T01B authenticated Teams inbound bridgeを実装する

- **Preconditions**: F02-T01A ACCEPTED。
- **Allowed files**: 新規`packages/server/src/http/routes/teamsBotActivities.ts`、`packages/server/src/http/app.ts`、新規`packages/server/tests/teamsBotActivities.test.ts`だけ。
- **Work**: POST/JSON/body/time/header gateからSDK HttpServerへbody+headersを渡す。
- **Complete**: SDK JWT検証を迂回するparse/log/persistenceが0。
- **Verify Positive**: valid install/activityがSDK handlerへexact 1回到達する。
- **Verify Adversarial**: 0/max/max+1、malformed、slow、compressed、duplicate auth、forged JWTを拒否する。
- **STOP**: Hono adapterでraw activityを保存しないとSDKを使えない。

#### P012-F02-T01C conversation reference/proactive clientを実装する

- **Preconditions**: F02-T01B ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140145_teams_conversation_references.sql`、新規`packages/server/src/db/teamsConversationReferencesRepo.ts`、新規`packages/server/src/clients/teamsProactiveClient.ts`、新規`packages/server/tests/teamsConversationReferencesRepo.test.ts`、新規`packages/server/tests/teamsProactiveClient.test.ts`だけ。
- **Work**: personal/channel union、full service base、install/revoke、SDK send/replyを実装する。
- **Complete**: active key cardinality 1、raw activity/address 0、request 0/1。
- **Verify Positive**: install→send/reply→uninstallと`/teams` path保持がgreen。
- **Verify Adversarial**: origin-only/path confusion/SSRF、wrong tenant/bot/object ID、revoked referenceを拒否する。
- **STOP**: Graph chat POSTまたはdelegated tokenが必要。

#### P012-F02-T01D canonical Teams ingress CASを実装する

- **Preconditions**: F02-T01B ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140147_teams_intent_ingress.sql`、新規`packages/server/src/db/teamsIntentIngressRepo.ts`、新規`packages/server/tests/teamsIntentIngressRepo.test.ts`だけ。
- **Work**: revision-v1、unique/CHECK/lease/CAS/origin bits/self-sender filterを実装する。
- **Complete**: processed/failed immutable、crash reclaim、downstream correlation exact 1。
- **Verify Positive**: SDK/Graph equivalence、20 duplicate、edit/revert/restartが期待row数。
- **Verify Adversarial**: bot reply100回、same-text new-etag、ID不一致dual ingressをfail-closeする。
- **STOP**: SDK/Graph equivalenceなしでdual executionを要求する。

#### P012-F02-T01E read intentをwinnerへ結線する

- **Preconditions**: F02-T01C、F02-T01D ACCEPTED。
- **Allowed files**: `packages/server/src/agents/teamsConversationAgent.ts`、`packages/server/src/index.ts`、`packages/server/tests/teamsConversationAgent.test.ts`だけ。
- **Work**: C/D portsをDIし、winnerだけquery 3種とreplyを実行する。
- **Complete**: same revisionのparse/reply各1、loser reply0、mutation0。
- **Verify Positive**: Issue/PR/board readがproject scope内でsanitized replyを返す。
- **Verify Adversarial**: wrong project/persona、secret title、self/system sender、duplicateを拒否する。
- **STOP**: P010 board acceptanceが未完。

#### P012-F02-T01F Teams foundation acceptanceを記録する

- **Preconditions**: F02-T01E ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F02-T01F/commands.json`、`.orchestration/evidence/P012-F02-T01F/readback.json`、`.orchestration/evidence/P012-F02-T01F/evidence.json`だけ。
- **Work**: same SHAでinstall→dual ingress→3 read→proactive→rotation→uninstall→cleanupを実行する。
- **Complete**: A-E evidence SHA一致、external cleanup完了。
- **Verify Positive**: SDK/Graph相関可能時dual、不能時Graph-onlyがreceiptどおり。
- **Verify Adversarial**: legacy RSC破損、bot loop、raw evidenceをrejectする。
- **STOP**: sandbox install/cleanupまたはcredential ownerが不在。

#### P012-F03-T03A raw copy inventoryを固定する

- **Preconditions**: F03-T02 ACCEPTED。
- **Allowed files**: `runbooks/channel-messages-purge.md`、`.orchestration/evidence/P012-F03-T03A/commands.json`、`.orchestration/evidence/P012-F03-T03A/readback.json`、`.orchestration/evidence/P012-F03-T03A/evidence.json`だけ。
- **Work**: live heap/TOAST、replica、WAL archive/PITR、snapshot、base backup、export、provider backupをread-only取得する。
- **Complete**: 各copyのowner、resource ID、key ID、retention、raw countまたは観測errorが一意に記録される。
- **Verify Positive**: commands exit/status、readback SHA-256、inventory resource集合が一致する。
- **Verify Adversarial**: unknown/unauthorized/timeoutをraw0へ変換せず`unknown`で残す。
- **STOP**: 一copyでもresource ownerを特定できない。

#### P012-F03-T03B records/data-owner decisionを固定する

- **Preconditions**: F03-T03A ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F03-T03B/decision.json`、`.orchestration/evidence/P012-F03-T03B/approvals.json`、`.orchestration/evidence/P012-F03-T03B/evidence.json`だけ。
- **Work**: Records OwnerとData OwnerがAの全copy raw0なら`same_cluster`、raw1件以上またはunknownなら`replacement`を署名する。
- **Complete**: inventory SHA、decision、owner subject、expiry、legal-hold状態が改ざん検知付きで一致する。
- **Verify Positive**: raw0/all-known fixtureだけ`same_cluster`、raw-present/unknown fixtureは`replacement`になる。
- **Verify Adversarial**: owner不在、期限切れ、inventory hash drift、未解決legal holdをrejectする。
- **STOP**: legal holdの処理根拠または両owner署名がない。

#### P012-F03-T03P dedicated platform DB routing storeをbootstrapする

- **Preconditions**: F03-T03B ACCEPTED。
- **Allowed files**: `infra/bicep/main.bicep`、新規`infra/bicep/modules/platform-db-routing.bicep`、新規`packages/server/tests/platformDbRoutingBicep.test.ts`だけ。
- **Work**: signed environment masterの既存old-DB versioned Key Vault secret URIはmetadataだけをattestする。専用Azure App Configuration store、exact `(key="aiops/prod/platform-database/connection-secret-uri",label=null)` 1件、runtime reader UAMI、secret/DB access 0のcutover UAMIを作る。`enablePlatformDbCutoverRole`はdefault/tracked desired stateともfalseとしPではrole assignment/FICを作らない。value/content-type/quoted ETag wire contractを固定し、全label列挙で他label 0、store内他key 0を確認する。
- **Complete**: old URI/version/content-type/quoted ETagが一致し、runtimeはまだ旧`DATABASE_URL`を使う。cutover UAMIのstore/secret/DB role assignmentとactive FICは0。
- **Verify Positive**: Bicep build/what-if、key/label cardinality、exact JSON bytes、quoted ETag、default false、cutover PUT 403がsigned masterと一致する。
- **Verify Adversarial**: shared/multi-key store、non-null label、trailing LF/whitespace、unversioned URI、ETag dequote/base64/requote、cutover secret/DB grantをrejectする。
- **STOP**: current old connectionのversioned secret URI、store/key/label、quoted ETagをowner管理できない。

#### P012-F03-T03Q global platform DB resolverへ切り替える

- **Preconditions**: F03-T03P ACCEPTED。
- **Allowed files**: `packages/server/package.json`、`pnpm-lock.yaml`、新規`packages/server/src/clients/platformDatabaseConnectionResolver.ts`、`packages/server/src/config.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/platformDatabaseConnectionResolver.test.ts`、`packages/server/tests/config.test.ts`だけ。
- **Work**: exact `@azure/app-configuration@1.12.1`、`@azure/identity@4.13.1`、`@azure/keyvault-secrets@4.11.2`を本task自身でpinする。signed store/key/null-label/runtime UAMIをDIし、全label cardinality、content-type、quoted ETag、versioned URIを検証する。secret payloadはlegacy期間のversioned password/DSN unionと、target用credential-free exact `{version:1,auth:"entra",hostAsciiLower,port,database,sslmode:"verify-full",roleName,tenantId,objectId,tokenScope:"https://ossrdbms-aad.database.windows.net/.default"}` unionだけをparseする。target resolverはARM/provider readbackしたruntime UAMI `(tenantId,objectId)`、role manifest外側`roleName`、authBinding exact 1件、DB self-query/catalog digestをowner-signed digestへ照合する。fallbackなしの`ManagedIdentityCredential({objectId})`をDIし、新規physical connectionごとのasync password callbackはexact `getToken(tokenScope)`でopaque tokenをsingle-flight取得する。JWT decode/claim/audience解析/token内容logを禁止し、principalはcredential constructor+ARM readback、scopeはgetToken引数、expiryはSDK `expiresOnTimestamp`だけで検証する。missing expiry、取得時刻から5分以下/60分超は接続0。refresh margin 5分以内のtokenを新規connectionへ使わず、`maxLifetimeSeconds=2700`でpool connectionをrecycleする。本taskのlive bootstrapは既存old legacy targetだけを不変に結線し、未作成replacement targetのreal login/activationを行わない。final targetの実環境判定はR後のT03Tだけが行う。
- **Complete**: 全repoがold legacy targetの同じglobal poolを使い、bootstrap前後の全table/partition/sequence digest一致、App Configuration write 0、old ETag/value不変、password/token/DSN log 0。target union、opaque token、refresh/pool lifetime/current_user/mapping oracleはinjected fakeで決定的に検証済みだが、final target activation evidenceは主張せずT03TまでBLOCKEDである。
- **Verify Positive**: SDK injected fakeによるgolden AppConfig/Key Vault GET、live old legacy接続、fake target Entra callback、quoted ETag、canonical target hash、DB self-query、single-flight refresh、fake clock T+54 reuse/T+55 refresh/T+61 pool expansion、clean old-target startup/restartを検証する。
- **Verify Adversarial**: channel-only pool、wrong store/key/label/UAMI、label 0/2、wire/content-type/URI drift、Key Vault/Entra 403/timeout、credential-bearing target、wrong ARM tenant/object、wrong credential objectId、wrong getToken引数、wrong role/current_user/mapping、authBinding 0/2、missing/short/>60分 expiry、JWT decode/claim/aud比較/token log、refresh race、stale tokenでnew connection、metadata-only target hash主張、mutable master、`DATABASE_URL` fallbackでpool/startup 0。
- **STOP**: current runtimeの全repoをold target不変の単一resolver/poolへ移行できない、Qでfinal targetを仮作成・有効化する、またはT03T evidenceなしでtarget activation可能にする。

#### P012-F03-T03C full platform replacement databaseをprovisionする

- **Preconditions**: F03-T03Q ACCEPTED。Bが`replacement`ならprovisionし、`same_cluster`ならQ digest付きsigned `not_applicable` receiptでACCEPTED。
- **Allowed files**: `infra/bicep/main.bicep`、新規`infra/bicep/modules/platform-db-replacement.bicep`、新規`packages/server/tests/platformDbReplacementBicep.test.ts`だけ。
- **Work**: 全プラットフォーム用PostgreSQL cluster/storage/distinct CMK/private network/backup、replacement versioned secretだけをIaCで作る。runtime/cutover roleを変更せず、routing keyはGETだけでold wire/ETagをattestする。
- **Complete**: oldとcluster/storage/key identityを共有せずpublic ingress 0。P/Q identity drift 0、App Configuration write 0、old ETag/value不変。
- **Verify Positive**: Bicep build/what-if、DB/network/key/backup/secret-version、routing GET readbackがdeclared JSONと一致する。
- **Verify Adversarial**: channel-only DB、shared key/storage、public endpoint、broad role、versionless secret、routing write、runtime AppConfig write、cutover secret/DB accessをrejectする。
- **STOP**: full platform容量、distinct key、private接続をprovisionできない。

#### P012-F03-T03D metadata-only schema/repositoryを実装する

- **Preconditions**: F03-T03C ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140110_channel_messages_metadata_only.sql`、`packages/server/src/db/channelMessagesRepo.ts`、`packages/server/tests/channelMessagesRepo.test.ts`だけ。
- **Work**: raw4列を持たないmetadata/HMAC/revision schema、role、repositoryをfresh/upgrade形で作る。
- **Complete**: fresh/upgrade/second run green、schema/API/roleにraw write path 0。
- **Verify Positive**: real PostgreSQL metadata insert/readとmigration idempotencyが一致する。
- **Verify Adversarial**: old column INSERT/UPDATEが`undefined_column`、raw-role grantをrejectする。
- **STOP**: B/Cの選択先とmigration targetが一致しない。

#### P012-F03-T03E author HMAC/configを実装する

- **Preconditions**: F03-T03D ACCEPTED。
- **Allowed files**: 新規`packages/server/src/lib/authorSubjectHasher.ts`、新規`packages/server/tests/authorSubjectHasher.test.ts`、`packages/server/src/config.ts`、`packages/server/tests/config.test.ts`だけ。
- **Work**: protected provider由来256-bit以上key、monotonic version、pure HMAC-SHA-256 hasherとDI configを実装する。
- **Complete**: raw author IDは呼出し中memoryだけ、DB/log/evidence/env fallback 0。
- **Verify Positive**: fixed key/version golden、rotation、same-subject stabilityが一致する。
- **Verify Adversarial**: short/missing key、version rollback、log/serialization、fallback keyをrejectする。
- **STOP**: protected providerからkey/versionを注入できない。

#### P012-F03-T03S migration/runtime/cutover identity transitionを実装する

- **Preconditions**: F03-T03C、F00-T05P ACCEPTED。
- **Allowed files**: `infra/bicep/main.bicep`、新規`infra/bicep/modules/platform-db-migration-identity.bicep`、新規`infra/bicep/modules/platform-db-cutover-journal.bicep`、新規`infra/bicep/modules/platform-db-cutover-guard.bicep`、`packages/server/package.json`、`pnpm-lock.yaml`、新規`packages/server/src/clients/platformDbCutoverJournal.ts`、新規`packages/server/src/cutoverGuardMain.ts`、新規`packages/server/tests/platformDbMigrationIdentityBicep.test.ts`、新規`packages/server/tests/platformDbCutoverJournalBicep.test.ts`、新規`packages/server/tests/platformDbCutoverJournal.test.ts`、新規`packages/server/tests/platformDbCutoverGrantExpiry.test.ts`だけ。
- **Work**: exact `@azure/storage-blob@12.33.0`をpinし、network-injected journal clientとDB非依存guard entrypointを実装する。dedicated migration UAMIを作り、replacement時だけ旧新private network/secret/schema-copy roleを付与しApp Configuration write 0にする。runtimeへnew secret/runtime DB roleをCAS前に付与しold accessはH closeまで保持する。fresh owner approval、B decision、G予定SHAを検証したone-shot deploymentはgrantGenerationごとに新しいephemeral cutover UAMI/FIC/Data Owner assignmentを作り、resource IDを再利用しない。tracked/defaultはfalse。旧新DB/App Configurationとは別resource groupへprivate endpoint+distinct CMK+versioning+version-level 5年immutabilityのdedicated Blob containerとread/write-only custom roleを作る。guardは同じtarget-SHA server image digest、zone-redundant ACA Environment、public ingressなし/private VNet/minReplicas=3、5秒loop、exact startup/readiness/liveness probesとする。new revision 3 replica ready+連続2 journal scanまでold revisionを維持する。各replicaはjournal ETag CASでsingle winnerへ収束し、F00-T05Pで証明したcondition/topologyだけを適用する。fresh grantとrevoke receiptを同journalへCASする。cutover preflightはAzure Service Health greenを要求し、total regional/control-plane outage残存riskはData Owner署名なしに受理しない。same-clusterはmigration/cutover/journal/guard assignment 0のsigned NAにする。
- **Complete**: `{runtime:{appConfigRead,currentSecretRead,newSecretReadUntilCutover,oldSecretReadUntilH,dbRuntime},cutover:{freshEphemeralPrincipalPerGeneration,approvedWindowAppConfigWriteOnly,defaultFalse,resourceIdReuse0},migration:{oldNewSecretRead,oldNewSchemaCopy,noAppConfig},journal:{containerReadWrite,noDelete,noControlPlane,noDbSecretAppConfig},guard:{zoneRedundant,threeReplicas,fiveSecondLoop,exactProbes,noIngress,noDb,revisionHandoff,journalReadWrite,currentGenerationGrantDeleteOnly,noDataPlaneWrite}}` exact state、image digest、command、private route、versioning/immutability、F00-T05P permission hashが一致する。
- **Verify Positive**: pre-cutover、G generation N、rollback generation N+1、G fail/H BLOCKED、absolute expiry、post-H/post-Iのlifecycle matrixをgolden化する。最悪poll位相、単一replica kill、revision rolloutでstale検出65秒、DELETE受理95秒、PUT403 11分以内へ収束し、provider `zoneRedundant=true` readbackとruntime reader/別generationは不変である。zone outageは注入試験の成功条件に含めず、F00-T05Pのsigned residual-risk receiptを照合する。
- **Verify Adversarial**: approval/SHA/generation/Service Health/region-risk署名なし、live generation expiry延長、principal/resource ID再利用、tracked true、non-zone/minReplicas<3/probe欠落/old revision早期停止/guard全停止、cutover secret/DB/journal access、journal delete/list、guard Data Owner/DB/secret/sibling delete、permission evidence drift、migration AppConfig write、runtime schema/copy role、same-cluster identity作成、cross-generation token injectionをrejectする。
- **STOP**: F00-T05P evidenceと実装権限が一致しない、migration authorityを分離できない、またはG/Hから独立してcurrent generationをPUT403 deadline内にrevokeできない。

#### P012-F03-T03R replacement schemaをsame-SHA clusterへ適用する

- **Preconditions**: F03-T03D、F03-T03S ACCEPTED。
- **Allowed files**: 新規`scripts/apply-platform-replacement-schema.mjs`、新規`scripts/platform-db-object-manifest.mjs`、新規`packages/server/tests/platformReplacementSchemaApply.test.ts`だけ。
- **Work**: replacement時だけmigration UAMIでtargetへsame-SHA fresh schemaとaccepted migrationsを適用する。source/target PostgreSQL engine majorと`pg_auth_members`/`pg_db_role_setting` column digestをsigned masterへ照合し、supported matrix外をSTOPする。manifestはschema/table/column/partition/sequence/type/domain/enum/constraint/index/view/materialized-view/function/procedure/trigger/extension/RLS/default privilege/role/owner/grantをcatalog化し、function/procedureのnormalized definition/owner/ACL/volatility/parallel/leakproof/security-definer/search_pathを含む。cluster manifestは前段exact schemaの`rolesSorted`、`membershipEdgesSorted`、`ownershipEdgesSorted`、`roleSettingsSorted`を別配列にする。identifierはSQL quote/連結せずUnicode NFC field、ownershipはdatabase/schema/object kind/name/function・procedure identity argumentのposition/type schema/type name/modeを個別保持する。`setconfig`は最初の`=`だけでname/valueへ分割し残りの`=`をvalueへ保持し、settingsをname順・duplicate 0にする。database-only/role-only/DB-role settingを`(databaseName|null,roleName|null)`で一意に所有する。authBinding.roleNameは外側roleNameと一致、NOLOGINはnull、LOGINはowner-signed Entra/managed-identity binding exact 1にする。password hash/credentialはcopyせずtarget `rolpassword`はNULLとし、Qのtoken取得+real login smokeを行う。non-system/application-owned scopeを全列挙し、system/provider-managedはengine-version別signed allowlist/digest一致時だけ除外する。未知kind/owner/role属性はfail-closeする。migration ledgerはversion/name/checksum/orderを別manifestにし、target=accepted set exact、source=accepted setからpending Dだけを除いたexact setを要求する。source DBは変更しない。
- **Complete**: target catalog/ledger/role auth mappingはaccepted oracle、source catalog/ledgerはpending Dだけを除くpre-D oracleへ各exact一致し、source data不変、target raw/password hash 0、login可用性をowner-signed identityで証明し、未列挙/未知object/role attribute 0。
- **Verify Positive**: baseline functionsと全object kind、quoted/dot-containing identifiers、同名で異なるobject kind、overloaded function/procedure identity arguments、NOLOGIN、nested role edge 6属性、ALTER DATABASE SET/ALTER ROLE SET/DB-role SET、`=`を含むsetting value、ownership/Entra login smoke、fresh/second apply、stable normalized digest、source-missing-D ledger、same-cluster NAがgreen。
- **Verify Adversarial**: SQL quoted identifier文字列化、schema/object連結、object kind/identity argument欠落、function overload衝突、function body/owner/ACL/search_path/security drift、membershipのrole/member/grantor/admin/inherit/set各1属性の欠落・反転、DB-only/global-role/DB-role settingの欠落・重複・順序・scope・first-`=`分割drift、authBindingの外側roleName不一致、validUntil mode/value、NOLOGIN binding捏造、LOGIN binding欠落、auth type/tenant/object/validity/artifact/signature drift、`rolsuper|rolcreaterole|rolcreatedb|rolreplication|rolbypassrls`昇格、inherit/login/connlimit drift、password hash copy、real login不能、engine major/catalog column drift、unknown kind/migration/raw/source/partial applyをrejectする。
- **STOP**: source不変またはfull object equalityを証明できない。

#### P012-F03-T03T final target Entra runtime acceptanceを実証する

- **Preconditions**: F03-T03R ACCEPTED。
- **Allowed files**: 新規`.orchestration/evidence/P012-F03-T03T/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: Bが`same_cluster`ならreplacement resource 0、Q old-target acceptance、R signed NAを照合してT03T signed not-applicable receiptを作り、shadow/resource request 0とする。`replacement`ならC/S/Rが固定したfinal PostgreSQL resource ID、versioned credential-free target secret、runtime UAMI `(tenantId,objectId)`、outer roleName/authBinding、catalog digestを同じtarget SHAへ照合する。作成前にowner-signed protected environment masterとlive provider/config readbackからexact `{revisionId,imageDigest,replicaCount,poolMaxPerReplica,totalExpectedConnections}`を固定する。`replicaCount`はcutover時にdeployするproduction steady-state configured replica countであり、現在のready count/autoscale最大値ではない。`poolMaxPerReplica`は当該revision/configのeffective `pg.Pool.max`、`totalExpectedConnections=replicaCount*poolMaxPerReplica`とする。owner-approved attempt ID、task ID、target SHAのRFC 8785 bytesのSHA-256を`acceptanceRunId`とし、全resourceをexact `{taskId,targetSha,acceptanceRunId,expiresAt}`でtagし、`expiresAt=createdAt+PT90M`のabsolute TTL guardを先に有効化する。その後、exact `replicaCount`のprivate shadow acceptance replicasを同じimmutable server image/runtime UAMIで起動し、Qのread-only `validateCandidateTarget()`へowner-signed candidate secret URI/versionを渡す。このmethodはApp Configuration write、global pool swap、request intakeを行わない。各replicaはfallbackなし`ManagedIdentityCredential({objectId})`、exact `getToken("https://ossrdbms-aad.database.windows.net/.default")`、opaque token/JWT decode 0、SDK `expiresOnTimestamp`が取得時刻より5..60分後、`sslmode=verify-full`でfinal DBへ接続し、`current_user===roleName`、Entra mapping、catalog digestをreadbackする。取得時点のremaining lifetimeがPT5M30S以下ならDB接続に使わず最大2回まで再取得し、なおPT5M30S超を得られなければSTOPする。token callbackごとにtoken/hashを残さず、local monotonic `tokenGeneration`、`callbackInvocation`、`acquiredAt`、`expiresOnTimestamp`、connection IDだけを相関する。T0の最初の接続使用token expiryを`E0`とし、`E0-PT5M-PT30S`でT0 generation再利用、`E0-PT5M`以降かつ`E0`より前の最初のnew physical connectionでrefreshを検証する。T+54/T+55は観測snapshotとし、固定generationを期待せず、その時点のactive generationの実expiryからreuse/refresh期待値を導出する。T+61では全replicaをexact `poolMaxPerReplica`まで拡張し、exact `totalExpectedConnections`のnew physical connectionを成功させ、T0 generationをnew connectionで使用せず、各new connectionのremaining lifetimeがPT5M超であることを確認する。全exact replicaを一斉restartし、同じexact cardinalityで再接続する。全exitを`finally` cleanupへ通し、正常時はexact tag tupleだけを列挙・削除・provider readbackで0件確認する。途中crashまたはrunner再開時も同じtag tupleとabsolute TTLからinventoryを再構成してcleanupを完了し、broad deleteは行わない。routing old ETag/valueとold writerを常に不変に保つ。
- **Complete**: replacementはfinal resource/secret version/runtime identity/role/mapping/catalog digest、作成前に署名したexact size oracle、全replicaのtoken generation/callback/acquiredAt/expiry/connection相関、expiry境界前後、T+54/T+55 snapshot、T+61/restart後のexact cardinality、current_user、JWT decode/token/hash/password/DSN log 0、AppConfig write 0、exact tag inventory 0、TTL guard/finally/crash-resume cleanupのprovider readbackがsigned evidenceへ一致する。same_clusterはbranch/input digestとresource/request 0のNA receiptが一致する。いずれもこのreceiptなしにF/Gを開始できない。
- **Verify Positive**: replacementはexact `replicaCount`でT0 login、`E0-PT5M-PT30S` reuse、`E0-PT5M<=now<E0` refresh、T+54/T+55の実expiry由来snapshot、T+61でT0 generation不使用かつremaining lifetime PT5M超のexact `totalExpectedConnections`、全exact replica restart/reconnectが成功し、old route/writerは不変になる。normal/finally、各観測点直前のprocess crash、cleanup途中crashから同じrunをresumeしてexact tagged inventory 0になる。same_clusterはshadow/resource/request 0のNAになる。
- **Verify Adversarial**: wrong final resource/secret version/UAMI tenant/objectId/role/scope、credential fallback、JWT decode/claim/aud比較、missing/取得時点で5分以下/60分超expiry、固定T+54 reuse/T+55 refreshの仮定、expiry境界前refreshまたは境界後reuse、T+61 new connectionでT0 generation使用・remaining lifetime PT5M以下、署名oracleと異なるreplica/pool/total cardinality、一replica未再起動、current_user/mapping/catalog drift、public network、AppConfig write/global pool swap、token/hash/DSN log、wrong/missing tag、相対TTL延長、normal/finally cleanup欠落、各観測点crash、partial delete後crash、foreign resourceのbroad delete、shadow残存をrejectする。
- **STOP**: exact size oracle、実expiry境界、real 61分refresh/full replica restart、またはnormal/crash/TTL全経路のexact-tag cleanupを実証できない、受入のためroutingを先行変更する、またはcleanup後もshadow authority/resourceが残る。

#### P012-F03-T03F transactional full platform copy primitiveを実装・予行する

- **Preconditions**: F03-T03E、F03-T03T ACCEPTED。Bが`same_cluster`ならT03Tを含むsigned `not_applicable` receiptを作りACCEPTED。
- **Allowed files**: 新規`scripts/copy-platform-database.mjs`、新規`packages/server/tests/platformDatabaseCopy.test.ts`だけ。
- **Work**: replacement時だけR manifestとE hasherをimportし、全retained data/partition/sequenceをtransactional snapshot/watermarkでcopyする。`channel_messages`だけmetadata-only変換する。`schema_migrations` rowはcopyせず、directionごとのsource/target ledger oracleを検証する。同じprimitiveはold→new、新→old、Gのold rehydrateを扱い、raw列を生成しない。synthetic cloneで各sub-step crash/restart/idempotencyを予行する。
- **Complete**: source catalog/ledgerはpre-D oracle、targetはaccepted oracleへ各exact一致し、transform後data ordered digest、row cardinality、sequence next value、HMAC digestが一致する。pre-G catalog同一性は偽って主張しない。target raw 0、raw dump/staging/temp/log/evidence 0。
- **Verify Positive**: multi-table/FK/partition/sequence/function/role、source-missing-D/target-full ledger、forward/reverse/rehydrate、各step crash/restart、same-cluster NAがgreen。
- **Verify Adversarial**: ledger blind copy/delete、target D row overwrite、extra/renamed/checksum drift、unknown object、manifest omission、independent HMAC、partial commit、raw output、writer activeをrejectする。
- **STOP**: future objectをmanifest駆動でcopyできない、または同primitiveで安全なreverse copyを証明できない。

#### P012-F03-T03G production connectionをatomic cutoverする

- **Preconditions**: F03-T03F ACCEPTED。
- **Allowed files**: 新規`scripts/cutover-platform-database.mjs`、新規`packages/server/tests/platformDatabaseCutover.test.ts`だけ。
- **Work**: Sのjournal clientを`pnpm exec tsx`からimportし、rowVersion/phase/step/grant generation/status/receipt hash/30秒leaseをquoted ETag CASする。fresh approvalでgeneration Nのephemeral UAMI/FIC/assignmentを作り、replacementはserverを0 replica・active request/DB session 0へdrainし、外部journalを7 stepへCASする。F old→new、oldへD transactional migration、F new→old full rehydrateを順に実行し、両ledger=accepted set、catalog/role/data/HMAC/raw0 equality後だけquoted old ETagでnew URIへPUTする。2xxまたはresponse-loss reconciliation GETのexpected value+winning ETagに結合したApp Configuration exact `last_modified`だけを、次のjournal CASで`routeCasWinningLastModified`/`cutoverCompletedAt`へ同値設定する。rollbackDeadlineはそこからPT60Mとし、Blob Date、client時刻、recovery観測時刻を代用しない。restartはcurrent live generation/provider readback済みstepだけをskipし、revoke後のrunner交代はfresh approval+generation N+1+fresh principalを要求する。全exit pathのfinallyはcurrent generation cleanupを呼び、独立guardもjournalへrevoke receiptをCASする。evidenceはblob version ID/ETag/content hashを参照する非権威copyに限定する。same-clusterはD/readback、App Configuration/Blob request 0で再開する。
- **Complete**: replacementはold/new双方raw 0、old writer 0/new writer 1、全object/role/data/tail digest、HMAC version、generation/ephemeral principal、URI hash、quoted AppConfig/blob ETag、journal version/hash、immutable cutoverCompletedAt/rollbackDeadlineをreceipt化する。G exit/fail/STOP/absolute expiryではDELETE受理95秒・PUT403 11分の正直なSLOへ収束し、確認まではphase blocked/writer 0。same-clusterはwriter 1、URI/ETag不変、raw schema/role 0、Blob request 0。
- **Verify Positive**: old raw fixtureはforward transform→D→new-to-old rehydrateで旧新metadata/role/ledger/digest一致し、各7 journal crash point、G completion、T+59/T+60、old/new DB片系喪失、runner交換、Blob CAS/close response lossから一意にresumeする。AppConfig CAS success/response loss後30分runner停止でもwinning ETagの同じlast_modifiedから全executorが同じdeadlineを算出し、conditional Blob/AppConfig GET/PUT/readback golden、generation/revoke journal receipt、最悪poll位相SLOも一致する。
- **Verify Adversarial**: DB内journal、証跡JSONだけのjournal、blob/evidence disagreement、lease中runner横取り、revoke世代再利用、live expiry延長、step rollback/skip、If-Match変換、D後rehydrate欠落、metadata NULL、role/ledger差、old raw残存、active session、object/function/data drift、AppConfig/Blob ETag loserではwriter/CAS 0。65秒で403を偽称する、11分超過中にwriter/regrantする設計をrejectする。
- **STOP**: drain、full-copy、旧新metadata-only equality、external journal、independent grant expiry、identity、quoted ETagのいずれかを固定できない。

#### P012-F03-T03H rollback stabilizationをcloseする

- **Preconditions**: F03-T03G ACCEPTED。
- **Allowed files**: task既定evidence 3ファイルだけ。
- **Work**: journal current versionのimmutable cutoverCompletedAt/rollbackDeadlineだけを使って60分間new writer health、全object/data digest、HMAC version、error budgetを監視する。G generationは保持しない。rollback決定時にfresh Data Owner approval、同一journal/target SHA、`now<rollbackDeadline`を検証し、generationを+1したfresh ephemeral UAMI/FIC/assignmentへ90分以下の独立grant windowを与えて`phaseStatus=rollback_running`をCASする。newをdrainし、migration UAMIでFをnew→oldへ実行、旧新metadata-only equalityを確認し、current generation cutover UAMIがquoted ETag CASした後だけold writerを再開する。rollbackDeadline経過またはvalid early-close署名で`closedAt`を一度だけCASし、finallyでgeneration cleanup/revoke receiptを要求する。HがBLOCKED/crashしてもguardがjournalへblocked/revokeをCASする。same-clusterはsigned NAでcloseする。
- **Complete**: replacementはjournal exact `closedAt>=rollbackDeadline`またはhealth/digest付き早期closeの一意な値、old/new URI hash/ETagとG journal version/hash一致。各generationのgrantIssuedAt/absolute expiry/revoke receiptがあり、closed/BLOCKED/stale時はDELETE受理95秒・PUT403 11分以内、確認まで次世代grant 0。same_clusterはNA receiptとG hash一致。
- **Verify Positive**: T+59分はclose/isolate/key/copy-delete 0、T+60分またはvalid early-close後だけ次task claim 1。window内rollbackはfresh generation→drain→full reverse copy→metadata-only equality→quoted ETag CAS→old writer 1/new writer 0→journal revoke receiptになる。G completion/T+59/T+60/fresh regrant/old-generation replay/close response lossをclock fixtureで再現する。
- **Verify Adversarial**: mutable updatedAt/evidenceからdeadline算出、G absolute expiryのH再利用、live generation延長、principal/FIC再利用、health/digest/HMAC drift、unsigned waiver、clock rollback、closed/BLOCKED後renew、T+0〜59分の全面DB隔離・key destroy・copy expiry短縮をrejectする。
- **STOP**: health/digestが一致しない場合はrollbackを実行するかwriter/intake BLOCKEDのまま維持し、次taskへ進まない。

#### P012-F03-T03I old estateを隔離する

- **Preconditions**: F03-T03H ACCEPTED。
- **Allowed files**: `infra/bicep/main.bicep`、`infra/bicep/modules/platform-db-routing.bicep`、`infra/bicep/modules/platform-db-migration-identity.bicep`、`packages/server/tests/platformDbRoutingBicep.test.ts`、`packages/server/tests/platformDbMigrationIdentityBicep.test.ts`だけ。
- **Work**: replacementは(1)`enablePlatformDbCutoverRole=false`をdeployしてcutover Data Owner role assignment/FICを削除しPUT 403、(2)migration UAMIの旧新secret/network/DB role/FIC、(3)runtime old-secret/old-DB roleをrevokeしてdeny、(4)old network遮断、(5)break-glass封印の順とする。tracked/default falseを再確認し、future re-grantはfresh approval必須。same-clusterはmutation 0のsigned NAにする。
- **Complete**: cutover AppConfig write/active FIC 0、migration access 0、runtime old 0/new health green、old network deny。通常IaC再apply後もcutover PUT 403。
- **Verify Positive**: post-H IaC what-if/deploy/reapply、role/FIC/PUT deny、new全repo health、same-cluster NAが一致する。
- **Verify Adversarial**: cutover revoke前の他revoke/isolate、tracked/default true、normal reapplyでrole復活、migration credential、runtime old secret、stale DNS/replica、unlisted identityをrejectする。
- **STOP**: cutover PUTが403でない、normal IaC reapplyでrole/FICが復活する、またはmigration/runtime-old/production参照が残る。

#### P012-F03-T03J old CMK dispositionを記録する

- **Preconditions**: F03-T03I ACCEPTED。
- **Allowed files**: task既定evidence 3ファイルだけ。
- **Work**: I receipt/H close hashを照合し、破棄直前にM365/Purview/provider legal-hold APIをfresh read-only再取得する。`observedAt>H.closed_at`、inventory/hash一致、hold clearをRecords/Data Ownerが署名し、かつ`issuedAt>observedAt`のirreversible-destruction approvalがある場合だけdedicated old keyをdisable/purgeする。shared key/same-clusterはmutation 0のsigned NAにする。
- **Complete**: dedicatedはold decrypt 0とpurge receipt、shared/same_clusterは対象key mutation 0とNA receiptがA/B/G hashに一致。
- **Verify Positive**: dedicated destroy、shared-key NA、same-cluster NAの3 fixtureがexact branchになる。
- **Verify Adversarial**: cached/close前legal-hold readback、hold API 403/timeout、approval issued before observation、H close前、shared key、wrong key、未署名NA、hold activeをrejectする。
- **STOP**: H close/fresh destruction approval、key sharing graph、owner/legal-hold dispositionのいずれかを確定できない。

#### P012-F03-T03K residual copyをdelete/expireする

- **Preconditions**: F03-T03J ACCEPTED。
- **Allowed files**: task既定evidence 3ファイルだけ。
- **Work**: replacementでは各replica/WAL/PITR/snapshot/base backup/export/provider backupのmutation直前にlegal-hold APIをfresh再取得し、hold clear署名とinventory hash一致時だけdeleteまたはpolicy expiryを追跡する。観測とmutationの間にhold revisionが変われば停止する。same_clusterはsigned NAでcopy mutation 0。
- **Complete**: replacementはAの全copyが`deleted|expired`、各mutation直前hold revision/signature付き、追加copy差分0。same_clusterは全copy raw0/NA一致。
- **Verify Positive**: replacementのnot-found/expiredとsame-cluster raw0 readbackがbranch別expectedになる。
- **Verify Adversarial**: stale hold readback、observation後hold change、API 403/timeout、pending retention、hidden replica、新snapshot、unknownをrejectする。
- **STOP**: 一copyでも状態、期限、ownerを確定できない。

#### P012-F03-T03L restore-negative acceptanceを記録する

- **Preconditions**: F03-T03K ACCEPTED。
- **Allowed files**: task既定evidence 3ファイルだけ。
- **Work**: replacementではAで列挙したold cluster、PITR、snapshot、backup、exportの各復元経路を試す。same_clusterはA/Kの全copy raw0再readbackを参照し、旧estateが存在しない理由付きsigned NA receiptを作る。
- **Complete**: replacementは全経路raw復元不能とexpected failure reason、same_clusterは全copy raw0/NA理由、両者でRecords/Data Owner署名が一致。
- **Verify Positive**: deleted/expired/key-destroyed/shared-key-copy-deleted/same-cluster-NAの各fixtureが定義済み結果になる。
- **Verify Adversarial**: raw復元成功、未試験経路、generic timeout、unknown copy、署名なしNAを合格扱いしない。
- **STOP**: 一経路でrawが読める、またはbranch結果を特定できない。

#### P012-F03-T03M Teams source canonicalizationをpure実装する

- **Preconditions**: F03-T03L ACCEPTED。
- **Allowed files**: `packages/shared/package.json`、`pnpm-lock.yaml`、新規`packages/shared/src/meetingSourceCanonical.ts`、新規`packages/shared/tests/meetingSourceCanonical.test.ts`だけ。
- **Work**: exact `parse5@7.3.0`をpinし、Teams HTML→text normalization、message-v1 leaf bytes、thread-v1 root/reply exact order serializerをpure実装する。
- **Complete**: DB/Graph/network dependency 0、raw author IDを受けず、EのHMAC output/key versionとmetadataだけを入力にする。
- **Verify Positive**: root+multi-page reply、HTML/entity/Unicode/CRLFのgolden bytes/hashが一致する。
- **Verify Adversarial**: raw author/body output、parser version drift、reply order/duplicate/missing、malformed/oversizeをrejectする。
- **STOP**: parse5 bytesまたはthread-v1 orderを固定できない。

#### P012-F03-T03N Teams Graph reply paginationを実装する

- **Preconditions**: F03-T03M ACCEPTED。
- **Allowed files**: `packages/shared/src/clients/graphClient.ts`、`packages/shared/tests/graphClient.test.ts`だけ。
- **Work**: allowlisted channelのroot delta、各root reply全page、typed edit/delete/tombstone、429/continuation検証を実装する。
- **Complete**: attachment fetch 0、全page結果とnext-linkをtyped memory objectで返しcursorを変更しない。
- **Verify Positive**: 2 root×multi-page replies、edit/delete/tombstone、valid continuationがexpected cardinality/order。
- **Verify Adversarial**: foreign scope/origin/path、page 2 failure、429、loop、same-time ID orderでpartial successを返さない。
- **STOP**: API quota内でcomplete pagination不能。

#### P012-F03-T03O Teams metadata runtimeを結線する

- **Preconditions**: F03-T03N ACCEPTED。
- **Allowed files**: `packages/server/src/scheduler/tasks/channelPollingTask.ts`、`packages/server/src/agents/teamsConversationAgent.ts`、`packages/server/tests/channelPollingTask.test.ts`、`packages/server/tests/teamsConversationAgent.test.ts`だけ。
- **Work**: E/M/NをDIしmetadata upsertを一transactionで完了後だけdelta cursorを進める。
- **Complete**: raw author/body 0、root/reply/tombstone cardinality、HMAC key version/digest、thread hash、cursorがcomplete。
- **Verify Positive**: edit/delete/tombstone/reply page2/restartでhash、order、cursorが一致する。
- **Verify Adversarial**: partial page、HMAC/canonical version drift、429、delete-before-create、raw fixtureでcursor advance/writeを0にする。
- **STOP**: E/M/Nのexact versionsを同時固定できない。

#### P012-F03-T04A pure Outlook canonicalizationを実装する

- **Preconditions**: F03-T03O、DEC-ENV-001 ACCEPTED。
- **Allowed files**: `packages/shared/src/meetingSourceCanonical.ts`、`packages/shared/tests/meetingSourceCanonical.test.ts`だけ。
- **Work**: T03Mのpinned parse5/normalization primitivesを再利用し、Outlook text/subject bytes、active message-v1、typed removed unionをpure追加する。
- **Complete**: DB/Graph/network dependency0、golden byte contract固定。
- **Verify Positive**: text/html/entity/Unicode/move active fixtureがexpected SHA。
- **Verify Adversarial**: malformed/non-HTML/oversize/@removed direct serialize/version driftを拒否する。
- **STOP**: parser bytesを固定できない。

#### P012-F03-T04B Outlook Graph receive clientを実装する

- **Preconditions**: F03-T04A ACCEPTED。
- **Allowed files**: `packages/shared/src/clients/graphClient.ts`、`packages/shared/tests/graphClient.test.ts`だけ。
- **Work**: ImmutableId subscription/GET/deltaとtyped 200/404/410/otherを実装する。
- **Complete**: 全page Prefer header、attachment fetch0、DB lookup0。
- **Verify Positive**: active/move/confirmed_removed branchesとpaginationがgreen。
- **Verify Adversarial**: missing header、foreign scope、429/5xx/timeout、continuation injectionを拒否する。
- **STOP**: tenant-wide Mail.Readが必要。

#### P012-F04-T05A launch state schema/repoを実装する

- **Preconditions**: F04-T04、DEC-ENV-004 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140300_agent_launches.sql`、新規`packages/server/src/db/agentLaunchesRepo.ts`、新規`packages/server/tests/agentLaunchesRepo.integration.test.ts`だけ。
- **Work**: nonce/lease/UID/attestation/state/sealed column/CAS invariantsを実装する。
- **Complete**: fresh/upgrade/concurrency/terminal immutability green。
- **Verify Positive**: exact transition winner1とreadback一致。
- **Verify Adversarial**: duplicate lease/UID、flag reversal、partial stateを拒否する。
- **STOP**: provider/Kubernetes callをrepoへ入れる必要がある。

#### P012-F04-T05B AKS/IAM/network IaCを実装する

- **Preconditions**: F04-T05A ACCEPTED。
- **Allowed files**: `infra/bicep/main.bicep`、新規`infra/bicep/modules/agent-aks.bicep`、新規`infra/k8s/kustomization.yaml`、新規`infra/k8s/agent-control-namespace.yaml`、新規`infra/k8s/agent-executions-namespace.yaml`、新規`infra/k8s/agent-gateway-namespace.yaml`、新規`infra/k8s/agent-broker-service-account.yaml`、新規`infra/k8s/agent-broker-rbac.yaml`、新規`infra/k8s/agent-broker-network-policy.yaml`、新規`infra/k8s/agent-broker-deployment.yaml`、新規`infra/k8s/agent-cilium-network-policies.yaml`、`packages/server/tests/infraBicepComposition.test.ts`だけ。
- **Work**: private AKS/Kata/Ciliumと3 namespaceを宣言し、broker UAMI/FIC、projected token、private API/CA、exact RBAC/egressを実装する。cluster scopeはTokenReview createだけ、namespace scopeはcontract記載のread、executions Job lifecycle、gateway launch固有Deployment/Service/TLS Secret lifecycleだけにする。
- **Complete**: agent egress/identity 0、proxy Key Vault route/role 0。brokerだけがAPI/Entra/Key Vault/DB/GitHub/gateway/DNS allowlistを持ち、Secret list/watch、Deployment/Service patch、RBAC mutation、exec/attach、cross-namespace、cluster-admin 0。
- **Verify Positive**: Bicep what-if、manifest composition/policy lint、broker WI token rotation、private API TLS、`kubectl auth can-i` exact allow matrix、role/egress readbackがexpected。
- **Verify Adversarial**: TokenReview以外のcluster verb、Secret list/watch、gateway Deployment/Service patch、非launch名、unapproved image/selector/port/targetPort、cross-launch label mutation、Role/Binding write、Pod exec/attach、cross-namespace、ACA/runc/public ingress/wildcard egress/module overwriteをredにする。
- **STOP**: Japan EastでKata/Ciliumを実証不能。

#### P012-F04-T05C certificate/proxy bootstrapを実装する

- **Preconditions**: F04-T05B ACCEPTED。
- **Allowed files**: 新規`infra/k8s/agent-proxy-service-account.yaml`、新規`infra/k8s/agent-proxy-deployment.yaml`、新規`infra/k8s/agent-proxy-service.yaml`、新規`infra/k8s/agent-proxy-certificate.yaml`、新規`infra/k8s/agent-private-ca-bundle.yaml`、新規`packages/server/src/lib/agentProxyBootstrap.ts`、新規`packages/server/tests/agentProxyBootstrap.test.ts`だけ。
- **Work**: proxy service accountは`automountServiceAccountToken:false`とし、audience=`api://aiops-agent-proxy-v1`、expirationSeconds=600、Pod-bound projected token volumeだけを宣言する。launch TLS、public CA mount、broker/gateway/cluster-DNS限定service/networkを実装する。
- **Complete**: projected token issuer/audience/namespace/service-account UID/Pod UID/exp、SAN/TTL/namespace一致、UAMI/federated credential/Entra endpoint egress/CA private key export 0。
- **Verify Positive**: proxy TLS handshake、offline Kubernetes OIDC/JWKS、API TokenReviewの`authenticated=true`/exact `status.audiences`/username/UID/groups、Pod UID live readbackが全て一致する。
- **Verify Adversarial**: offline-onlyまたはTokenReview-only成功、audience集合差、username/UID/groups/Pod UID drift、default automount token、unbound token/exp>600、Entra/Key Vault egress、proxy Key Vault403、wrong SAN/expired certを確認する。
- **STOP**: shared sidecar/cert-manager暗黙dependencyが必要。

#### P012-F04-T05D token broker/sealingを実装する

- **Preconditions**: F04-T05A、F04-T05C ACCEPTED。
- **Allowed files**: `packages/server/package.json`、`pnpm-lock.yaml`、新規`packages/server/src/http/routes/agentTokenBroker.ts`、新規`packages/server/src/lib/sealedAgentCredential.ts`、新規`packages/server/src/lib/agentGatewayDlp.ts`、`packages/server/src/http/app.ts`、`packages/server/src/config.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/agentTokenBroker.test.ts`、新規`packages/server/tests/sealedAgentCredential.test.ts`、新規`packages/server/tests/agentGatewayDlp.test.ts`だけ。
- **Work**: exact `@azure/identity@4.13.1`、`@azure/keyvault-secrets@4.11.2`、`@azure/keyvault-keys@4.10.2`、`@kubernetes/client-node@1.4.0`を本task自身でpinし、injected Kubernetes clientでproxy projected JWTのoffline JWKSとlive TokenReview/Pod readback、mint1、seal、lease response1、ACK/revokeを実装する。TokenReview exact audience/subject/groups、launch label/name、source namespace/Pod UIDを全て照合する。
- **Complete**: repo1/read-only/expiry/nonce/lease binding、agent-visible secret0。
- **Verify Positive**: injected networkless client unit、staging normal launch/revoke204、TokenReview/Pod UID/audit correlationがgreen。
- **Verify Adversarial**: API timeout/403、offline/live disagreement、claim/audience/group/namespace/Pod drift、Secret/list/cross-namespace/exec権限要求、mint/commit/response crash、multi-repo/write tokenをfail-closeする。
- **STOP**: caller self-attestationまたはproxy secret accessが必要。

#### P012-F04-T05E suspended Job/Pod attestationを実装する

- **Preconditions**: F04-T05B、F04-T05D ACCEPTED。
- **Allowed files**: 新規`packages/server/src/lib/agentLaunchAttestation.ts`、新規`infra/k8s/agent-job-template.yaml`、`packages/server/src/http/routes/agentTokenBroker.ts`、新規`packages/server/tests/agentLaunchAttestation.test.ts`、`packages/server/tests/agentTokenBroker.test.ts`だけ。
- **Work**: deterministic suspend/reconcile、Job spec/Pod二段attestation、init readyを実装する。
- **Complete**: launchあたりJob/Pod/provider process各最大1。
- **Verify Positive**: exact launch順とUID/policy readbackがgreen。
- **Verify Adversarial**: admission mutation、timeout/crash/OOM/eviction/broker crashでprovider0/1、replacement0。
- **STOP**: attestation前entrypointを止められない。

#### P012-F04-T05F GitHub read gatewayを実装する

- **Preconditions**: F04-T05D ACCEPTED。
- **Allowed files**: 新規`docs/contracts/agent-github-read-operations.v1.json`、新規`packages/server/src/lib/agentGithubReadOperations.ts`、新規`packages/server/src/http/routes/agentGithubReadGateway.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/agentGithubReadGateway.test.ts`だけ。
- **Work**: named 4 argvのactual capture/hash/variables/root/fieldsとGHES gatewayを実装する。
- **Complete**: placeholder hash0、signed target exact、write/arbitrary query0。
- **Verify Positive**: 4 commandと100-item outputがgreen。
- **Verify Adversarial**: 101/alias/extra flag/foreign variable/root/mutationでstdout/external call0。
- **STOP**: pinned binaryからqueryをcapture不能。

#### P012-F04-T05G LLM gateway/data controlsを実装する

- **Preconditions**: F04-T05D ACCEPTED。
- **Allowed files**: 新規`packages/server/src/http/routes/agentLlmGateway.ts`、`packages/server/src/lib/agentGatewayDlp.ts`、`packages/server/src/http/app.ts`、`packages/server/src/config.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/agentLlmGateway.test.ts`、`packages/server/tests/agentGatewayDlp.test.ts`、`packages/server/tests/config.test.ts`だけ。
- **Work**: Claude/Responses wire、model/budget、OpenAI jp/ZDR/store/background controlsを実装する。
- **Complete**: provider key job0、body log/trace/replay/local cache0。
- **Verify Positive**: Claude/Codex/Droid各1 promptとowner receipt一致。
- **Verify Adversarial**: save tool/extended cache/default retention/region/model driftを拒否する。
- **STOP**: ZDR/nonregional processing acceptanceがない。

#### P012-F04-T05H isolated platform integrationを受理する

- **Preconditions**: F04-T05E、F04-T05F、F04-T05G ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F04-T05H/commands.json`、`.orchestration/evidence/P012-F04-T05H/readback.json`、`.orchestration/evidence/P012-F04-T05H/evidence.json`だけ。
- **Work**: A-G same SHAをdeployしproxy→broker→Job→4 read+3 prompt→revoke/cleanupする。
- **Complete**: UID/state/permission/cost/audit/cleanupのoperation ID相関が完全。
- **Verify Positive**: all external readback expected、review C/H/M0。
- **Verify Adversarial**: partial SHA、orphan、secret evidence、cleanup欠落をrejectする。
- **STOP**: external owner/cleanup不在。

#### P012-F04-T06A shared launcher/isolationを実装する

- **Preconditions**: F04-T04、F04-T05H ACCEPTED。
- **Allowed files**: 新規`infra/agent-sandbox/Containerfile`、新規`infra/agent-sandbox/credential-proxy.mjs`、新規`infra/agent-sandbox/seccomp.json`、新規`scripts/run-isolated-readonly-agent.mjs`、`infra/k8s/agent-job-template.yaml`、`infra/k8s/agent-proxy-deployment.yaml`、新規`packages/server/tests/readOnlyGithubAgentLauncher.test.ts`だけ。
- **Work**: empty HOME/read-only source/no git/credential0/init-ready launcherを実装する。
- **Complete**: host/Docker fallback0、source/host hash不変、Pod/process最大1。
- **Verify Positive**: tmpfs safe editとisolation readbackがgreen。
- **Verify Adversarial**: host canary、mount/PID/env/egress/credential endpointを拒否する。
- **STOP**: shared credential/host processが必要。

#### P012-F04-T06B Claude integrationを実装する

- **Preconditions**: F04-T06A ACCEPTED。
- **Allowed files**: 新規`.claude/settings.json`、新規`.claude/hooks/typecheck-after-edit.mjs`、新規`packages/server/tests/claudeIsolatedAgent.test.ts`だけ。
- **Work**: base URL/apiKeyHelper/NODE_EXTRA_CA_CERTS/hookを実装する。
- **Complete**: doctor/effective config、private TLS、source write0。
- **Verify Positive**: prompt/read/hookがgreen。
- **Verify Adversarial**: wrong CA/insecure/host write/direct providerを拒否する。
- **STOP**: official private CA方式を実証不能。

#### P012-F04-T06C Droid integrationを実装する

- **Preconditions**: F04-T06A ACCEPTED。
- **Allowed files**: 新規`.factory/settings.json`、新規`.factory/droids/github-operations.md`、新規`packages/server/tests/droidIsolatedAgent.test.ts`だけ。
- **Work**: exact settings JSON/selector/NODE_EXTRA_CA_CERTS/gateway highを実装する。
- **Complete**: effective settings一致、cloud/IDE request0。
- **Verify Positive**: custom selector prompt/readがgreen。
- **Verify Adversarial**: 全field drift、reasoning flag、wrong CA/insecureを拒否する。
- **STOP**: pinned Droidでprivate CA/custom modelを実証不能。

#### P012-F04-T06D Codex integrationを実装する

- **Preconditions**: F04-T06A ACCEPTED。
- **Allowed files**: 新規`infra/agent-sandbox/codex-home.config.toml.tmpl`、新規`packages/server/tests/codexIsolatedAgent.test.ts`だけ。
- **Work**: fresh 0400 model/reasoning/provider/base/env/wire/retry0 configを実装する。
- **Complete**: project provider/auth0、effective request exact 1。
- **Verify Positive**: SSL_CERT_FILE private TLS prompt/readがgreen。
- **Verify Adversarial**: implicit retry、project auth、wrong CA/insecureを拒否する。
- **STOP**: official provider configでgateway接続不能。

#### P012-F04-T06E provider parity acceptanceを記録する

- **Preconditions**: F04-T06B、F04-T06C、F04-T06D ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F04-T06E/commands.json`、`.orchestration/evidence/P012-F04-T06E/readback.json`、`.orchestration/evidence/P012-F04-T06E/evidence.json`だけ。
- **Work**: 3 providerで同じ5 prompts/4 reads/TLS/isolationを比較する。
- **Complete**: allow/refuse/proposal/credential/TLS差異0、provider-only差を列挙。
- **Verify Positive**: same result set/audit correlationがgreen。
- **Verify Adversarial**: direct write/host fallback/unknown CA/secret observationをrejectする。
- **STOP**: 一providerでもcontract不一致。

Executable task countは99 formal `#### P012-...` task heading。DAG JSON、plan validator、agent asset validatorはこの99 ID exact set、7必須field、direct prerequisiteを検証し、navigation tableとgate-group summaryを実行taskとして数えない。

orchestrator、認証・migration・concurrency・外部write・CI publisherを扱うhigh-risk worker、F04各taskとF07-T04の別context reviewerは`gpt-5.6-sol high`を使う。機械的read-only探索、既知fixture、docs parityだけはSuggested executor toolkitの条件を満たす場合に限り`gpt-5.6-terra medium`へ委譲し、resolved model/reasoningをtask evidenceへ記録する。runtime inventoryに指定slugがなければ黙ってfallbackせずSTOPする。

## Steps

### Phase 0: 仕様・境界・現状を固定する

#### P012-F00-T01 基準SHAとremote稼働inventoryを固定する

- **Preconditions**: clean isolated checkout、`origin/main` fetch済み。
- **Allowed files**: `.mise.toml`、新規`mise.lock`、`.orchestration/evidence/P012-F00-T01/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: SHA、branch protection、workflow run、Actions secrets/variables/environments、Pages status、tracked agent assets、既存Azure/agent sandbox/token broker resourceを取得し、secret値なしのJSONへ保存する。ここでは既存`DEC-ENV-002`を変更せず、sandbox capabilityは`present|absent|partial`とresource ID/readbackだけを記録する。`.mise.toml`へ`"aqua:rhysd/actionlint" = "1.7.12"`と`actionlint = "actionlint -shellcheck= -pyflakes= .github/workflows/*.yml"` taskを追加し、ambientなoptional shellcheck/pyflakes連携を明示的に無効化して実行hostのPATH/tool有無に依存しないworkflow-only検査に固定する。`mise lock --platform linux-x64,macos-arm64`でNode 22、pnpm 11.13.0、actionlint 1.7.12のURL/checksum/provenanceをmise標準の`mise.lock`へ固定する。
- **Complete**: local SHAとremote default branch SHA一致。remote inventoryとsandbox capabilityの観測事実を再現可能に記録し、既存`DEC-ENV-002`の意味を上書きしない。cache-cold環境で`MISE_LOCKED=1 mise install`と`MISE_LOCKED=1 mise run actionlint`がdynamic version/API resolutionなしでgreen。
- **Verify Positive**: `gh repo view`と`gh api`のexit/statusをartifactへ保存しSHA-256を計算する。Linux x64とmacOS arm64のlock entryにexact version、URL、SHA-256があり、改変なしassetだけinstallできる。
- **Verify Adversarial**: API 403/404、stale SHA、secret値を含むoutputを受入れない。Pages 404を「機能故障」ではなく「未設定」と記録する。lock checksum、URL、versionのいずれかをfixtureで変えるとlocked installを失敗させ、元へ戻す。
- **STOP**: remote mainがlocal SHAと異なる、またはprimary dirty checkoutしか利用できない。

#### P012-F00-T02 operation matrixをmachine-readable contractへ固定する

- **Preconditions**: F00-T01 ACCEPTED。
- **Allowed files**: 新規`docs/contracts/conversational-github-operations.json`、新規`docs/contracts/conversational-github-operations.schema.json`、新規`docs/contracts/project-operation-approver.schema.json`、新規`docs/contracts/plan-012-task-dag.json`、新規`scripts/validate-plan-012-dag.mjs`、新規`scripts/validate-plan-012-dag.test.mjs`、新規`packages/server/tests/conversationalGithubOperationsContract.test.ts`。
- **Work**: Operation schema and permission matrixを値変更せずJSON化する。別schemaでintended-approver masterのexact fields、RFC 8785/Ed25519、immutable source SHA、keyring/revocation、delivery/source entitlement、validity、projectごとのactive cardinality=1を固定する。task headingとPreconditionsをmachine-readable DAGへ一度転記し、表/DAG/各task-level Preconditionsの欠落・余剰・cycle・未知taskをvalidatorで拒否する。executorはfield、limit、profile、permission、target、result、approverを追加・削除・選択しない。
- **Complete**: Markdown表とJSON contractが一対一。禁止operationはcontractにhandlerを持たず、approverは署名済みmaster以外から解決できない。
- **Verify Positive**: schema validate、全99 executable taskのDAG/golden testがexit 0。
- **Verify Adversarial**: `pull_request.merge`、任意URL、任意GraphQL、未知field、project省略、approver 0/2件、expired/revoked/invalid signature、task依存1件欠落/余剰/cycleをfixtureへ入れるとexit 1。
- **STOP**: operation kindまたはprofile matrixが正本仕様と衝突する。

#### P012-F00-T03 ProjectV2 write除外decisionを記録する

- **Preconditions**: F00-T02 ACCEPTED、DEC-SPEC-008確認済み。
- **Allowed files**: 新規`docs/adr/0017-conversational-projectv2-status-write.md`、`docs/spec/productization-decisions.md`だけ。
- **Work**: GitHub `updateProjectV2ItemFieldValue`にprovider CAS/version/If-MatchがないTOCTOUを記録し、`project_v2.status.set`をinitial operation contractから除外する。Kanban/自然言語boardはread-only、editは認可済みGitHub deep linkだけとし、provider CAS追加またはownerのlast-writer risk受容をreconsideration triggerにする。
- **Complete**: Plan 012のconversation/Web Kanban/agent surfaceではProjectV2 mutation全種、item reorder、DnDを明示禁止し、operation JSON/schema/narrow port/handlerにwrite kindが存在しない。既存XLSX importは別decision/credential境界として非対象。
- **Verify Positive**: ADR link/catalog/traceability validate。
- **Verify Adversarial**: `project_v2.status.set`、option name/ID、GraphQL mutation、foreign nodeをcontractへ入れるとschema/handler testがred。
- **STOP**: ProjectV2 writeを同じPlanへ戻す要求が出る。別ADR/Planとowner risk decisionなしでは追加しない。

#### P012-F00-T04 meeting source・PII・retention decisionを記録する

- **Preconditions**: F00-T03 ACCEPTED。
- **Allowed files**: 新規`docs/adr/0018-meeting-minutes-intake.md`、`docs/spec/productization-decisions.md`、新規`docs/contracts/meeting-senders.v1.schema.json`、新規`runbooks/meeting-minutes-intake.md`だけ。
- **Work**: exact trigger、allowlisted mailbox/channel、Outlook immutable-ID canonical hashとsender/delegate identity、versioned Teams thread hash、raw本文non-persistence、metadata-only replacement cutoverとlegacy key/replica/WAL/PITR/backup crypto-shred、Microsoft 365/Purview legal hold正本、memory-only LLM input、derived proposal textの30分+24時間上限/terminal redaction/metadata 5年LTR、添付/transcript対象外を固定する。private `prjops-data`の同一immutable 40-character SHAに`meeting-senders.v1.json`+detached signatureを置き、既存offline root/delegated keyring/revocation/RFC 8785/Ed25519検証を再利用する。recordは`tenantId,projectId,subjectKind=user|shared_mailbox,subjectOid,mailboxObjectId|null,addressHmacSha256,hmacKeyVersion,delegates:[{delegateSubjectOid,validFrom,validUntil}],validFrom,validUntil,version`のexact schema、active address HMAC cardinality 1、delegate subject→shared mailbox cardinality 0..1とする。address HMAC inputはinternal ASCII SMTP addr-specのASCII lowercase US-ASCII bytesに固定し、non-ASCII/quoted/comment/display-name/external/invalidをschema生成時とruntimeの双方でrejectする。raw email/display nameをmasterへ入れず、runtime directory permissionを要求しない。minutes extractorは既存ADR-0002と揃えたAnthropic commercial APIの`claude-sonnet-4-6`、Japan利用を含むowner承認済みregion、prompt caching/file API/batch/conversation persistenceなしに固定する。production gateは契約済みZero Data Retention対象organization/API keyのevidence、training不使用のcommercial terms、abuse/law例外、provider/gateway/APMのrequest/response body logging・trace・replay 0、provider console/delete/DPA owner receiptを必須とする。標準30日retention、consumer Claude/Claude Code login、保存型product、ZDR対象外endpointへfallbackしない。ZDR証明不能ならraw本文をproviderへ送信せずproduction intakeをSTOPする。
  Anthropic Privacy Controls readbackで当該organization/key/endpoint/modelがZDR eligibleであり、Covered Modelの追加retention/review対象でないことを確認する。User Safety classifier resultと法令・misuse/harm例外はraw input/output 0の外部例外としてData Ownerが明示受容する。Covered Modelまたは追加raw retention対象ならmodelを勝手に差し替えずDEC-ENVをBLOCKEDに戻す。
- **Complete**: source種別ごとのowner、region、raw storage=`none`、source-system hold、derived payload lifecycle、clarification、stale条件に加え、provider organization/key/model/endpoint/region、ZDR applicability、training、abuse/law例外、cache/log/trace、DPA/delete ownerとevidence SHAが空欄なし。
- **Verify Positive**: contract fixtureのTeams/Outlook valid sourceがaccept。
- **Verify Adversarial**: ambient chat、forwarded mail、unknown/ambiguous/delegate-rule不一致sender、attachment-only、expired/moved source、cross-project subject、標準30日retention key、consumer login、prompt cache、body logging/tracingをrejectし、provider request 0。
- **STOP**: Data Owner、privacy owner、Microsoft tenant ownerの承認がない場合、production intakeを有効化しない。

#### P012-F00-T05 isolated agent execution decisionを発行する

- **Preconditions**: F00-T04、DEC-ENV-002 ACCEPTED。
- **Allowed files**: 新規`docs/adr/0019-isolated-interactive-agent-execution.md`、`docs/adr/README.md`、`docs/spec/productization-decisions.md`、新規`docs/contracts/isolated-agent-launch.v1.schema.json`、新規`runbooks/isolated-agent-launch.md`だけ。
- **Work**: 新規`DEC-ENV-004`としてJapan East private AKS上の1 request/1 Kubernetes Jobを採用し、Azure Container Apps Jobはjob-wide identity/egressのため明示却下する。Azure Linux 3.0+ dedicated user node pool、Azure CNI powered by Cilium、Pod Sandboxing `kata-vm-isolation`、Pod Security restricted、Azure Policy deny、immutable ACR digestを固定する。agent Jobは`agent-executions` namespace、service account token/UAMI/Workload Identityなし、launch-specific labelとdefault-deny egressを持つKata Podとする。credential proxyは`agent-gateway` namespaceの別Pod/Service、専用service account+projected Kubernetes JWT、broker/gateway/cluster DNSだけへのegressとし、agentからproxy filesystem/PID/volumeを共有しない。launch rowは256-bit nonce hash、project/repository ID、image digest、proxy Pod UID、nullable Job/agent Pod UID、immutable 128-bit `lease_generation`、`job_spec_attested=false`、`pod_attested=false`、有効期限5分をwrite-ahead保存する。brokerはKubernetes OIDC discovery/JWKSとTokenReview readbackでproxy projected JWTの`iss/aud/sub/namespace/serviceAccountName/serviceAccountUID/podName/podUID/signature/exp`、nonce、signed mapping、Kubernetes APIのproxy namespace/UID/image/securityContext/serviceAccount/policy/Runningを検証する。credential stateは`pending→issuing→issued→lease_delivering→active|indeterminate|revoked|expired`とする。`pending→issuing` commit後にだけGitHub installation tokenをrepository 1件/read-only permissionsで最大1回mintし、GitHub `expires_at` 1時間以下を検証してKey Vault管理AES-256-GCMでlaunch/repo/permission/expiry AADへsealし`issued`へ保存する。mint timeout、mint後かつ`issued` commit前crash/DB failureは`indeterminate`、再mint 0、orphan alertとする。`issued→lease_delivering`で`lease_generation`を一度だけ設定し、launch ID/proxy Pod UID/repo/provider/model/budget/lease generation付き10分gateway JWTをproxyへ1回だけ返す。proxy ACK後にbrokerが`active`をcommit/readbackする。launcherは決定的名の`suspend:true` Jobを一度だけcreateし、timeout/409は同名GETでreconcileする。Jobは`parallelism:1`、`completions:1`、`backoffLimit:0`、`restartPolicy:Never`、`activeDeadlineSeconds<=lease`、有限`ttlSecondsAfterFinished`とする。UID/resourceVersion/image/runtime/security/service-account/label/policy selectorを完全readbackし、Job UIDと`job_spec_attested=true`をCAS保存後にUID/resourceVersion precondition付き`suspend:false` patchを行う。Podのnoncredential init gateはbroker readyまでprovider entrypointを開始しない。brokerが実Pod UID/image/runtimeClass/securityContext/serviceAccount/Cilium selectorをreadbackし`pod_attested=true`をCASした時だけreadyとなる。別名再create、controller replacement Pod、attestation前provider processは禁止し、不一致/admission mutation/Pod timeout/crash/OOM/eviction/broker crashは`indeterminate`+revoke+delete、provider process 0または最大1とする。partial response/ACK前crashは`indeterminate`、再delivery 0とする。row versionはDB CAS専用、JWT/gateway照合はactive遷移で変化しない`lease_generation`を使い、作成前に存在しないJob UIDを含めない。agent-visible credentialはlaunch固有private-CA TLS Serviceへ渡す固定placeholder `proxy-placeholder`だけで、JWT取得endpoint/shared `/proc`/shared credential volumeを作らない。GitHub-read/LLM gatewayは各requestでJWT、proxy projected service-account JWT/Pod UID、Kubernetes API readback、`agent_launches` lease generation/active state/job_spec_attested/pod_attested/expiry/revocationを再検証する。GitHub-read gatewayはGitHub CLI 2.96.0のimmutable binary/attestationから抽出してSHA-256固定したexact REST method/pathおよびGraphQL persisted query/variables/root/fields/depth/page/costだけをsigned repo/projectへproxyし、任意queryを受けない。LLM gatewayだけがprovider long-lived credentialをKey Vaultから読み、同JWTでClaude Anthropic-format、Codex/Droid OpenAI Responses-formatをfixed model/budgetへforwardする。OpenAIはowner承認済みproject/org/key・Japan endpoint・`gpt-5.6-sol`のZDR readbackを必須とし、`store:false`/`background:false`を強制、保存型endpoint/tool/extended prompt cachingを拒否、gateway local body log/trace/replay/cacheを0にする。ZDRが取れない場合はMAM/default retentionをownerが明示受容するまでSTOPし、暗黙fallbackしない。Codex provider/authはproject configに置かずfresh job-only `$CODEX_HOME/config.toml`、Claude/Droidは公式gateway/BYOK設定をlaunch固有TLS Serviceへ向ける。job/gateway leaseは10分で、終了時brokerはsealed tokenを復号して`DELETE /installation/token`をbest-effort実行しciphertextを消去する。revoke失敗/orphanは最大1時間の残存riskとしてinventory/alertし、security ownerがinstallation suspend/deleteを選ぶ。providerへのprompt送信、費用、retention例外、proxy compromise時の10分lease riskをowner acceptanceへ記録する。
  Credential proxyのexact network/RBAC contractではKey Vaultを除外する。proxy SAはbroker/gateway audienceだけでUAMI/federated credential 0、Key Vault route/role/data-plane 0。broker/gatewayの別identityだけが用途別secret/keyを読む。
  OpenAI originはexact `https://jp.api.openai.com/v1`、storage residency Japan=yes、regional processing=noとし、MAM/ZDRとnonregional processingのData Owner acceptanceを必須化する。startupはorigin/org/project/key reference/model/ZDR/data sharing offをreadbackし、Japan processingを主張しない。
- **Complete**: DEC-ENV-004とADRにcomponent owner、trust boundary、exact claims/state、repo binding、nonce、deterministic suspended Job/attestation、provider expiry/job lease、one-time delivery、sealed credential、LLM gateway auth、OpenAI project/org/model/endpoint/region/ZDRまたは明示受容retention、audit、revocation/orphan、rollback、cost/region、negative resourcesとowner-accepted residual riskが空欄なく、既存DEC-ENV-002との関係が明記される。
- **Verify Positive**: zero-context reviewerがschema/runbookだけからbroker request/state、claim検証順、token permission/expiry/lease generation、provider別gateway config、AKS/Bicep/Kubernetes resource、ownerを同一集合で復元する。
- **Verify Adversarial**: ACA Job、self-hosted Docker socket、host process、mutable image tag、public broker、agent service-account/Workload Identity、standard runc、missing default-deny、long-lived provider keyをjobへ注入、PAT/SSH、multi-repo token、nonce/lease generation再利用、mint/commit/response各境界crash、別名Job再作成、attestation前unsuspend、caller自己申告attestation、Kubernetes UID/policy readback省略、OpenAI `store:true`/background/保存型tool/extended cache/ZDR driftを選ぶとcontract validationがred。
- **STOP**: ownerがDEC-ENV-004/AKS費用を承認しない、AKS Pod Sandboxing/Cilium/projected service-account JWTのOIDC/JWKS/TokenReview/Kubernetes UID・policy readbackをJapan East stagingで検証できない、またはGitHub Appがrepository-selected read-only tokenをmintできない。

#### P012-F00-T05P cutover guard management permissionをsandbox証明する

- **Preconditions**: F00-T01 ACCEPTED。
- **Allowed files**: 新規`.orchestration/evidence/P012-F00-T05P/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: disposable Azure sandboxへ専用App Configuration store、runtime reader sibling assignment、2世代のephemeral cutover UAMI/FIC、generation別Data Owner assignment、guard UAMIを作る。Azureのdelegated role-assignment management conditionをprincipal ID、role definition ID、resource scopeへexact限定し、guardがcurrent generationのnamed assignment/FICだけGET/DELETEできることを実APIで証明する。runtime reader、別generation、別principal、別role、別store、UAMI本体、sibling FIC mutationは403を要求する。zone-redundant ACA guardを3 replica/5秒loop/exact probes/revision handoffで立て、provider `zoneRedundant=true` readback、poll最悪位相、単一replica kill、new revision rollout中のDELETE受理とPUT403を測定する。公式Azure Chaos Studio fault libraryにACAのzone-selective outage faultがないことを参照SHA付きで記録し、単一zone outageを注入済みと主張しない。conditionが表現不能ならgeneration別dedicated resource group+ephemeral UAMI隔離へ変更して再証明し、どちらも成立しなければSTOPする。実測値とAzure上限からstale検出65秒、DELETE受理95秒、PUT403 11分のSLOを確認する。zone outageとtotal Japan East/Storage/Entra/management-plane outageはnon-injectable/SLO外 residual riskとし、cutover前Service Health green、outage中AppConfig writer 0、復旧後403前writer/regrant 0をData Ownerが署名する。
- **Complete**: 採用condition JSONまたはisolation topology、exact management Actions/NotActions/condition、DataActions 0、positive/negative実測、`zoneRedundant=true` readback、probe/revision contract、Chaos Studio fault-library参照、zone/region residual-risk owner署名、cleanup inventoryがevidenceへ固定される。replacement resourceはまだ0。
- **Verify Positive**: generation Nだけをrevokeしruntime readerとN+1は有効、単一replica killとrevision rollout中もNの既発行token PUTは11分以内に403、zoneRedundant readback一致、resource ID再利用0、cleanup 100%。
- **Verify Adversarial**: runtime/sibling/別storeのassignment、別generation FIC、UAMI本体をdeleteしようとすると403。condition省略、scope拡張、owner role、broad User Access Administrator、non-zone/minReplicas<3/probe欠落/old revision早期停止、poll最悪位相SLO超過、Service Health degraded、region-risk署名なし、cleanup残存をrejectする。
- **STOP**: current generationだけをdeleteする管理権限、旧世代tokenの期限内PUT403、zoneRedundant readback、zone/region residual-risk署名、または全sandbox cleanupを置換DB作成前に証明できない。

#### P012-F00-T06 Phase 0 acceptance

- **Preconditions**: F00-T01,F00-T02,F00-T03,F00-T04,F00-T05,F00-T05P ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F00-T06/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: source evidence、decision、contract、rejected alternatives、review outcomeを一つのreceiptへまとめる。
- **Complete**: CRITICAL/HIGH 0、MEDIUMはowner/date/mitigation付き。baseline SHAとartifact hashが一致。
- **Verify Positive**: fresh-context reviewerがcontractからoperation/trigger/禁止項目を同じ集合として復元できる。
- **Verify Adversarial**:会話文だけを渡しても追加operationやPagesを推測できないことを確認。
- **STOP**: reviewer間でoperation setまたはapproval境界の解釈が一致しない。

**Phase 0 completion**: T01,T02,T03,T04,T05,T05P,T06がACCEPTEDで、以後のexecutorが会話履歴なしにexact contract、対象外、DAG、モデルを再現できる。

### Phase 1: typed proposal・承認・冪等GitHub executorを実装する

#### P012-F01-T01 cross-project intentを全経路でfail-closedにする

- **Preconditions**: F00-T06 ACCEPTED。
- **Allowed files**: `packages/server/src/agents/teamsConversationAgent.ts`、`packages/server/tests/teamsConversationAgent.test.ts`だけ。
- **Work**: slash/free-text正規化直後に`intent.projectId === channel.projectId`を必須化する。不一致はGitHub/DB/LLM追加call前に拒否返信と監査を行う。
- **Complete**: query、Issue write、code taskの全kindでchannel projectだけがtarget/auditに使われる。
- **Verify Positive**: same-project slash/free-textが従来結果。
- **Verify Adversarial**: PJ-001 channelからPJ-999を指定してGitHub/insert/dispatch call 0、監査reason=`project_mismatch`。
- **STOP**: 一つのchannelが複数projectを正当に表す仕様が見つかった場合。

#### P012-F01-T02 pure operation parser/schemaを追加する

- **Preconditions**: F01-T01 ACCEPTED。
- **Allowed files**: `packages/prjops/src/lib/commandParser.ts`、`packages/prjops/tests/commandParser.test.ts`、`packages/server/src/lib/freeTextIntent.ts`、`packages/server/tests/freeTextIntent.test.ts`だけ。
- **Work**: Operation schema and permission matrixのexact kind/field/nullability/min/max/defaultをstrict schemaで転記する。LLMはproject/repo/node/field/option IDを決めず、人間可読targetだけ抽出する。
- **Complete**: slashとfree-textが同じinternal discriminated unionへ収束する。
- **Verify Positive**: 各kindの日本語/英語valid fixture。
- **Verify Adversarial**: 曖昧target、複数operation、oversize、HTML/script、unknown kindはproposalを作らずunknown/400。
- **STOP**:一発話に複数mutationを自動分割する必要が出た場合。議事録以外は1 intentへ再質問する。

#### P012-F01-T03 GitHubClientへ最小APIを追加する

- **Preconditions**: F01-T01 ACCEPTED。
- **Allowed files**: `packages/shared/src/clients/githubClient.ts`、`packages/shared/tests/githubClient.test.ts`、`packages/server/src/auth/githubAppTokenProvider.ts`、`packages/server/tests/githubAppTokenProvider.test.ts`、新規`packages/server/src/lib/conversationalGithubPorts.ts`、新規`packages/server/src/lib/conversationalGithubCredential.ts`、`packages/server/src/config.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/conversationalGithubPorts.test.ts`、新規`packages/server/tests/conversationalGithubCredential.test.ts`、`packages/server/tests/config.test.ts`。
- **Work**: `getIssue`、`updateIssueState`、marker検索可能な`listIssueComments`、結果IDを返す`createIssueComment`を追加する。全REST requestの`X-GitHub-Api-Version`を2026-07-15時点の最新supported `2026-03-10`へ統一する。Plan 012 conversation App ID/private-key secret/installation IDをXLSX、coding-dispatch、unprivileged agent、P010 publisherの各credentialと別config key、別`TokenProvider`、別cache/compositionで注入する。startupは3 coding identityを同じ表でreadbackし、coding-dispatch App=Metadata read/Contents read/Actions write、agent=Metadata read/Contents read、publisher=Metadata read/allowlisted-branch Contents write/Pull requests write、publisher Actions=none、dispatch Contents/Pull requests write=noneへ完全一致させる。conversation AppはMetadata=read、Contents=read、Issues=write、Pull requests=write、Projects=read、Actions/Workflows/Projects-write/Administration/Pages/Deployments=noneである。Plan 012 narrow portは5 mutationと必要readだけを公開しProjectV2 methodsを公開しない。既存XLSX importのProjectV2 write credential/portは別decisionとして維持する。
- **Complete**: conversation executorのtype/DI/tokenからProjectV2 mutationを呼べず、Plan 012 AppとXLSX AppのApp ID/installation/token cache namespaceが一致するとstartup failureし、GitHubClient全体の既存XLSX import APIを誤って削除しない。
- **Verify Positive**: official REST request path、method、version header、response parseをmockで一致。
- **Verify Adversarial**: 403/404/409/422/429/5xx、invalid JSONをfail-closedにする。conversation portへ`addProjectV2ItemById`/`updateProjectV2ItemFieldValue`を渡すtype fixtureはcompile failure、Plan 012 AppへProjects writeを付与またはXLSX tokenを注入するとstartup/test failure。publisherへActions write、dispatchへContents/Pull requests write、agentへActions/write、3 App/installation/cache/environmentのcross-injectionを各startup redにする。Projects write権限なしAppでremote mutation 403、XLSX portの既存testはgreen。
- **STOP**: API versionまたはpermissionが公式資料と一致しない。汎用`request(method,url,body)`は追加しない。

#### P012-F01-T04 authorization/target/idempotency pure policyを追加する

- **Preconditions**: F01-T02,F01-T03 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/lib/operationProposal.ts`、新規`packages/server/src/lib/operationApproverMaster.ts`、新規`packages/server/src/agents/operationApproverProvider.ts`、`packages/server/src/config.ts`、新規`packages/server/tests/operationProposal.test.ts`、新規`packages/server/tests/operationApproverMaster.test.ts`、新規`packages/server/tests/operationApproverProvider.test.ts`、`packages/server/tests/config.test.ts`だけ。
- **Work**: RFC 8785 canonicalization/Ed25519 verificationをpure lib、immutable-SHA fetch/atomic refreshをproviderに分離する。protected environmentのroot fingerprint、private repo、40-char SHA、machine identity configをfail-closed検証し、root-signed keyring/revocation→delegated signature→active cardinality/delivery/source entitlementの順で検証する。そのverified snapshotだけをactive subject/persona/project scope、channel project、署名済みrepo mapping、source revision/thread hash、expected Issue state、payload size、reason、idempotency policyへ入力する。
- **Complete**: policy outputは`read_now | propose | reject`とmachine code。LLM confidenceを入力にしない。
- **Verify Positive**: 全kindの最小valid inputがexpected decision。
- **Verify Adversarial**: wrong tenant/persona/project/repo、inactive、approver 0/2件、self approver、mutable/non-40-char source SHA、unknown/revoked key、bad root fingerprint、RFC 8785 byte差、expired/invalid signature/version gap、atomic refresh途中failure、stale hash、duplicate key、blank reasonをreject。期限切れ後のcache fallback 0。
- **STOP**: policyがDB/API/LLMへ依存する形になる。

#### P012-F01-T05 proposal schema・migration・repoを実装する

- **Preconditions**: P010-F03-T05 ACCEPTED、F01-T04 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140100_operation_proposals.sql`、新規`packages/server/src/db/operationProposalsRepo.ts`、新規`packages/server/src/db/operationExecutionQueueRepo.ts`、新規`packages/server/src/db/operationExecutionAttemptsRepo.ts`、新規`packages/server/src/db/operationNotificationsRepo.ts`、新規`packages/server/tests/operationProposalsRepo.test.ts`、新規`packages/server/tests/operationExecutionQueueRepo.test.ts`、新規`packages/server/tests/operationExecutionAttemptsRepo.test.ts`、新規`packages/server/tests/operationNotificationsRepo.test.ts`だけ。固定migration名が既に存在すればSTOPする。
- **Work**: `operation_proposals`へUUID、source type/key/hash/revision、project/repo、requester stable subject、approver master version/digest、GitHub 5-kind strict payload（coding task除外）、payload SHA/redacted_at、expected state、`approval_request_id` FK、`context_provider_kind`、`context_provider_version`、`context_provider_digest`、`context_activated_at`、idempotency key unique、status、result、trace/timestampsを持たせる。context 4列は初期NULLで、activation transactionだけが一度設定し、以後immutableとする。同migrationでlease/statusだけの`operation_execution_queue`、`operation_id UNIQUE`の`operation_execution_attempts`、`operation_notification_outbox`を作る。初期outbox schemaからoperation ID+notification kind unique、opaque delivery key、`requester_status|approval_request|operation_result|approval_terminal|clarification` kind、`blocked_context|pending|claimed|sending|sent|failed|indeterminate|expired` status、lease/attempt、typed `http_status smallint`、nullable fixed `error_code`、`provider_request_id_hash`、`provider_message_id_hash`、nullable sealed-envelope ciphertext/96-bit IV/tag/key-version/AAD-digestだけを持たせ、raw/generic provider response/result/error/body/URL/email/address列を作らない。`UNIQUE(key_version,iv)`を設定してraw nonce/URL列を持たない。proposal/queueにattempt countを置かない。proposal statusは`pending|approved|executing|succeeded|failed|verification_failed|indeterminate|rejected|expired|stale`。
- **Complete**: Plan 010正本decision後のadapterだけが`pending→approved`を行い、executorがpreflight後にattempt insertと`approved→executing`/queue claimを同transactionでCASする。`completeAndEnqueueNotification()`がterminal更新、text payload redaction、append-only audit、outbox insertを同transactionで行い、raw正文をproposal/outboxへ複製しない。
- **Verify Positive**: fresh、upgrade、second run、insert/find/CAS/unique conflictがreal PostgreSQLでgreen。
- **Verify Adversarial**: 20 concurrent approvals/attempt insertsで勝者1、proposal/queueに偽attempt column、片側だけclaimed/attemptあり、duplicate source/idempotency、terminal overwrite、redaction/audit欠落時にexternal call 0またはtransaction rollback。
- **STOP**: Plan 010 approval schemaをfork/duplicateする必要がある。先に共通境界を修正する。

#### P012-F01-T06 mutation markerとreconciliationを実装する

- **Preconditions**: F01-T05 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/lib/operationMarker.ts`、新規`packages/server/tests/operationMarker.test.ts`、新規`packages/shared/src/clients/singleAttemptTransport.ts`、新規`packages/shared/tests/singleAttemptTransport.test.ts`、`packages/shared/src/clients/githubClient.ts`、`packages/shared/tests/githubClient.test.ts`だけ。
- **Work**: create/comment本文へ`<!-- aiops-op:<UUID> -->`を1個付与する。Issue state=`all`とcommentの全pageをread-only探索し、Issue state updateはexpected current valueとtarget valueを照合する。mutationと結果通知用にinjected `FetchLike`を1回だけ呼び、retry/backoffを持たない`singleAttemptTransport`を追加する。marker不在やreadback不能は未実行と推定せずindeterminateを維持する。
- **Complete**: Side-effect and recovery contractの分類を返し、自動再送を一切許可しない。target既達はsuccess、別値はstale、結果不明はindeterminate。
- **Verify Positive**: marker発見、already-target、initial applyの3経路。
- **Verify Adversarial**:偽marker、別repo marker、複数marker、timeout直後停止、readback 5xxで二重writeしない。
- **STOP**: GitHub readbackなしで安全に再試行できないoperationを見つけた場合、そのkindを無効化する。

#### P012-F01-T07 operation executorを実装する

- **Preconditions**: F01-T06、P010-F03-T08 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/agents/githubOperationExecutor.ts`、新規`packages/server/tests/githubOperationExecutor.test.ts`だけ。
- **Work**: approved rowをCAS claimし、kind別の固定handlerを呼び、出力前sanitize、readback、result/auditを記録する。switchのdefaultはunreachable error。任意APIは受け付けない。
- **Complete**: GitHub mutation 5 kindのsuccess/failed/stale/verification_failed/indeterminateが決定的。coding task handlerは存在しない。requester、approver、executor、source、before/afterを監査し、各mutationはsingle-attempt transport経由だけである。
- **Verify Positive**: kindごとの外部call数・path・payload・result URL一致。
- **Verify Adversarial**: unapproved、self-approved、expired、failsafe、duplicate、race、GitHub timeout、process crash、DB finalization failureでoutbound mutation request 0/1、attempt済みrowの自動再送0。
- **STOP**: external write前にauthorization/mapping/source revisionを再取得できない。

#### P012-F01-T08 durable queueへoperation executionを結線する

- **Preconditions**: F01-T07 ACCEPTED。
- **Allowed files**: `packages/server/src/db/operationProposalsRepo.ts`、`packages/server/src/db/operationExecutionQueueRepo.ts`、`packages/server/src/db/operationExecutionAttemptsRepo.ts`、新規`packages/server/src/scheduler/tasks/approvedOperationDispatchTask.ts`、`packages/server/src/index.ts`、`packages/server/tests/operationProposalsRepo.test.ts`、`packages/server/tests/operationExecutionQueueRepo.test.ts`、`packages/server/tests/operationExecutionAttemptsRepo.test.ts`、新規`packages/server/tests/approvedOperationDispatchTask.test.ts`だけ。
- **Work**: Plan 010のdecision/expiryと`operation_proposals.approval_request_id`を定期的にjoinする。acceptedは1つのPostgreSQL transaction内で`operation_execution_queue`へ`INSERT ... ON CONFLICT DO NOTHING`しproposalを`pending→approved`へCASする。rejected/30分expiredは`completeAndEnqueueNotification()`でproposal terminal、payload redaction、audit、source/intended-approver terminal outboxをatomic作成し、queue/attemptを作らない。consumerはbounded preflight後にproposal/queueをlockし、authoritative attempt row不存在の場合だけattempt insert+queue claim+`approved→executing`を同transactionで行う。attempt既存/state不一致はmutationを送らずT06 read-only reconciliationへ進む。coding taskはこのgeneric dispatcherへ一切入れずF02-T07のP010 state machineだけが扱う。
- **Complete**: approval responseとworker crashの間でもevent lost 0。各operation IDのoutbound mutation requestは最大1、結果不明はindeterminate。
- **Verify Positive**: enqueue→claim→execute→doneのtrace ID相関。
- **Verify Adversarial**: enqueue後crash、external call後crash、markDone前crash、lease reclaim、proposal/queue/attempt片側corruption、dead-letterでoutbound 0/1とexpected terminal state。
- **STOP**: event doneとproposal terminalが相互に矛盾し、reconcileで閉じられない。

#### P012-F01-T09 Phase 1 acceptance

- **Preconditions**: F01-T01,F01-T02,F01-T03,F01-T04,F01-T05,F01-T06,F01-T07,F01-T08 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F01-T09/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: real PostgreSQL concurrency/failure injection、GitHub mock contract、security reviewをまとめる。
- **Complete**: cross-project external call 0、20 concurrent approvalのenqueue eligibility 1、各operationのoutbound mutation request 0/1、全writeにhuman approval、all terminal state/audit相関。
- **Verify Positive**: focused testsと`mise run ci` green。
- **Verify Adversarial**: approvalをDBで直接偽装、source edit/delete、mapping change、callback replay、marker collisionをすべてfail-closed。
- **STOP**: CRITICAL/HIGH finding 1件以上。

**Phase 1 completion**: typed operation以外を実行できず、承認・CAS・write-ahead attempt・readback・監査を含めてoperation IDごとのoutbound mutation request最大1とindeterminate時の自動再送0を実PostgreSQLで証明する。

### Phase 2: Teams自然言語操作をproposal境界へ接続する

#### Gate group P012-F02-T01 read-only intent基盤（非実行summary）

- **Preconditions**: F01-T09 ACCEPTED、P010-F02-T14 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140145_teams_conversation_references.sql`、`packages/server/package.json`、`pnpm-lock.yaml`、`.env.example`、`docs/teams-app/manifest.json`、`docs/teams-app/README.md`、`packages/server/src/config.ts`、`packages/server/src/agents/teamsConversationAgent.ts`、新規`packages/server/src/db/teamsConversationReferencesRepo.ts`、新規`packages/server/src/db/teamsIntentIngressRepo.ts`、新規`packages/server/src/clients/teamsProactiveClient.ts`、新規`packages/server/src/http/routes/teamsBotActivities.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts`、新規`infra/bicep/main.bicep`、新規`infra/bicep/modules/teams-bot.bicep`、`packages/server/tests/config.test.ts`、`packages/server/tests/teamsAppManifest.test.ts`、`packages/server/tests/teamsConversationAgent.test.ts`、新規`packages/server/tests/teamsConversationReferencesRepo.test.ts`、新規`packages/server/tests/teamsIntentIngressRepo.test.ts`、新規`packages/server/tests/teamsProactiveClient.test.ts`、新規`packages/server/tests/teamsBotActivities.test.ts`、新規`packages/server/tests/infraBicepComposition.test.ts`だけ。固定migration名が存在すればSTOPする。
- **Work**: SDK 2.0.13をpinする。Hono routeはPOST/JSON/byte+time cap/圧縮なし/Auth header 1をparse前検証し、`IHttpServerAdapter`/`HttpServer.handleRequest`へbridgeしてSDK JWT検証を維持する。exact configは`TEAMS_BOT_APP_ID`、`TEAMS_BOT_TENANT_ID`、verified registration readback由来の`TEAMS_BOT_ENTRA_OBJECT_ID`（lowercase UUID、platform上別identityならapp IDとの差異を検証）、full `TEAMS_SERVICE_URL_BASE`、`TEAMS_BOT_CREDENTIAL_SECRET_URI`。service baseはapproved host+normalized path（例`/teams`）を保持しorigin-only/path confusion/SSRFを拒否する。Appは`clientSecret`をcaptureせずofficial `AppOptions.token` callbackを使う。callbackだけがserver WIでcurrent Key Vault secret versionからbot access tokenをmemory取得し、old/new overlap中にversion変化をatomic refresh、secretをSDK/logへ返さずrestartなしでrotationする。manifest/Bicep/legacy RSC、conversation reference、ingress schema/CAS/self-loop、Graph-only fallback、read intentを前段contractどおり実装する。
- **Complete**: read intentはproposalなし、GitHub writeなし、最大件数/pagination link明示。SDK/Graphの同一message+revisionはparse、reply、proposal/coding/outbox cardinality各1。Teams outbound transportはSDK reactive/proactiveだけで、raw activity/body永続化、Graph chat POST、tenant/app/service-origin drift、plain credential env、未install app 0。sandbox manifest package install/uninstallとcredential rotationがgreen。
- **Verify Positive**: install.add→active personal/channel reference、3 read kindのsanitized reactive Teams reply、uninstall→revoked。SDK-first/Graph-first、20 duplicate、restartでsource row/parse/reply/proposal/coding/outbox各1、edit revisionだけ別row 1。
- **Verify Adversarial**: transport limits/JWT、foreign tenant/project/repo、`/teams`を落としたorigin-only base、userinfo/query/fragment/path confusion/SSRF、missing/duplicate/revoked reference、bot object/app ID substitution、secret version rollover/old-new overlap/token callback failure、manifest/RSC drift、SDK/Graph concurrent claim/lease、self reply 100回、Graph chat POSTでexternal write/proposal 0。
- **STOP**: board endpointがP010受入未完、またはsandboxでSDK activity IDとGraph chatMessage IDの相関を証明できないままdual execution ingressを有効化する。

#### P012-F02-T02 全write intentをproposal作成へ変更する

- **Preconditions**: F02-T01F、P010-F05-T14 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140150_coding_task_context_outbox.sql`、`packages/server/src/agents/teamsConversationAgent.ts`、新規`packages/server/src/lib/codingTaskOperationAdapter.ts`、新規`packages/server/src/lib/sealedApprovalDeliveryEnvelope.ts`、`packages/server/src/db/operationProposalsRepo.ts`、`packages/server/src/db/operationNotificationsRepo.ts`、`packages/server/src/db/approvalRequestsRepo.ts`、`packages/server/src/db/codingTasksRepo.ts`、`packages/server/src/config.ts`、`packages/server/tests/teamsConversationAgent.test.ts`、`packages/server/tests/operationProposalsRepo.test.ts`、`packages/server/tests/operationNotificationsRepo.test.ts`、`packages/server/tests/approvalRequestsRepo.test.ts`、`packages/server/tests/codingTasksRepo.test.ts`、新規`packages/server/tests/codingTaskOperationAdapter.test.ts`、新規`packages/server/tests/sealedApprovalDeliveryEnvelope.test.ts`、`packages/server/tests/config.test.ts`だけ。固定migration名が存在すればSTOPする。
- **Work**: 現`gh_issue_create`直接callを削除する。GitHub mutation 5 kindはverified master/source contextとsource revision/hashを固定し、`initializeWithApprovalAndNotifications()`でproposal、Plan 010 approval request、requester status outbox、`blocked_context` intended-approver outboxを同一transactionへ1/1/1/1作成する。migrationは`coding_tasks`へ`context_provider_kind/version/digest/activated_at`を追加し、初期NULL・activation後immutableとする。`operation_notification_outbox`の最終DDLは本taskだけが所有し、`subject_kind='operation'|'coding_task'`、nullable `operation_id`/`coding_task_id`、exact-one-subject CHECK、両FK、subject別partial unique、`requester_status|approval_request|operation_result|approval_terminal|clarification` kind、`blocked_context|pending|claimed|sending|sent|failed|indeterminate|expired` status、lease/attempt、typed `http_status smallint`、nullable fixed `error_code=destination_unavailable|transport_rejected|transport_timeout|transport_protocol_invalid|context_provider_mismatch`、`provider_request_id_hash`、`provider_message_id_hash`、terminal/status/error compatibility CHECKをfresh schemaと`202607140150_coding_task_context_outbox.sql`へ完成形で入れる。approval raw nonce/relative pathはKey Vault管理AES-256-GCM current keyとCSPRNG 96-bit IVでsealし、AADをrequest ID、delivery SHA-256、expiry、key versionのcanonical bytesへ固定する。DBはnonce hashとciphertext/IV/tag/key versionだけを保存し、`(key_version,iv)` unique conflictをfail-closeする。decrypt keyringは未期限ciphertext参照中の全versionを保持し、該当row 0かつ最大expiry+24時間後だけkeyを廃棄する。`coding_task.create`はP010 adapterへ渡し、P010 initializerでcoding row、approval request、`subject_kind='coding_task'`のrequester/approver outboxをatomic作成し、generic proposal/queue/attemptを作らない。
- **Complete**: Teams handlerからGitHub write methodの直接call 0。proposal commit後に4 row欠落state 0、context provider未登録時のapprover delivery/approval 0、DB dumpからraw nonce/URL復元不能。
- **Verify Positive**: GitHub 5 kindはoperation pending row 1/coding row 0、coding taskはP010 queued row 1/operation row 0、GitHub/Actions write 0。
- **Verify Adversarial**: ambient会話、曖昧対象、project mismatch、duplicate notification、4 statement各失敗、commit直後crash、restart、20 concurrent initializer、DB theft、wrong key/version/AAD/request/delivery/expiry、IV長≠96-bit、forced IV reuse、30分内2回rotation、参照中key削除で各正本row 0またはcardinality 1/1/1/1、partial commit/raw nonce/generic-P010二重row 0。
- **STOP**: parserだけの権限判定でwriteを許可する経路が残る。

#### P012-F02-T03 authenticated approval contextを先に接続する

- **Preconditions**: F02-T02、P010-F03-T08 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/lib/operationApprovalAdapter.ts`、`packages/server/src/http/routes/approvals.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts`、`packages/server/src/db/operationProposalsRepo.ts`、`packages/server/src/db/operationNotificationsRepo.ts`、`packages/server/src/db/codingTasksRepo.ts`、新規`packages/server/src/scheduler/tasks/operationContextActivationTask.ts`、`packages/server/tests/operationProposalsRepo.test.ts`、`packages/server/tests/operationNotificationsRepo.test.ts`、`packages/server/tests/codingTasksRepo.test.ts`、新規`packages/server/tests/operationContextActivationTask.test.ts`、`packages/shared/src/clients/graphClient.ts`、`packages/shared/tests/graphClient.test.ts`、新規`packages/server/tests/operationApprovalAdapter.test.ts`だけ。Plan 010所有table/policy/token/decision state setは変更しない。
- **Work**: T02が作成したapproval requestへsource-kind context providerをDIする。`teams_channel`はdelegated Graph sessionでexact team/channel membershipと全thread hash、`outlook_folder`はexact mailbox/folder accessとOutlook canonical message hash、`interactive_agent`はauthenticated `(tid,oid,clientId)`、active profile、one-time POST/stored payload hash、`coding_task`は元sourceとPlan 012 verified contextをGET/POST直前に再検証する。initializer時点でruntime providerが登録済みなら同一transactionでprovider kind、semver version、compiled artifact SHA-256 digest、timestampをsubjectの`operation_proposals`または`coding_tasks`の4 exact columnへ書き、対応outboxを直接`pending`にする。未登録ならsubject 4列NULLかつ`blocked_context`でcommitする。新規1分schedulerは`subject_kind`別に`blocked_context`を走査し、登録済みruntime providerのkind/version/digestを検証後、正本subject 4列のNULL→valueと同digest outboxの`blocked_context→pending`を一つのtransaction/CASでactivateする。期限切れblocked rowはoperation proposalまたはcoding taskを既存`expired`、payload/instruction redaction、audit、requester/intended-approver terminal outboxへatomic遷移し、generic queue/attempt/workflow dispatchを作らない。approval GET/POST、outbox claim、decision commit直前はruntime registryのkind/version/digestとsubject DBを完全一致検証し、mismatchなら同一transactionでdelivery/queue/attempt/workflow dispatch 0、operationをattempt 0の`verification_failed`またはcoding taskを既存`failed`+`context_verification_failed`へCASし、対応するPlan 010 approval requestを既存terminal `expired`へCASし、payload/instruction redaction、append-only audit `context_provider_mismatch`、terminal outboxをcommitする。statement failureは全件rollbackし、provider復旧後もterminal subject/approvalをpendingへ戻さない。Entra、CSRF、30分、nonce hash、requester分離、atomic decision/auditは正本実装を再利用する。
- **Complete**: operation/coding taskともcontext provider negative tests完了前または未登録versionのdelivery/approval 0。provider登録、initializer/activation commit直後crash、process/DB restart後も全blocked rowが期限内に`pending`、期限後に`expired`へ収束し、silent `blocked_context`は0。URL所持だけ、source scope/hash不一致では閲覧/承認不可。
- **Verify Positive**: 各source kindのauthorized different approverが1回だけ202/redirectし、対応outboxだけpending。
- **Verify Adversarial**: operation/coding task各subjectでphase途中deploy/restart、provider登録直後crash、initializer/activate各statement failure、activation commit直後crash、20 concurrent scheduler、期限境界、旧binary restart、provider digest改変、NULL/unknown kind/version、wrong subject_kind/FK両NULL/両非NULL、anonymous、wrong tenant/persona/project/client、self approval、master drift、Teams/mail container不一致、interactive hash変更、coding context欠落、Graph 403/timeout、replay、CSRF、20 concurrent POSTでduplicate activation/delivery/queue/attempt/GitHub write/workflow dispatch 0を確認する。digest mismatchではsubject terminal、Plan 010 approval `expired`、audit/outbox/redactionが一括commitまたは一括rollbackし、provider復旧後もpendingへ戻らない。通常blockedは期限内`pending`または期限後`expired`へ収束する。
- **STOP**: routeがcoding task専用HMACを再利用する、またはcontext未登録requestを承認できる。

#### P012-F02-T04 confirmation card/deep link rendererを固定する

- **Preconditions**: F02-T03 ACCEPTED。
- **Allowed files**: `packages/server/src/agents/teamsConversationAgent.ts`、`packages/server/src/lib/dashboardDeepLink.ts`、`packages/server/src/lib/sealedApprovalDeliveryEnvelope.ts`、`packages/server/src/db/operationNotificationsRepo.ts`、`packages/server/tests/teamsConversationAgent.test.ts`、`packages/server/tests/sealedApprovalDeliveryEnvelope.test.ts`だけ。
- **Work**: requester status cardはkind、target、expiry、operation IDだけをrenderし承認操作を置かない。intended-approver rendererはclaim中だけsealed envelopeをmemoryへ復号し、HTTPS origin+relative approval path+raw nonceを組み立て、before→after、sanitized reason、expiryをexact `approvalDelivery`用card/textへ入れ、buffer参照を破棄する。source timestamp/hash prefixは表示できるが本文/credentialは埋めない。rendererはDB update/Graph sendを行わない。
- **Complete**: requester/intended approverのschemaが決定的で、raw nonce/URLはmemory外、log、error、trace、fixtureへ0。
- **Verify Positive**: Teams proactive/mail rendererのURL、expiry、localized text、AAD binding一致。
- **Verify Adversarial**: requester cardのapprove action、wrong delivery/AAD、endpoint drift、javascript/http origin、source excerpt、HTML injection、key rotation/expiry/token leakをreject/sanitize。
- **STOP**: raw nonceをoutbox/logへ平文保存しないとrenderできない。

#### P012-F02-T05 notification outboxのtransaction不変条件を固定する

- **Preconditions**: F02-T04 ACCEPTED。
- **Allowed files**: `packages/server/package.json`、`pnpm-lock.yaml`、`packages/server/src/db/operationProposalsRepo.ts`、`packages/server/src/db/operationNotificationsRepo.ts`、`packages/server/src/db/approvalRequestsRepo.ts`、`packages/server/src/db/teamsConversationReferencesRepo.ts`、`packages/server/src/clients/teamsProactiveClient.ts`、`packages/server/src/http/routes/teamsBotActivities.ts`、新規`packages/server/src/scheduler/tasks/operationNotificationDispatchTask.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts`、`packages/shared/src/clients/graphClient.ts`、`packages/server/tests/operationProposalsRepo.test.ts`、`packages/server/tests/operationNotificationsRepo.test.ts`、`packages/server/tests/approvalRequestsRepo.test.ts`、`packages/server/tests/teamsConversationReferencesRepo.test.ts`、`packages/server/tests/teamsProactiveClient.test.ts`、`packages/server/tests/teamsBotActivities.test.ts`、新規`packages/server/tests/operationNotificationDispatchTask.test.ts`だけ。schema/migrationはP012-F02-T02の完成形をread-onlyで使用し、本taskでは変更しない。
- **Work**: outboxにopaque delivery key、`requester_status|approval_request|operation_result|approval_terminal|clarification` kind、`blocked_context|pending|claimed|sending|sent|failed|indeterminate|expired` status、lease、attempt count、typed `http_status smallint`、nullable fixed enum `error_code`=`destination_unavailable|transport_rejected|transport_timeout|transport_protocol_invalid|context_provider_mismatch`、`provider_request_id_hash`、`provider_message_id_hash`だけを保存し、raw provider response/result/error/body/URL/email/addressはcolumnにもlogにも保存しない。Teams SDKの検証済みinstall/activityからpersonal/channel metadata-only conversation referenceをupsert/revokeし、approval mailはGraph `sendMail`+Exchange Application RBAC、Outlook source result/clarificationはGraph `/users/{mailboxObjectId}/messages/{immutableMessageId}/reply`、Teamsの承認者・source thread/status/result/clarificationは全て`@microsoft/teams.apps@2.0.13` proactive `app.send/app.reply`へ分離する。mail replyはreply-allせずsource messageのexact threadだけを使う。SDK/Graph内部retryを0に設定できない、またはnetwork boundaryでoutbound POST 0/1を証明できないversionはSTOPする。periodic workerをscheduler/indexへ結線する。`pending→claimed`はlease expiry後reclaim可、renderer/decryptとdelivery destination再検証成功後に`claimed→sending`とattempt=1をcommitし、その後だけ選択transportをexact 1回呼ぶ。`sending`でcrash/timeout/response不明はsweepが`indeterminate`とし自動再送しない。send前`claimed` crashはlease後reclaimする。`approval_request`がvalidation失敗、revoked/missing conversation reference、Teams/mail definitive non-2xxとなった場合は同じDB transactionでoutboxを`failed`、proposalを`pending→verification_failed`、Plan 010 approval requestを既存terminal `expired`へCASし、payload redaction、append-only audit error code=`approval_delivery_failed`、requester用`approval_terminal` outboxを作成する。queue/attempt/GitHub writeは0とする。response不明の`indeterminate`ではlink到達可能性があるためproposal/approval requestを30分まで`pending`のまま維持し、requester statusへ`notification_indeterminate`を表示するが自動再送しない。`sent|failed|indeterminate|expired`でsealed envelope ciphertextを消去する。`completeAndEnqueueNotification()`はterminal operation、text redaction、append-only audit、result outboxを同transactionでcommitする。
  definitive `approval_request` failureのtransactionは`subject_kind=operation`ならproposal `verification_failed`+payload redaction、`coding_task`なら`queued→failed`+`dispatch_error_code=approval_delivery_failed`+instruction redactionへ分岐し、双方でPlan 010 approval `expired`、outbox failed、audit、requester terminal outboxを同時commitする。coding queue/workflow dispatchとgeneric queue/attemptはいずれも0とする。
- **Complete**: initial requester/approver/result/terminal通知のpending eventはrestart後もworkerが処理し、各rowのoutbound request 0/1、未観測event 0。approval deliveryのdefinitive failureはoperationがattempt 0の`verification_failed`、codingがdispatch 0の`failed`、response不明は承認期限までvisible `notification_indeterminate`+pending/queuedとなる。network delivery exactly-onceは主張せず、全rowがdurable terminalまたはvisible indeterminateとなる。
- **Verify Positive**: terminal/redaction/audit/outboxのcommitまたは一括rollback、insert/claim/finalizeがreal PostgreSQLでgreen。
- **Verify Adversarial**: 各statement failure、commit直後restart、20 concurrent claim、claimed crash/reclaim、sending commit直後crash、Teams/mail 400/401/403/404/429/5xx、missing/revoked/wrong-tenant conversation reference、bot uninstall、partial response、timeout、ciphertext cleanup/key rotationでpartial commit 0、external call 0/1、sending自動再claim 0、definitive approval delivery failure後の承認/queue/attempt/GitHub write 0、response不明時のproposal早期terminal 0、silent pending/lost row 0。Graph chat POST/`Teamwork.Migrate.All`/delegated refresh token/raw provider fieldがcode/schemaに1件でもあればred。
- **STOP**: notification stateをoperation terminal statusへ混在させる設計になる。

#### P012-F02-T06 結果を元threadへ通知する

- **Preconditions**: F02-T05 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/agents/operationResultNotifier.ts`、`packages/shared/src/clients/graphClient.ts`、`packages/shared/tests/graphClient.test.ts`、新規`packages/server/tests/operationResultNotifier.test.ts`だけ。
- **Work**: succeeded/failed/stale/verification_failed/indeterminate/rejected/expiredごとにT05 worker用result outbox payloadを生成する。Teams sourceはexact active channel conversation reference+metadata-only thread root message IDを、Outlook sourceはallowlisted mailbox object ID+immutable source message IDをdestination keyにし、operation ID、status、GitHub URLまたは非secret error codeを各別outbox rowへ入れる。rejected/expiredはintended approverにもterminal cardを作る。T06はtransportを直接呼ばず、TeamsはT05 SDK proactive `app.reply`、Outlook sourceはT05 Graph source-message `/reply`、approval mailはT05 `sendMail`の各single-attempt workerだけが送る。
- **Complete**: application outbound notification request 0/1。reply失敗はGitHub mutationをrollbackせず、自動再送もしない。
- **Verify Positive**: success URL、provider message ID、audit correlation。
- **Verify Adversarial**: deleted thread、429/5xx、timeout、secret-bearing GitHub error、send後crashで二回目POST 0。
- **STOP**:通知失敗をGitHub mutation失敗へ誤変換する、または自動retryを要求する設計になる。

#### P012-F02-T07 coding taskのPlan 010適合性を回帰検証する

- **Preconditions**: F02-T06、P010-F05-T10,P010-F05-T11,P010-F05-T12,P010-F05-T13,P010-F05-T14 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、`packages/server/package.json`、`pnpm-lock.yaml`、新規`packages/devops/src/db/migrations/202607140200_coding_task_dispatch_retention.sql`、`packages/server/src/lib/codingTaskOperationAdapter.ts`、`packages/server/src/http/routes/codingTasks.ts`、新規`packages/server/src/http/routes/codingTaskInstructionBroker.ts`、`packages/server/src/http/app.ts`、`packages/server/src/db/codingTasksRepo.ts`、新規`packages/server/src/scheduler/tasks/codingTaskRetentionTask.ts`、`packages/server/src/index.ts`、`packages/server/src/config.ts`、`packages/server/tests/config.test.ts`、`packages/shared/src/clients/githubClient.ts`、`packages/shared/tests/githubClient.test.ts`、`.github/workflows/coding-task.yml`、`.github/actions/run-coding-agent/action.yml`、`packages/server/tests/codingTaskOperationAdapter.test.ts`、新規`packages/server/tests/codingTaskApprovalCompatibility.test.ts`、新規`packages/server/tests/codingTaskInstructionBroker.test.ts`、新規`packages/server/tests/codingTaskRetentionTask.test.ts`、新規`packages/server/tests/codingTasksRepo.integration.test.ts`だけ。固定migration名が存在すればSTOPする。
- **Work**: exact `@azure/identity@4.13.1`と`@azure/keyvault-keys@4.10.2`をpinし、migrationへfull ACK/receipt、`publish_authorized|publish_delivering|publishing`、5分authorization expiry、前段exact token-attempt state、bounded transaction/transport timestamps、可変長`bytea` delivery/revocation二ciphertext+IV/tag、provider expiry、suspension attempt/readback/confirmed timestamp、unique token/push/PR attempt、expanded error CHECKを追加する。plaintext token column/format fieldは0、tokenは1..16384 UTF-8 bytesのopaque string、ciphertext envelope上限32768 bytes、digest SHA-256とする。callbackはexact tuple+30秒以内heartbeatで`running→publish_authorized`だけを許す。専用publisher installationごとにjobをserializeし、protected OIDC exchangeはauthorization consume、lock/statement/total deadline、`clock_timestamp()`再検証、mint transport CASをすべて満たした後だけmint1とする。2xxは`response_received_at<provider_expires_at<=response_received_at+PT60M`、異なるIV/AAD purposeの二ciphertext+expiry+digestをatomic保存して`deliverable`へCASする。seal definitive failureでmemory tokenがあればimmediate revoke1、seal commit response lossはreadbackだけで収束する。response unknown/コピーなしorphanはdelivery/write 0、App JWT suspend1、read-only GET確認、確認後65分suspendとする。ACKはdeliveryを永久消費するがrevocation copyを保持する。known tokenのterminal/stale/ACKなし/expiry時は`revoking` CAS後にrevoke1、204またはknown expiry経過だけでciphertextを消去する。deterministic branch/commit/PR markerを各single-attempt+read-only reconciliationで閉じる。start receiptはRFC8785 digest→Key Vault Sign→raw `R||S`とする。
  workflow startup/jobはF01-T03と同じ3-row identity tableでApp ID、installation ID、repository selection、permission set、cache namespace、protected environmentをreadbackする。coding-dispatchだけがActions write、publisherだけがallowlisted Contents/Pull requests writeを持ち、publisher Actions writeまたはdispatch Contents/Pull requests writeはjob開始前にrejectする。
  orphan suspension CASはinstallation row lock下で単調`suspension_generation`を採番し、token attemptへ固定する。同migrationで`publisher_installation_recovery_attempts(recovery_id PRIMARY KEY,installation_id,suspension_generation,orphan_token_attempt_id UNIQUE REFERENCES publisher_token_attempts, state,approval_digest,requested_at,provider_request_id_hash,provider_readback_hash,completed_at, UNIQUE(installation_id,suspension_generation))`、`installation_id WHERE state='unsuspending'` partial unique、terminal compatibility CHECKを完成形として追加し、T07Rは適用済みmigrationを変更しない。
- **Complete**: 正常経路は`queued→dispatching→running→publish_authorized→publish_delivering→publishing→pr_created`、known token attemptは`minting→deliverable→delivery_consumed→revoking→revoked|expired`、unknown tokenは`minting→orphaned_suspending→orphaned_suspended→orphaned_expired`。各CAS winner1、token/push/PR/revoke/suspend request各0/1。ACK後delivery GET 0、失効確定までrevocation copy保持。unknown tokenを時刻推定でexpiredにせず、suspend confirmed+65分またはinstallation手動deleteへ収束し、確認不能時はpublisher write永続0。late/indeterminate childのpublisher call 0。
- **Verify Positive**: sandboxでconfirmation→ACK/start/heartbeat→callback→OIDC exchange→二ciphertext atomic seal→sealed delivery replay→ACK/readback→redelivery拒否→push→draft PR→revoke 204→sealed copies消去を実行し、receipt wire、state、attempt、marker、instruction leak 0を確認する。
- **Verify Adversarial**: lock T+2秒、statement T+5秒、transaction T+10秒、attempt/mint transport各T+1秒、authorization残30秒を境界検証する。2xx expiryはresponse_received_at直後/正確+60分/>60分/malformedを検証する。classic opaque token、sandbox overrideでstateless `ghs_APPID_JWT`約520文字、`.`/`_`/`-`、520超可変長をmint/seal/delivery/Bearer/revokeし、prefix/JWT/segment/fixed-length introspectionを入れるとredにする。空/16384/16385 bytes、AEAD envelope境界も検証する。exchange/mint response loss、server側遅延発行、2xx直後crash、各seal/expiry保存/commit前/commit response loss、DB unavailable、memory revoke 204/timeout、copyなしorphan、suspend 2xx/timeout/response loss、suspended_at欠落、既発行/後着token write、confirmed+64/+65分、unauthorized unsuspend、delivery/ACK loss、ACK後GET、unused 5分expiry、ACKなし60秒、known expiry、publishing stale、revoke/push/PR response loss、marker ambiguous、OIDC replay、late child、20 concurrent各stepでresend 0、terminal一意、external request 0/1を確認する。DER/padding/wrong curve/JWK driftもrejectする。
- **STOP**: bounded transaction/transportまたは専用installation serializationなしのmint、2xx tokenの単一copy、seal persistence gapの無視、publisherが`publishing` readback前にwrite、ACK後redelivery、失効確定前にrevocation copy消去、response unknown再送、orphan tokenの時刻推定expiry、suspend未確認のpublisher再開、自動unsuspend。

#### P012-F02-T07R suspended publisher installationをbreak-glass復旧する

- **Preconditions**: F02-T07 ACCEPTED。通常実行はしない。`orphaned_expired` installationの復旧が必要な場合だけclaimする。
- **Allowed files**: 新規`packages/server/src/tools/publisherInstallationRecovery.ts`、新規`packages/server/tests/publisherInstallationRecovery.test.ts`、新規`runbooks/publisher-installation-recovery.md`だけ。
- **Work**: conversational operation kindを追加しない。open `orphaned_expired` generationが0ならprovider/DB inventory SHA付きsigned not-applicable receiptだけを作る。復旧時はGitHub App owner/managerであることをowner-signed masterとlive membership evidenceで確認した人間security ownerが、protected environmentへinstallation ID、latest unresolved `suspension_generation`、`orphan_token_attempt_id`へbindingしたone-time approval recordを提出する。toolは専用installation、latest generationのattempt `state=orphaned_expired`、`suspension_confirmed_at`非NULL、trusted DB `now>=suspension_confirmed_at+PT65M`、他のopen token/push/PR attempt 0、open recovery 0、publisher App/installation/repository/exact permissions一致をtransaction内でlock・再検証し、composite unique recovery rowとappend-only auditをwrite-ahead commitする。Key Vault内App private keyをmemory署名だけに使ったApp JWTでexact `DELETE /app/installations/{installation_id}/suspended`を最大1回送り、直後のread-only installation GETで`suspended_at=null`とApp/installation/account/repository selection/permissions不変を確認して`unsuspended`へCASする。response不明はDELETEを再送せずGETだけでreconcileする。成功後も旧task/authorization/attemptを再開せず、新しいtaskだけを許可する。
- **Complete**: no-open-orphan時はDB/provider cardinality 0のsigned not-applicable receipt、復旧時はexact actor、approval digest、App JWT key version、installation/repository/permission pre/post readback、DELETE request 0/1、GET reconciliation、append-only audit、terminal `unsuspended|indeterminate|abandoned`が一意で、private key/JWT/token log 0。条件不成立またはreadback不明はsuspendを維持し、App owner/managerがinstallationをdeleteして正式config PRでfresh installationを作るか永久suspendを選ぶ。
- **Verify Positive**: sandboxでApp owner/manager approval→write-ahead→App JWT DELETE 204→GET `suspended_at=null`→new taskだけmintを実行し、installation account ownerのWeb UIを使わず復旧する。
- **Verify Adversarial**: App owner/managerでないactor、installation account ownerだけの操作、approval欠落/期限切れ、T+64:59、state違い、open attempt 1、wrong App/installation/repo/permission、publisher jobからのcall、DELETE timeout/response loss、GET mismatchでunsuspend再送・publisher再開を0にする。同一installationでgeneration N orphan→suspend→recover→new task→generation N+1 orphan→suspend→recoverを成功させ、N approval/recoveryのN+1 replayを拒否し、N/N+1各20 concurrent callerのwinnerをgenerationごとに1件、open recoveryをinstallation当たり1件にする。旧task再開、private key/JWT出力もrejectする。
- **STOP**: 同じsuspend authorityを証明できない、App JWTをKey Vault外へ出す、response unknownでDELETEを再送する、readback前にpublisherを再開する、またはbreak-glassを自然言語operationとして公開する。

#### P012-F02-T08 command/help/docsを同期する

- **Preconditions**: F02-T07R ACCEPTEDまたは未claimのsigned not-applicable receipt。
- **Allowed files**: `docs/reference/teams-commands.md`、`docs/reference/http-api.md`、新規`packages/server/tests/conversationalOperationsDocs.test.ts`だけ。
- **Work**: exact operation set、read/write差、confirmation、禁止operation、examplesを生成元contractと同期する。
- **Complete**: helpが未実装operationを表示しない。
- **Verify Positive**: golden docs test。
- **Verify Adversarial**: Pages/merge/DnD/任意APIの語を許可一覧へ追加するとtest failure。
- **STOP**: docsとmachine contractが二重手入力でdriftする。

#### P012-F02-T09 Phase 2 acceptance

- **Preconditions**: F02-T01F,F02-T02,F02-T03,F02-T04,F02-T05,F02-T06,F02-T07,F02-T07R,F02-T08 ACCEPTED（T07Rは未claimならsigned not-applicable receipt）。
- **Allowed files**: `.orchestration/evidence/P012-F02-T09/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: Teams sandboxでread、atomic proposal/approval/outbox、context activation、durable delivery、approval、write、webhook、result/terminal replyの往復をtrace IDで保存する。
- **Complete**: Issue create/comment/close/reopen、PR comment、coding task、rejected、expiredの各positive/negative、restart後outbox処理、sealed nonce非開示を実証し、Plan 012 surfaceからのProjectV2 writeが0件である。
- **Verify Positive**: GitHub readbackとTeams replyがoperation ID一致。
- **Verify Adversarial**: cross-project、unauthorized、context未登録、approver master drift、nonce DB theft/replay、source edit、outbox claimed/sending crash、ProjectV2 mutation入力でGitHub call 0、notification external call 0/1、silent lost row 0。
- **STOP**: tenant/repositoryがsandboxでない、cleanup不完全。

**Phase 2 completion**: Teams自然言語のreadは即時、writeはproposalのみ、別人承認後にoperation IDごとのGitHub/Graph outbound mutation requestが各最大1回送られ、結果不明時は自動再送されない。

### Phase 3: Outlook/Teams議事録からproposalを生成する

#### P012-F03-T01 Graph webhook boundaryを先に強化する

- **Preconditions**: F00-T06、F01-T09、F02-T04、P010-F03-T08、P010-F04-T03 ACCEPTED。`operationProposalsRepo`、`operationApprovalAdapter`、Plan 010 approval repo/routeの実pathとexport symbolがPlan記載と異なる場合は実装せずPlan改訂へ戻す。
- **Allowed files**: `packages/server/src/http/routes/graphNotifications.ts`、`packages/server/src/lib/graphNotificationValidator.ts`、`packages/server/tests/app.test.ts`、`packages/server/tests/graphNotificationValidator.test.ts`だけ。
- **Work**: existing Hono bodyLimit patternを再利用し、body上限1,048,576 bytes、top-level object、`value` array最大100件、各string最大8,192 code points、nesting最大8、known notification kindをruntime validateする。Microsoft公式payloadがこの上限を超える実測証拠があれば値を推測変更せずSTOPしてADR改訂する。
- **Complete**: oversized 413、malformed 400、invalid clientState 401/403、valid 202。
- **Verify Positive**: Teams/Outlook valid batch。
- **Verify Adversarial**: huge body、`value:{}`、deep nesting、1000 notifications、unknown resourceでqueue 0。
- **STOP**: Graph公式最大payloadを下回るlimitを推測設定する。

#### P012-F03-T02 lifecycle通知を耐久queueへ入れる

- **Preconditions**: F03-T01 ACCEPTED。
- **Allowed files**: `packages/server/src/http/routes/graphNotifications.ts`、`packages/server/src/db/eventsRepo.ts`、`packages/server/src/lib/githubEventRouter.ts`、`packages/server/src/lib/graphLifecycleHandler.ts`、`packages/server/src/scheduler/tasks/eventsPollingTask.ts`、`packages/server/tests/app.test.ts`、`packages/server/tests/eventsRepo.test.ts`、`packages/server/tests/eventsPollingTask.test.ts`、`packages/server/tests/graphLifecycleHandler.test.ts`だけ。
- **Work**: background Promiseを廃止し、dedupe key付きeventへenqueueする。resource-kind matrixをcodeで固定し、Teams `chatMessage`は`reauthorizationRequired|subscriptionRemoved`だけ、Outlook `message`は`reauthorizationRequired|subscriptionRemoved|missed`を受理する。Teamsの`missed`はunsupportedとして400/queue 0、Teams欠落回復はlifecycleと独立した定期delta poll、Outlook `missed`は即時delta pollで行う。workerはrenew/remove/delta、監査、mode更新を完了してからdoneにする。
- **Complete**: HTTP 202直後process停止でもeventが残る。
- **Verify Positive**: Teams reauthorization/removedと定期delta、Outlook 3 lifecycle kindのenqueue→worker→renew/delta→done。
- **Verify Adversarial**: Teams `missed`、resource/kind mismatch、duplicate lifecycle、worker crash、lease reclaim、Graph 429/5xxでlost 0。
- **STOP**: lifecycleだけ耐久境界を迂回する経路が残る。

#### Gate group P012-F03-T03 raw移行とTeams backfill（非実行summary）

- **Preconditions**: F03-T02 ACCEPTED。
- **Referenced scope**: formal `P012-F03-T03A,B,P,Q,C,D,E,S,R,F,G,H,I,J,K,L,M,N,O`のAllowed filesだけが実行権限を持つ。このsummary自身はファイルを変更しない。
- **Work**: P/Q global pool、C/S/R cluster/ephemeral identities/external Blob journal+independent grant guard/exhaustive catalog+role+ledger oracle、F transform copyを用意する。Gはdrain→forward→old D→new-to-old rehydrate→catalog/role/data/ledger/raw0 equality→quoted ETag CASをjournal化する。G終了時にgrantをrevokeし、H rollback時だけfresh approvalで再grant、Iもcutover role/FIC 0を最初にreadbackする。J/Kは破棄直前hold再検証、L restore-negativeを閉じる。M/N/Oを同じHMAC/canonical/cursorへ結線する。
- **Complete**: 全プラットフォームrepoが同じglobal poolへ接続し、replacement/same-cluster両分岐でraw 4列/role/write path 0。replacementは全object/data digest一致、partial pageでcursor不変。
- **Verify Positive**: same-cluster、replacement dedicated-key、replacement shared-keyのbranchごとにfull schema/copy/cutover/rollback/retirementと2 root×multi-page repliesを実証する。
- **Verify Adversarial**: channel-only copy、function/role属性等catalog kind/ledger omission、password hash copy、D後rehydrate欠落、DB内journal/step skip、期限なしcutover writer、guard停止、stale hold、identity混同、ETag変換、raw rollback、page failureをrejectする。
- **STOP**: API quota内でcomplete backfillできない。scopeを専用minutes channelへ絞る。

#### Gate group P012-F03-T04 Outlook canonicalization/receive（非実行summary）

- **Preconditions**: F03-T03 ACCEPTED、DEC-ENV-001 sandbox available。
- **Allowed files**: `packages/shared/package.json`、`pnpm-lock.yaml`、`packages/shared/src/clients/graphClient.ts`、新規`packages/shared/src/meetingSourceCanonical.ts`、`packages/shared/tests/graphClient.test.ts`、新規`packages/shared/tests/meetingSourceCanonical.test.ts`だけ。
- **Work**: exact `parse5@7.3.0`をdirect dependencyとしてpinする。allowlisted mailbox/folderのmessage subscription、get message、delta fallbackに必要な最小methodを追加し、subscription作成と全message GET/delta pageへ`Prefer: IdType="ImmutableId"`を付ける。active itemからtenant/mailbox/parentFolder/immutable message ID/changeKey/etag/received/lastModified/subject/body content type/body/`sender`/`from`だけ取得し、attachmentは取得しない。pure `htmlToTextV1`+text normalizationと`aiops-outlook-message-v1` RFC 8785 serializerはfull active item+`deleted=false`だけを受け、subject/body hash、sender/from subject HMAC、sender master version/digestをserializerへ渡す。delta `@removed`は同じImmutableIdをPrefer header付きGETし、200ならtyped `active` full item、404/410ならDB非依存typed `confirmed_removed {mailboxObjectId,immutableMessageId}`、その他はtyped `verification_failed`を返す。存在しないsource event ID/timeを作らず、prior evidence lookup/appendは行わない。bodyは最大262,144 code pointsで、それを超えるmailは`source_oversize`としてproposal 0・clarification通知にする。
- **Complete**: Exchange Application RBAC範囲外mailboxはclient側でも拒否。
- **Verify Positive**: official v1.0 path、全page ImmutableId header、pagination parse、text/html golden bytes、RFC 8785 canonical hash、folder move→stale。
- **Verify Adversarial**: missing ImmutableId header、foreign mailbox/folder、continuation origin/path injection、oversize body、malformed HTML/entity/Unicode/CRLF、parser upgrade byte drift、`@removed` missing fieldsをserializerへ直投入、tombstone GET 200/404/410/429/5xx/timeout、unknown tombstone、invalid delta link。
- **STOP**: tenant-wide Mail.Readが必要、またはApplication RBAC negative proofがない。

#### P012-F03-T05 Outlook subscription/pollingをschedulerへ接続する

- **Preconditions**: F03-T04B ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140120_graph_subscription_resource_kind.sql`、`packages/server/src/db/graphSubscriptionsRepo.ts`、`packages/server/src/scheduler/tasks/subscriptionRenewalTask.ts`、`packages/server/src/scheduler/tasks/channelPollingTask.ts`、`packages/server/src/config.ts`、`packages/server/src/index.ts`、`packages/server/tests/graphSubscriptionsRepo.test.ts`、`packages/server/tests/subscriptionRenewalTask.test.ts`、`packages/server/tests/channelPollingTask.test.ts`、`packages/server/tests/config.test.ts`だけ。固定migration名が既に存在すればSTOPする。
- **Work**: resource kindを必須化し、Teamsはrenew deadline・`reauthorizationRequired|subscriptionRemoved`・定期delta、Outlookはrenew deadline・3 lifecycle kind・notification/deltaを明示的に分岐する。dedupeはTeamsがteam+channel+message ID+etag、Outlook active itemがmailbox+parent folder+immutable message ID+changeKey+etag。typed confirmed removalはT06がpriorEvidenceIdを解決した後の`mailbox+immutable message ID+priorEvidenceId+deleted=true`だけでdedupeする。Outlook `@removed`はT04のGET 200/404/410/other分岐を必ず通す。dead/removed subscriptionはinactiveとoperator alertにし、manual replayはread-only deltaだけ許可する。
- **Complete**: Teamsはperiodic delta、Outlookはnotification欠落時のmissed/delta fallbackでvalid sourceを一度取得。resource/kind誤用は0。
- **Verify Positive**: create/renew/notification/delta/cursor。
- **Verify Adversarial**: Teams `missed`拒否、Outlook `missed`、removed/dead、duplicate etag、edit/delete、renewal deadline逸失、process restart、scope changeでcursor/rows/alert expected。
- **STOP**: Graph subscription rowがTeams固有前提のまま無理にoverloadされる。最小resource_kind migrationを先に行う。

#### P012-F03-T06 metadata-only immutable source evidenceを保存する

- **Preconditions**: F03-T05 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140130_operation_source_evidence.sql`、新規`packages/server/src/db/operationSourceEvidenceRepo.ts`、`packages/server/src/scheduler/tasks/channelPollingTask.ts`、新規`packages/server/tests/operationSourceEvidenceRepo.test.ts`、`packages/server/tests/channelPollingTask.test.ts`だけ。固定migration名が既に存在すればSTOPする。
- **Work**: active evidenceはtenant/team/channel/mailbox/parent folder/immutable message ID、author/sender/from subject HMAC+key version、sender master version/digest、changeKey、etag、UTC created/lastModified、`deleted=false`、subject/text SHA-256、Teams thread-v1またはOutlook-message-v1 SHA-256、opaque source ID、proposal IDだけをappend-only保存する。pollerがT04 typed `confirmed_removed`を受けた時だけ同じmailbox+ImmutableIdの最新prior evidenceをlookupし、存在すれば`deleted=true`、prior evidence ID/prior message hash、application `observedAt`だけをappendしてpending proposalをstaleにする。uniqueは`mailbox+ImmutableId+priorEvidenceId+deleted=true`で、新canonical message hash、source event ID/time、欠落fieldを作らない。同prior retryは1、新active evidence後の再削除はnew priorで1。prior不在はaudit-only、metadata/proposal 0。typed `verification_failed`はwrite 0+alertとする。raw author/sender/from ID/body、subject/title、email、display name、content type、excerpt、legal-hold table/APIは作らない。
- **Complete**: proposalが参照したrevision/hashをmetadataから照合し、current edit/deleteをGraph再取得で検出できる。
- **Verify Positive**: same revision dedupe、new revision/thread reply、tombstone GET 200 move/edit再canonicalization、404/410 prior-hash tombstoneのstale propagation。
- **Verify Adversarial**: confirmed_removedのprior不在、same-prior retry/new-prior再削除、GET 429 verification_failed、delete-before-create、hash collision fixture、欠落fieldからcanonical hash生成、raw secret/body/display/excerptがDB/schema/log/fixtureに0件。
- **STOP**: raw全文をaudit logへ保存する設計になる。

#### P012-F03-T07 M365 source-system holdとraw非保存境界を固定する

- **Preconditions**: F03-T06 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、新規`packages/devops/src/db/migrations/202607140135_raw_content_incidents.sql`、新規`packages/server/src/db/rawContentSafetyRepo.ts`、`packages/server/src/scheduler/tasks/channelPollingTask.ts`、`packages/server/src/lib/operationApprovalAdapter.ts`、`packages/server/src/agents/githubOperationExecutor.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/rawContentSafetyRepo.test.ts`、`packages/server/tests/channelPollingTask.test.ts`、`packages/server/tests/operationApprovalAdapter.test.ts`、`packages/server/tests/githubOperationExecutor.test.ts`、`runbooks/meeting-minutes-intake.md`だけ。
- **Work**: migrationはsingleton `minutes_ingestion_gate(id=1,enabled,epoch,incident_id)`と`raw_content_incidents`（UUID、`detected|remediated|closed`、schema/hash/count、timestamps、root-cause evidence hash、`recovery_approval_request_id`）を作り、open incidentをpartial uniqueにする。pollerはGraph/LLM read前に`readAndAssertIngestionEnabled()`でenabled+epochを取得し、disabledなら外部read/LLM/metadata/proposal 0とする。metadata/proposal write直前の短いtransactionでgateを`FOR SHARE` lockしてenabled+same epochを再検証する。meeting-source proposalのapproval GET/POST前とexecution preflight前も同じ初段gateをGraph/LLM/GitHub readより先に通し、disabledならattempt/GitHub/Graph/LLM 0でproposalを`verification_failed`、approval requestを`expired`、derived payload redaction、audit/outboxへatomic terminalizeする。executorは専用pool connectionで`pg_advisory_lock_shared(12012)`を取得してから最終row gate/epoch確認、attempt commit、single-attempt GitHub request、terminal/indeterminate commitを行い、finallyで`pg_advisory_unlock_shared(12012)`してconnectionを返す。`inspectSchemaAndOpenIncident()`は別sessionで`pg_advisory_lock(12012)`を先に取得し、その保持中にgate rowをexclusive lockしてincident open、disable、epoch increment、auditをcommitし、finally unlockする。connection/process crash時はsession lockが解放され、attempt rowが再送を禁止する。startup/channel/mail poll、approval、executionは初段gateと最終write barrierを必ず通る。application内hold table/APIは作らずM365/Purviewをsource hold正本とする。
- **Complete**: prohibited raw/display column/path検出時にopen incidentがdurableに1件だけ作られ、gate epochが上がり、restart後も全minutes ingestionが停止する。source-system policy owner/evidence pathとlive/replica/WAL/PITR/snapshot/base backup/export/provider backup判断がrunbookに一意。
- **Verify Positive**: clean schema/startupとM365 hold evidence reference、incident open→epoch increment→restart後disabledがreal PostgreSQLでgreen。
- **Verify Adversarial**: workerをGraph read後/write前でpauseし、detectorがexclusive lockでdisable+epoch increment後にresumeしてmetadata/proposal 0。(A) pending minutes proposalをapproval GET/POSTまたはexecution初段gate前にdisableするとGraph/LLM/attempt/GitHub write 0、(B) execution preflight read後からattempt insert前にdisableすると既発生read exact 1、attempt/mutation 0、(C) attempt commit後・HTTP直前にpauseしてdetectorを開始するとexclusive advisory lock/disable commitがblockし、single-attempt+terminal/indeterminate後だけdisable commit、disable commit時点以降mutation 0。(D) Cでexecutor process/connection crashするとshared lock自動解放、detector commit、attempt残存、自動再送0。双方のsession/row lock順序を固定しdeadlock 0、terminal/redaction/audit/outbox atomicを確認する。prohibited column再導入、20 detector、1000 poller、process restart、unknown backup inventory、app-local hold table/APIでもopen incident 1、ingestion/proposal 0。
- **STOP**: production raw/backups 1件以上または不明、source-system policy owner/evidence不在。

#### P012-F03-T08 meeting source trigger/identity resolverを実装する

- **Preconditions**: F03-T07 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/lib/meetingSourceResolver.ts`、新規`packages/server/src/lib/meetingSenderMaster.ts`、新規`packages/server/src/agents/meetingSenderMasterProvider.ts`、`packages/server/src/lib/stakeholderProfileResolver.ts`、`packages/server/src/db/projectChannelsRepo.ts`、`packages/server/src/config.ts`、新規`packages/server/tests/meetingSourceResolver.test.ts`、新規`packages/server/tests/meetingSenderMaster.test.ts`、新規`packages/server/tests/meetingSenderMasterProvider.test.ts`、`packages/server/tests/config.test.ts`だけ。
- **Work**: Exact product contractのprefix、channel/mailbox/folder allowlist、PJ resolutionをcodeで判定する。providerはT04と同じimmutable `prjops-data` SHAから`meeting-senders.v1.json`、detached signature、keyring/revocationをatomic fetch→RFC 8785/Ed25519検証し、同一version/digestを3時点へ固定する。Graph `sender/from.emailAddress.address`はinternal ASCII SMTP addr-specだけを受け、ASCII全体lowercaseのUS-ASCII bytesをprotected versioned keyでHMACし、raw addressを破棄してmasterのaddress HMACだけをlookupする。non-ASCII、quoted/comment/display-name/external/invalid addr-specは変換せずrejectする。通常送信はsender/fromが同じactive same-tenant subject、代理送信はactive delegate OID→active shared mailbox object ID、from、target mailbox、validity/revocationが全一致する場合だけacceptする。atomic refreshに失敗した場合は期限内の同じverified artifactだけを継続し、期限切れ/ambiguous/revoked/driftはfail-closeする。runtime directory API/permission、email/display name一致、LLMによるtrigger/project/sender決定は禁止する。
- **Complete**: accepted/rejected/clarify machine codeにsender master version/digestを含め、raw address永続化とruntime directory call 0。
- **Verify Positive**: Teams/Outlook ja/en valid fixtures。
- **Verify Adversarial**: ambient chat、forward、lookalike PJ、multiple PJ、external/unresolved/ambiguous sender、sender/from不一致、未登録/期限切れ/revoked delegate、delegate/shared mailbox mismatch、master signature/version/digest/key rotation drift、refresh partial failure、runtime directory call、inactive project、cross-tenant。
- **STOP**: sender/mappingがmutable email表示名だけに依存する。

#### P012-F03-T09 minutes extraction schemaを実装する

- **Preconditions**: F03-T08 ACCEPTED。
- **Allowed files**: 新規`packages/prjops/src/lib/minutesProposal.ts`、新規`packages/prjops/src/agents/meetingMinutesExtractor.ts`、`packages/shared/src/clients/anthropicClient.ts`、`packages/server/src/config.ts`、新規`packages/prjops/tests/minutesProposal.test.ts`、新規`packages/prjops/tests/meetingMinutesExtractor.test.ts`、`packages/server/tests/config.test.ts`だけ。
- **Work**: decision、action、owner、due、target type/number/title、proposed kind、reason、memory-only source quote offsetsをstructured outputで抽出する。codeがcompletenessとoperation allowlistを判定し、offsetとquoteはproposal/evidence/logへ渡さず処理終了時に破棄する。modelは`claude-sonnet-4-6`、commercial API、owner承認済みZDR organization/keyに固定し、Files/Batch/prompt caching/conversation persistence、consumer auth、fallback model/endpointを禁止する。client/gateway/APMはrequest/response body・raw error・replay traceを保存せず、provider request IDはHMAC/SHA-256だけ監査する。startupでDEC-ENVのorganization/key/model/endpoint/region/ZDR receipt SHAをreadbackし、不足・標準30日retention・provider control不明ならextractorをdisabledにする。
  当該modelがZDR eligibleでもCovered Modelの追加retention/review対象なら起動を拒否する。User Safety classifier resultと法令・misuse/harm例外はDEC-ENVで承認されたmachine-readable receiptと一致しなければならない。
- **Complete**: LLM outputはmemory内proposal candidateだけ。project/repo/IDs/current stateはserverが補完し、永続化するcandidateにはraw quote/offsetが存在しない。
- **Verify Positive**: ja/en fixtureからexpected candidate集合。
- **Verify Adversarial**: prompt injection、hallucinated target、multiple conflicting decisions、secret、missing owner/due/targetはclarify/reject、GitHub call 0。ZDR未契約/対象外key、consumer login、wrong model/endpoint/region、cache/file/batch、body log/trace、provider 4xx raw bodyでprovider requestまたはdurable raw 0。
- **STOP**: AGT-02進捗6項目schemaへ無理に混在させる。別contractを維持する。

#### P012-F03-T10 candidateを一操作一proposalへ展開する

- **Preconditions**: F03-T09 ACCEPTED、F01-T09 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/agents/meetingMinutesAgent.ts`、`packages/server/src/db/operationProposalsRepo.ts`、`packages/server/src/db/rawContentSafetyRepo.ts`、新規`packages/server/tests/meetingMinutesAgent.test.ts`だけ。
- **Work**: Graph/LLM read前に`rawContentSafetyRepo.readAndAssertIngestionEnabled()`でenabled+epochを取得し、disabledならGraph/LLM/metadata/proposal callを0にする。Teams root+reply全pageまたはOutlook messageを再取得し、Meeting source contractのversion 1 serializerでsource hashを再計算する。一致時だけtargetをGitHub readで存在/現在状態確認する。proposal書込直前の短いtransactionで`lockAndAssertIngestionEnabled(expectedEpoch)`がgateを`FOR SHARE` lockし、enabled+epoch一致した場合だけcandidateごとにsource hashとexpected state付きpending proposalを作る。重複candidateはidempotency keyで一つにし、disable/epoch changeとの競合では全candidate write 0とする。
- **Complete**: 一部曖昧でも他candidateを勝手にまとめず、各proposalを独立承認できる。
- **Verify Positive**: 3 candidate→3 proposal、GitHub write 0。
- **Verify Adversarial**: missing/foreign target、duplicate、already applied、source edit中、GitHub 5xxでpartial proposal集合を誤ってcomplete扱いしない。(a) 開始時disabledではGraph/LLM/metadata/proposal 0、(b) initial pass後かつproposal transaction前にdetectorをcommitすると最終write 0、incident 1。1000 concurrent workerでも同じ二境界を再現する。
- **STOP**: 複数mutationを一つのapprovalで束ねる要求が出た場合、atomicity decisionを別Plan化する。

#### P012-F03-T11 clarification/rejection/approval通知を送る

- **Preconditions**: F03-T10 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/agents/meetingMinutesNotifier.ts`、`packages/shared/src/clients/graphClient.ts`、`packages/shared/tests/graphClient.test.ts`、新規`packages/server/tests/meetingMinutesNotifier.test.ts`だけ。
- **Work**: source channel/mail threadへcandidate count、各proposal link、clarification、rejected reasonのoutboxを作る。Teamsはexact active channel conversation reference+thread root message IDを使うT05 `app.reply`、Outlook source mailはallowlisted mailbox object ID+immutable source message IDを使うT05 Graph `/users/{mailboxObjectId}/messages/{immutableMessageId}/reply`だけが配送し、agentは直接transportを呼ばない。approval delivery mailだけは署名済みmasterのsender/recipient mailbox object IDを使う`sendMail`とする。
- **Complete**: no-op議事録は「提案0」と返信し、副作用0。
- **Verify Positive**: Teams/Outlook localized notification。
- **Verify Adversarial**: recipient injection、reply-all、external address、missing/revoked/wrong channel conversation reference、Graph chat POST、secret error、duplicate delivery。
- **STOP**: Outlook source replyがsource immutable message IDを使わず新規`sendMail`/reply-allとなる、またはapproval mailが署名済みmasterのmailbox allowlistを迂回する。

#### P012-F03-T12 raw非保存の定期guardと復旧手順を実装する

- **Preconditions**: F03-T01,F03-T02,F03-T03O,F03-T04B,F03-T05,F03-T06,F03-T07,F03-T08,F03-T09,F03-T10,F03-T11 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/scheduler/tasks/rawContentGuardTask.ts`、`packages/server/src/db/rawContentSafetyRepo.ts`、新規`packages/server/src/lib/rawContentRecoveryAdapter.ts`、新規`packages/server/src/http/routes/rawContentRecovery.ts`、新規`packages/server/src/agents/rawContentIncidentNotifier.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts`、`runbooks/channel-messages-purge.md`、`runbooks/meeting-minutes-intake.md`、新規`packages/server/tests/rawContentGuardTask.test.ts`、新規`packages/server/tests/rawContentRecovery.test.ts`、新規`packages/server/tests/rawContentIncidentNotifier.test.ts`だけ。
- **Work**: startupと毎時`inspectSchemaAndOpenIncident()`を実行し、禁止column/path検出時はgate rowをexclusive lockしてdurable incident open、ingestion disable、epoch increment、append-only SEV-1 auditを同一transactionで行い、configured Data Owner/operations recipientへmetadata-only通知する。cleanupはraw存在/不明ならP012-F03-T03のfull platform replacement primitiveを再利用し、全object/data copy、旧新metadata-only equality、quoted ETag CAS、rollback close、migration/runtime-old access revoke、旧隔離、dedicated key destroyまたはshared-key mutation 0、全copy delete/expiry、restore-negativeを必須とする。同一cluster migrationは全copy raw 0の事前証明時だけ許可する。operatorのauthenticated CSRF POSTは全evidence hashが揃った時だけ`markRemediated`とPlan 010 `raw_content_ingestion_reenable` approval requestを作る。署名済みRecords/Data Ownerの別人accepted decision、全copyの復元不能、clean guardをrecoverable dispatcherが確認した後だけ`closeAfterAcceptedApproval`し、同transactionでgate enabledとepoch incrementをcommitする。legal hold/unknown copy/期限付き例外では再開しない。
- **Complete**: prohibited column/path 0、open incident中/restart後ingestion 0、replacement cutover+全copy復元不能readback+root cause+別人owner approval+clean guardの全条件後だけ再開し、metadata/hash/auditは維持。
- **Verify Positive**: real PostgreSQLでhourly guard→exclusive gate lock/epoch increment→incident open→restart disabled→replacement cutover/crypto-shred/delete readback→remediated→owner approval→clean guard→close/re-enable/epoch incrementを時計注入で再現。
- **Verify Adversarial**: old heap/WAL/PITR/replica/backup restore可能、legal hold、unknown provider copy、期限付き例外、scheduler restart、notification failure、statement failure、operator自己承認、approval/clean guard前close、paused poller、1000 concurrent detectorでexternal ingestion/proposal 0、open incident 1。
- **STOP**: backup/restore影響またはRecords/Data Ownerのlegacy data決定が未解決。

#### P012-F03-T13 Phase 3 acceptance

- **Preconditions**: F03-T01,F03-T02,F03-T03O,F03-T04B,F03-T05,F03-T06,F03-T07,F03-T08,F03-T09,F03-T10,F03-T11,F03-T12 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F03-T13/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: Teams/Outlook sandbox E2E、source edit/reply/delete→stale、approved mutation、raw非保存guard、M365 hold evidence、cleanupを同一SHAで実行する。
- **Complete**: positive/negative intake、proposal数、approval、GitHub result、notification state、raw/display column・write path 0、source-system evidence/cleanupが一致。
- **Verify Positive**: sandbox trace、DB、GitHub、Teams/mail correlationと`mise run ci`。
- **Verify Adversarial**: unknown sender、foreign mailbox、thread reply missing、source edit、unapproved proposal、prohibited raw column再導入でGitHub write/ingestion継続0、durable incident 1。
- **STOP**: cleanup不完全、raw Outlook/Teams body persistence、external trace欠落、M365 policy、ZDR、legacy live/replica/WAL/PITR/backup復元不能evidenceのいずれか欠落。

**Phase 3 completion**: allowlisted text議事録だけをmemory内で一度処理し、metadata/thread hashを固定し、raw本文を永続化せず一操作一proposalを作り、人間承認なしではGitHubを一切変更しない。

### Phase 4: Claude Code・Droid・Codexを共通proposal境界へ接続する

#### P012-F04-T01 interactive agent用の認証済みproposal intakeを追加する

- **Preconditions**: F00-T06、F01-T09、F02-T04、P010-F03-T08 ACCEPTED。
- **Allowed files**: 新規`packages/server/src/http/routes/operationProposalIntake.ts`、`packages/server/src/http/app.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/operationProposalIntake.test.ts`だけ。
- **Work**: query/path parameterを一切受けないauthenticated GETが空のescaped textarea formだけを返す。人間がagent出力のversion 1 JSONをtextareaへ貼り付ける。POSTは`application/x-www-form-urlencoded` raw body最大1,048,576 bytes、decoded JSON UTF-8最大270,336 bytesを先に制限し、その後Operation schemaのUnicode code point上限、same-origin/CSRF、active requester profile/project、source=`interactive_agent`を検証してpending proposalとPlan 010 approval requestを作る。agent processはsession/CSRF/approval tokenを受け取らない。responseへ`Cache-Control: no-store`、`Pragma: no-cache`、`Referrer-Policy: no-referrer`を付け、route access logはmethod/status/operation IDだけでquery/body/title/reasonを記録しない。
- **Complete**: interactive agentはGitHub mutationを直接呼ばず、authenticated human POST後もpendingで停止する。
- **Verify Positive**: authenticated PRF-02 requesterが空GET→65,480 code-point Issue bodyをPOST→pending proposal 1、GitHub write 0。executor fixtureで56 code-point marker追加後の最終outboundがexact 65,536。access log/browser history/Referer/proxy test captureにtitle/body/reason 0。
- **Verify Adversarial**: GET query/path payload、anonymous、PRF-01 write、1,048,577-byte raw body、270,337-byte decoded JSON、65,481-code-point body、tampered draft、unknown kind、foreign project、CSRF、script injectionでproposal/GitHub call 0、413/400 expected。
- **STOP**: browser/Entra sessionをagent processへ渡す、payloadをURLへ入れる、またはrequest bodyをaccess/proxy logへ記録する設計になる。

#### P012-F04-T02 provider-neutral operation runbookを作る

- **Preconditions**: F04-T01 ACCEPTED。
- **Allowed files**: 新規`runbooks/conversational-github-operations.md`だけ。
- **Work**: read-only `gh` allowlist、write draft schema、payloadを含まないproposal intake URL、空formへの人間paste/POST、browser review、別人approval、server readback、audit、forbidden operations、STOPを記載する。secret値や個人credential手順を含めない。
- **Complete**: Claude/Droid/Codex wrapperがこのrunbookを唯一の共通手順として参照し、直接GitHub mutation commandを一つも掲載しない。
- **Verify Positive**: valid Issue commentがpending proposalで停止し、ProjectV2 writeを拒否して認可済みGitHub deep linkを返す手順をzero-context reviewerが再現。
- **Verify Adversarial**: merge/pages/arbitrary API/direct `gh` write/production targetが手順から実行不能。
- **STOP**: provider別wrapperに異なるpermission matrixが必要になる。

#### P012-F04-T03 三つのthin skill wrapperを追加する

- **Preconditions**: F04-T02 ACCEPTED。
- **Allowed files**: `.agents/skills/github-operations/SKILL.md`、`.claude/skills/github-operations/SKILL.md`、`.factory/skills/github-operations/SKILL.md`。
- **Work**: trigger、runbook全文読込、read-only `gh` preflight、exact draftをterminalへ表示、payloadなしproposal intake URL提示、browserでの人間paste/review待ち、server status readback、STOPだけをprovider形式で記載する。GitHub write commandを掲載・実行しない。
- **Complete**: Codexは`.agents/skills`、Claude/Factoryは各native locationから発見可能。
- **Verify Positive**: 各CLIのskill inventory/diagnosticで検出。
- **Verify Adversarial**: wrapper単独ではrunbook未読でwriteしない。`gh pr merge`、`git push origin main`を拒否。
- **STOP**: provider公式が該当skill locationを認識しない。公式locationへ修正し、推測した互換symlinkは作らない。

#### P012-F04-T04 Codex custom agentsとcommand rulesを追加する

- **Preconditions**: F04-T03 ACCEPTED。
- **Allowed files**: 新規`.codex/agents/orchestrator.toml`、新規`.codex/agents/negative-reviewer.toml`、新規`.codex/rules/default.rules`、新規`.codex/config.toml`だけ。
- **Work**: `.codex/agents/orchestrator.toml`と`negative-reviewer.toml`はexact required `name`、`description`、`developer_instructions`を持ち、reviewerに`sandbox_mode="read-only"`、`model="gpt-5.6-sol"`、`model_reasoning_effort="high"`を設定する。agents/rulesはtrusted project layerのauto-discoveryを使い、file参照keyを発明しない。`.codex/config.toml`はsupported `[agents]` concurrency/limitsとrepo内非secretだけに限定し、provider/auth/profileを置かない。rulesはmutation/merge/pushをforbidden、canonical 4 read commandだけallow/promptとする。
- **Complete**: `codex execpolicy check`でexpected decision。project trustがない場合はconfig/rules未読を明示する。tracked `.codex/config.toml`のprovider/auth key数0。
- **Verify Positive**: `codex features`、agent discovery/effective config、canonical read command decision。
- **Verify Adversarial**: merge、force push、main push、compound commandでforbidden。rulesをsecurity boundaryの唯一根拠にしない。
- **STOP**: runtimeのmodel/reasoning slugが確認できない、またはrulesが複合commandを安全に判定できない。

#### Gate group P012-F04-T05 isolated platform（非実行summary）

- **Preconditions**: F04-T04、DEC-ENV-004 ACCEPTED。
- **Allowed files**: `packages/devops/src/db/schema.sql`、`packages/server/package.json`、`pnpm-lock.yaml`、新規`packages/devops/src/db/migrations/202607140300_agent_launches.sql`、新規`docs/contracts/agent-github-read-operations.v1.json`、新規`packages/server/src/db/agentLaunchesRepo.ts`、新規`packages/server/src/http/routes/agentTokenBroker.ts`、新規`packages/server/src/http/routes/agentGithubReadGateway.ts`、新規`packages/server/src/http/routes/agentLlmGateway.ts`、新規`packages/server/src/lib/agentGithubReadOperations.ts`、新規`packages/server/src/lib/agentLaunchAttestation.ts`、新規`packages/server/src/lib/sealedAgentCredential.ts`、新規`packages/server/src/lib/agentGatewayDlp.ts`、`packages/server/src/http/app.ts`、`packages/server/src/config.ts`、`packages/server/src/index.ts`、新規`packages/server/tests/agentLaunchesRepo.integration.test.ts`、新規`packages/server/tests/agentTokenBroker.test.ts`、新規`packages/server/tests/agentGithubReadGateway.test.ts`、新規`packages/server/tests/agentLlmGateway.test.ts`、新規`packages/server/tests/agentLaunchAttestation.test.ts`、新規`packages/server/tests/sealedAgentCredential.test.ts`、新規`packages/server/tests/agentGatewayDlp.test.ts`、`packages/server/tests/infraBicepComposition.test.ts`、`infra/bicep/main.bicep`、新規`infra/bicep/modules/agent-aks.bicep`、新規`infra/k8s/kustomization.yaml`、新規`infra/k8s/agent-control-namespace.yaml`、新規`infra/k8s/agent-executions-namespace.yaml`、新規`infra/k8s/agent-gateway-namespace.yaml`、新規`infra/k8s/agent-broker-service-account.yaml`、新規`infra/k8s/agent-broker-rbac.yaml`、新規`infra/k8s/agent-broker-network-policy.yaml`、新規`infra/k8s/agent-broker-deployment.yaml`、新規`infra/k8s/agent-proxy-service-account.yaml`、新規`infra/k8s/agent-proxy-deployment.yaml`、新規`infra/k8s/agent-proxy-service.yaml`、新規`infra/k8s/agent-proxy-certificate.yaml`、新規`infra/k8s/agent-private-ca-bundle.yaml`、新規`infra/k8s/agent-cilium-network-policies.yaml`、新規`infra/k8s/agent-job-template.yaml`だけ。固定migration名が存在すればSTOPする。
- **Work**: Bicep rootは既存teams-bot moduleを保持してagent-aks moduleを合成し、composition testで上書きを拒否する。private AKS/ACR/Key Vault/private DNS/control-plane IAM、Azure Linux 3.0+ dedicated user node pool、Cilium/ACNS、Kata、Pod Security/Azure Policyをprovisionする。manifestは`agent-control|agent-executions|agent-gateway`三namespace、restricted security、launch proxy、private CA、default-deny policyを宣言し、agentはservice-account/UAMI/Workload Identity/IMDS/API/direct egress 0、proxyとのfilesystem/PID/volume共有0とする。brokerはdedicated SA/UAMI/FIC、private API/CA、TokenReview createだけのcluster scope、exact namespace RBAC/egressを持ち、Secret list/watch、RBAC mutation、exec/attach、cross-namespaceは0。`agent_launches`はimmutable image/repo、proxy/Job/Pod UID、128-bit `lease_generation`、`job_spec_attested`、`pod_attested`、5分nonceをwrite-ahead保存する。mint/lease responseは各最大1、transitionはCAS、sealed credentialはlaunch/repo/permission/expiry AADへbindingする。proxy ACK→active readback後、deterministic `suspend:true` Jobを一度だけcreateし、timeout/409は同名GETでreconcileする。Jobは`parallelism:1`、`completions:1`、`backoffLimit:0`、`restartPolicy:Never`、`activeDeadlineSeconds<=lease`、有限TTL。Job spec readback→`job_spec_attested=true`後だけunsuspendし、noncredential init gateはactual Pod UID/image/runtime/security/service-account/Cilium readback→`pod_attested=true`後だけprovider entrypointを開始する。admission mutation、Pod timeout/crash/OOM/eviction、broker crashではreplacement Pod/provider processを作らずrevoke/deleteする。gatewayはJWT、proxy projected service-account JWT/UID、Kubernetes readback、DB lease generation/active/両attestation/expiry/revocationを全requestで照合する。GitHub CLIは2.96.0 tarball、official SHA-256 `83d5c2ccad5498f58bf6368acb1ab32588cf43ab3a4b1c301bf36328b1c8bd60`、provenanceを固定し、前段の4 commandに対応するGHES REST `/api/v3`/GraphQL `/api/graphql` persisted contractだけを許可する。101件目はpartial stdout 0+422+追加page 0。LLM gatewayはClaude Anthropic、Codex/Droid Responsesだけをfixed provider/model/budgetへforwardする。OpenAIはapproved org/project/model/Japan endpoint/ZDRをreadbackし、`store:false`/`background:false`を強制、保存型resource/tool/extended prompt cachingをrejectする。gateway local body log/trace/replay/cacheは0、standard in-memory cacheを無効と偽らず、known credential canaryをreject/redactする。
  proxy service accountはprojected tokenのbroker/gateway audienceだけを持ち、UAMI/federated credential、Key Vault network route、RBAC role assignment、data-plane permissionはexact 0。GitHub App private key、provider key、CA signing keyへはbroker/gatewayの別identityだけが用途別least privilegeでアクセスする。stagingはproxyからKey Vault 403/route deny、proxy identityの`az role assignment` 0、cross-identity secret read 0をreadbackする。
  Job template/state machineの正本は前段契約どおり`job_spec_attested`と`pod_attested`を分離する。決定的`suspend:true` Jobをtimeout/409時も同名GETでreconcileし、別名create 0。`parallelism:1`、`completions:1`、`backoffLimit:0`、`restartPolicy:Never`、`activeDeadlineSeconds<=lease`、有限TTLを固定する。Job spec readback後だけunsuspendし、noncredential init gateはactual Pod UID/image/runtime/security/service-account/Cilium readbackと`pod_attested=true` CAS後だけreadyを返す。admission mutation、Pod timeout、crash/OOM/evictionでreplacement Pod/provider processを作らず、revoke/deleteで閉じる。gatewayは両attestation flagを必須化する。OpenAI Responsesはapproved org/project/model/exact `https://jp.api.openai.com/v1`/ZDRをreadbackし、storage residency Japan=yes、regional processing=noをowner receiptと照合する。`store:false`/`background:false`を強制し、保存型resource/toolとextended prompt cachingをrejectする。gateway local body log/trace/replay/cacheは0、standard in-memory cacheを無効と偽らない。
  `agent-proxy-certificate.yaml`はcert-manager等の暗黙dependencyではなく、brokerがKey Vault内non-exportable private CAで署名したcert/keyをlaunch固有TLS Secretへ書くためのtemplateである。`agent-private-ca-bundle.yaml`はpublic CAだけを持ち、CA private keyのKubernetes Secret/volume/exportは0とする。
- **Complete**: valid launchごとにmint 1以下、proxy lease response 1以下、nonce consumed 1、GitHub `expires_at` 1時間以下、agent Job/gateway JWT/TLS certificate 10分以下、repository 1、write permission 0。agentが受けるcredential値は固定placeholderとprivate CA bundleだけで、plaintext GitHub token/private key/raw OIDC/provider key/gateway JWTはagent environment/filesystem/`/proc`/log/evidence 0。sealed GitHub token ciphertextだけ`issued|lease_delivering|active`中にserver側存在し、revoke/expired/indeterminateで消去される。read contractは4 command exact set、101件以上はoutput 0+422、wildcard/任意query 0。
- **Verify Positive**: stagingでBicep what-if/deploy、Kubernetes APIによるnode/runtime/namespace/UID/image/securityContext/serviceAccount/Cilium policy/Pod Running readback、proxy lease/ACK→broker active readback→agent Job create、private-CA TLS hostname validation、pinned `gh 2.96.0` checksum/attestation、4 read command、Claude/Codex/Droid各1 prompt、provider/model/budget、GitHub permission/API readback、normal exit revoke 204、redacted auditを同launch IDで相関する。
- **Verify Adversarial**: wrong issuer/audience/tenant/identity/repo/digest/namespace/Job UID/Pod UID/`lease_generation`、expired/replayed nonce、`lease_delivering|indeterminate|revoked|expired` request、Kubernetes API 403/timeout、row versionだけの変化、public ingress、multi-repo/write permission、20 concurrent exchange、mint timeout、mint後/DB commit前crash、issued後crash、partial lease response、ACK前crash、active readback前agent Job create、revoke/ciphertext cleanup failureでmint/return 0/1とexact stateを確認する。agentのservice-account token/Workload Identity/IMDS/Kubernetes API/DB/Key Vault/direct Internet、proxy filesystem/PID/volume共有、raw credential観測は0。wrong/missing private CA/SAN、unknown persisted hash、variable target mismatch、alias混在、extra fragment/field、over depth/page/cost、`node|nodes|search|viewer|projectsV2`、REST write/GraphQL mutation/direct github.com egressはexternal call 0。100件以下はvalid JSON、101件以上はstdout 0、stderr error code、HTTP 422、追加page 0。
- **STOP**: caller自己申告だけでattestationを受理する、broker public anonymous化、またはApp private keyをjobへ渡す必要がある。

#### Gate group P012-F04-T06 provider launcher/settings（非実行summary）

- **Preconditions**: F04-T04,F04-T05 ACCEPTED。
- **Allowed files**: 新規`.claude/settings.json`、新規`.claude/hooks/typecheck-after-edit.mjs`、新規`.factory/settings.json`、新規`.factory/droids/github-operations.md`、新規`infra/agent-sandbox/Containerfile`、新規`infra/agent-sandbox/codex-home.config.toml.tmpl`、新規`infra/agent-sandbox/credential-proxy.mjs`、新規`infra/agent-sandbox/seccomp.json`、新規`scripts/run-isolated-readonly-agent.mjs`、`infra/k8s/agent-job-template.yaml`、`infra/k8s/agent-proxy-deployment.yaml`、新規`packages/server/tests/readOnlyGithubAgentLauncher.test.ts`だけ。
- **Work**: launcherは二段attestation/init-ready順、Pod/process最大1、fixed env/empty HOME/read-only source/no `.git`/host credential 0を実装する。同一public CA bundleをread-only mountし、Claudeはexact `NODE_EXTRA_CA_CERTS=<bundle>`、Codexは`SSL_CERT_FILE=<bundle>`、Droidは公式またはpinned CLI sandboxで実証した`NODE_EXTRA_CA_CERTS=<bundle>`だけを使う。Droidで検証できなければ有効化せずSTOPする。`NODE_TLS_REJECT_UNAUTHORIZED=0`、`--insecure`、CA system-store改変は禁止。Droid `.factory/settings.json`はexact `{model:"custom:AIOps-Gateway-GPT-5.6-Sol-0",cloudSessionSync:false,ideAutoConnect:false,customModels:[{model:"gpt-5.6-sol",displayName:"AIOps Gateway GPT-5.6 Sol",baseUrl:"https://llm-<launch>.agent-gateway.svc.cluster.local/openai/v1",apiKey:"${AIOPS_GATEWAY_PLACEHOLDER}",provider:"openai",maxOutputTokens:32768}],sessionDefaultSettings:{interactionMode:"spec",autonomyLevel:"off"}}`。custom modelへreasoning flagを渡さずgatewayがmodel/highを強制する。Codex job configは前段exact model/reasoning/provider/base/env/wire/retry 0、Claudeはlaunch TLS `ANTHROPIC_BASE_URL`+`apiKeyHelper`とする。hook testはPod tmpfsだけを編集しsource/host hash不変を確認する。
- **Complete**: `claude doctor`/settings validation、Droid effective settings/model selector/cloud-sync readback、Codex effective config readback、3 provider Job dry-run、Kubernetes image/UID/runtime/mount/PID/env/Cilium/proxy/broker state attestation、host credential canary非到達、agent-visible secret 0、source/host write 0がgreen。host直実行はlauncherが拒否する。
- **Verify Positive**: proxy ACK→active readback→agent Job create後、3 providerのprivate-TLS gateway promptとpinned 4種類の`gh` read、Codex request exact 1、Droid upstream `gpt-5.6-sol`+`reasoning.effort=high` exact 1、Factory cloud/IDE endpoint request 0、direct provider request 0、tmpfs safe edit→typecheck hook、provider expiry/job lease/repository/App/permission/image/Job+Pod UID/mount/PID/Cilium snapshotのredacted evidence。
- **Verify Adversarial**: host credentials/`/proc`/proxy paths、unsafe flags、mutation/pushを拒否する。Droid exact JSON field drift、selector/model/base/provider/env/maxOutput/sync/IDE/spec/off drift、reasoning flag、Codex config drift、private CA/SAN missing/wrong、`NODE_TLS_REJECT_UNAUTHORIZED=0`/insecure/system trust fallback、Factory sync requestをredにする。
- **STOP**: DEC-ENV-004、broker readback、host credential canary isolation、hook trustのいずれかを確認できない。`/hooks` review/trustを含む全条件が揃うまでhost fallbackせずblocked。

#### P012-F04-T07 agent asset parity validatorを追加する

- **Preconditions**: F04-T04,F04-T05H,F04-T06E ACCEPTED。
- **Allowed files**: 新規`scripts/validate-agent-operation-assets.mjs`、新規`packages/server/tests/agentOperationAssets.test.ts`、`package.json`、`.github/workflows/ci.yml`だけ。
- **Work**: provider wrapperの存在、共通runbook link、全GitHub mutation禁止、proposal intake契約、exact `gpt-5.6-sol high`、credential launcher、hook target file、tracked statusを検証する。`validate-plan-012-dag.mjs`、agent asset validator、F00-T01でlock済みの`mise run actionlint`を`mise run ci`/GitHub CIへ接続する。composite `.github/actions/*/action.yml`は`agentOperationAssets.test.ts`でmetadata必須key、entrypoint、credential/forbidden command policyを別検証する。
- **Complete**: asset/DAG削除・driftでlocal CIとhosted CIがfailure。
- **Verify Positive**: actual tree、exact 99 executable task/direct prerequisite、workflowがgreen。
- **Verify Adversarial**: wrapper1件削除、merge許可追加、dangling hook、untracked-only asset、DAG range/unknown/cycleでred。
- **STOP**: validatorがprovider設定を実行して副作用を起こす。

#### P012-F04-T08 Phase 4 cold review

- **Preconditions**: F04-T01,F04-T02,F04-T03,F04-T04,F04-T05H,F04-T06E,F04-T07 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F04-T08/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: Claude、Droid、Codexを別contextで起動し、同じ5 promptsに対するplan/拒否/commandを比較する。
- **Complete**: read allowlist、write proposal-only、forbidden、confirmationの差異0。provider固有差はdocumented。
- **Verify Positive**: read、Issue proposal、PR comment proposal、ProjectV2 write拒否+deep link、coding task。
- **Verify Adversarial**: merge、Pages publish、arbitrary API、production write、secret exfiltrationを全providerが拒否。
- **STOP**:一つでもinteractive writeを直接GitHubへ送り、authenticated proposal intakeまたは別人approvalを省略する。

**Phase 4 completion**: 必要なtemplate/skill/subagent/rule/hook/proposal入口がtrackedされ、全interactive writeがserver proposalへ収束し、provider間のpermission driftをCIとcold reviewで検出できる。

### Phase 5: Project picker・read-only Kanbanの既存Planを受理する

#### P012-F05-T01 P010 project picker受入証跡を再検証する

- **Preconditions**: P010-F02-T10 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F05-T01/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: zero/one/multi project、URL propagation、400/403/409、persona切替を現HEADで再実行する。
- **Complete**: unauthorized project data query 0、selection drift 0。
- **Verify Positive**: one auto-select、multi explicit select。
- **Verify Adversarial**: malformed/foreign/inactive/cross-persona project。
- **STOP**: selectionをlocalStorage/unsigned cookieで認可する。

#### P012-F05-T02 P010 complete board snapshotを再検証する

- **Preconditions**: F05-T01、P010-F02-T11 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F05-T02/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: signed inventory、POSITION order、updatedAt前後、pagination、duplicate、cursor loop、scope filterを再実行する。
- **Complete**: incomplete snapshot publication 0、unknown non-null optionは503。
- **Verify Positive**: sandbox boardとのitem/column/hash一致。
- **Verify Adversarial**: inventory rename/color/delete、page missing、foreign item、archived/redacted/deleted。
- **STOP**: current `listCurrentProjectV2Snapshots`のpage単位publishが残る。

#### P012-F05-T03 read-only UIと認可済み編集deep linkを確認する

- **Preconditions**: F05-T02、P010-F02-T12,P010-F02-T13,P010-F02-T14 ACCEPTED、P012-F00-T03 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F05-T03/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: Web UIにDnD/write endpointがなく、認可済みGitHub Project deep linkだけがあること、Teams/agent operation schema・executorにもProjectV2 mutation kind/pathがないことを確認する。
- **Complete**: Plan 012 UI/Teams/agent route/narrow server portからのProjectV2 write call 0、編集導線はGitHub deep linkだけ。既存XLSX import routeは別credential/decisionとして回帰green。
- **Verify Positive**: board render/accessibility/deep link。
- **Verify Adversarial**: DOM/API/operation JSONからStatus mutation、keyboard reorder、LLM-supplied cards/columnsが不可能。
- **STOP**: provider CASまたは別ADR/owner risk decisionなしでProjectV2 writeを追加する要求が出る。

**Phase 5 completion**: picker/Kanbanは認可済みcomplete snapshotをread-only表示し、ProjectV2編集はGitHubの認可済みdeep linkへ限定される。

### Phase 6: sandbox E2Eで全surfaceを実証する

#### P012-F06-T01 external preflightを実行する

- **Preconditions**: F02-T09,F03-T13,F04-T08,F05-T03、P010-F05-T14、Plan 011 acceptance。
- **Allowed files**: `.orchestration/evidence/P012-F06-T01/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: sandbox repo/project/team/channel/mailbox、GitHub App permissions、RSC、Exchange RBAC、agent auth、protected environment、cleanup ownerをread-only確認する。
- **Complete**: positive/negative resource pairとredacted IDs/hashが揃う。
- **Verify Positive**: all preflight 200/expected permission。
- **Verify Adversarial**: production ID、wildcard grant、missing negative resource、self-approval可能environmentをreject。
- **STOP**: Actions secrets/variables/environmentsが0のまま、またはsandbox識別不能。

#### P012-F06-T02 Teams read/write round tripを実証する

- **Preconditions**: F06-T01 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T02/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: query 3種、GitHub mutation 5種、coding task 1種を発話→proposal→approval→GitHub/Actions→webhook/callback→replyまで実行し、ProjectV2 write requestは拒否+deep linkで外部mutation 0を確認する。
- **Complete**: each operation IDのsource/approval/GitHub/audit/reply相関、cleanup成功。
- **Verify Positive**: target state/readback一致。
- **Verify Adversarial**: wrong project/persona、self approval、expiry/replay、source editでGitHub request 0。API timeout後はindeterminate、自動再送0、同operation IDのoutbound request 1。
- **STOP**:一件でもtrace chain欠落。

#### P012-F06-T03 Teams議事録round tripを実証する

- **Preconditions**: F06-T02 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T03/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: `[議事録]` messageとmulti-reply、edit/delete、delivery outage中の未受信messageを実tenantで作り、Teams periodic deltaと`subscriptionRemoved` recoveryでbackfillする。Teams `missed` lifecycleは送信・期待しない。
- **Complete**: expected candidate/proposal数、source hash、stale、reply、cleanup一致。
- **Verify Positive**: approved proposalだけGitHub更新。
- **Verify Adversarial**: ambient message、reply欠落、edit後approval、unknown senderでwrite 0。
- **STOP**: reply-complete証跡なし。

#### P012-F06-T04 Outlook議事録round tripを実証する

- **Preconditions**: F06-T03 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T04/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: allowlisted mailbox/folderへvalid mail、edit/move/delete、missed notification、foreign mailbox negativeを実行する。
- **Complete**: subscription/delta/source/proposal/approval/GitHub/notification/cleanup相関。
- **Verify Positive**: valid mailからexpected proposals。
- **Verify Adversarial**: foreign mailbox/sender、bad subject、attachment-only、RBAC scope外でdata/write 0。
- **STOP**: tenant-wide permissionまたはcleanup failure。

#### P012-F06-T05 Claude Code coding workflowを実証する

- **Preconditions**: F06-T04 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T05/commands.json`、`readback.json`、`evidence.json`だけ。sandbox側のdraft PRは証跡対象でありrepository file変更許可ではない。
- **Work**: official pinned CLI/action、unprivileged job、patch manifest、publisherを使い1 file draft PRを作る。
- **Complete**: agent jobにpush tokenなし、publisherだけ短命token、main mutation/merge 0。
- **Verify Positive**: draft PR、artifact digest、callback相関。
- **Verify Adversarial**: scope外path/symlink/binary/oversize/secret/timeout/no-changeでpublisher拒否。
- **STOP**: credential separationをrunner上で証明できない。

#### P012-F06-T06 Droid coding workflowを実証する

- **Preconditions**: F06-T05 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T06/commands.json`、`readback.json`、`evidence.json`だけ。sandbox側のdraft PRは証跡対象でありrepository file変更許可ではない。
- **Work**: P010-F05-T11/T12で受入済みのGitHub Actions unprivileged runner、pinned Droid Exec、runner-local accepted provider authentication/model selector、patch artifact→publisher境界を同fixtureで実行する。CI coding workflowからprivate AKS `*.svc.cluster.local` gateway/custom selectorを参照しない。interactive DroidのAKS custom modelはF06-T07で別に実証し、CIとinteractiveのcredential/network contractを混在させない。
- **Complete**: Claudeと同じartifact/publisher contractでdraft PR。
- **Verify Positive**: P010 accepted runner-local model/auth evidence、file/digest/callback一致。
- **Verify Adversarial**: private cluster DNS/custom selector混入、unaccepted model/auth、permission exceed、`--auto high`、agent job内push/main/publisher secretを拒否。
- **STOP**: P010 runner-local CLI version/model/auth/output envelopeを公式資料・sandbox・owner acceptanceと一致確認できない、またはCI runnerからprivate AKS serviceへ接続しないと実行できない。

#### P012-F06-T07 interactive Claude/Droid/Codex skill smokeを実証する

- **Preconditions**: F06-T06 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T07/commands.json`、`readback.json`、`evidence.json`だけ。sandbox GitHub objectは証跡対象でありrepository file変更許可ではない。
- **Work**: host側にSSH Agent/Keychain/credential helper/`.git-credentials`/`.netrc`/`AIOPS_PR_TOKEN` canaryを用意したうえで、attested ephemeral sandbox内の各agentへ同じnatural-language promptを与える。read-only preflight、draft生成、別browserのauthenticated proposal intake、人間requester POST、別人approval、server executor、readbackを実行する。agentによる直接`gh` mutationとhost直起動は禁止する。
- **Complete**: operation allowlist、proposal-only、confirmation、resultが一致。providerごとのsession ID、image digest、UID、mount、egress、token permissionを保存し、host canary到達/出力0。
- **Verify Positive**: Issue comment proposalを1件承認しserver executor結果を確認する。ProjectV2 write promptは拒否+deep link、GitHub mutation 0。
- **Verify Adversarial**: 各agent tokenでIssue/PR write、GraphQL mutation、workflow dispatch、git push、merge/pages/arbitrary API/production targetを403またはlocal refusalにし、server executor tokenだけIssue comment成功。
- **STOP**: providerが自律的にconfirmationを省略。

#### P012-F06-T08 full regression/security/accessibility reviewを実行する

- **Preconditions**: F06-T01,F06-T02,F06-T03,F06-T04,F06-T05,F06-T06,F06-T07 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T08/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: clean checkoutで`MISE_LOCKED=1 mise install`、`MISE_LOCKED=1 mise run ci`、`mise run actionlint`、composite action policy test、gitleaks、real PostgreSQL concurrency、secret/PII scan、Kanban keyboard/screen-reader、independent negative reviewを実行する。
- **Complete**: all green、CRITICAL/HIGH 0、MEDIUM owner/date/mitigation。
- **Verify Positive**: command/exitを省略しないDLP-redacted logsとartifact hashes。secret、token、raw議事録、email/name、source excerptは0。
- **Verify Adversarial**: 意図的にapproval bypass、forbidden operation、inventory mismatch、source staleをfixtureで入れ、対応gateがredになることを確認後fixtureを戻す。
- **STOP**: gateが不変条件違反を検出しない空虚なoracle。

#### P012-F06-T09 Phase 6 acceptance

- **Preconditions**: F06-T01,F06-T02,F06-T03,F06-T04,F06-T05,F06-T06,F06-T07,F06-T08 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F06-T09/commands.json`、`readback.json`、`evidence.json`、`verification/VERIFICATION_REPORT.md`だけ。
- **Work**: 全taskのtarget SHA、command、exit、artifact hash、review、environment、cleanup、human approval referenceをまとめる。
- **Complete**: mock-only taskをexternal acceptedにしない。cleanup failure 0。
- **Verify Positive**: independent verifierがsource artifactsから全判定を再計算できる。
- **Verify Adversarial**: missing hash、mutable URL、wrong SHA、self-issued review、redactedしすぎて相関不能なrecordをreject。
- **STOP**: Plan 011 trust verifierがreceiptを受理しない。

**Phase 6 completion**: Teams、Outlook、GitHub、Claude Code、Droid、Codex、ProjectV2の実sandbox相関とcleanupが揃い、local mockを越えた運用可能性を証明する。

### Phase 7: 文書・計画・go-live状態を実態へ同期する

#### P012-F07-T01 operator runbookとreferenceを最終同期する

- **Preconditions**: F06-T09 ACCEPTED。
- **Allowed files**: `runbooks/conversational-github-operations.md`、`runbooks/meeting-minutes-intake.md`、`runbooks/e2e-real-environment.md`、`docs/reference/teams-commands.md`、`docs/reference/http-api.md`、`verification/VERIFICATION_REPORT.md`だけ。
- **Work**: setup、permissions、triggers、operation matrix、approval、recovery、raw非保存guard、M365 hold正本、manual fallback、disable switch、evidence linksを実装どおり更新する。
- **Complete**: 未実装機能を現在形で書かない。
- **Verify Positive**: link/command/golden contract check。
- **Verify Adversarial**: Pages、auto merge、自動議事録write、DnDを現在形にするとdocs test failure。
- **STOP**: implementation evidenceとdocsが一致しない。

#### P012-F07-T02 plans statusを実態へ同期する

- **Preconditions**: F07-T01 ACCEPTED。
- **Allowed files**: `plans/README.md`、`plans/010-recommended-spec-environment-execution.md`、`plans/011-acceptance-trust-bootstrap.md`、本`plans/012-conversational-github-operations-and-minutes.md`のstatus行だけ。evidenceで状態が変わらないPlanは変更しない。
- **Work**: Plan 006/010/011/012のtask evidenceを確認し、未完/blockedをDONEにしない。重複taskはsupersede理由を記録する。
- **Complete**: README statusとacceptance evidenceが一対一。
- **Verify Positive**: status link/SHA/hash存在。
- **Verify Adversarial**: external evidenceなしのDONE、local-onlyをENV acceptedとして記録するとreview failure。
- **STOP**: evidenceのowner/signature/immutabilityを検証できない。

#### P012-F07-T03 final clean checkout gateを実行する

- **Preconditions**: F07-T02 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F07-T03/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: fresh cloneで`MISE_LOCKED=1 mise install`、`MISE_LOCKED=1 mise run ci`、workflow lint、agent asset parity、contract、acceptance verifierを実行する。
- **Complete**: working tree clean、generated diff 0、all exit 0。
- **Verify Positive**: command/exitを省略しないDLP-redacted logs。secret、token、raw議事録、email/name、source excerptは0。
- **Verify Adversarial**: untracked-only asset、missing generated file、lock drift、secret fixture leakageを検出。
- **STOP**: primary dirty checkoutの成果だけで合格扱いしない。

#### P012-F07-T04 independent final go/no-goを記録する

- **Preconditions**: F07-T01,F07-T02,F07-T03 ACCEPTED。
- **Allowed files**: `.orchestration/evidence/P012-F07-T04/commands.json`、`readback.json`、`evidence.json`だけ。
- **Work**: workerと異なるexact model/reasoning `gpt-5.6-sol high` reviewer、人間security/data/operations ownerが否定的に確認する。
- **Complete**: CRITICAL/HIGH 0、全external gate accepted、rollback/disable/raw incident owner明記でGO。1件でも欠ければNO-GO/BLOCKED。
- **Verify Positive**: receiptがPlan 011 verifierで受理。
- **Verify Adversarial**: requester=reviewer、self-issued evidence、missing cleanup、production test、auto mergeをreject。
- **STOP**: independent human reviewerを確保できない。

**Phase 7 completion**: 実装、文書、plan status、外部証跡、最終判定が同じSHAを指し、GOまたは具体的BLOCKEDが一意に決まる。

## Test plan

### Unit and contract tests

- `packages/server/tests/freeTextIntent.test.ts`: exact kind、unknown、oversize、prompt injection、multi-intent。
- `packages/prjops/tests/commandParser.test.ts`: slash syntax、permission matrix、理由必須、project mismatch。
- `packages/shared/tests/githubClient.test.ts`: Issue PATCH/comment marker、Plan 012 narrow portのProjectV2 mutation不在、既存XLSX ProjectV2 port回帰、official REST path/version/error。
- `packages/shared/tests/graphClient.test.ts`: Outlook mailbox/folder allowlist、全page ImmutableId header、delta continuation、reply pagination。
- `packages/server/tests/platformDbReplacementBicep.test.ts`: full platform replacement DB/storage/distinct-CMK/private network/versioned secret、P/Q identity drift 0、routing PUT/PATCH 0。
- `packages/server/tests/platformDbRoutingBicep.test.ts`: exact wire/ETag、cutover role default/tracked false、generation別ephemeral grant、post-G/H/I revoke/PUT403、normal reapply非復活。
- `packages/server/tests/platformDbCutoverJournalBicep.test.ts`: 旧新DBから独立したprivate Blob、distinct CMK、versioning、5年immutability、read/write-only custom DataActions、delete/list/control-plane/runtime/cutover/migration access 0。
- `packages/server/tests/platformDbCutoverJournal.test.ts`: RFC8785全field、winning ETag AppConfig last_modified=routeCasWinningLastModified=cutoverCompletedAt、rollbackDeadline/closedAt、Blob/client/recovery時刻の代用拒否、generation/grant/revoke receipt、quoted ETag、monotonic transition、same-payload replay、blob/evidence hash一致。
- `packages/server/tests/platformDbCutoverGrantExpiry.test.ts`: 30秒renew、60秒stale/90分generation expiry、3 replica/5秒poll/zone/probes/revision handoff、DELETE受理95秒/PUT403 11分、G fail/STOP/CAS不明/H BLOCKED/closed、old-generation replay/sibling delete 0。
- `packages/server/tests/platformDatabaseConnectionResolver.test.ts`: injected Azure SDK、legacy/credential-free Entra target union、ARM tenant/objectId+`ManagedIdentityCredential({objectId})`、exact getToken scope引数、opaque token/JWT decode 0、SDK expiry、current_user/mapping oracle、5分refresh margin、45分pool lifetime、fake 61分clock/pool expansion/restart、canonical target tuple+DB self-query/catalog digest、single global pool、all repo binding、`DATABASE_URL` fallback/password/token/DSN log 0。
- P012-F03-T03T environment acceptance: final resource/secret/runtime UAMI/role mapping、作成前の署名済みexact replica/pool/total cardinality、SDK実expiryの`E0-PT5M`境界、T+54/T+55 snapshot、T+61のremaining lifetime、新旧generation相関、全shadow replica restart、absolute TTL/finally/crash-resume exact-tag cleanup、old route/writer不変。
- `packages/server/tests/platformDbMigrationIdentityBicep.test.ts`: runtime/cutover/migration UAMIのpre-cutover/rollback/post-close lifecycle、cutover-first revoke、future fresh regrant、cross-injection 0。
- `packages/server/tests/platformReplacementSchemaApply.test.ts`: same-SHA fresh schema、accepted ledger、全catalog kind、function attributes、engine-major、cluster-level roles/edge 6属性/DB-only・role-only・DB-role settings、NOLOGIN null binding、Entra login smoke、password/raw 0、unknown fail-close、source不変。
- `packages/server/tests/channelMessagesRepo.test.ts`: raw列0のfresh/upgrade/idempotency、real PostgreSQL metadata/HMAC revision、旧column SQL `undefined_column`、raw role grant 0。
- `packages/server/tests/authorSubjectHasher.test.ts`: 256-bit以上protected key、golden HMAC、monotonic key version/rotation、raw author ID/log/serialization/fallback 0。
- `packages/server/tests/platformDatabaseCopy.test.ts`: manifest-driven全data forward/reverse/old-rehydrate、channel metadata-only変換、ledger non-copy/source-missing-D/target-full/checksum drift、function/unknown kind、restart/raw staging 0。
- `packages/server/tests/platformDatabaseCutover.test.ts`: external Blob 7-step journal、D後new→old rehydrate、旧新catalog/cluster-role/data/ledger/raw0 equality、quoted ETag CAS、CAS response loss+30分停止でもAppConfig last_modified由来deadline同一、全crash/DB片系喪失/runner交換resume、rollback、grant revoke、same-cluster request 0。
- `packages/server/tests/operationProposal.test.ts`: policy、idempotency、expected state、stale、forbidden kind。
- `packages/server/tests/operationProposalsRepo.test.ts`: CAS、unique、terminal immutability、real PostgreSQL concurrency。
- `packages/server/tests/operationNotificationsRepo.test.ts`: proposal/approval request/requester outbox/approver outboxの1/1/1/1 atomic initializer、restart、statement failure。
- `packages/server/tests/operationContextActivationTask.test.ts`: provider登録後のdurable `blocked_context→pending`、期限後expired、digest固定、crash/restart/concurrency収束。
- `packages/server/tests/operationNotificationDispatchTask.test.ts`: pending/claimed lease、Teams proactive/mail single-attempt、restart、definitive approval delivery failure、indeterminate、typed provider metadata、sealed envelope cleanup。
- `packages/server/tests/teamsBotActivities.test.ts`: Hono transport cap/JWT SDK bridge、manifest/exact config/AppOptions.token rotation、full service base path、self-bot/system reply 0。
- `packages/server/tests/teamsIntentIngressRepo.test.ts`: exact schema/CAS/lease、SDK-first/Graph-first/20 duplicate/restart/edit、SDK/Graph ID相関不能時Graph-only、bot reply loop 100回でsend 1。
- `packages/server/tests/teamsProactiveClient.test.ts`: SDK 2.0.13、active exact conversation reference、install/uninstall、wrong tenant/bot/user/origin、Graph chat POST 0、legacy RSC send回帰。
- `packages/server/tests/sealedApprovalDeliveryEnvelope.test.ts`: AES-256-GCM AAD、key rotation、DB theft、wrong endpoint/request/expiry、plaintext nonce 0。
- `packages/server/tests/githubOperationExecutor.test.ts`: kind別call、MAX_USER_BODY+marker、timeout/readback、indeterminate、minutes shared advisory lock/disable race/crash再送0。
- `packages/server/tests/conversationalGithubCredential.test.ts`: Plan 012/XLSX App分離、permission readback、cross-injection拒否。
- `packages/server/tests/codingTasksRepo.integration.test.ts`: full coding/publish states、authorization/token/push/PR attempt CAS、expiry/error CHECK、sealed cleanup、instruction redaction/sweep。
- `packages/server/tests/codingTaskInstructionBroker.test.ts`: receipt wire、ACK/heartbeat/callback、bounded DB/transport clock、2xx expiry+各seal/commit failure、classic/stateless可変長opaque token、二ciphertext atomicity、orphan installation suspend/readback/65分保持、ACK後redelivery0+revocation copy保持、exchange/token/push/PR/revoke/suspend response-loss、marker reconciliation、known expiry後cleanup、late child publisher 0、instruction canary 0。
- `packages/server/tests/publisherInstallationRecovery.test.ts`: App owner/manager、generation/orphan-attempt-bound approval、orphaned_expired+65分/open attempt 0、write-ahead App JWT DELETE 0/1、response-loss GET reconciliation、同一installation二世代復旧、旧generation replay 0、permission readback、旧task再開0、permanent suspend/delete分岐。
- `packages/server/tests/agentTokenBroker.test.ts`: broker UAMI/FIC/projected token、private API CA、offline JWKS+live TokenReview exact audience/username/UID/groups、Pod UID、RBAC allow/deny、proxy token audience/600秒、suspended Job二段attestation、nonce/lease one-time、repository/permission/expiry。
- `packages/server/tests/agentGithubReadGateway.test.ts`: live active launch+immutable lease generation、GHES `/api/v3`/`/api/graphql`、4 persisted operation、100/101件fail-close、unknown hash/alias/foreign variable/mutation拒否。
- `packages/server/tests/agentLlmGateway.test.ts`: provider/model/budget/ZDR、`jp.api.openai.com` storage-Japan/nonregional-processing acceptance、store/background/save-tool reject、10分lease、wire format、body log/local cache 0、credential非開示。
- `packages/server/tests/readOnlyGithubAgentLauncher.test.ts`: proxy ACK→active→suspended Job→Job/Pod attestation→init ready、admission mutation/crash/OOM/eviction replacement 0、fresh Codex/Droid settings、private-CA TLS、Kata/PID/mount/`/proc`分離、token 0。
- `packages/server/tests/meetingMinutesAgent.test.ts`: trigger、identity、structured candidates、one proposal per mutation、no direct write。
- `packages/server/tests/graphNotificationValidator.test.ts`: body/batch/schema limits。
- `packages/server/tests/meetingSenderMasterProvider.test.ts`: signed immutable master、ASCII SMTP HMAC、delegate/version/revocation、runtime directory 0。
- `packages/shared/tests/meetingSourceCanonical.test.ts`: parse5 exact Teams HTML/text/message-v1/thread-v1 root/reply order、Outlook subject/active serializer、@removed typed 200/404/410/429、欠落field hash生成0。
- `packages/server/tests/channelPollingTask.test.ts`: root/reply complete、Outlook prior-hash tombstone、unknown prior 0、cursor atomicity、initial/final/advisory gate races、restart。
- agent asset validator test: wrapper/runbook/rules/hook target/golden set。

### HTTP/integration tests

- Hono `app.request()`でanonymous/wrong tenant/self approval/CSRF/expiry/replay/concurrent POST。
- real PostgreSQLで20 concurrent initializer/approval/dispatch、1/1/1/1 cardinality、event lease reclaim、statement failure injection。
- source edit/delete/mapping change後の409 stale、GitHub call 0。
- external mutation request送信後process crash→indeterminate→read-only reconciliation→自動再送0、同operation IDのoutbound request 1。
- Teams/Outlook/GitHub mockのtrace ID相関とsecret/PII出力0。
- raw移行branch matrixを4系統で実行する。(a) all-copy raw0=`same_cluster`はP→Q→C signed NA→S signed NA→D→E→R signed NA→T03T signed NA→F signed NA→G→H signed NA→I signed NA→J signed NA→K signed NA→L signed NA→M→N→Oがgreenで、Gはglobal poolのApp Configuration/Blob request 0・quoted ETag/URI不変・writer再開。(b) raw present+dedicated key=`replacement`はP→Q→C→S external journal/guard→D→R full role fidelity→T03T final Entra runtime acceptance→E→F ledger-aware full copy→G D適用+new-to-old rehydrate+全catalog/data/ledger equality+Blob journal+quoted ETag cutover→H full reverse rollback proof/close→I cutover-first全identity revoke+isolate→J key destroy→K copy delete/expiry→L restore-negative→M/N/O。(c) raw present+shared keyは(b)と同じT03T receiptを必須とし、Jだけkey mutation 0のsigned NA、K/Lで全copy削除・復元不能。(d) unknown/owner欠落/legal holdはBまたは該当taskでBLOCKED、T03T/F/G receipt 0、writer/intake再開0。全branchでT03T signed acceptanceまたはsigned NA receiptをF/Gの必須入力にし、A inventory、B decision、schema/object/data/HMAC digest、role/auth fidelity、identity/lease/revoke lifecycle、journal/provider readback、Records/Data Owner署名を同一receipt chainで照合する。branch sequenceからNAを含むdirect prerequisiteを一件でも欠落または後置したfixtureはrejectする。

### Real-environment acceptance

- dedicated M365 sandbox tenant、allowlisted Team/channel/mailbox/folder、Teams app install+proactive conversation reference、Exchange Application RBAC。
- disposable GitHub sandbox repo/ProjectV2、positive/negative project、signed project/repository mappingとsigned intended-approver master。
- interactive Codex/Claude/Droidはprivate AKS/Kata/Ciliumのread-only skill/proposal smokeを実証する。CI coding taskのClaude/DroidはP010受入済みGitHub Actions unprivileged patch artifact→separate publisher→draft PRを実証し、private cluster DNS/credentialを要求しない。
- Teams発話/議事録、Outlook議事録のproposal→human approval→GitHub→webhook→reply。
- cleanup後にsandbox Issue/comment/Project state/subscription/mail/message/artifactをinventoryと突合。

## Done criteria

- [ ] Exact product contractの10 kind（`unknown`を含む）以外をparser、API、agent、skillが実行できない。
- [ ] Teams intentのproject IDはsource channel projectと完全一致し、cross-project外部callは0。
- [ ] Teams SDK/Graph dual ingressは同一source keyのdurable CASへ収束し、SDK/Graph ID相関不能時はGraph-onlyとなる。同一message/revisionのparse/reply/proposal/coding/outboxは各1、self-bot/system messageはreply 0でloopしない。
- [ ] read intentは認可後即時、write intentは全てpending proposalで停止する。
- [ ] Entra stable subject、active persona/project、署名済みmasterの単一intended approver、requester≠approver、CSRF、30分、one-time、CASを満たす承認だけがrecoverable dispatcherによりenqueueされる。
- [ ] proposal、Plan 010 approval request、requester outbox、intended-approver outboxは同一transactionでcardinality 1/1/1/1となり、crash/restart/concurrencyでもpartial commitと未観測eventは0。外部delivery不明はvisible `indeterminate`で自動再送0。
- [ ] context provider kind/version/artifact digest/timestampはactivation時に一度だけ固定され、durable schedulerが期限内`pending`または期限後`expired`へ収束させる。definitive approval delivery failureはattempt 0の`verification_failed`、response不明だけは承認期限までvisible pendingを維持する。
- [ ] immutable `prjops-data` SHA、RFC 8785、Ed25519 root/delegated keyring/revocation、delivery/source entitlement、atomic refresh/expiry fail-closeを満たすapprover masterだけを使用し、delegated live-source accessなしの承認は0。
- [ ] Teams/Outlookはdelegated Graph live source、interactive agentはauthenticated requester/client+POST hash、coding taskはPlan 012 verified contextをapproval/execution前に再検証する。
- [ ] concurrent/retry/crashで各operation IDのoutbound mutation requestが最大1で、送信後結果不明はindeterminate・自動再送0。
- [ ] mutation attemptの正本は`operation_execution_attempts.operation_id UNIQUE`だけで、proposal/queueにcounter 0。preflight不能はattempt 0の`verification_failed`、state corruption時はexternal call 0。meeting mutationはsession shared advisory lockをattempt前からterminal/indeterminate後まで保持し、detector disable commit時点以降のmutation 0、crash後再送0。
- [ ] source revision/hash/mapping/current state変更はstaleで停止する。
- [ ] Teams lifecycle/reply backfillとOutlook notification/deltaが耐久queue経由でlost 0。
- [ ] Plan 012 Teams配送はSDK 2.0.13、事前install、active exact conversation reference/full service base、AppOptions.token+Key Vault rotation、single-attemptに限定され、Graph chat POST/delegated refresh token/`Teamwork.Migrate.All`は0。既存legacy RSC sendは回帰green。Outlook source replyとapproval sendMailはExchange Application RBAC範囲内だけである。
- [ ] Outlook全pageはImmutableIdを使い、parse5/text/subject byte contract、RFC 8785 active message-v1、parent folder/changeKey/etag、signed `meeting-senders.v1` version/digest、ASCII SMTP HMAC、sender/from/delegateを3時点で再計算する。`@removed`はGET 200 activeまたは404/410 prior-evidence tombstoneへ分岐し、unknown/429はwrite 0、新hash捏造0。
- [ ] raw永続化0。full catalog manifestはengine-major、structured role/membership/ownership/settings、quoted/overload/first-`=`境界、NOLOGIN null/LOGIN Entra bindingを網羅しpassword hashをcopyしない。Qはold legacy live+target fakeだけ、R後のT03Tはfinal resource/secret/runtime UAMIでcredential-free Entra target、ARM principal+`ManagedIdentityCredential({objectId})`、exact getToken引数、opaque token、SDK expiry、current_user/mapping、real T+61/pool expansion/full replica restartをrouting前に実証する。GはAppConfig winning last_modifiedだけからcutover/rollback deadlineを算出する。grantは世代別fresh UAMI/FIC、zone-redundant ACA 3 replicas/5秒loop/probes/revision handoff、単一replica実測、zoneRedundant readback、zone/region residual-risk署名を持つ。403未確認中writer/regrant 0。I/J/K/Lまでreceipt/hold/restore-negativeが一致する。
- [ ] minutes extractorは`claude-sonnet-4-6` commercial APIのowner承認済みZDR organization/keyだけを使い、consumer/標準30日retention/fallback/cache/files/batch/body log/traceは0。providerのtraining/abuse/law例外、region、DPA/delete evidenceを記録する。
- [ ] generic derived textはterminal時またはexpiry後24時間以内、coding instructionはOIDC one-time delivery ACK/running/terminal時・orphan dispatching 5分・queued 30分以内にNULL+SHA-256へredactされ、metadata/auditだけ5年保持される。GitHub workflow input/event/log/artifact/cacheのinstruction/canaryは0。
- [ ] coding start receipt wireがexactで、verified callbackだけがpublishを開始する。publisherは専用installation serialization→bounded DB/transport attempt→2xx token二ciphertext atomic seal→ACK/readback→redelivery禁止→single-attempt push/PRの順を守る。unknown tokenは時刻推定せずinstallation suspend確認+65分維持または手動deleteへ収束し、自動unsuspend 0。known tokenのrevocation copyは204/known expiryまで保持する。各external request 0/1、stuck 0、late/indeterminate/expired childのwrite 0。
- [ ] suspended publisher installationの復旧はT07Rだけが行い、GitHub App owner/managerのgeneration/orphan-attempt-bound approval、同じApp JWT authority、write-ahead DELETE 0/1、GET readback、installation当たりopen recovery 1を必須とする。同一installationの後続generationは新rowで復旧でき、旧generation replay、自然言語/installation owner Web UI/publisher jobからのunsuspend、response unknown再送、旧task再開は0。
- [ ] Project picker/complete snapshot/read-only KanbanがP010受入条件を満たす。
- [ ] Plan 012 conversation/Web Kanban/agent surfaceからのProjectV2 write全種、DnD、Pages、merge、main push、任意APIは0。既存XLSX importは別credential/decisionでのみ利用可能。
- [ ] Plan 012専用GitHub AppとXLSX Appはconfig/TokenProvider/cache/compositionが分離し、Plan 012 tokenはrepository 1件、Projects writeなし、相互注入時fail-closeである。
- [ ] Claude Code/Droid CI agent jobにpush credentialがなく、opaque task ID+OIDC one-time instruction deliveryだけを使い、publisherだけがdraft PRを作る。interactive AKSとCI runnerのnetwork/credential contractを混在させない。
- [ ] coding-dispatch App=Actions write/Contents read、agent=Contents read only、publisher=allowlisted branch Contents write+Pull requests writeの3 identityをApp/installation/cache/environmentごとに分離し、cross-injection/main/non-draft/merge/admin/deployを拒否する。
- [ ] interactive Codex/Claude/Droidはread-only `gh`以外を実行せず、writeは全てEntra browser proposal intakeでpending停止する。
- [ ] interactive agentのhost直実行は0。empty HOME/新規UID/read-only source/no `.git`/host credential mount 0/direct external egress 0、SSH/Keychain/credential-helper canary非到達を3 providerで実証する。
- [ ] DEC-ENV-004のprivate AKS/Kata/Cilium、`agent-control` broker UAMI/FIC、private API/CA、exact TokenReview/RBAC/egress、別namespace proxy、private CA、one-time nonce/leaseがgreen。Secret list/watch、gateway Deployment/Service patch・非launch名create、RBAC mutation、exec/attach、cross-namespace、cluster-adminは0。deterministic suspended Job、二段attestation、Pod/process最大1を実証し、agent/proxyへのbroker authority継承は0。
- [ ] OpenAI Responsesはexact `https://jp.api.openai.com/v1`、approved org/project/key、`gpt-5.6-sol`、ZDR、data sharing off、`store:false`、`background:false`に固定する。storage residency Japan=yes、regional processing=noをownerが受容し、保存型resource/tool/extended cache、gateway body log/trace/replay/local cacheは0。
- [ ] GitHub CLI 2.96.0 Linux amd64のofficial SHA-256/attestationとGHES互換TLS上の4 read command persisted contractが固定され、100件以下はvalid output、101件以上はoutput 0+422、任意GraphQL、foreign variable、alias混在、`node|nodes|search|viewer|projectsV2`、write methodを拒否する。
- [ ] Codex provider/authはtracked project config 0、fresh job-only `$CODEX_HOME/config.toml`だけに存在し、Claude/Droidを含む3 providerは非secret placeholder+private-CA TLS Serviceだけへ接続する。Droidはexact custom selector、cloudSessionSync/ideAutoConnect=false、gateway強制`gpt-5.6-sol` high reasoningである。
- [ ] Codex/Claude/Droid skill/subagent/rule/hook資産がtrackedされ、parity validatorがgreen。
- [ ] sandbox E2Eのsource/approval/GitHub/webhook/reply/audit/cleanupが同じoperation IDで相関する。
- [ ] pinned actionlint v1.7.12の`mise run actionlint`、composite action policy test、focused tests、real PostgreSQL tests、clean checkoutの`MISE_LOCKED=1 mise install`と`MISE_LOCKED=1 mise run ci`、`git diff --check`がexit 0。
- [ ] git diffがある場合、Crit data/receipt運用または明示的な利用不能代替reviewを完了する。
- [ ] repositoryにplan-quality validator/hook/subagent/CI entry pointが導入済みなら`uv run python scripts/validate_plan_quality.py plans/012-conversational-github-operations-and-minutes.md`とhookがexit 0。未導入のままなら、各pathの不存在、manual checklist、2名以上の独立review結果をPhase 0 evidenceへ保存する。
- [ ] independent reviewerのCRITICAL/HIGH 0、人間security/data/operations ownerのGOを記録する。
- [ ] `plans/README.md`のPlan 012 statusがevidenceと一致する。

## STOP conditions

- Plan 010 stable identity、approval、Project picker/complete snapshot、Graph sandbox、coding publisherの必要taskがACCEPTEDでない。
- Plan 011のindependent trust verifier、人間reviewer、protected environmentを用意できない。
- Teams/LLMのprojectとsource channel projectが一致しない、またはproject→repo/ProjectV2 mappingが一意でない。
- Entra `(tid,oid)`、persona、active assignmentをapproval時に再検証できない。
- requester自己承認、URL所持だけの承認、CSRFなし、期限なし、replay可能のいずれかが残る。
- approver masterのimmutable SHA、offline root fingerprint、RFC 8785/Ed25519、key revocation、delivery/source entitlement、delegated live fetchのいずれかが未確定。
- external mutation attemptのwrite-ahead記録、outbound request最大1、indeterminate時の自動再送0を証明できない。
- proposal/queueにattempt counterが残る、またはcoding taskがgeneric executorとP010 state machineの双方へ入る。
- source revision/hash、current mapping、expected GitHub stateをapproval/execution時に再検証できない。
- raw inventory/hold/decisionが未確定、catalog manifestがstructured role/membership/ownership/settings/authを網羅しない、Qで未作成final target証跡を主張する、T03Tのfinal resource/credential-free Entra real login/61分refresh/full replica restartをrouting前に証明できない、password hashをcopyする、migration ledgerをblind copyする、D後rehydrate/旧新equality/外部Blob journal crash resume/AppConfig last_modified由来deadlineがない、journalが旧新DBに依存する、fresh generation/ephemeral principal/revoke receipt/F00-T05P proofがない、guardがzone-redundant 3 replicas/probes/revision handoffを持たない、単一replica実測・zoneRedundant readback・zone/region residual-risk owner受容のいずれかがない、quoted ETag CAS、full rollback、破棄直前hold、旧隔離/key/copy/restore-negativeの一つでも証明できない場合はSTOPする。
- derived proposal textのterminal/expiry redaction、5年metadata/audit retention、P010 coding-task retentionのいずれかが未確定。
- tenant-wide Graph permission、本番tenant/repo、unscoped mailbox/teamを使わないとtestできない。
- Teams full service base path、bot Entra object ID、AppOptions.token rotation、SDK/Graph message revision equivalenceのいずれかをsandboxで実証できない。
- coding instructionをworkflow input/log/artifactへ渡す、OIDC claim/ACK readback前にagentを開始する、またはdispatch/agent/publisher identity/environmentを分離できない。
- publisher mint前のbounded transaction/transport attemptがない、2xx後seal persistence gapを管理しない、ACK後再配送、失効前revocation copy消去、revoke/suspend response不明を自動再送する、orphan tokenを時刻推定でexpiredにする、またはinstallation suspensionを確認できないままpublisherを再開する。
- opaque installation tokenをprefix/JWT/fixed lengthで解析する、stateless約520文字tokenを保存・配送・revokeできない、recoveryをinstallation lifetimeで一件に固定する、旧suspension generation approvalを再利用する、App owner/manager以外がunsuspendする、break-glassを自然言語operationへ公開する、またはT07R readback前にpublisherを再開する。
- Claude/Droid CLI version、auth、permission mode、output envelopeを公式資料とsandboxで確認できない。
- agent jobからpublisher credential、merge credential、deployment credentialへ到達できる。
- interactive agentがhost UID/HOME、SSH agent、Keychain、credential helper/store、`.netrc`、Docker socket、credential-bearing remote、server/publisher tokenのいずれかへ到達できる。
- private AKS/Kata/Cilium/別Pod proxy/private CA/Kubernetes UID-policy readbackをstagingで証明できない、またはACA/localhost/shared sidecarへfallbackする。
- brokerがTokenReview以外のcluster-scope権限、Secret list/watch、gateway Deployment/Service patch・非launch名create、Role/RoleBinding mutation、Pod exec/attach、cross-namespace権限を持つ、credential proxyにKey Vault route/role/data-plane permissionがある、private CAを公式trust設定で検証できない、またはTLS bypassが必要。
- provider CASまたは別ADR/owner risk decisionなしでProjectV2 writeを要求する。
- GitHub Pages、PR merge、main push、DnD、任意REST/GraphQL/shellをscopeへ追加する要求が出る。別decision/Planへ戻す。
- `mise run ci`、external cleanup、independent review、acceptance verifierのいずれかがgreenでない。
- `.mise.toml`、package/workspace manifest、lockfileのdrift後にCommands/CI compatibilityと独立Plan reviewを再実行していない。

## Maintenance notes

- operation kindを増やすときはcontract、pure policy、permission、idempotency、skill parity、positive/adversarial E2Eを同じPRで更新する。
- GitHub API version、ProjectV2 field/options、Microsoft Graph subscription lifetime/permission、Codex/Claude/Droid CLIは実装着手時とupgrade時に公式一次資料を再確認する。RESTは`2026-03-10`を基準とし、より新しいsupported versionが出た場合はclient全体とmockを同一PRで更新するか、現version維持理由をdecision recordへ残す。
- marker formatは公開後に変更しない。変更には旧/new両方のreconciliation migrationが必要。
- source content/excerptは監査ログを含む全永続媒体へ入れず、metadata/hashだけを残す。raw/display column 0のschema guard、durable incident、M365/Purview hold evidenceを定期監査する。
- Web Kanbanのwrite UIや自然言語ProjectV2 writeは自動追加しない。provider CASまたはowner risk decision、keyboard accessibility、conflict recoveryを定める別ADR/Planが必要。
- GitHub Pagesはdynamic dashboardの代替ではない。static public docsという具体的owner要件が生じた時だけ再検討する。
- agent rules/hooksは補助防御であり、GitHub branch protection、token scope、server authorizationの代替にしない。
- external evidenceにはsecret値やraw議事録本文を保存せず、redacted stable ID、trace/operation ID、SHA-256、HTTP status、cleanup結果だけを残す。

## 安全回帰

- [ ] 外部入力はDB前、LLM前、外部出力前の三段階でsanitizeする。
- [ ] audit logはappend-onlyで、decision/auditの必要箇所は同一transactionにする。
- [ ] authorization filterはdata取得側で強制し、表示後maskに依存しない。
- [ ] stable subjectはEntra `(tid,oid)`、email/表示名/Teams IDを単独認可キーにしない。
- [ ] LLMはintent/candidate文章抽出だけで、project/repo/権限/ID/数値/intended approver/承認を決めない。
- [ ] human approval前のGitHub writeは0。ambient会話や議事録から直接writeしない。
- [ ] requesterとapproverを分離し、期限切れ/replay/CSRF/foreign tenant/personaを拒否する。
- [ ] main直接push、自動merge、agent merge/deploy credentialを禁止する。
- [ ] GitHub Projects v2をworkflow正本とし、第二のboard/state DBを作らない。
- [ ] Web Kanbanと自然言語board操作はread-only、ProjectV2編集は認可済みGitHub deep linkだけ。
- [ ] retry/crash/duplicate notificationでoperation IDごとのoutbound mutation request最大1、結果不明時はindeterminateで自動再送せず停止する。
- [ ] raw議事録の永続化0、PII最小化、M365/Purview hold正本、sandbox-only external testを維持する。
- [ ] security/accessibility/secret protectionをPonytailの簡略化対象にしない。

## Official references

- Codex model/subagents/skills/hooks/rules: https://developers.openai.com/codex/codex-manual.md
- Codex config/state locations, project-local provider/auth exclusion, custom model providers: https://learn.chatgpt.com/docs/config-file/config-advanced
- Codex configuration reference (`config.toml`): https://learn.chatgpt.com/docs/config-file/config-reference#configtoml
- Codex models and exact CLI slugs: https://developers.openai.com/codex/models/
- actionlint v1.7.12 workflow checker: https://github.com/rhysd/actionlint/releases/tag/v1.7.12
- mise lockfile exact versions/checksums: https://mise.jdx.dev/dev-tools/mise-lock.html
- mise aqua backend and integrity verification: https://mise.jdx.dev/dev-tools/backends/aqua.html
- RFC 8785 JSON Canonicalization Scheme: https://www.rfc-editor.org/rfc/rfc8785
- RFC 7518 JSON Web Algorithms ECDSA signature format: https://www.rfc-editor.org/rfc/rfc7518#section-3.4
- RFC 8032 Ed25519: https://www.rfc-editor.org/rfc/rfc8032
- GitHub REST API versions: https://docs.github.com/en/rest/about-the-rest-api/api-versions
- GitHub App installation token repository/permission restriction and one-hour expiry: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
- GitHub App installation token revoke endpoint: https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token
- GitHub App installation suspend/unsuspend endpoints: https://docs.github.com/en/rest/apps/installations#suspend-an-app-installation
- GitHub App installation suspension authority and same-method recovery: https://docs.github.com/en/apps/maintaining-github-apps/suspending-a-github-app-installation
- GitHub stateless installation token rollout and per-request sandbox override: https://github.blog/changelog/2026-05-15-github-app-installation-tokens-per-request-override-header/
- GitHub CLI 2.96.0 immutable latest release: https://github.com/cli/cli/releases/tag/v2.96.0
- GitHub CLI 2.96.0 official checksums: https://github.com/cli/cli/releases/download/v2.96.0/gh_2.96.0_checksums.txt
- GitHub CLI binary provenance verification: https://github.com/cli/cli#verification-of-binaries
- GitHub CLI `gh api` REST/GraphQL behavior: https://cli.github.com/manual/gh_api
- GitHub REST 2026-03-10 workflow dispatch 200 run-details breaking change: https://docs.github.com/en/rest/about-the-rest-api/breaking-changes?apiVersion=2026-03-10
- GitHub workflow dispatch run ID rollout: https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/
- GitHub Actions secure use and immutable SHA pinning: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub Issue update: https://docs.github.com/en/rest/issues/issues
- GitHub Issue/PR comments: https://docs.github.com/en/rest/issues/comments
- GitHub Projects GraphQL object reference: https://docs.github.com/en/graphql/reference/objects#projectv2
- GitHub Projects API operation order: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- GitHub deployment environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- GitHub Pages static hosting scope: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Microsoft Graph change notifications: https://learn.microsoft.com/en-us/graph/change-notifications-overview
- Microsoft Graph lifecycle notifications: https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events
- Microsoft Graph Outlook immutable IDs (`Prefer: IdType="ImmutableId"`): https://learn.microsoft.com/en-us/graph/outlook-immutable-id
- Microsoft Teams SDK proactive messaging: https://learn.microsoft.com/en-us/microsoftteams/platform/teams-sdk/essentials/sending-messages/proactive-messaging
- Microsoft Teams bot proactive messaging and conversation IDs: https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages
- Microsoft Graph chat message POST permission table (normal app-only send rejected): https://learn.microsoft.com/en-us/graph/api/chat-post-messages?view=graph-rest-1.0
- Microsoft Teams retention policies: https://learn.microsoft.com/en-us/microsoftteams/retention-policies
- Microsoft Purview retention for Exchange: https://learn.microsoft.com/en-us/purview/retention-policies-exchange
- Microsoft Graph transcript notifications (deferred): https://learn.microsoft.com/en-us/graph/teams-changenotifications-callrecording-and-calltranscript
- Microsoft Graph transcript retrieval (deferred): https://learn.microsoft.com/en-us/graph/api/calltranscript-get?view=graph-rest-1.0
- AKS Cilium network-policy best practices: https://learn.microsoft.com/en-us/azure/aks/network-policy-best-practices
- AKS Pod Security best practices: https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security
- AKS Microsoft Entra Workload Identity: https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview
- Azure Key Vault supported key types/algorithms (EC P-256/ES256): https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys-details
- Azure Key Vault Sign operation (digest input): https://learn.microsoft.com/en-us/rest/api/keyvault/keys/sign/sign
- Azure App Configuration store-level data-plane RBAC: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-enable-rbac
- Azure App Configuration Set Key-Value conditional request (`If-Match`/ETag): https://learn.microsoft.com/en-us/rest/api/appconfiguration/data-plane/key-values/set-key-value
- Azure App Configuration Key Vault reference content type/value contract: https://learn.microsoft.com/en-us/azure/azure-app-configuration/use-key-vault-references-dotnet-core
- Azure Blob conditional headers (`If-Match`/`If-None-Match`): https://learn.microsoft.com/en-us/rest/api/storageservices/specifying-conditional-headers-for-blob-service-operations
- Azure Blob versioning: https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview
- Azure Blob version-level immutable storage: https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview
- Azure delegated role-assignment management with conditions: https://learn.microsoft.com/en-us/azure/role-based-access-control/delegate-role-assignments-portal
- Azure RBAC propagation troubleshooting: https://learn.microsoft.com/en-us/azure/role-based-access-control/troubleshooting#symptom---role-assignment-changes-are-not-being-detected
- Azure Container Apps: https://learn.microsoft.com/en-us/azure/container-apps/overview
- Azure Container Apps reliability/zone guidance: https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-container-apps
- Azure Chaos Studio fault library: https://learn.microsoft.com/en-us/azure/chaos-studio/chaos-studio-fault-library
- Kubernetes projected service-account tokens: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#serviceaccount-token-volume-projection
- Kubernetes TokenReview v1 API: https://kubernetes.io/docs/reference/kubernetes-api/authentication-resources/token-review-v1/
- AKS Pod Sandboxing/Kata concepts: https://learn.microsoft.com/en-us/azure/aks/concepts-pod-sandboxing
- AKS Pod Sandboxing deployment/runtime class: https://learn.microsoft.com/en-us/azure/azure-linux/pod-sandboxing-aks
- Kubernetes Job suspension and controller behavior: https://kubernetes.io/docs/concepts/workloads/controllers/job/#suspending-a-job
- PostgreSQL system catalogs: https://www.postgresql.org/docs/current/catalogs.html
- PostgreSQL system information functions (`pg_get_functiondef`): https://www.postgresql.org/docs/current/functions-info.html
- PostgreSQL `pg_auth_members`: https://www.postgresql.org/docs/current/catalog-pg-auth-members.html
- PostgreSQL `pg_db_role_setting`: https://www.postgresql.org/docs/current/catalog-pg-db-role-setting.html
- Azure Database for PostgreSQL managed-identity authentication: https://learn.microsoft.com/en-us/azure/postgresql/security/security-connect-with-managed-identity
- Microsoft identity platform access tokens are opaque to clients: https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
- Azure Identity AccessToken API: https://learn.microsoft.com/en-us/javascript/api/@azure/identity/accesstoken
- node-postgres async dynamic password callback: https://node-postgres.com/features/connecting
- node-postgres pool `maxLifetimeSeconds`: https://node-postgres.com/apis/pool
- Anthropic commercial API retention and ZDR exception: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- Anthropic ZDR applicable products and remaining abuse/law exceptions: https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to
- Claude Code enterprise network/custom CA (`NODE_EXTRA_CA_CERTS`): https://code.claude.com/docs/en/network-config
- OpenAI API data controls/default usage policies/data residency: https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint
- OpenAI Admin project data-retention readback (`client.admin.organization.projects.data_retention.retrieve(project_id)` / `GET /organization/projects/{project_id}/data_retention`): https://github.com/openai/openai-python/blob/main/api.md
- OpenAI API input/output data-sharing controls and ZDR incompatibility: https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai
- OpenAI GPT-5.6 Sol model: https://developers.openai.com/api/docs/models/gpt-5.6-sol
- Claude Code CLI: https://code.claude.com/docs/en/cli-usage
- Claude Code LLM gateway/base URL/apiKeyHelper: https://docs.anthropic.com/en/docs/claude-code/llm-gateway
- Factory Droid Exec: https://docs.factory.ai/cli/droid-exec/overview
- Factory Droid custom model/base URL/environment API key: https://docs.factory.ai/cli/byok/overview
- Factory Droid settings (`cloudSessionSync`, `ideAutoConnect`, reasoning): https://docs.factory.ai/cli/configuration/settings
