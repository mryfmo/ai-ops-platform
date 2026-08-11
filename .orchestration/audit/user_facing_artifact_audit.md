# T34 User-Facing Artifact Effectiveness Audit

- Repository revision: `21306d8`
- Audit date: 2026-07-10
- Lens: a new user can complete the stated task using the shipped artifact and its documented prerequisites
- Decision: **NO-GO** for Excel import and the affected operator procedures
- Scope: all 3 guides, all 4 references, Teams package README, all 10 runbooks, and the xlsxImport/reportIngest/codingTasks error surfaces

## Method

1. Enumerated every file in the six required artifact groups; no sampling was used.
2. Followed each procedure from its first prerequisite through its stated success check.
3. Generated and parsed the real Excel workbook, then ran adversarial local probes for field typing, corrupt input, and re-execution.
4. Compared commands, required values, and error responses with the current route, parser, engine, workflow, scheduler, and configuration code.
5. Compared every candidate against PRG-001..050 and SPC-001..026. A candidate with the same root cause was recorded only in the deduplication ledger.
6. Used GitHub and Microsoft primary documentation for current external API prerequisites. No external write was performed.

## Executive Result

- New findings: **11** (`HIGH 8 / MED 3`)
- Defect types: 実行不能 7 / 記入不能 1 / 循環定義 1 / 前提未記載 2
- Existing-finding duplicates newly filed: **0**
- Excel template: 3 worksheets, 3 executable example rows, 0 instruction worksheets, 0 data validations
- Generated template parse: `rows=3`, `errors=0`; the placeholder Project v2 IDs pass dry-run
- Existing route tests: 31/31 pass, showing that implementation tests do not establish user task completion

## Excel End-to-End Walkthrough

### Generated workbook evidence

Command:

```bash
pnpm exec tsx packages/shared/src/xlsxImport/generateTemplate.ts \
  .orchestration/sandboxes/T34-aiops-import-template.xlsx
```

Result:

- SHA-256: `34f9949c25fee7debb4387a5f2cc8638994a865577344d8683b46121839f6e3b`
- Sheets: `issues`, `project_items`, `milestones`; no instruction/README sheet
- Row 2 in each sheet contains an example, not a marked/non-executable sample
- Header notes contain only `required|optional` plus `string|date|csv`
- Workbook data validation count: 0 on every sheet
- `parseXlsxImport()` returns all three example rows with `errors=[]`

The untouched template therefore looks valid to dry-run. It attempts to create the example issue and milestone, then uses `PVT_kw...`, `I_kw...`, and `PVTSSF_l...` as actual Project v2 IDs.

### Knowledge required for completion but absent from the Excel guide/template

1. Delete or replace all three row-2 examples; they are executable data, not comments.
2. Keep all three worksheets even when a target kind is unused; a missing sheet is an error.
3. Choose a `source_key` globally unique across all sheets and stable across reruns. Only ledger status `imported` is skipped; `pending` and `failed` are retried.
4. Identify whether the Project v2 owner is an organization or a user and obtain the project number from its URL.
5. Authenticate `gh` with at least `read:project` to inspect project IDs. The execution credential separately needs write access to the project and repository objects.
6. Query `project_node_id`, every `field_node_id`, each field data type, single-select option IDs, and iteration IDs.
7. Query `content_node_id` for every Issue or Pull Request to add.
8. Map GitHub field data types to the engine's accepted `field_type` spellings.
9. Encode `value` by field type: option ID, iteration ID, numeric string, ISO date, or text. Option display names are not accepted for single-select.
10. Understand that dry-run checks local workbook structure only. It does not verify node existence, field ownership, option IDs, remote permissions, or GraphQL compatibility.
11. Include a matching `milestones` row (or a previously imported ledger entry included in the rerun) for every `issues.milestone`. An existing GitHub milestone name alone is not resolved.
12. Set `XLSX_IMPORT_SECRET` and `XLSX_IMPORT_ALLOWED_REPOS` on the server, and use the exact same HMAC secret as the caller.
13. Know that `owner` and `repo` select the GitHub repository for Issue/Milestone writes and must match the full `owner/repo` allowlist entry. They do not identify the Project v2 owner.
14. Sign the exact binary workbook body. Re-encoding or multipart wrapping changes the signature.
15. Add `x-confirm-import: yes` only for execute, and ensure failsafe is inactive.
16. Treat `result.failed > 0` as incomplete even though execute returns HTTP 200.
17. Reconcile remote GitHub state before retrying a failed row; a failure after remote creation but before ledger commit can duplicate the object.

Items 12-15 are the already accepted PRG-020 documentation defect and are not re-filed as UFA findings.

### Actual node-ID acquisition procedure missing from the guide

GitHub's current Projects API documentation requires `gh` authentication with `project` or read-only `read:project`, exposes Project v2 fields and single-select option IDs, and uses `singleSelectOptionId` for updates: [GitHub Projects API guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects?tool=cli), [Projects GraphQL reference](https://docs.github.com/en/graphql/reference/projects).

Step 0, authenticate and verify scope:

```bash
gh auth login --scopes "read:project"
gh auth status
```

The audit workstation failed `gh auth status` because its token is invalid. This demonstrates that authentication is a real prerequisite; no live repository data was queried.

Step 1, retrieve the organization-owned project ID, field IDs, data types, option IDs, and iteration IDs:

```bash
export PROJECT_OWNER=acme
export PROJECT_NUMBER=12
gh api graphql \
  -f login="$PROJECT_OWNER" \
  -F number="$PROJECT_NUMBER" \
  -f query='query($login:String!,$number:Int!){
    organization(login:$login){
      projectV2(number:$number){
        id
        title
        fields(first:100){
          nodes{
            __typename
            ... on ProjectV2Field { id name dataType }
            ... on ProjectV2SingleSelectField { id name dataType options { id name } }
            ... on ProjectV2IterationField {
              id name dataType
              configuration { iterations { id title startDate duration } }
            }
          }
        }
      }
    }
  }'
```

For a user-owned project, replace `organization(login:$login)` with `user(login:$login)`.

Step 2, retrieve each Issue or Pull Request content node ID:

```bash
gh api repos/OWNER/REPO/issues/123 --jq .node_id
gh api repos/OWNER/REPO/pulls/456 --jq .node_id
```

Step 3, map the returned field contract to workbook values:

| GitHub field data type | `field_type` accepted by current engine | `value` format |
| --- | --- | --- |
| text | `text` | literal text |
| number | `number` | numeric string; current parser does not reject NaN |
| date | `date` | `YYYY-MM-DD`; current Project field parser does not validate it |
| single select | `single_select`, `single-select`, or `single_select_option` | option **ID**, not option name |
| iteration | `iteration` | iteration **ID**, not iteration title |

Any other `field_type` silently falls through to a text mutation. The shipped guide contains none of these commands or mappings.

### Complete signed HTTP sequence missing from the guide

```bash
export AIOPS_BASE_URL=https://aiops.example.com
export XLSX=aiops-import.xlsx
export XLSX_IMPORT_SECRET='<same 32+ character server secret>'
export OWNER=acme
export REPO=widget

SIG=$(openssl dgst -sha256 -hmac "$XLSX_IMPORT_SECRET" "$XLSX" | awk '{print $NF}')

curl -fsS "$AIOPS_BASE_URL/xlsx-import/dry-run" \
  -H 'content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' \
  -H "x-aiops-signature-256: sha256=$SIG" \
  --data-binary "@$XLSX" | tee /tmp/xlsx-dry-run.json
jq -e '.ok == true and .errors == []' /tmp/xlsx-dry-run.json

curl -fsS "$AIOPS_BASE_URL/xlsx-import/execute?owner=$OWNER&repo=$REPO" \
  -H 'content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' \
  -H "x-aiops-signature-256: sha256=$SIG" \
  -H 'x-confirm-import: yes' \
  --data-binary "@$XLSX" | tee /tmp/xlsx-execute.json
jq -e '.ok == true and .result.failed == 0' /tmp/xlsx-execute.json
```

Re-run uses the same signed execute command and must be checked for the expected `skipped` count. The guide currently supplies only method/path fragments, so its §3/§4 examples fail at the HMAC boundary before reaching the documented 400/409 cases (PRG-020).

## Findings

### UFA-001: The template's example rows are executable imports

- 欠陥種別: 実行不能
- 対象成果物: generated Excel template and `docs/guide/excel-import.md`
- ユーザーが詰まる箇所の再現: A new user downloads the template and follows the guide, which never says to delete row 2. Dry-run returns `ok=true` for three rows. Execute can create the sample Issue/Milestone and then fails the Project row on placeholder IDs. The workbook has no instruction sheet, sample marker, or input validation to distinguish examples from payload.
- 証跡 file:line: `packages/shared/src/xlsxImport/template.ts:55-69`; `packages/shared/src/xlsxImport/parser.ts:168-199`; `packages/shared/tests/xlsxImport.test.ts:46-51`; `docs/guide/excel-import.md:19-49`; generated workbook `.orchestration/sandboxes/T34-aiops-import-template.xlsx`
- 重大度: **HIGH**
- 推奨対処: Add a non-imported instruction sheet, remove executable examples from data sheets or mark/strip them explicitly, add field validations and safe examples, and test that a freshly downloaded untouched template cannot execute writes.
- 既存所見(PRG/SPC)との相互参照: PRG-020 covers authentication/allowlist documentation, not executable sample data. No duplicate.

### UFA-002: Required Project v2 node IDs cannot be obtained from any shipped artifact

- 欠陥種別: 記入不能
- 対象成果物: `project_items` sheet and `docs/guide/excel-import.md`
- ユーザーが詰まる箇所の再現: Three opaque GraphQL node IDs are mandatory, but the guide gives only their names. It provides no authentication scope, owner/project-number distinction, `gh api graphql` query, Issue/PR node query, or permission prerequisite. A user cannot derive values such as `PVT_*`, `I_*`/`PR_*`, and `PVTF_*` from normal Project URLs alone.
- 証跡 file:line: `packages/shared/src/xlsxImport/template.ts:30-36`; `docs/guide/excel-import.md:31-40`; `packages/shared/src/xlsxImport/engine.ts:207-218`; `packages/shared/src/clients/githubClient.ts:237-268`; local `gh auth status` failed with an invalid token
- 重大度: **HIGH**
- 推奨対処: Put the exact read-only commands above in the guide and template instruction sheet; document organization/user variants, required scopes, Project number, content lookup, field lookup, and execution-token write permissions.
- 既存所見(PRG/SPC)との相互参照: PRG-020 covers HMAC/allowlist misinformation. PRG-032 covers broad operator provisioning. Neither identifies the per-row node-ID acquisition contract. No duplicate.

### UFA-003: `field_type` is circular prose and its `value` encoding is undiscoverable

- 欠陥種別: 循環定義
- 対象成果物: `project_items.field_type/value` in template and Excel guide
- ユーザーが詰まる箇所の再現: The guide says the engine retains `field_type` to pass a mutation, which only restates implementation. The parser accepts any string. The client recognizes three single-select spellings, number, date, and iteration, silently treating every other value as text. Single-select and iteration require IDs rather than display names. `numbre/not-a-number` passed the local parser with `errors=[]`.
- 証跡 file:line: `docs/guide/excel-import.md:33-40`; `packages/shared/src/xlsxImport/parser.ts:138-147`; `packages/shared/src/clients/githubClient.ts:46-60`; `packages/shared/src/clients/githubClient.ts:247-268`
- 重大度: **HIGH**
- 推奨対処: Define a closed enum and per-type value schema in the specification, guide, template dropdowns, and parser. Reject unknown type, NaN, invalid date, option names, and iteration titles during dry-run.
- 既存所見(PRG/SPC)との相互参照: SPC-009..012 cover data-model/schema documentation, not the Project mutation input contract. No duplicate.

### UFA-004: The guide implies any milestone name can be used, but only workbook/ledger milestones resolve

- 欠陥種別: 前提未記載
- 対象成果物: `issues.milestone` in Excel guide
- ユーザーが詰まる箇所の再現: The guide labels the cell only as “Milestone name.” The engine resolves names solely from milestone rows processed in the same workbook or imported ledger rows encountered in that run. An existing GitHub milestone that is not represented that way fails with `milestone title not resolved`; adding it with a new key can instead attempt a duplicate milestone create.
- 証跡 file:line: `docs/guide/excel-import.md:21-29`; `packages/shared/src/xlsxImport/engine.ts:106-120`; `packages/shared/src/xlsxImport/engine.ts:186-205`; `packages/shared/tests/xlsxImport.test.ts:315-329`
- 重大度: **HIGH**
- 推奨対処: Either resolve existing milestones from GitHub before import or state and validate the workbook/ledger requirement during dry-run. Document how an existing milestone is linked without recreating it.
- 既存所見(PRG/SPC)との相互参照: No PRG/SPC finding covers milestone resolution. No duplicate.

### UFA-005: The rerun guide overclaims idempotence across remote-write/ledger failure

- 欠陥種別: 実行不能
- 対象成果物: Excel guide §5 and import ledger behavior
- ユーザーが詰まる箇所の再現: The guide says the same `source_key` is skipped. The engine skips only `imported`. If GitHub creation succeeds and `markImported` fails, the row becomes failed and the next run performs the remote creation again. A local probe executed the same failed row twice and observed `remoteCreates=2`.
- 証跡 file:line: `docs/guide/excel-import.md:77-81`; `packages/shared/src/xlsxImport/engine.ts:158-179`; `packages/shared/src/xlsxImport/engine.ts:181-228`; `packages/server/src/db/importLedgerRepo.ts:32-56`
- 重大度: **HIGH**
- 推奨対処: Use a recoverable claim/outbox or reconcile the remote marker/object before retry. Document imported/pending/failed semantics and require an operator reconciliation step instead of promising unconditional skip.
- 既存所見(PRG/SPC)との相互参照: PRG-047/SPC-025 address report delivery claims, not Excel import remote writes. No duplicate.

### UFA-006: Both Graph subscription commands are expired and hide required configuration

- 欠陥種別: 実行不能
- 対象成果物: CLI reference and report-delivery runbook
- ユーザーが詰まる箇所の再現: Both commands hard-code `--expiry 2026-07-09T06:00:00Z`, already past on the audit date. Running the command as documented also fails before Graph access because `loadConfig()` requires `DATABASE_URL`, `GITHUB_WEBHOOK_SECRET`, and `CODING_TASK_CALLBACK_SECRET` in addition to the Graph variables the runbook lists. The observed exit was `E-CFG01` naming eight missing variables.
- 証跡 file:line: `docs/reference/cli.md:81-92`; `runbooks/report-delivery.md:28-40`; `packages/server/src/tools/createGraphSubscription.ts:58-82`; `packages/server/src/config.ts:14-90`
- 重大度: **HIGH**
- 推奨対処: Generate a future expiry at execution time within the resource limit, list every required variable, or decouple the tool from unrelated full-server config. Add a preflight command and a successful response check. Microsoft documents finite lifetimes and renewal requirements: [change notification lifetimes](https://learn.microsoft.com/en-us/graph/change-notifications-overview).
- 既存所見(PRG/SPC)との相互参照: PRG-032 covers missing end-to-end provisioning; this finding is the deterministic failure of the published command itself. No duplicate.

### UFA-007: The Graph recovery runbook deletes the only recovery state and promises nonexistent recreation

- 欠陥種別: 実行不能
- 対象成果物: `runbooks/graph-subscription-recovery.md`
- ユーザーが詰まる箇所の再現: The runbook says polling subscriptions are recreated every 30 minutes and instructs deletion so the next renewal recreates them. The actual renewal task lists only `mode='notification'`, never calls create, and explicitly excludes polling records. Deleting the row removes resource/team/channel/delta-link state and leaves nothing for polling or renewal. Its curl check also uses `-o /dev/null` while asking the operator to inspect body `ping`, and prefixes `https://` around a `PUBLIC_BASE_URL` value that already requires a URL.
- 証跡 file:line: `runbooks/graph-subscription-recovery.md:5-12`; `runbooks/graph-subscription-recovery.md:32-43`; `packages/server/src/scheduler/tasks/subscriptionRenewalTask.ts:41-75`; `packages/server/tests/subscriptionRenewalTask.test.ts:105-118`; `packages/server/src/db/graphSubscriptionsRepo.ts:87-117`
- 重大度: **HIGH**
- 推奨対処: Do not delete the row. Preserve resource and delta state, add a tested explicit create-and-upsert recovery command, switch mode only after creation succeeds, and use a curl command that asserts both status and body.
- 既存所見(PRG/SPC)との相互参照: PRG-028 covers unexecuted real E2E; PRG-032 covers provisioning absence. Neither records this destructive false recovery path. No duplicate.

### UFA-008: The coding-task failure runbook's manual dispatch omits a required workflow input

- 欠陥種別: 実行不能
- 対象成果物: `runbooks/coding-task-failure.md`
- ユーザーが詰まる箇所の再現: The documented `gh workflow run` includes `task_id`, `instruction`, and `base_ref`, but `coding-task.yml` requires `project_id`. The runbook also offers a WebUI rerun path that does not exist in the Web application. A responder following either path cannot complete recovery.
- 証跡 file:line: `runbooks/coding-task-failure.md:15-20`; `runbooks/coding-task-failure.md:31-37`; `.github/workflows/coding-task.yml:29-56`; repository search found no Web coding-task rerun route or component
- 重大度: **HIGH**
- 推奨対処: Publish a copy-paste command with `--repo`, `project_id`, `agent`, shell-safe instruction input, and required auth; either implement the stated UI path or remove it. Add a dry workflow-input contract test.
- 既存所見(PRG/SPC)との相互参照: PRG-014 covers dispatch/callback atomicity and correlation; PRG-039 covers a different missing failure-triage entrypoint. This is a distinct operator command contract. No duplicate.

### UFA-009: Coding callback 4xx responses omit the valid state contract

- 欠陥種別: 前提未記載
- 対象成果物: HTTP API reference and internal coding-task callback errors
- ユーザーが詰まる箇所の再現: The reference says only `status`, while the route accepts exactly `pr_created`, `failed`, or `cancelled`, and only from `running`. `400 invalid status` returns no allowed values. The race-path `409 invalid state transition` omits even current status. A workflow maintainer cannot decide whether to correct payload, wait, reconcile, or stop retrying from the documented contract and response.
- 証跡 file:line: `docs/reference/http-api.md:16-18`; `packages/server/src/http/routes/codingTasks.ts:201-228`; `packages/server/src/http/routes/codingTasks.ts:233-268`; `packages/server/src/db/codingTasksRepo.ts:15-17`
- 重大度: **MED**
- 推奨対処: Document allowed terminal statuses and the `running -> terminal` transition; return a stable error code, current status, allowed next statuses, retryability, and correlation ID on every 4xx.
- 既存所見(PRG/SPC)との相互参照: PRG-014 covers the underlying durability/security race, not caller self-resolution. No duplicate.

### UFA-010: A corrupt upload bypasses the documented row-error model and becomes an uncaught server error

- 欠陥種別: 実行不能
- 対象成果物: Excel guide dry-run error contract and xlsxImport route
- ユーザーが詰まる箇所の再現: The guide describes structured `sheet/row/column/message` errors. The route does not catch workbook-load exceptions. A local `not xlsx` body threw `Can't find end of central directory` instead of returning a self-resolving 4xx. A user cannot distinguish corrupt file, wrong content type, or server failure.
- 証跡 file:line: `docs/guide/excel-import.md:51-66`; `packages/server/src/http/routes/xlsxImport.ts:91-95`; `packages/server/src/http/routes/xlsxImport.ts:136-139`; `packages/shared/src/xlsxImport/parser.ts:158-164`
- 重大度: **MED**
- 推奨対処: Catch workbook format/size/decompression failures at the route boundary and return a stable 400/415/422 code with accepted format, size limit, and next action. Add route tests for corrupt, non-XLSX, and truncated ZIP bodies.
- 既存所見(PRG/SPC)との相互参照: PRG-011 covers absent request-size/abuse controls, not format-error usability. No duplicate.

### UFA-011: The timeseries API reference row is structurally broken by unescaped pipes

- 欠陥種別: 実行不能
- 対象成果物: `docs/reference/http-api.md`
- ユーザーが詰まる箇所の再現: The Markdown table uses literal `|` characters inside the query and response cells. Renderers split one endpoint into extra columns, interleaving period values, persona values, and response prose. A caller cannot reliably determine the accepted query shape from the rendered reference.
- 証跡 file:line: `docs/reference/http-api.md:24-37`, especially line 36
- 重大度: **MED**
- 推奨対処: Escape pipes or replace the row with a fenced request example and a separate parameter table; add Markdown table lint/render validation.
- 既存所見(PRG/SPC)との相互参照: No accepted finding covers reference rendering. No duplicate.

## Six-Group Coverage

### 1. Excel import complete set

| Artifact | Walkthrough result |
| --- | --- |
| `packages/shared/src/xlsxImport/template.ts` and generated workbook | UFA-001/002/003; generated and inspected fully |
| `packages/shared/src/xlsxImport/parser.ts` | UFA-003/010; invalid type probe and corrupt input probe executed |
| `packages/shared/src/xlsxImport/engine.ts` / ledger | UFA-004/005; rerun failure probe executed |
| `packages/server/src/http/routes/xlsxImport.ts` | UFA-010; HMAC/allowlist docs remain PRG-020 |
| `docs/guide/excel-import.md` | UFA-001..005/010; HMAC/allowlist duplicate referenced to PRG-020 |

### 2. All `docs/guide/*.md`

| Guide | Walkthrough result |
| --- | --- |
| `docs/guide/dashboard.md` | It candidly states production provider/E2E gaps; inability is already PRG-004/028, no new finding |
| `docs/guide/excel-import.md` | UFA-001..005/010; PRG-020 reference |
| `docs/guide/reports.md` | Informational descriptions are usable; Seven Keys threshold ambiguity remains SPC-015, no new finding |

### 3. All `docs/reference/*.md`

| Reference | Walkthrough result |
| --- | --- |
| `docs/reference/cli.md` | Template/schema commands exist; traceability command ran successfully; Graph subscription command is UFA-006 |
| `docs/reference/configuration.md` | XLSX variable omission is exactly PRG-020; report/web variables otherwise match current schemas |
| `docs/reference/http-api.md` | XLSX auth errors are PRG-020; callback contract UFA-009; timeseries table UFA-011 |
| `docs/reference/page-agent-tools.md` | Tool names, visibility, ViewSpec paths, and chat prerequisites match current code; no new finding |

### 4. Teams application README

| Artifact | Walkthrough result |
| --- | --- |
| `docs/teams-app/README.md` | Missing icons/legal routes/install flow are exactly PRG-019/032; no duplicate UFA finding |

### 5. All operator-facing `runbooks/*.md`

| Runbook | Walkthrough result |
| --- | --- |
| `runbooks/channel-messages-purge.md` | Lifecycle/subject/12-vs-13-month defects are PRG-043, SPC-013, and SPC-014; SQL flow otherwise traceable |
| `runbooks/coding-task-failure.md` | UFA-008 |
| `runbooks/database-migrations.md` | Commands/paths exist; real PostgreSQL proof and recovery remain PRG-016/026 |
| `runbooks/e2e-real-environment.md` | Stale Excel absence and unexecuted environment are PRG-022/028/032; no duplicate |
| `runbooks/github-projects-v2-webhooks.md` | Actual dispatcher/E2E gaps are PRG-002/028; setup statements otherwise coherent |
| `runbooks/graph-subscription-recovery.md` | UFA-007 |
| `runbooks/manual-ops.md` | Unsafe/stale operations are exactly PRG-021 |
| `runbooks/observability-slo.md` | Missing deployed collection/alerts are exactly PRG-030 |
| `runbooks/production-gates.md` | Incomplete go-live ledger is exactly PRG-031 |
| `runbooks/report-delivery.md` | UFA-006; recipient/provisioning gap is PRG-032 |

### 6. Error-message self-resolution

| Route family | 4xx/invalid-input assessment |
| --- | --- |
| xlsxImport | Confirmation and missing-query messages are actionable; validation rows carry sheet/row/column. Signature/allowlist recovery is PRG-020. Unknown field semantics are UFA-003 and corrupt workbooks are UFA-010. |
| reportIngest | `400 invalid JSON` is direct; `422 invalid report` includes schema details; signing/config paths are present in report workflow/runbook. No new finding. |
| codingTasks | Confirmation token/repo/failsafe remediation is tied to PRG-014/021/032. Callback valid statuses and transition recovery are missing: UFA-009. |

## Deduplication Ledger

| Candidate observed in T34 | Disposition and root-cause comparison |
| --- | --- |
| XLSX HMAC header, signature command, allowlist, config variables absent | **PRG-020**, exact same files and security/documentation root; reference only |
| Teams icons, legal routes, manifest placeholders | **PRG-019**, exact package-installability root; reference only |
| Teams/project/recipient/subscription provisioning absent | **PRG-032**, exact zero-to-working onboarding root; reference only |
| Manual deploy/grant/failsafe/audit guidance wrong | **PRG-021**, exact manual-ops root; reference only |
| E2E says Excel absent and real environment remains unexecuted | **PRG-022/028**, exact stale evidence and unperformed validation roots; reference only |
| Observability runbook has prose alerts but no deployed rules | **PRG-030**, exact observability wiring root; reference only |
| Production-gates runbook lacks complete evidence ledger | **PRG-031**, exact go-live governance root; reference only |
| PII purge handles project closure, not subject requests | **PRG-043**, exact user-centric privacy lifecycle root; reference only |
| 12-month/13-month retention wording | **SPC-013 and SPC-014**, exact retention-contract root; reference only |
| Dashboard production data and real auth/LLM E2E unavailable | **PRG-004/028**, exact provider/environment roots; reference only |
| Seven Keys threshold semantics | **SPC-015**, exact non-canonical threshold root; reference only |

No UFA-001..011 row duplicates an accepted PRG/SPC root cause.

## Validation Summary

- `pnpm --filter @aiops/shared exec vitest run tests/xlsxImport.test.ts`: 19/19 pass
- `pnpm --filter @aiops/server exec vitest run tests/xlsxImportRoutes.test.ts tests/reportIngestRoutes.test.ts tests/codingTaskRoutes.test.ts`: 31/31 pass
- Template generation: pass after sandbox IPC permission approval
- Generated workbook parse: 3 rows / 0 errors
- Invalid field probe: `numbre` + `not-a-number` accepted with 0 errors
- Corrupt workbook probe: uncaught ZIP-format exception
- Remote-write/ledger-failure rerun probe: two runs, two remote creates
- Graph subscription command from docs: exit 1 with eight missing config values before any external call
- Product/docs/spec/audit tracked diff: none
