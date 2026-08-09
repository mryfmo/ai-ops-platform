# 機能仕様

## A. AI Control Plane

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-CP-001 | Workflow開始 | idempotency keyを必須化し、同一business operationを二重開始しない |
| FR-CP-002 | Workflow照会 | status、current step、waiting reason、source refs、approval stateを返す |
| FR-CP-003 | Signal/Update | approve/reject/cancel/retry/resumeを認証・policy判定後に適用 |
| FR-CP-004 | Durable timer | report、subscription renewal、reconcile、grant expiryをTemporal timer/scheduleで実行 |
| FR-CP-005 | Activity retry | readと安全なidempotent activityだけ自動retry。unknown-result writeは自動再送しない |
| FR-CP-006 | Compensation | 複数SoR書込みの途中失敗を記録し、rollback可能な操作だけ補償する |
| FR-CP-007 | Human approval | approval requestを生成し、Temporal signal受信までworkflowをdurable wait |
| FR-CP-008 | Feature flag | old/new pathをproject/tenant/workflow単位で切替可能 |

## B. LLM Inference Plane

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-LLM-001 | 論理model alias | applicationはprovider model IDを知らない |
| FR-LLM-002 | Bedrock標準 | governed/standard/fast/code aliasの標準bindingはBedrock |
| FR-LLM-003 | Anthropic代替 | policy許可、error分類許可、data classification許可時だけ利用 |
| FR-LLM-004 | Provider binding | workflow開始時にprovider/model revisionを固定し、黙って切替えない |
| FR-LLM-005 | Virtual key | user/team/project/app/runner単位のkey、budget、rate、expiryを持つ |
| FR-LLM-006 | Usage | tokens、cost、latency、cache、provider、aliasをledger/OTelへ記録 |
| FR-LLM-007 | Direct egress防止 | production workloadがproviderへ直接接続できないことをnetwork/testで保証 |

## C. MCP/A2A Access Plane

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-MCP-001 | Registry | server/tool/version/owner/risk/resource scopeをGitOps管理 |
| FR-MCP-002 | Auth | OAuth/OIDC/token exchangeを中央化し、token passthroughを禁止 |
| FR-MCP-003 | Tool policy | toolごとにallow/ask/deny、resource scope、data classを判定 |
| FR-MCP-004 | Approval | L2/L3 toolはaction ledgerと人間承認を通す |
| FR-MCP-005 | High-risk deny | merge/deploy/delete/permission/retention/production DB toolを公開しない |
| FR-MCP-006 | Audit | request/result metadata、server/tool/version、actor、policy、latencyを記録 |
| FR-MCP-007 | Prompt-injection boundary | tool resultをuntrusted contentとしてlabelし、次のtool権限を拡大しない |

## D. Work IQ / Microsoft Graph

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-M365-001 | Delegated query | Work IQはサインインuser/OBOでのみ実行 |
| FR-M365-002 | Permission trimming | userが閲覧できないM365情報を返さないことをnegative probeで確認 |
| FR-M365-003 | Read-first | 初期releaseはfetch/search/ask/get_schema中心。CRUDはflag off |
| FR-M365-004 | Background path | notification、transcript、calendar、formal writeはGraphを使用 |
| FR-M365-005 | Data routing | classificationとpurposeによりWork IQ内完結、Bedrock、Anthropicを選別 |
| FR-M365-006 | Source citation | responseにsource identity/version/urlを保持 |

## E. Teams / Web Workbench

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-UI-001 | Teams conversation | mention、thread follow-up、file-aware request、status updateを処理 |
| FR-UI-002 | Rich result | cards、table、chart、incident、approval、PR resultをnative surfaceへ表示 |
| FR-UI-003 | Workbench handoff | Teams threadから同一workflow/workspaceをWebで開く |
| FR-UI-004 | Capability scope | workspace/gadgetは明示されたproject/repo/space/resourceだけにアクセス |
| FR-UI-005 | Deferred action | side effect候補をpending actionとして表示し、承認前は正式SoRへ反映しない |
| FR-UI-006 | Replaceability | Teams adapter/Web UIはControl API contract以外のworkflow stateを持たない |

## F. Meeting / Knowledge

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-MTG-001 | Meeting correlation | Outlook/Teams eventとWispr noteをtitle/time/participants/IDsで相関しconfidenceを記録 |
| FR-MTG-002 | Structure | summary、decision、action、risk、question、source spanを生成 |
| FR-MTG-003 | Human review | 発行前にowner/due/target system/visibilityを確認 |
| FR-MTG-004 | Publication | action→Plane、engineering action→GitHub、working knowledge→Confluence、formal minutes→SharePoint |
| FR-MTG-005 | Idempotency | 同じmeeting/versionを二重発行しない |
| FR-MTG-006 | Provenance | 発行物にmeeting/source/reviewer/model/policy/versionを付与 |

## G. AI Coding Agents

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-AGT-001 | Task manifest | task ID、writer、reviewer、allowed paths、forbidden paths、acceptanceを固定 |
| FR-AGT-002 | One Writer | 同一task/branchはClaudeまたはDroid/Codexの一方だけがwrite |
| FR-AGT-003 | Isolated runner | ephemeral runner/worktree、no persistent provider secrets |
| FR-AGT-004 | PR-only | `agent/{task-id}` branch、ai-generated label、human merge |
| FR-AGT-005 | Independent review | Reviewerはdiff、tests、spec drift、securityを独立検証 |
| FR-AGT-006 | Evidence | 実行command、result、未実行項目、artifact linksをcallbackへ送る |

## H. AIOps / Observability

| ID | 機能 | 必須挙動 |
|---|---|---|
| FR-OBS-001 | Correlation | trace/workflow/run/project/repo/meeting/approval/tool/model IDsを関連付ける |
| FR-OBS-002 | Incident workflow | alert→context収集→RCA→repair PR→CI→human deploy→recovery→postmortem |
| FR-OBS-003 | Decision receipt | policy/approval/model/tool routingの理由とversionを保存 |
| FR-OBS-004 | Redaction | prompt/content/secret/PIIを原則記録せず、必要なhash/refのみ保存 |
| FR-OBS-005 | SLO | workflow success/latency、gateway overhead、approval wait、tool/model errorを測定 |
