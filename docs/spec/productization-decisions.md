# Productization Decision Record

- Status: **ACCEPTED**
- Decision date: 2026-07-13
- Decision authority: repository owner instruction in the implementation session
- Applies to: `plans/002-*` through `plans/010-*`, `docs/audit/09-remediation-plan.md`
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

`schema/version.yaml` contains exactly `schema_version`, `generated_at`, and `content_sha256`. The initial production schema is `1.0.0`. The checksum is lowercase SHA-256 over the sorted relative paths and normalized UTF-8 file bytes, excluding `schema/version.yaml`. Unknown files, unknown fields, filename/record-ID mismatches, duplicate canonical IDs, duplicate identity mappings, invalid references, and checksum mismatch fail the whole snapshot. A partial snapshot is never served.

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
- A stale, unknown, inactive, malformed, or out-of-scope selection returns HTTP 403 and no project row, metric, snapshot, or item. Selector order is canonical project ID ascending, then display name ascending; order does not grant access.

The Kanban view is fixed as follows:

- GitHub Projects v2 is the workflow source of truth. The application reads the current reconciled ProjectV2 snapshot through a project-scoped SQL/repository query and never joins in an out-of-scope item after retrieval.
- Columns are the configured ProjectV2 `Status` single-select options in the option order returned for that exact project. Status names are data, not hard-coded English or Japanese workflow semantics. Items without a valid option appear in one final `未分類` column.
- Cards expose only the sanitized fields present in the snapshot contract: stable item ID, item type, title, repository, assignees, labels, and authorized GitHub URL. Closed items remain visible when their ProjectV2 item is active; archived/redacted items and deleted content are excluded.
- Column order, item position, status option ID/name/color, snapshot capture time, and source ProjectV2 node ID are persisted in the sanitized snapshot contract so a board can be reproduced deterministically. Duplicate source item IDs or an unknown status option fail the board response rather than guessing a column.
- The initial application view is read-only. It provides an authorized GitHub Projects deep link for edits. Drag-and-drop and ProjectV2 mutation are deferred until a separate decision defines write permission, optimistic concurrency, audit, idempotency, failure recovery, and accessible keyboard interaction.
- `projectBoard` is a strict ViewSpec navigation instruction, not embedded board data. The server resolves its `projectId`, reauthorizes it, and returns code-derived board JSON. The LLM cannot supply cards, columns, counts, URLs, status, or position.

ENV acceptance requires an immutable mapping from each `PJ-*` ID to one ProjectV2 node ID and authorized GitHub URL, the configured Status field ID and ordered option inventory, GitHub App read permission, positive/negative sandbox projects, and evidence that a foreign or unmapped ProjectV2 node returns no data.

## 3. Accepted environment decisions

### DEC-ENV-001: Microsoft 365 sandbox

Use a dedicated non-production Microsoft 365 tenant. The test app is installed only in one allowlisted sandbox Team and channel with the minimum RSC permissions required by the tested operations. Outlook application access uses Exchange Online Application RBAC scoped by immutable mailbox object identity to one test mailbox. Any unscoped Entra `Mail.Send` application grant is removed before positive testing.

The callback is a public HTTPS endpoint in staging. The exact tenant, app, team, channel, mailbox, recipient, and callback IDs live in the secret/config stores, not Git. A delegated/UI sandbox actor generates ordinary message edit/delete events because app-only success must not be claimed for an unsupported operation. Evidence is redacted and cleanup is mandatory.

ENV acceptance requires positive and negative authorization, subscription create/renew/lifecycle/delta, created/updated/deleted ordering, Outlook send, DB/audit correlation, and cleanup. Local mocks cannot close this gate.

### DEC-ENV-002: Azure staging and production

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

## 4. Official references checked 2026-07-13

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
