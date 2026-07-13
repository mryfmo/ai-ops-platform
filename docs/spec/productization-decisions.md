# Productization Decision Record

- Status: **ACCEPTED**
- Decision date: 2026-07-13
- Decision authority: repository owner instruction in the implementation session
- Applies to: `plans/002-*` through `plans/010-*`, `docs/audit/09-remediation-plan.md`, `docs/adr/0016-azure-platform.md`
- Change rule: any semantic change requires a dedicated decision PR, a threat/data-impact review, and updates to this file and Plan 010 in the same commit.

## 1. Precedence and vocabulary

This file fixes the product and environment choices that earlier plans left open. Later executors must not substitute another design because it is easier to implement.

When documents conflict, use this order:

1. `AGENTS.md` and accepted ADRs;
2. this decision record;
3. `plans/010-recommended-spec-environment-execution.md`;
4. `plans/009-remaining-productization-execution.md` for work not overridden by Plan 010;
5. child Plans 002-008;
6. `docs/audit/09-remediation-plan.md`, which is a historical audit work plan.

The following terms are not interchangeable:

- **SPEC gate**: code must not start until the value is fixed in this record. The decisions below close the named SPEC gates.
- **ENV gate**: the implementation is fixed, but success requires a named sandbox/staging resource, credential, permission, external operation, or human evidence. Missing ENV evidence is `BLOCKED`, not `DONE` and not an implementation choice.
- **human gate**: an accountable person must approve or execute the external operation. An agent may prepare commands and inspect redacted output but must not invent the approval.

## 2. Accepted specification decisions

### DEC-SPEC-001: authoritative PrjOps data contract

The authoritative source is a separate private Git repository conventionally named `prjops-data`. The actual organization/repository URL is an ENV value. Its default branch is `main`; production consumes an immutable 40-character commit SHA, never a floating branch checkout.

The repository layout is fixed:

```text
schema/version.yaml
organizations/ORG-*.yaml
projects/PJ-*.yaml
stakeholders/ST-*.yaml
issues/ISSUE-*.yaml
actions/ACT-*.yaml
status_updates/SU-*.yaml
report_jobs/RPT-*.yaml
seven_keys/questionnaires/*.yaml
seven_keys/snapshots/*.yaml
investor/financial_inputs.yaml
investor/board_pack.yaml
```

`schema/version.yaml` contains exactly `schema_version`, `generated_at`, and `content_sha256`. The initial production schema is `1.0.0`. The checksum algorithm is fixed:

1. Exclude `schema/version.yaml`. Reject a symlink, non-regular file, unknown path, non-UTF-8 byte sequence, UTF-8 BOM, CR/CRLF line ending, non-NFC Unicode, or a file without one final LF.
2. Require every relative path to match the ASCII path/layout patterns above, use `/` separators, contain no `.` or `..` segment, and sort by unsigned ASCII byte order.
3. For each file, compute lowercase SHA-256 over its exact canonical UTF-8 bytes and byte length. Construct one entry with keys in this exact order: `{"path":"<ASCII path>","sha256":"<64 lowercase hex>","size":<base-10 integer>}`.
4. Construct the exact no-whitespace ASCII document `{"files":[<comma-joined entries>]}` followed by one LF. `content_sha256` is lowercase SHA-256 over those bytes.

The contract repository contains golden vectors for empty, one-file, multi-file, ordering, line-ending, BOM, Unicode-normalization, path, symlink, and boundary-collision cases. Unknown files, unknown fields, filename/record-ID mismatches, duplicate canonical IDs, duplicate identity mappings, invalid references, and checksum mismatch fail the whole snapshot. A partial snapshot is never served.

Data ownership is fixed:

- Data Owner approves schema and retention changes.
- PMO Operator authors business records through reviewed pull requests in `prjops-data`.
- The platform runtime has read-only access to the pinned snapshot.
- Updates occur only through a reviewed PR; direct runtime mutation of the repository is forbidden.
- Logical deletion uses `active: false`, `deactivated_at`, and `deactivation_reason`. Physical deletion is allowed only after the retention period and an approved data-erasure record.
- Conflicting concurrent updates are resolved by Git merge before publication. The runtime never merges records.

ENV values still required: exact repository URL, GitHub App installation, owner identities, first accepted commit SHA, and a signed checksum inventory.

### DEC-SPEC-002: stable identity and authorization key

The authorization subject is the ordered pair `(entra_tenant_id, entra_object_id)`, populated from a resource server-validated Microsoft Entra access token `tid` and `oid`. Both values must be canonical lowercase UUID strings. `email`, `preferred_username`, `name`, Teams user ID, and token `sub` are display/delivery/correlation attributes only and must not authorize access.

Rules:

- A missing or malformed `tid` or `oid` is HTTP 401.
- A valid subject absent from the active subject table is HTTP 403.
- A subject from a tenant other than the configured tenant is HTTP 403 before any domain row is fetched.
- Legacy email rows are migrated only through an owner-reviewed mapping file containing old record ID, tenant ID, object ID, and disposition. Duplicate, unresolved, cross-tenant, or inactive mappings abort the entire apply transaction.
- Email changes for the same `(tid, oid)` do not change access. Reuse of the same email by a different subject grants nothing.
- Authorization queries include tenant, object ID, `active = true`, persona, and project scope in SQL or the authoritative provider query. Fetch-all-then-filter and display-layer masking are forbidden.

### DEC-SPEC-003: persona selection and scope

Multiple assigned personas are not silently collapsed to the most privileged persona.

- With exactly one active persona, it is selected.
- With two or more active personas and no valid signed persona cookie, the Web page displays only the selector and APIs return `409 E-AUTH03 persona_selection_required`; no business data is returned.
- A selected persona must exactly match an active assignment for the stable subject on every request. A stale, unknown, cross-tenant, or inactive selection is HTTP 403 and clears no server state.
- Selector order is deterministic: `PRF-01`, `PRF-M`, `PRF-02`, `PRF-L`, `PRF-03`, `PRF-G`, `PRF-04`, `PRF-05/investor`; ties sort by domain then project ID. This order is display-only, never an authorization priority.
- `NULL`, an empty project list, or an unknown scope always means no project access.
- Global project visibility is allowed only for an active `PRF-04` PrjOps assignment or active `PRF-G` DevOps assignment explicitly marked `scope_mode: global` by the authoritative record. No other persona may use global scope.
- `PRF-05` and `investor` are one authorization audience. They see only `invested_project_ids`, code-calculated aggregates, and the existing investor masking rules.
- Active recipient/persona state is re-read for every request and delivery. It is not cached.

### DEC-SPEC-004: PII, residency, and retention

Default data residency is Japan. Production and backups remain in Japan regions unless a stricter signed requirement replaces this decision.

| Data class               | Examples                                         | Store                                              | LLM                                                 | Default retention      |
| ------------------------ | ------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| Authorization identifier | tenant ID, object ID, project assignment         | PostgreSQL and authoritative master                | prohibited                                          | active life + 365 days |
| Contact/display PII      | name, email, language, timezone                  | authoritative master and active delivery row       | prohibited unless replaced by a role label          | active life + 30 days  |
| Raw intake content       | Teams/mail/GitHub text after secret sanitization | controlled raw store                               | only after `sanitizeForLlmInput`, minimum necessary | 90 days                |
| Standard internal report | validated report JSON/HTML                       | PostgreSQL/archive                                 | narrative slots only                                | 5 years                |
| Investor report          | validated investor output                        | immutable archive                                  | narrative slots only                                | 7 years                |
| Audit event              | stable actor ID, action, reason, evidence hash   | append-only PostgreSQL/LTR archive                 | prohibited                                          | 5 years minimum        |
| Smoke/E2E evidence       | hashes, status, duration, request IDs            | `verification/evidence` or approved evidence store | prohibited                                          | 1 year                 |

Raw secrets, access tokens, refresh tokens, message bodies, personal email addresses, names, and nonce values are forbidden in committed evidence. If the configured LLM provider cannot meet the approved retention/data-processing terms, the request fails closed instead of sending PII.

### DEC-SPEC-005: approval identity, nonce, and atomicity

Possession of an approval URL is not approval authority.

- GET and POST require a validated Entra subject from DEC-SPEC-002 and an active project-scoped approval entitlement.
- The approver must match the stored intended approver subject or an explicitly configured project approval role. The requester cannot approve their own request.
- Each approval request stores a random 256-bit nonce hash, UUID `jti`, intended subject, issued time, expiry, status, request subject/type, and requester subject. Raw nonce values are never stored or logged.
- The URL token expires after 30 minutes. Expiry does not expire the business request; an authorized user may issue a new one-time URL while the request is pending and before its business deadline.
- POST requires same-origin validation and a synchronizer CSRF token bound to the authenticated session.
- The decision row, nonce consumption, subject state transition, and append-only audit insert use one PostgreSQL transaction and one injected client. Any failure rolls back all four effects.
- `UNIQUE(jti)` and a compare-and-set `status = 'pending'` predicate make concurrent/replayed POSTs fail with 409. Exactly one transition may enqueue a downstream action.
- Audit actor is `entra:<tid>:<oid>`. Email/name are not stored as the authoritative actor.
- `AGT_CHG` and report approval cards receive the URL from the server composition root. They do not generate or verify tokens.
- Approval never directly grants a deploy/merge credential to an agent process.

### DEC-SPEC-006: traceability namespace

Canonical traceability references have three components: `(system, category, identifier)`. Source and test annotations use `PrjOps:REQ-043`, `PrjOps:SPEC-INT-070`, `PrjOps:AC-043-1`, `DevOps:REQ-033`, and so on. A bare `REQ-*`, `SPEC-*`, `TH-*`, or `AC-*` occurrence does not satisfy a gate when the ID exists in more than one system.

T-P1-06b receives new canonical requirements rather than using `AUD-*` as fake specification IDs:

- `PrjOps:REQ-043`: the traceability gate must distinguish namespaced requirements and disclose that reference presence is not behavioral proof.
- `PrjOps:SPEC-INT-070`: the verifier parses exact canonical references, rejects malformed/bare ambiguous references, and reports source and test coverage separately.
- `PrjOps:AC-043-1`: a fixture with the same bare ID in both systems fails; correctly namespaced references satisfy only their named system.
- `DevOps:REQ-033`, `DevOps:SPEC-INT-084`, and `DevOps:AC-033a` impose the equivalent rule on the DevOps catalog.

The old source documents remain an ENV/document-supply gate for cataloging legacy definitions. They do not block the local T-P1-06b verifier improvement.

### DEC-SPEC-007: snapshots, report metrics, ViewSpec, and narratives

Weekly snapshot periods are half-open intervals in `Asia/Tokyo`: Monday 00:00 inclusive through the next Monday 00:00 exclusive. A weekly value is the last valid measured value at or before the interval end from a record whose project/scope matches exactly. `delta_vs_previous_week = current - previous` only when both values exist and are finite. Otherwise the result is unavailable, never numeric zero.

Unavailable report metrics use this exact shape:

```json
{
  "value": null,
  "unavailable_reason": "missing_current|missing_previous|scope_mismatch|source_error",
  "source": "<stable source id>",
  "as_of": "<ISO-8601>"
}
```

Measured metrics use finite numbers plus the same `source` and `as_of` evidence. The LLM may not populate, alter, or infer either form.

Supported ViewSpec kinds are exactly:

- `executiveSummary`
- `managerSummary` with optional `periodDays` of 7, 14, or 28
- `investorSummary`
- `projectList`
- `timeseries` with `period` of `week|month|quarter|half|year`
- `agentActivity`
- `projectBoard` with required canonical `projectId`

The shared runtime schema rejects unknown keys, embedded data, metrics, labels, URLs, HTML, and unsupported periods. The same parser is used at tool output, stream/UI, page context, initial view, and fetch boundaries. No `as ViewSpec` trust cast is permitted.

Incident burndown remains only in the DevOps/PrjOps manager summary. The UI label is `速報値（インシデント台帳の作成・終了時刻から算出）`; no new AGT_RPT section is added.

AGT-04 narrative slots are data-driven for all PrjOps profiles:

| Profile | Allowed narrative slots                           |
| ------- | ------------------------------------------------- |
| PRF-01  | `own_progress_summary`, `own_next_action`         |
| PRF-02  | `project_health_summary`, `delivery_risk_summary` |
| PRF-03  | `portfolio_summary`, `escalation_summary`         |
| PRF-04  | `executive_summary`, `decision_request_summary`   |
| PRF-05  | `investor_highlight`, `investor_risk_outlook`     |

Slots contain sanitized prose without digits or numeric claims. Missing/invalid prose becomes an empty slot plus an audit warning; code-calculated tables and metrics remain available.

### DEC-SPEC-008: project picker and Kanban operating view

The dashboard requires one common project picker and one Kanban operating view. They reuse the existing authorization and GitHub Projects v2 integration; they do not create a second project registry, workflow state machine, or task database.

Project selection is fixed as follows:

- The canonical project identity is the `PJ-*` ID from DEC-SPEC-001. The GitHub ProjectV2 node ID is an ENV mapping attribute and is never used as the user-facing authorization key.
- The picker options come only from the already subject/persona-scoped project query. A client-supplied `project` URL search parameter is untrusted and is validated against that scoped result on every page and API request before project data is fetched.
- Selection is represented as `?project=PJ-*` so that reload, back/forward navigation, and an authorized shared URL preserve context. `localStorage`, email, a display name, list position, and an unsigned cookie are not authorization inputs.
- Exactly one accessible project is selected automatically. With multiple accessible projects and no valid selection, the page displays the picker without project detail and project-specific APIs return `409 E-AUTH04 project_selection_required`.
- An explicit `all` portfolio option exists only for an active global `PRF-04` or `PRF-G` assignment. It is not accepted by `projectBoard`, which always requires one project.
- A stale, unknown, inactive, cross-tenant, cross-persona, or out-of-scope well-formed selection returns HTTP 403 and no project row, metric, snapshot, or item. Selector order is canonical project ID ascending, then display name ascending; order does not grant access.

Project-specific endpoint selection behavior is fixed by this matrix. `resolved project` means the server resolved the URL value through the active subject/persona-scoped project query before calling the data provider. A missing selection with one accessible project resolves automatically; a missing selection with multiple projects is 409. A syntactically malformed `project` value is 400. A well-formed but unknown, inactive, cross-tenant, cross-persona, or out-of-scope value is 403. These statuses are identical for project-specific page and API entry points and occur before a domain-data query.

| Endpoint/view       | Required context                                   | Request `project=all`               | Picker response behavior                                      |
| ------------------- | -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| project picker/list | no selection; returns scoped `{id,name}` options   | forbidden                           | returns `portfolioAllowed: true` only for global PRF-04/PRF-G |
| project board       | one resolved canonical `PJ-*`                      | forbidden                           | consumes current selection                                    |
| executive summary   | one resolved project or explicit portfolio context | active global `PRF-04` only         | consumes current selection                                    |
| manager summary     | one resolved project or explicit portfolio context | active global `PRF-G` only          | consumes current selection                                    |
| investor summary    | one resolved project                               | forbidden                           | consumes current selection                                    |
| timeseries          | one resolved project or explicit portfolio context | active global `PRF-04`/`PRF-G` only | consumes current selection                                    |
| agent activity      | one resolved project or explicit portfolio context | active global `PRF-G` only          | consumes current selection                                    |

`GET /api/data/projects` returns `{domain,projects,portfolioAllowed}` only when the `project` parameter is absent. If the parameter is present one or more times, including an empty, valid, malformed, or `all` value, it returns HTTP 400 `E-AUTH05 unexpected_project_parameter` before any domain-data query. The UI, not the API, synthesizes the `all` option only when `portfolioAllowed` is true. `projectList` is the picker/list view and does not read project-detail data. Existing summary ViewSpecs use the already resolved URL context; they do not accept a second LLM-supplied project ID. `projectBoard` contains a project ID only to navigate to a single board, and the server re-resolves it using the same policy.

The Kanban view is fixed as follows:

- GitHub Projects v2 is the workflow source of truth. The application reads the current reconciled ProjectV2 snapshot through a project-scoped SQL/repository query and never joins in an out-of-scope item after retrieval.
- The signed ENV inventory is the column-order source of truth. It contains the exact ProjectV2 Status field ID and each option's ID, name, color, and zero-based ordinal. A GraphQL read must return the same field ID and option ID/name/color set. A missing Status field value on an item goes to one final `未分類` column. An item with a non-null option ID absent from the signed inventory, or any added/deleted/renamed/recolored option, fails the complete response with 503 `E-BOARD03 status_inventory_mismatch`; it is never guessed into `未分類`.
- Cards expose only the sanitized fields present in the snapshot contract: stable item ID, item type, title, repository, assignees, labels, and authorized GitHub URL. Closed items remain visible when their ProjectV2 item is active; archived/redacted items and deleted content are excluded.
- The GraphQL request orders ProjectV2 items by `POSITION ASC`. The application persists the zero-based ordinal in that paginated response as `item_position`; it does not assume a nonexistent scalar position field. Column ordinal from the signed inventory, item ordinal, status option ID/name/color, snapshot capture time, and source ProjectV2 node ID are persisted in the sanitized snapshot contract so a board can be reproduced deterministically. Project `updatedAt` is read before and after pagination; a change, duplicate source item ID, missing page, cursor loop, or inventory mismatch discards the whole snapshot.
- The initial application view is read-only. It provides an authorized GitHub Projects deep link for edits. Drag-and-drop and ProjectV2 mutation are deferred until a separate decision defines write permission, optimistic concurrency, audit, idempotency, failure recovery, and accessible keyboard interaction.
- `projectBoard` is a strict ViewSpec navigation instruction, not embedded board data. The server resolves its `projectId`, reauthorizes it, and returns code-derived board JSON. The LLM cannot supply cards, columns, counts, URLs, status, or position.

ENV acceptance requires an immutable mapping from each `PJ-*` ID to one ProjectV2 node ID and authorized GitHub URL, an owner-signed Status field/ordered option inventory, GitHub App read permission, positive/negative sandbox projects, and evidence that a foreign or unmapped ProjectV2 node returns no data. A Status option change is an ENV configuration change: the board remains 503 until the owner approves a new signed inventory and the positive/negative snapshot verification passes.

## 3. Accepted environment decisions

### DEC-ENV-001: Microsoft 365 sandbox

Use a dedicated non-production Microsoft 365 tenant. The test app is installed only in one allowlisted sandbox Team and channel with the minimum RSC permissions required by the tested operations. Outlook application access uses Exchange Online Application RBAC scoped by immutable mailbox object identity to one test mailbox. Any unscoped Entra `Mail.Send` application grant is removed before positive testing.

The callback is a public HTTPS endpoint in staging. The exact tenant, app, team, channel, mailbox, recipient, and callback IDs live in the secret/config stores, not Git. A delegated/UI sandbox actor generates ordinary message edit/delete events because app-only success must not be claimed for an unsupported operation. Evidence is redacted and cleanup is mandatory.

ENV acceptance requires positive and negative authorization, subscription create/renew/lifecycle/delta, created/updated/deleted ordering, Outlook send, DB/audit correlation, and cleanup. Local mocks cannot close this gate.

### DEC-ENV-002: Azure staging and production

ADR-0016 records this accepted architecture and supersedes only the cloud-undecided portions of ADR-0003/0005 and the undecided backup/provider portions of Proposed ADR-0015.

The platform baseline is:

- Azure Container Apps for server/web runtime;
- Azure Container Registry with immutable digest deployment, SBOM, and provenance;
- Azure Database for PostgreSQL Flexible Server;
- Azure Key Vault references through user-assigned managed identities;
- Azure Front Door Premium with WAF as the only public origin path;
- private PostgreSQL networking and private endpoints where supported;
- Log Analytics and Application Insights for logs, metrics, traces, and alerts;
- Bicep as the only infrastructure definition.

Primary region is Japan East. Japan West is the disaster-recovery region. Staging and production use separate subscriptions when available; at minimum they use separate resource groups, managed identities, vaults, databases, Container Apps environments, and federated GitHub environments. Production values may not be reused by staging.

Container Apps uses multiple revision mode. Deployment stages are 0% (direct-label smoke), 10%, 50%, and 100%. A stage advances only after startup/readiness/liveness probes, synthetic transaction, error-rate, latency, and audit-correlation checks pass. Rollback moves traffic to the previous digest; it never rebuilds an old tag.

PostgreSQL automated backup retention is 35 days. Geo-redundant backup is selected at server creation. Weekly Azure Backup long-term retention is 5 years for audit obligations. Acceptance includes PITR to a new clean server, schema/role/network restoration, row counts and checksums, application reconnection, and measured RPO/RTO. Targets are same-region RPO <= 5 minutes/RTO <= 60 minutes and regional DR RPO <= 60 minutes/RTO <= 4 hours.

Availability target is 99.9% monthly for the authenticated application path. Alerts must cover availability, p95 latency, 5xx rate, queue age, failed jobs, delivery failures, DB saturation, Graph subscription expiry, budget/failsafe activation, and backup/restore failures. Every alert has severity, owner, runbook, paging target, and acknowledgement escalation.

### DEC-ENV-003: GitHub governance and this merge exception

Normal operation requires pull requests, required status checks, conversation resolution, CODEOWNERS approval by `@mryfmo`, stale-approval dismissal, no force push/deletion, and no bypass for GitHub Apps or administrators. The minimal GitHub App token is used for repository reads and draft PR creation; agents do not receive merge or deployment credentials.

The repository owner's 2026-07-13 instruction is a one-time exception allowing the orchestrator to merge the PR that records these decisions and collected audit artifacts after CI and independent negative review. It does not authorize automatic merging of later implementation, dependency, staging, or production PRs. Branch protection and human-review enforcement must be restored/verified immediately after the exception merge.

Dependency major versions are isolated into one migration PR per dependency family. Dependabot groups only compatible minor/patch updates and limits concurrent version PRs to three.

## 4. Alternatives rejected and reconsideration triggers

The following options were considered and are not implementation choices for Plan 010. A later executor may not select one merely because an ENV value is missing. Reconsideration requires the named trigger, a replacement decision/ADR, impact and threat review, migration/rollback design, and owner approval.

### Specification alternatives

| Decision     | Rejected alternative                                                    | Why it is not the recommendation                                                                                               | Tradeoff accepted by the recommendation                                          | Reconsider only when                                                                                                            |
| ------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| DEC-SPEC-001 | Keep authoritative PrjOps records in this application repository        | Couples releases and business-data changes, broadens runtime repository access, and makes ownership/history boundaries unclear | A separate repository adds GitHub App setup and pinned-snapshot publication work | A single-repository design proves separate ownership, immutable publication, least privilege, and rollback with less total risk |
| DEC-SPEC-001 | Make PostgreSQL the authoring source                                    | Requires a new mutation UI/API, conflict workflow, history export, and data-owner operating model that are not present         | Git review is less convenient for high-frequency edits                           | Measured edit volume makes reviewed Git changes unworkable and a replacement authoring/audit design is accepted                 |
| DEC-SPEC-001 | Continue with bundled sample YAML or Excel as production truth          | Samples are incomplete and Excel imports are an intake mechanism, not an authoritative versioned snapshot                      | Operators must maintain the `prjops-data` contract                               | Never without a new authoritative-source decision; samples remain test-only                                                     |
| DEC-SPEC-002 | Authorize by email or `preferred_username`                              | Both are mutable and reusable and can cross organizational identity changes                                                    | Stable IDs require an owner-reviewed legacy mapping                              | Never for authorization; they remain display/delivery attributes                                                                |
| DEC-SPEC-002 | Authorize by token `sub` alone                                          | `sub` is application-specific and does not replace the tenant/object pair required for cross-service correlation               | `(tid,oid)` validation is stricter                                               | Only if Microsoft changes the stable resource-server identity contract and a replacement threat review is accepted              |
| DEC-SPEC-002 | Authorize by Teams user ID                                              | It is channel/delivery correlation, not the verified Web resource-server subject                                               | Teams/Web correlation needs an explicit mapping                                  | Never as the sole authorization key                                                                                             |
| DEC-SPEC-003 | Silently choose the first or most privileged persona                    | Makes list order an authorization decision and enables accidental privilege elevation                                          | Users with multiple assignments must select once                                 | Only if the product removes simultaneous personas rather than prioritizing them                                                 |
| DEC-SPEC-003 | Merge all assigned personas into a union scope                          | Violates least privilege and obscures which business role justified a response                                                 | Separate persona contexts require an extra selector                              | Only with a new explicit composite-role model, SoD analysis, and auditable purpose binding                                      |
| DEC-SPEC-004 | Store all raw content indefinitely                                      | Conflicts with data minimization and increases breach and subject-request exposure                                             | Short retention can limit later forensic detail                                  | A legal/records owner approves a longer class-specific period and deletion/hold controls                                        |
| DEC-SPEC-004 | Use any available region                                                | Makes residency non-deterministic and weakens vendor/subprocessor review                                                       | Japan residency may cost more and reduce SKU choice                              | The data owner and legal/security owners approve a replacement residency assessment                                             |
| DEC-SPEC-005 | Reuse the deterministic task-ID HMAC link for approval                  | A transferable link is not intended-approver authentication and does not provide one-time state                                | Stateful nonce/jti storage and CSRF are required                                 | Never for a privileged decision; HMAC links may remain for non-authorizing correlation                                          |
| DEC-SPEC-005 | Write decision and audit in separate transactions                       | A crash can create a decision without evidence or evidence without a decision                                                  | One transaction requires a shared DB client boundary                             | Only if an equivalent atomic outbox/ledger protocol is proved under injected failures                                           |
| DEC-SPEC-005 | Use a 72-hour reusable approval URL                                     | Enlarges theft/replay exposure and conflicts with at-most-once semantics                                                       | Thirty minutes requires reissue support                                          | A measured workflow need and compensating authentication justify a different signed expiry decision                             |
| DEC-SPEC-006 | Keep bare IDs where PrjOps and DevOps collide                           | A reference can satisfy the wrong system and presence can be mistaken for behavioral proof                                     | Existing annotations need a mechanical namespace migration                       | Never while catalogs contain colliding IDs                                                                                      |
| DEC-SPEC-006 | Use `AUD-*` findings as specification IDs                               | Audit observations describe gaps; they are not product requirements or acceptance authority                                    | New canonical IDs must be reviewed and cataloged                                 | Only if the formal specification system itself is replaced by an approved model                                                 |
| DEC-SPEC-007 | Treat missing metrics as numeric zero                                   | Produces a false business claim and hides source failure                                                                       | Consumers must handle a typed unavailable form                                   | Never unless the metric definition proves missing is semantically zero                                                          |
| DEC-SPEC-007 | Let the LLM emit metrics or embedded ViewSpec data                      | Makes numeric and authorization-sensitive UI content nondeterministic                                                          | More code/schema work is required                                                | Never for numeric or authorization-bearing fields under the current design principles                                           |
| DEC-SPEC-007 | Keep six ViewSpec kinds and link directly to GitHub for every board use | Prevents authorized in-dashboard project operations and consistent page-agent navigation                                       | A seventh strict kind adds schema, route, and tests                              | The product removes the Kanban dashboard requirement                                                                            |
| DEC-SPEC-008 | Store selection in `localStorage` or an unsigned cookie                 | It is not shareable server context and can be forged or stale across personas                                                  | URL state requires explicit validation and propagation                           | Only as a non-authorizing display preference layered over the same server resolver                                              |
| DEC-SPEC-008 | Default multi-project users to an aggregate                             | Can mix projects without a deliberate context choice and leaks meaning across role changes                                     | Multiple-project users must choose or explicitly choose authorized `all`         | User research plus a replacement authorization decision proves an aggregate default is safe                                     |
| DEC-SPEC-008 | Build a separate Kanban database/workflow                               | Creates dual truth, reconciliation, mutation, and audit failure modes beside GitHub Projects v2                                | Read performance depends on reconciled snapshots                                 | GitHub Projects v2 demonstrably cannot meet an accepted operating requirement and migration ownership is approved               |
| DEC-SPEC-008 | Enable drag-and-drop immediately                                        | Write authorization, concurrency, idempotency, recovery, audit, and keyboard accessibility are undefined                       | Initial board edits require opening GitHub                                       | A dedicated write-boundary decision and adversarial/accessibility acceptance are complete                                       |

### Environment and governance alternatives

| Decision    | Rejected alternative                                       | Why it is not the recommendation                                                                                    | Tradeoff accepted by the recommendation                            | Reconsider only when                                                                                                   |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| DEC-ENV-001 | Test Graph in the production tenant                        | Risks real messages, broad consent, and unbounded cleanup impact                                                    | A dedicated tenant costs setup and license effort                  | Never for destructive/negative acceptance; a later production read-only verification needs a separate approved runbook |
| DEC-ENV-001 | Grant tenant-wide `Mail.Send` or `ChannelMessage.Read.All` | Violates least privilege and makes negative scope proof impossible                                                  | RSC and Exchange Application RBAC add configuration work           | Microsoft removes the scoped mechanism and security accepts documented compensating controls                           |
| DEC-ENV-001 | Claim app-only edit/delete success from mocks              | Microsoft method support and tenant behavior cannot be proved locally                                               | A delegated/UI sandbox actor is required for those events          | Microsoft officially supports and the sandbox proves an app-only replacement                                           |
| DEC-ENV-002 | AWS or another cloud baseline                              | Leaves the Microsoft-centered identity/operations stack and accepted Azure design unresolved                        | Azure coupling and service cost are accepted                       | A replacement ADR proves equal or better identity, network, release, backup, DR, cost, and E2E controls                |
| DEC-ENV-002 | Self-managed Kubernetes or virtual machines                | Adds cluster/host patching, HA, ingress, secrets, and rollout operations without a current requirement              | Container Apps imposes platform constraints                        | A measured workload/compliance gap cannot be met by Container Apps and operating ownership is funded                   |
| DEC-ENV-002 | Azure App Service                                          | Matches HTTP hosting but less directly matches the accepted container job, revision-label, and staged traffic model | Container Apps requires its own networking/observability expertise | A validated App Service design meets every rollout, private-network, job, probe, and rollback criterion more simply    |
| DEC-ENV-002 | Self-managed pgBackRest as the default                     | Duplicates managed PITR/geo-backup operations and increases credential/storage/restore ownership                    | Managed services create provider coupling                          | Managed backup cannot meet an approved retention/export/account-loss requirement                                       |
| DEC-ENV-003 | Let agents merge all future PRs                            | Removes accountable review from auth, data, infrastructure, and production changes                                  | Human review throughput remains an operating constraint            | Repository governance is replaced by an approved risk-tiered merge policy and protected automation identity            |
| DEC-ENV-003 | Combine unrelated dependency majors                        | Hides migration causes and makes rollback/review ambiguous                                                          | More PRs are required                                              | The versions form one inseparable compatibility migration with one rollback and test matrix                            |
| DEC-ENV-003 | Direct-push the decision artifacts                         | Bypasses hosted checks, review evidence, and branch protection                                                      | The one-time merge still requires a PR and green gates             | Never under the current repository rules                                                                               |

## 5. Official references checked 2026-07-13

- Microsoft Entra access token claims (`tid`, immutable `oid`, `uti`): https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference
- Microsoft identity platform access token validation and tenant-key guidance: https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
- Exchange Online Application RBAC and `Test-ServicePrincipalAuthorization`: https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
- Teams resource-specific consent: https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent
- Teams message change notifications and lifecycle URL requirement: https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage
- Microsoft Graph lifecycle notifications: https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events
- Azure Container Apps Key Vault references and managed identity: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets
- Azure Container Apps revisions: https://learn.microsoft.com/en-us/azure/container-apps/revisions
- Azure Container Apps traffic splitting: https://learn.microsoft.com/en-us/azure/container-apps/traffic-splitting
- Azure Container Apps health probes: https://learn.microsoft.com/en-us/azure/container-apps/health-probes
- Azure Database for PostgreSQL backup, PITR, geo restore, and LTR: https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore
- PostgreSQL all-or-nothing transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
- GitHub protected branches and required reviews: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub Projects table, board, and roadmap layouts: https://docs.github.com/en/issues/planning-and-tracking-with-projects
- GitHub ProjectV2 GraphQL fields, items, single-select options, and permissions: https://docs.github.com/en/graphql/reference/projects
- Accepted Azure platform architecture: [ADR-0016](../adr/0016-azure-platform.md)
