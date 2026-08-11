# Production Readiness Gap Audit

- Task: T30
- Audited commit: `21306d8`
- Audit date: 2026-07-10
- Method: read-only adversarial review across specification, documentation, implementation, and verification
- Scope: repository-wide; generated dependencies/build output were excluded from source review

## Executive Summary

`mise run ci` is green, but the repository is not production-ready. The largest blockers are not isolated defects: the fresh PostgreSQL schema cannot provide a working audit log, the resident server does not execute the advertised DevOps agents, the deploy workflow performs no deployment, and PrjOps has neither a production data provider nor scheduled analysis/tracking runtime. Several public boundaries and operational controls also remain incomplete.

### Severity by Surface

| Severity | Specification | Documentation | Implementation | Verification | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| CRITICAL | 0 | 0 | 4 | 0 | 4 |
| HIGH | 3 | 10 | 20 | 5 | 38 |
| MED | 0 | 1 | 6 | 1 | 8 |
| LOW | 0 | 0 | 0 | 0 | 0 |
| **Total** | **3** | **11** | **30** | **6** | **50** |

### Go-live Verdict

**NO-GO.** PRG-001 through PRG-005 are direct production blockers. Green unit/DI tests do not exercise the failing production composition, schema, hosted workflows, or real external systems.

## 4 Surfaces x 6 Lenses Coverage

Every cell below records a finding or an explicit checked result.

| Surface | Lens | Result and evidence |
| --- | --- | --- |
| Specification | Operability | Gap: deployment target, RPO/RTO, rollout, capacity, and operational acceptance are not specified (PRG-025). |
| Specification | Reliability | Gap: canonical older requirements are absent, so failure-mode and recovery semantics cannot be independently checked (PRG-023, PRG-025). |
| Specification | Security | Gap: security IDs exist, but most older source text is outside the repository and cannot be audited for complete trust-boundary requirements (PRG-023). |
| Specification | Specification completeness | Gap: older IDs are bare strings and traceability is lexical, while AC coverage remains incomplete (PRG-023, PRG-024). |
| Specification | Verification completeness | Gap: the gate does not require AC test references or semantic requirement-to-test mappings (PRG-024). |
| Specification | Documentation effectiveness | Gap: an operator cannot resolve older IDs to canonical text from this repository (PRG-023). |
| Documentation | Operability | Gaps: no backup/restore/DR, production topology/upgrade, complete go-live checklist, or provisioning flow (PRG-016, PRG-017, PRG-031, PRG-032). |
| Documentation | Reliability | Gaps: recovery instructions assume unavailable controls and stale behavior (PRG-016, PRG-021). |
| Documentation | Security | Gaps: secret rotation/supply, a complete env template, and user-centric PII deletion/correction are undefined, while XLSX/manual-operation guidance is stale (PRG-018, PRG-020, PRG-021, PRG-043). |
| Documentation | Specification completeness | Gap: verification and runtime claims contradict current files and counts (PRG-022, PRG-038). |
| Documentation | Verification completeness | Gap: the main verification report is stale and `verify:all` points to a missing script (PRG-022, PRG-038). |
| Documentation | Documentation effectiveness | Gaps: Teams package, API guide, manual runbook, E2E guide, go-live, env setup, onboarding, and PII subject handling are not executable end to end (PRG-019 through PRG-022, PRG-031, PRG-032, PRG-043). |
| Implementation | Operability | Gaps: deployment/job workflows are placeholders, inactive, or reference a missing entrypoint; GitHub auth is transitional; alerts and non-audit event-store retention are not operated (PRG-003, PRG-006, PRG-012, PRG-030, PRG-036, PRG-039, PRG-046). |
| Implementation | Reliability | Gaps: invalid audit schema, shallow readiness/failsafe, per-request DB pools, non-atomic dispatch, hidden dead letters, replica-duplicated schedulers, an expiring holiday calendar, and non-atomic delivery claims remain (PRG-001, PRG-008, PRG-013 through PRG-015, PRG-041, PRG-042, PRG-047). |
| Implementation | Security | Gaps: sample authorization data, unenforced audit privileges, unsanitized queue payloads, unbounded bodies, transitional tokens, public metrics, cross-project report delivery, floating actions, non-identifying actors, unhardened containers, and latent HTML injection remain (PRG-005, PRG-009 through PRG-012, PRG-034, PRG-044, PRG-045, PRG-048 through PRG-050). |
| Implementation | Specification completeness | Gaps: DevOps handlers, PrjOps runtime/data, report metrics, DORA deltas, and incident-ticket semantics do not implement stated behavior (PRG-002, PRG-004, PRG-007, PRG-035, PRG-040). |
| Implementation | Verification completeness | Gap: production-only code paths contain admitted placeholders, a missing entrypoint, or untested scale/replica/tenant/time/security assumptions (PRG-001 through PRG-008, PRG-027, PRG-033, PRG-039 through PRG-050). |
| Implementation | Documentation effectiveness | Gap: code comments explicitly describe multiple production paths as sample, disabled, provisional, missing, or unverified; those caveats are not surfaced consistently to operators (PRG-004, PRG-006, PRG-012, PRG-020, PRG-039, PRG-040). |
| Verification | Operability | Gaps: no hosted workflow/container validation, so a missing workflow entrypoint passes; real-environment E2E, load test, and web coverage gates are also absent (PRG-027 through PRG-029, PRG-033, PRG-039). |
| Verification | Reliability | Gaps: no real PostgreSQL/schema test, composition-root test, external E2E, or scale test (PRG-026 through PRG-029). |
| Verification | Security | Gaps: production DB roles, external identity/webhooks, dependency advisories, report tenant isolation, action pinning, actor attribution, container hardening, and sibling HTML paths are not gated (PRG-026, PRG-028, PRG-037, PRG-044, PRG-045, PRG-048 through PRG-050). |
| Verification | Specification completeness | Gaps: tests do not prove the production composition or all ACs (PRG-026, PRG-027, PRG-033). |
| Verification | Verification completeness | Gaps: PRG-026 through PRG-029, PRG-033, PRG-037, and PRG-039. |
| Verification | Documentation effectiveness | Confirmed gap: `requires-real-env` work remains open and the report does not reflect the current 985-test observation (PRG-022, PRG-028). |

## Findings

### PRG-001: Make the fresh PostgreSQL audit schema executable

- **Surface / lens / severity**: Implementation / Reliability / **CRITICAL**
- **Evidence**: `packages/devops/src/db/schema.sql:186-216` defines `audit_log` as range partitioned with `PRIMARY KEY (log_id)`, but a PostgreSQL partitioned unique/primary key must include the partition key `at`; only a commented sample partition exists. `packages/server/src/db/pgAuditLog.ts:28-32` inserts every audit record into this table.
- **Why production needs it**: Fresh schema application or the first audit insert fails, taking down security, webhook rejection, scheduler, delivery, and recovery paths that all require audit writes.
- **Recommended follow-up**: Add a real schema-level integration test against supported PostgreSQL; correct the key/partition design; create a default/current/future partition strategy; prove insert and rollover before any other runtime work.

### PRG-002: Wire actual DevOps agents into the event dispatcher

- **Surface / lens / severity**: Implementation / Specification completeness / **CRITICAL**
- **Evidence**: `packages/server/src/index.ts:194-226` supplies `AGT_BLD`, `AGT_DEP`, and `AGT_INC` handlers that only append `github_event_received`. The implemented agent functions are exported from `packages/devops/src/index.ts:13-19` but have no runtime callers; repository search finds no calls to `classifyBuildFailure`, `triageAndNotify`, or the deploy/change execution functions from server/web.
- **Why production needs it**: Signed GitHub events are marked done without performing the advertised classification, incident response, deployment, or change-management behavior.
- **Recommended follow-up**: Define per-event production adapters, load required data, call each agent function, persist outcomes, and add composition tests proving side effects rather than audit-only dispatch.

### PRG-003: Replace the no-op deployment path with a real release pipeline

- **Surface / lens / severity**: Implementation / Operability / **CRITICAL**
- **Evidence**: `packages/devops/src/workflows/deploy-prod.yml:36-41` only echoes a ref and a monitoring message. The file is under `packages/.../src/workflows`, not active `.github/workflows`; `packages/devops/src/agents/AGT_DEP.ts:90,141` dispatches `deploy-prod.yml` as though installed.
- **Why production needs it**: A reported successful production deployment performs no artifact build, deployment, health verification, rollback, or event publication.
- **Recommended follow-up**: Select the deployment platform, implement artifact promotion and environment protection, publish the workflow to every managed repository, wire monitoring/rollback, and validate with a non-production canary.

### PRG-004: Build the missing PrjOps production runtime and data adapters

- **Surface / lens / severity**: Implementation / Specification completeness / **CRITICAL**
- **Evidence**: `docs/adr/0003-devops-runtime.md:22-28` admits analyze/track/remind jobs are unscheduled. `packages/web/src/server/personaResolver.ts:74-85` and `packages/web/src/server/reportData/prjopsReportData.ts:69-85` provide only interfaces/in-memory fixtures. Routes instantiate empty providers, for example `packages/web/src/app/api/data/executive-summary/route.ts:29-37`; `packages/server/src/index.ts:354-362` disables monthly Seven Keys snapshots.
- **Why production needs it**: PrjOps users cannot resolve a persona, see project data, run analysis/tracking, or produce the advertised reports.
- **Recommended follow-up**: Implement the `prjops-data` checkout/API providers, a durable audit writer, scheduled collect/analyze/track/report jobs, and production composition tests with representative data.

### PRG-005: Remove sample stakeholder data from the production authorization boundary

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/server/src/index.ts:122-136` embeds `SAMPLE_STAKEHOLDERS`; `packages/server/src/index.ts:228-239` uses it to authorize Teams callers. The real sample YAML is not loaded by any runtime (`packages/prjops/src/data/README.md:3-8`).
- **Why production needs it**: Real users are denied or authorization depends on fixture identity instead of the current stakeholder master, making the Teams command boundary non-production.
- **Recommended follow-up**: Inject a production stakeholder provider, fail closed on unavailable/stale data, add tenant/project membership tests, and prohibit fixture providers in production startup.

### PRG-006: Install and validate the agent CLIs used by hosted workflows

- **Surface / lens / severity**: Implementation / Operability / **HIGH**
- **Evidence**: `.github/actions/run-coding-agent/action.yml:6-8,23-50` says both CLI invocations are unverified and calls `claude`/`droid` without installing them. `.github/workflows/report-generation.yml:60-90` does the same. `.github/workflows/coding-task.yml:25-26` states only syntax was checked.
- **Why production needs it**: Coding-task and standard-report workflows fail at the first agent invocation on a clean GitHub-hosted runner.
- **Recommended follow-up**: Use supported pinned actions/installers, validate exact CLI flags/auth, add workflow smoke tests, and remove unverified alternatives until they pass.

### PRG-007: Source standard-report metrics from production data and fail closed when absent

- **Surface / lens / severity**: Implementation / Specification completeness / **HIGH**
- **Evidence**: `packages/shared/src/reporting/calculateReportMetrics.ts:7-16` defaults absent metrics to zero. `.github/workflows/report-generation.yml:50-58` supplies no metric environment/data source, and lines 104-106 treat missing ingest configuration as successful skip.
- **Why production needs it**: Scheduled reports can assert zero completed/blocked work and complete successfully without reaching the platform.
- **Recommended follow-up**: Query a versioned snapshot/API, represent missing metrics as unavailable, require ingest in production mode, and test the actual workflow data path.

### PRG-008: Make health, readiness, and failsafe reflect all critical dependencies

- **Surface / lens / severity**: Implementation / Reliability / **HIGH**
- **Evidence**: `packages/server/src/index.ts:252-268` checks only `SELECT 1` and supplies `activateFailsafe: async () => {}`. `packages/server/src/http/routes/health.ts:13-23` checks no schema version or external dependency. Failsafe is an in-memory boolean (`packages/server/src/index.ts:242-264`) and auto-clears after a healthy DB check (`packages/server/src/scheduler/tasks/healthcheckTask.ts:39-52`). The stop mechanism itself exists: `guardFailsafeTask` wraps event/reconcile/snapshot/report jobs (`packages/server/src/index.ts:244-249,295-383`) and coding-task/XLSX/report routes check the flag; healthcheck, JIT revocation, subscription renewal, and channel polling intentionally remain outside that wrapper.
- **Why production needs it**: GitHub/Graph/agent outages do not activate failsafe, restart loses state, all-project notification is absent, and an outdated schema can report ready.
- **Recommended follow-up**: Preserve the existing guards; extend dependency health policy, persist/acknowledge state, verify schema version, implement required notifications, decide and document the four unguarded tasks, and add double-signal real integration tests.

### PRG-009: Enforce append-only audit privileges in executable DDL

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/devops/src/db/schema.sql:198-201` contains only commented `REVOKE`/`GRANT`; `packages/server/src/db/pgAuditLog.ts:4-7` claims the restriction is enforced by that comment. No role/bootstrap DDL exists.
- **Why production needs it**: The application role can retain owner/default UPDATE/DELETE privileges, so append-only audit guarantees are not enforced at the database trust boundary.
- **Recommended follow-up**: Create owner/migrator/app roles, executable grants/revokes and sequence privileges, then test denied UPDATE/DELETE with the real app role.

### PRG-010: Sanitize GitHub payloads before the first database write

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/server/src/http/routes/githubWebhook.ts:46-69` passes parsed external payload directly to enqueue; `packages/server/src/db/eventsRepo.ts:99-120` serializes it into `events.payload` without `sanitizeSecrets`. This conflicts with `AGENTS.md:43-44`. Later `pm_events` sanitation does not remove the first unsanitized copy, while sibling persistence boundaries explicitly sanitize/refuse secrets (`packages/server/src/db/pmTimeseriesRepo.ts:37-49`, `packages/server/src/db/pgAuditLog.ts:19-30`).
- **Why production needs it**: HMAC proves GitHub origin, not secret-free content: legitimate issue/PR/workflow fields can contain accidentally pasted credentials. They are retained before the required first-layer defense. The queue payload is not sent directly to an LLM, but persistent secret exposure and inconsistent trust-boundary enforcement justify HIGH.
- **Recommended follow-up**: Sanitize structured payloads at enqueue, preserve only required fields where possible, and add regression tests containing secret-like values.

### PRG-011: Add request-size and abuse controls at public boundaries

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/server/src/http/routes/xlsxImport.ts:51`, `packages/server/src/http/routes/githubWebhook.ts:30`, `packages/server/src/http/routes/reportIngest.ts:40`, `packages/server/src/http/routes/graphNotifications.ts:87`, `packages/server/src/http/routes/codingTasks.ts:217`, and `packages/web/src/app/api/chat/route.ts:48` fully buffer/parse bodies. Repository search found no body limit, content-length guard, 413 handling, or general rate limiter.
- **Why production needs it**: Internet-reachable routes can exhaust memory/CPU before HMAC/auth checks; XLSX parsing and chat are especially expensive.
- **Recommended follow-up**: Set proxy and app limits by route, reject oversized content before buffering, rate-limit expensive authenticated actions, and test 413/429 behavior.

### PRG-012: Replace the unvalidated static GitHub token fallback

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/server/src/index.ts:181-184` returns `process.env.GITHUB_TOKEN ?? ""`; `packages/server/src/config.ts:14-90` does not validate it. `docs/adr/0005-resident-server-and-teams-integration.md:73-74` calls GitHub App installation-token exchange a remaining task.
- **Why production needs it**: Startup/readiness succeeds with no GitHub credential, while a broad long-lived token may be used without rotation or installation scoping.
- **Recommended follow-up**: Implement GitHub App JWT-to-installation-token exchange, validate app configuration at startup, cache tokens only to expiry, and add rotation/revocation runbooks.

### PRG-013: Reuse a bounded Web PostgreSQL pool

- **Surface / lens / severity**: Implementation / Reliability / **HIGH**
- **Evidence**: Eight production files instantiate `new pg.Pool`, including `packages/web/src/app/api/chat/route.ts:31-46` and `packages/web/src/app/dashboard/page.tsx:54-60`; no `pool.end()` or shared pool module exists, and Web does not use server pool timeouts.
- **Why production needs it**: Requests/reloads can create many default pools and exhaust PostgreSQL connections, amplifying cost-guard lock pressure.
- **Recommended follow-up**: Use one process-level bounded pool with timeouts, expose pool metrics, and load-test concurrent routes.

### PRG-014: Make coding-task dispatch and callback delivery recoverable

- **Surface / lens / severity**: Implementation / Reliability / **HIGH**
- **Evidence**: `packages/server/src/http/routes/codingTasks.ts:168-184` dispatches GitHub before marking the DB row running, leaving a duplicate-dispatch window on DB failure. `.github/workflows/coding-task.yml:182,199,215` uses `curl -sS` without `-f`, so rejected callbacks can still leave the workflow green. Confirm tokens are deterministic and have no expiry (`packages/server/src/lib/confirmToken.ts:16-32`).
- **Why production needs it**: Workflows can run while the ledger stays queued, be dispatched again, or finish without recording terminal state.
- **Recommended follow-up**: Add an outbox/idempotency/reconciliation design, use callback request correlation and `curl -f`, and expire one-time confirmation records.

### PRG-015: Expose and operate the dead-letter queue

- **Surface / lens / severity**: Implementation / Reliability / **HIGH**
- **Evidence**: `packages/server/src/db/eventsRepo.ts:240-244` excludes `dead` from queue metrics, while `packages/server/src/observability/metrics.ts:13,73-81` resets `dead` to zero. No replay/requeue tool or dead-letter runbook exists.
- **Why production needs it**: Poison events silently accumulate while the exported dead gauge remains zero; operators cannot inspect/replay them safely.
- **Recommended follow-up**: Include dead counts/age, alert on any new dead event, add an audited replay/quarantine tool, and document triage.

### PRG-016: Add backup, restore, PITR, and disaster-recovery procedures

- **Surface / lens / severity**: Documentation / Operability / **HIGH**
- **Evidence**: `runbooks/database-migrations.md:39-41` says to take a backup/PITR checkpoint but gives no procedure. Repository search found no backup/restore/DR runbook, RPO, RTO, restore drill, or ownership.
- **Why production needs it**: Operators cannot safely migrate or recover PostgreSQL/audit/report data after corruption or region loss.
- **Recommended follow-up**: Define RPO/RTO, managed backup configuration, encrypted retention, restore steps, periodic restore tests, and evidence retention.

### PRG-017: Document an executable production topology, release, and upgrade path

- **Surface / lens / severity**: Documentation / Operability / **HIGH**
- **Evidence**: `docs/adr/0003-devops-runtime.md:34-35,48-49` leaves AWS/Azure selection open. Only `packages/server/Dockerfile` exists; no deployment manifest/IaC, TLS/network policy, autoscaling, rollout, upgrade, or rollback artifact procedure exists.
- **Why production needs it**: There is no reproducible path from source to a running, secured, upgradeable service.
- **Recommended follow-up**: Select a supported target and publish versioned IaC/manifests, network/TLS/storage rules, migration ordering, canary/rollback, and upgrade compatibility policy.

### PRG-018: Define secret supply, separation, and rotation

- **Surface / lens / severity**: Documentation / Security / **HIGH**
- **Evidence**: `docs/reference/configuration.md` lists environment variables but no secret-manager integration or rotation procedure. A repository-wide `find . -type f \( -name '.env.example' -o -name '*.env.example' \)` returned no env template, so operators must reconstruct the full set from configuration code and scattered workflow/runbook docs. `packages/server/src/config.ts:83-89` intentionally reuses `CODING_TASK_CALLBACK_SECRET` for HMAC confirmation and bearer callback auth. E2E docs export secrets directly (`runbooks/e2e-real-environment.md:21-44`).
- **Why production needs it**: Rotation, least privilege, audit, and blast-radius separation are undefined for GitHub, Graph, Auth.js, ingest, webhook, and LLM credentials.
- **Recommended follow-up**: Map each secret to an owner/store/consumer/rotation cadence, split unrelated keys, document zero-downtime dual-key rotation, and test revocation.

### PRG-019: Make the Teams application package installable

- **Surface / lens / severity**: Documentation / Documentation effectiveness / **HIGH**
- **Evidence**: `docs/teams-app/manifest.json:5,9-11,27-28,52` contains required placeholders; `docs/teams-app/README.md:11-12` requires two icons that do not exist. The manifest points to `/privacy` and `/terms`, but no routes exist. The claimed `teamsAppInstallation` provisioning flow appears only in docs (`README.md:26`).
- **Why production needs it**: The Teams package cannot be zipped/validated/installed as shipped, and project/team onboarding is not implemented.
- **Recommended follow-up**: Provide environment-specific packaging, real legal pages, icons, manifest validation, and an audited install/project-channel provisioning workflow.

### PRG-020: Correct XLSX API/security documentation

- **Surface / lens / severity**: Documentation / Security / **HIGH**
- **Evidence**: `docs/reference/http-api.md:19-21` says dry-run has no auth and execute only needs `x-confirm-import`; implementation requires HMAC and an allowlist (`packages/server/src/http/routes/xlsxImport.ts:47-75,98-122`). `docs/reference/configuration.md` omits `XLSX_IMPORT_SECRET` and `XLSX_IMPORT_ALLOWED_REPOS`. `docs/guide/excel-import.md:68-76` omits signature instructions.
- **Why production needs it**: Operators following the reference cannot call the API correctly and may misunderstand its security boundary.
- **Recommended follow-up**: Generate/reference API docs from route contracts, document signing and allowlists, add safe CLI examples, and gate docs drift in tests.

### PRG-021: Repair unsafe and stale manual-operation guidance

- **Surface / lens / severity**: Documentation / Documentation effectiveness / **HIGH**
- **Evidence**: `runbooks/manual-ops.md:30-39` says grant by manual DB INSERT, notifications continue, and an all-project notice arrives; the production failsafe blocks report delivery and `activateFailsafe` is empty. Lines 12-23 direct operators to a deploy workflow that only echoes. Lines 58-61 claim DB REVOKE is applied though schema contains comments only.
- **Why production needs it**: Incident responders may perform ineffective or unsafe actions while believing controls are active.
- **Recommended follow-up**: Re-test every runbook command in staging, require application/API actions instead of raw grants, align behavior tables with code, and add runbook owners/review dates.

### PRG-022: Rebuild the verification report from current evidence

- **Surface / lens / severity**: Documentation / Verification completeness / **HIGH**
- **Evidence**: `verification/VERIFICATION_REPORT.md:72,101,115` says 359 tests are authoritative, while line 224 and `README.md:92` claim 750. This audit observed 833 coverage-gated tests plus 152 Web tests = 985. Lines 203-208 describe obsolete missing installs/jobs and line 106 says Excel was absent at T13.
- **Why production needs it**: Go-live decisions cannot rely on contradictory, stale, branch-specific evidence.
- **Recommended follow-up**: Generate test counts/status from CI artifacts, version evidence by commit, separate historical sections, and remove obsolete instructions.

### PRG-023: Bring canonical requirements into the repository

- **Surface / lens / severity**: Specification / Specification completeness / **HIGH**
- **Evidence**: `docs/spec/spec-id-catalog.md:3` says older IDs remain governed by original source documents. `verification/VERIFICATION_REPORT.md:9` references `/mnt/user-data/uploads`; no source ZIP/PPTX/canonical extracted requirement text exists in the repository. `packages/traceability/spec-ids/*.json` contains only ID strings.
- **Why production needs it**: Maintainers cannot verify meaning, edge cases, conflicts, or changes for most requirements without inaccessible external files.
- **Recommended follow-up**: Import a licensed, normalized requirement corpus with namespace, text, source location, version, owner, and change history.

### PRG-024: Upgrade traceability from string presence to semantic mappings

- **Surface / lens / severity**: Specification / Specification completeness / **HIGH**
- **Evidence**: `packages/traceability/src/verifyTraceability.ts:84-98` uses `String.includes`; `packages/traceability/src/verifyTraceability.ts:221-235` fails only missing source references for REQ/SPEC-INT/TH. Current matrix reports PrjOps AC test references 71% and DevOps 43%, but the gate remains green.
- **Why production needs it**: An ID in a comment can satisfy the gate even when behavior or acceptance tests are absent.
- **Recommended follow-up**: Store explicit requirement-to-implementation-to-test mappings, require test references for testable ACs, classify operational AC evidence, and review semantics on change.

### PRG-025: Specify production non-functional acceptance criteria

- **Surface / lens / severity**: Specification / Operability / **HIGH**
- **Evidence**: `README.md:8` states 50 projects with design limits of 100, while `README.md:109-112` says migration/test plans are out of scope. No RPO/RTO, throughput, concurrency, cost ceiling, rollout, rollback time, data-residency, or support criteria are defined.
- **Why production needs it**: Production readiness and capacity cannot be objectively accepted or rejected.
- **Recommended follow-up**: Define measurable NFRs and go-live exit criteria per dependency and persona, including scale, latency, availability, recovery, security, and cost.

### PRG-026: Test schema and repositories against real PostgreSQL

- **Surface / lens / severity**: Verification / Verification completeness / **HIGH**
- **Evidence**: `verification/VERIFICATION_REPORT.md:28-46` records no PostgreSQL server. Repository tests use mocked `query` calls; current coverage shows `PgAuditLog` 0%. No test applies `schema.sql`, all migrations, roles, constraints, partitions, and repository operations to a real database.
- **Why production needs it**: SQL syntax/partition/privilege errors such as PRG-001 and PRG-009 pass CI.
- **Recommended follow-up**: Add ephemeral supported PostgreSQL CI, fresh-schema and upgrade paths, role-denial tests, concurrent queue/cost tests, and schema equivalence assertions.

### PRG-027: Test production composition, container, and hosted workflows

- **Surface / lens / severity**: Verification / Verification completeness / **HIGH**
- **Evidence**: Current coverage reports `packages/server/src/index.ts:1-525`, `packages/server/src/main.ts:1-36`, and `packages/server/scripts/start-container.mjs:1-49` at 0%, and core external agent files at 0%. CI (`.github/workflows/ci.yml:15-27`) does not build the Dockerfile or validate/run other workflows. `packages/server/Dockerfile:17` hides Web build failure with `|| echo`.
- **Why production needs it**: CI validates factories in isolation but not the wiring that contains most critical gaps.
- **Recommended follow-up**: Add composition-root tests, fail-closed container build/start smoke, action/workflow lint, and staged hosted-workflow execution.

### PRG-028: Complete and record real-environment E2E

- **Surface / lens / severity**: Verification / Verification completeness / **HIGH**
- **Evidence**: `verification/VERIFICATION_REPORT.md:39-50` and `runbooks/e2e-real-environment.md:115-125` leave authenticated dashboard, PostgreSQL, GitHub/Teams webhooks, Graph delivery, and real LLM checks incomplete. T14 remains unperformed.
- **Why production needs it**: Authentication, tenant permissions, webhook reachability, delivery, token scopes, and provider-specific behavior are unproven.
- **Recommended follow-up**: Provision a dedicated staging tenant/org/database, execute the checklist with redacted evidence, and require sign-off before go-live.

### PRG-029: Add load, capacity, and failure-injection verification

- **Surface / lens / severity**: Verification / Verification completeness / **HIGH**
- **Evidence**: Repository search found no k6/artillery/autocannon/benchmark suite. Existing “load” tests in `packages/devops/tests/deployMonitor.test.ts:12-86` are arrays passed to pure functions, not traffic. No test covers 50/100 projects, webhook bursts, DB pool exhaustion, queue backlog, or shutdown under load.
- **Why production needs it**: Claimed scale, SLOs, retry behavior, and resource settings have no empirical basis.
- **Recommended follow-up**: Define workloads from PRG-025, run steady/burst/soak and dependency-failure tests, and tune capacity with recorded thresholds.

### PRG-030: Deploy actual SLO collection and alerting

- **Surface / lens / severity**: Implementation / Operability / **HIGH**
- **Evidence**: `runbooks/observability-slo.md:18-24` lists prose alert conditions, but no Prometheus scrape configuration, alert rules, receiver/on-call integration, dashboard, or burn-rate policy exists. Repository search finds only the runbook and in-process registry.
- **Why production needs it**: Metrics exist only if an external system happens to scrape them; no alert reaches an operator.
- **Recommended follow-up**: Add deployment-specific scrape/auth, recording and alert rules, receivers, dashboards, SLO ownership, and alert tests.

### PRG-031: Create a single evidence-backed go-live checklist

- **Surface / lens / severity**: Documentation / Operability / **HIGH**
- **Evidence**: `runbooks/production-gates.md` covers CODEOWNERS, `AIOPS_PR_TOKEN`, and gitleaks only. It does not gate DB restore, migrations, runtime platform, secret rotation, data provisioning, alert delivery, real E2E, load, tenant permissions, or rollback. Branch-protection enforcement remains a manual note (`AGENTS.md:72-73`).
- **Why production needs it**: Critical prerequisites are scattered and can be skipped without an accountable decision.
- **Recommended follow-up**: Create a checklist with owner, evidence link, date, environment, approver, exception expiry, and explicit NO-GO blockers.

### PRG-032: Add operator onboarding and project provisioning

- **Surface / lens / severity**: Documentation / Documentation effectiveness / **HIGH**
- **Evidence**: No executable flow creates app roles, recipients, project channels, Graph subscriptions, Teams app installation, PrjOps repositories/providers, or initial audit partitions. `docs/teams-app/README.md:26` names a nonexistent installation flow; report runbook only says rows must exist. No `.env.example`/`*.env.example` exists, so even the documented environment variables cannot be instantiated from a single versioned template.
- **Why production needs it**: A new operator cannot bring a project/user from zero to a working, least-privilege state.
- **Recommended follow-up**: Provide idempotent provisioning commands/APIs, approval/audit behavior, rollback, and a tested onboarding walkthrough.

### PRG-033: Gate Web tests and coverage in CI

- **Surface / lens / severity**: Verification / Verification completeness / **HIGH**
- **Evidence**: `packages/web/package.json:7-13` has `test` but no `test:coverage`. `.github/workflows/ci.yml:21-27` runs only recursive `test:coverage` and has no plain `test` step, so `--if-present` skips Web entirely: its 152 tests are never executed in hosted CI, not merely omitted from coverage. `vitest.config.ts` files define no thresholds, and server coverage accepts `index.ts` at 0%.
- **Why production needs it**: Critical auth, persona, data API, and chat regressions receive no hosted test execution at all, while coverage can also fall to zero on production files without failure.
- **Recommended follow-up**: Add Web coverage, risk-based per-file/global thresholds, and explicit composition/auth/data-route expectations.

### PRG-034: Protect or isolate the metrics endpoint

- **Surface / lens / severity**: Implementation / Security / **MED**
- **Evidence**: `packages/server/src/http/routes/metrics.ts:10` exposes `/metrics` without auth on the same public Hono app; `docs/reference/http-api.md:11` documents no auth. Labels expose task/status and operational state.
- **Why production needs it**: Public operational telemetry assists reconnaissance and allows scrape abuse.
- **Recommended follow-up**: Bind metrics to a private listener/network or require proxy authentication and rate limits.

### PRG-035: Remove hard-coded zero DORA deltas

- **Surface / lens / severity**: Implementation / Specification completeness / **MED**
- **Evidence**: `packages/devops/src/agents/AGT_RPT.ts:96-111` calculates current DORA metrics but sets all `deltaVsPrevWeek` fields to zero. Tests only assert mail delivery, not delta correctness (`packages/devops/tests/agtRpt.test.ts:58-86`).
- **Why production needs it**: If this report path is wired, it presents “no change” without previous-period data.
- **Recommended follow-up**: Accept previous-period inputs and calculate deltas, or omit/render N/A until available.

### PRG-036: Implement audit retention and partition lifecycle

- **Surface / lens / severity**: Implementation / Operability / **HIGH**
- **Evidence**: `packages/devops/src/db/schema.sql:213-216` promises a future runbook for monthly partitions and 13-month drops; none exists. `docs/adr/0001-monorepo.md:28` requires separate PrjOps 5-year and DevOps 1-year retention, but production PrjOps audit storage is not instantiated (`packages/shared/src/auditLog.ts:74-99` is only a generic adapter).
- **Why production needs it**: Audit writes can stop at month boundaries and retention/compliance claims are not executed.
- **Recommended follow-up**: Automate advance partition creation/drop with locks and alerts, implement PrjOps durable audit storage, and test retention without losing required evidence.

### PRG-037: Triage current dependency advisories and add a security gate

- **Surface / lens / severity**: Verification / Security / **MED**
- **Evidence**: `pnpm audit --prod` reported 3 moderate and 1 low advisories: next-auth beta email misdelivery, PostCSS stringify XSS, transitive uuid buffer bounds, and AI SDK provider-utils resource consumption. CI runs gitleaks but no dependency audit (`.github/workflows/ci.yml:29-45`).
- **Why production needs it**: Current dependencies are not continuously assessed. The next-auth email advisory appears not directly reachable because only Entra ID is configured, but all findings need owner/impact decisions.
- **Recommended follow-up**: Record reachability, upgrade direct/transitive packages where safe, and add a policy-based audit/SBOM gate with time-bounded exceptions.

### PRG-038: Repair verification commands and CI parity claims

- **Surface / lens / severity**: Documentation / Documentation effectiveness / **MED**
- **Evidence**: `package.json:17` defines `verify:all` as `bash verification/run_verification.sh`, but that file does not exist. `.mise.toml:41-43` includes governance/lint/traceability/format/build/typecheck/coverage, while `.github/workflows/ci.yml:21-27` omits lint and format despite AGENTS/README describing equivalent order.
- **Why production needs it**: Operators and contributors cannot rely on documented one-command verification or local/remote parity.
- **Recommended follow-up**: Remove or restore `verify:all`, make hosted CI invoke the canonical task (or document intentional differences), and test command existence.

### PRG-039: Provide the workflow-failure triage entrypoint before distribution

- **Surface / lens / severity**: Implementation / Operability / **HIGH**
- **Evidence**: `packages/devops/src/workflows/on-workflow-failure-triage.yml:18-19` runs `node packages/devops/scripts/jobs/on-build-failure.mjs`, but `find packages/devops/scripts/jobs -maxdepth 2 -type f -print` returns only `packages/devops/scripts/jobs/README.md`; the referenced module does not exist. A full sweep of the three active `.github/workflows/*.yml`, both `packages/devops/src/workflows/*.yml`, and the referenced composite action checked every explicit local action, `node` entrypoint, and `tsx` source path. All other explicit local paths exist; this was the only additional missing workflow reference.
- **Why production needs it**: When this distributed workflow receives its first failed `workflow_run`, the triage job deterministically stops at Node's missing-module error before AGT-BLD can classify or notify anyone.
- **Recommended follow-up**: Implement and package the entrypoint around the production AGT-BLD adapter, or change the workflow to invoke an existing supported command; install the workflow under the managed repository's `.github/workflows`; add static local-reference validation and a hosted smoke test.

### PRG-040: Replace provisional incident-ticket semantics with an owned data contract

- **Surface / lens / severity**: Implementation / Specification completeness / **MED**
- **Evidence**: `packages/devops/src/lib/incidentBurndown.ts:7-11` explicitly states that, because no ticket entity exists, incidents are temporarily treated as tickets and real ticket-system integration is out of scope. The provisional calculation is exposed to dashboard data by `packages/web/src/server/reportData/devopsReportData.ts:300-301`.
- **Why production needs it**: Managers can interpret an incident-only series as the requested ticket backlog/burndown, producing a semantically valid-looking but incomplete operational metric.
- **Recommended follow-up**: Define the ticket/backlog source of truth and inclusion rules, implement its production adapter and reconciliation policy, and label the metric unavailable until the contract is supplied and verified against representative data.

### PRG-041: Coordinate scheduled work across server replicas

- **Surface / lens / severity**: Implementation / Reliability / **HIGH**
- **Evidence**: `packages/server/src/index.ts:252-389` starts every scheduled task in every process. `packages/server/src/scheduler/scheduler.ts:73-114` guards overlap only with process-local state and has no leader election, advisory lock, or lease. An independent probe starting two scheduler instances around one task observed six executions in 35 ms rather than one execution stream.
- **Why production needs it**: Horizontal scaling or a rolling deployment duplicates external polling, subscription renewal, report delivery, health-state transitions, and other side effects; database uniqueness protects only some writes and does not serialize external calls.
- **Recommended follow-up**: Choose a single scheduler leader or acquire a per-task PostgreSQL advisory/lease lock before side effects; make each task idempotent at its external boundary; add a two-replica integration test.

### PRG-042: Fail closed when the Japanese holiday calendar is outside its verified horizon

- **Surface / lens / severity**: Implementation / Reliability / **MED**
- **Evidence**: `packages/shared/src/calendar/jp_holidays.yaml:15-125` contains only 2026-2027 entries and identifies some values as provisional/sample. `packages/shared/src/calendar/businessCalendar.ts:76-84` treats every absent date as a non-holiday without checking coverage and `isJpHoliday` ignores `HolidayEntry.verified`. The production calendar therefore returned `true` for `isBusinessDay(..., "2028-01-10")`, although that date is Coming of Age Day.
- **Why production needs it**: After the data horizon, scheduled reports, monthly jobs, reminders, and business-hours risk factors silently run on Japanese public holidays instead of stopping on stale calendar data.
- **Recommended follow-up**: Store explicit covered-year metadata, reject startup/scheduling outside a reviewed horizon, alert before expiry, and update/verify the next year through the documented approval process.

### PRG-043: Define user-centric PII correction and erasure handling

- **Surface / lens / severity**: Documentation / Security / **HIGH**
- **Evidence**: `packages/devops/src/db/schema.sql:239-250` stores Teams author AAD IDs, names, and message content. `packages/server/src/db/channelMessagesRepo.ts:45-59` retains content after a Teams-side deletion and only marks `deleted_at`. `runbooks/channel-messages-purge.md:17-35` deletes data only after an entire project channel is closed for 13 months; repository search found no data-subject lookup, individual correction/erasure, legal-hold, or exception procedure.
- **Why production needs it**: A user deletion/correction request or employment/tenant lifecycle event cannot be reconciled with retained message copies, creating privacy and compliance risk independent of project closure.
- **Recommended follow-up**: Classify personal fields and lawful retention bases, define subject lookup/correction/erasure and legal-hold rules, redact deleted-message bodies where permitted, and produce auditable completion evidence.

### PRG-044: Preserve project scope in standard reports before recipient delivery

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/shared/src/reporting/reportSchema.ts:25-35` has no tenant/project ownership on a report or slot. `packages/server/src/scheduler/tasks/reportDeliveryTask.ts:100-116` assigns every slot to the recipient's own first project and user before applying the permission filter, then lines 144-180 send the report to every active recipient. An independent probe put `PROJECT-A SECRET` in a project-less payload, delivered it to a PRF-02 recipient scoped only to `PROJECT-B`, and observed the secret in rendered HTML.
- **Why production needs it**: The filtering layer launders unscoped content into each recipient's allowed scope, so a validly signed report can disclose one project's internal detail to unrelated active recipients.
- **Recommended follow-up**: Require domain/tenant/project IDs per report or slot, reject unscoped detailed reports, filter original provenance rather than synthesized recipient values, and add cross-project negative delivery tests.

### PRG-045: Pin every distributed workflow action to an immutable commit

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: Active repository workflows pin action commits, but distributable workflows use mutable major tags: `packages/devops/src/workflows/on-workflow-failure-triage.yml:14-15` uses `actions/checkout@v4` and `jdx/mise-action@v2`; `packages/devops/src/workflows/deploy-prod.yml:33` uses `actions/checkout@v4`.
- **Why production needs it**: Installing these workflows makes deployment/failure-triage execution depend on mutable upstream tag resolution, weakening review provenance and exposing privileged automation to supply-chain substitution.
- **Recommended follow-up**: Pin full reviewed SHAs with version comments, automate controlled update PRs, and gate all shipped workflow/action references with a pinning check.

### PRG-046: Bound retention for non-audit operational event stores

- **Surface / lens / severity**: Implementation / Operability / **HIGH**
- **Evidence**: `packages/devops/src/db/schema.sql:13-69,155-165,276-307` creates append-oriented `events`, `pm_events`, `pm_snapshots`, `standard_reports`, `llm_usage`, and `coding_tasks`. Repository search found no production purge/delete policy for these tables; the only explicit retention automation target is the separate audit log, while channel messages have a manual runbook.
- **Why production needs it**: Webhook payloads, snapshots, reports, usage records, and completed queue rows grow without a capacity or privacy bound, eventually degrading indexes, backups, restores, and database cost.
- **Recommended follow-up**: Define per-table retention/legal-hold requirements, partition or batch-purge high-volume stores, retain only required normalized fields, expose age/size metrics, and test purge safety and backup impact.

### PRG-047: Acquire an exclusive delivery claim before sending

- **Surface / lens / severity**: Implementation / Reliability / **HIGH**
- **Evidence**: `packages/prjops/src/lib/idempotentDelivery.ts:52-77` decides from read-only `status`/`exists` checks. `packages/prjops/src/agents/AGT05_distributor.ts:47-65` then writes `pending` and sends, but `packages/server/src/db/reportDeliveryLogRepo.ts:33-42` uses a non-exclusive UPSERT and returns no ownership result. Two concurrent `distributeOne` calls for the same report/recipient independently returned `sent` and invoked `sendMail` twice.
- **Why production needs it**: Replica duplication from PRG-041 or overlapping delivery invocations violates SPEC-EXT-023/AC-018-2 by sending two emails; deduplicating/updating the log row does not undo external delivery.
- **Recommended follow-up**: Atomically `INSERT ... ON CONFLICT DO NOTHING RETURNING` a pending claim before send, allow only the winner to call Graph, and define lease/recovery semantics for a claimant that crashes before marking sent.

### PRG-048: Attribute Teams actions to an immutable user identity

- **Surface / lens / severity**: Implementation / Security / **HIGH**
- **Evidence**: `packages/server/src/agents/teamsConversationAgent.ts:208-235` receives and stores `raw.authorAadId`, but later audit actors use only `USER:${callerProfile}` (`:292-300`, `:485-491`) and coding-task insertion stores the same persona value as `requestedBy` (`:426-435`). The individual AAD ID is not propagated into those action records.
- **Why production needs it**: Code-task initiation and other autonomous operations can be traced only to “some PRF-01/02/etc. user,” defeating individual accountability, incident reconstruction, and non-repudiation at a core audit boundary.
- **Recommended follow-up**: Carry the immutable AAD/object ID through command execution, record it in `actor`/`requested_by` with persona as separate authorization context, and migrate/test existing audit consumers without logging unnecessary display-name PII.

### PRG-049: Harden and minimize the runtime container

- **Surface / lens / severity**: Implementation / Security / **MED**
- **Evidence**: `packages/server/Dockerfile:20-31` copies the complete build repository into runtime, including source, tests, and development dependencies; it never prunes production dependencies and has no `USER` directive, so the default Node image user remains root.
- **Why production needs it**: A runtime compromise gains root inside an unnecessarily large image with extra tools/source/dependencies, increasing exploitable surface, image size, transfer time, and software-inventory noise.
- **Recommended follow-up**: Copy only built runtime artifacts and production dependencies, run as an unprivileged fixed UID/GID, remove package-manager/build tooling, and verify startup plus image contents in CI.

### PRG-050: Escape previous-report summaries in progress-request email HTML

- **Surface / lens / severity**: Implementation / Security / **MED**
- **Evidence**: `packages/prjops/src/agents/AGT05_distributor.ts:178-192` interpolates `previousSummary3Lines` directly into `htmlBody`. A probe supplied `<img src=x onerror=alert(1)>` and observed the raw tag unchanged in the outgoing HTML. Repository search found only tests as callers, so this is a latent, not currently production-wired, path.
- **Why production needs it**: Once scheduled/wired, external previous-report text can alter email markup, create deceptive links/content, or exploit client-specific HTML behavior. Latency limits current exposure, so MED is proportionate.
- **Recommended follow-up**: Reuse a shared HTML escaper or render text-only content at the final email boundary, add a malicious-summary test, and require the same sink review for every Graph `htmlBody` caller before wiring this job.

## Known Seed Reconciliation

| Seed | Current conclusion |
| --- | --- |
| L1b-1 failsafe stop wiring | **Partially remediated since the seed.** T22 added guards around dangerous scheduler/routes, so “stop wiring entirely absent” is stale. Remaining blockers are DB-only health detection, volatile state, automatic recovery, and empty all-project notification (PRG-008). |
| T14 real-environment E2E | **Still open.** No real PostgreSQL/Entra/GitHub/Graph/LLM end-to-end evidence (PRG-026, PRG-028). |
| AGENTS go-live prerequisites | **Still open as external/manual gates.** Branch-protection enforcement and production token/secret configuration are not proven; they must enter the go-live checklist (PRG-012, PRG-018, PRG-031). |
| Verification report classifications | **Honest in broad categories but stale/inconsistent.** Real-env gaps are disclosed, while counts, historical statements, and current implementation status conflict (PRG-022, PRG-038). |

## Checked Areas Reconciliation

- GitHub webhook HMAC verification and delivery-ID fail-closed behavior are present before enqueue (`githubWebhook.ts:29-69`).
- Graph notifications use `clientState` validation and lifecycle routing; no bypass was found in the reviewed handlers.
- Report ingest and XLSX execute fail closed when their optional HMAC secrets are absent.
- SQL query construction in repository files uses parameters in the reviewed paths; no string-built user-controlled SQL injection was found.
- Standard-report HTML escapes payload text before email rendering (`reportDeliveryTask.ts:125-132`), but that result was path-specific: the sibling progress-request email path is unescaped (PRG-050).
- Graceful shutdown has a bounded timeout and repeated-signal guard in the current implementation/tests.
- No CRITICAL/HIGH production dependency advisory was reported by `pnpm audit --prod` on 2026-07-10.

## Recommended Dependency Order

1. **P0 decision baseline**: PRG-023/024/025/031/043. Establish canonical requirements, NFRs, privacy lifecycle, and go-live evidence ownership before interpreting “done.”
2. **P0 data/audit foundation**: PRG-001/009/016/026/036. A working, protected, recoverable PostgreSQL/audit layer is prerequisite to every runtime flow.
3. **P0 hosting/security foundation**: PRG-011/012/017/018/030/034/044/045/048/049/050. Select the platform, secret model, network boundaries, report scope, actor identity, container/action provenance, safe HTML sinks, and alert delivery.
4. **P0 product runtime**: PRG-002/003/004/005/006/007/039/041/047. Wire real agents, workflow entrypoints, deployment, singleton scheduled execution, atomic delivery claims, PrjOps data/jobs, authorization, and report generation.
5. **P1 reliability closure**: PRG-008/013/014/015/035/040/042/046. Complete health/failsafe, pool lifecycle, workflow reconciliation, dead letters, calendar validity, retention, and metric truthfulness.
6. **P1 integration proof**: PRG-027/028/029/033/037. Exercise container/workflows, real external services, load/failure, coverage, and dependencies.
7. **P1 operator readiness**: PRG-019/020/021/022/032/038. Make packaging, API/runbooks, evidence, and onboarding executable.
8. **Go-live review**: execute PRG-031 with evidence from every prior group; unresolved CRITICAL/HIGH items require an explicit time-bounded exception approved by accountable humans.

## Suggested Follow-up Task Groups

| Order | Task group | Findings | Depends on |
| ---: | --- | --- | --- |
| 1 | Canonical specification, NFR, and privacy baseline | 023-025, 031, 043 | none |
| 2 | PostgreSQL bootstrap, roles, partitions, restore drill | 001, 009, 016, 026, 036 | 1 |
| 3 | Production platform, secrets, network, observability | 011, 012, 017, 018, 030, 034, 045, 049 | 1-2 |
| 4 | DevOps event-agent and deployment runtime | 002, 003, 006, 008, 039, 041, 047 | 1-3 |
| 5 | PrjOps data, identity, scheduled jobs, audit | 004, 005, 032, 036 | 1-3 |
| 6 | Report and dashboard scope/metric correctness | 006, 007, 035, 040, 044, 050 | 1-5 |
| 7 | Queue/workflow/database reliability and retention | 013-015, 042, 046 | 2-6 |
| 8 | Teams packaging, identity audit, and provisioning | 019, 032, 048 | 3, 5 |
| 9 | CI composition, Web coverage, dependency policy | 027, 033, 037, 038 | 2-8 |
| 10 | Real-environment E2E and load/failure tests | 028, 029 | 2-9 |
| 11 | Runbook/API/evidence refresh | 020-022, 038 | 2-10 |
| 12 | Formal go-live decision | 031 | all prior groups |
