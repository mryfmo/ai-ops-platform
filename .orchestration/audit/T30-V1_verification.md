# T30-V1 Adversarial Verification

- Task: T30-V1
- Verified audit commit: `21306d8`
- Date: 2026-07-10
- Method: independent read-only evidence checks, targeted execution, adversarial negative-path review

## Verdict Summary

The T30 **NO-GO** verdict is sustained. Of the original 40 findings, 39 are CONFIRMED and one is CONFIRMED-WITH-CORRECTION. PRG-005 is a real production blocker, but the evidence supports **HIGH**, not CRITICAL: the fixture identity normally fails closed for real users and proves unusable authorization, not a universal catastrophic compromise. No finding was REFUTED or left UNVERIFIABLE.

Ten additional gaps were independently reproduced or derived across the initial run and revise round 1 and added to the production audit as PRG-041 through PRG-050.

## Original Finding Verdicts (40/40)

| ID | Verdict | Independent basis |
| --- | --- | --- |
| PRG-001 | CONFIRMED | Static PostgreSQL DDL violates the partitioned-primary-key rule and provides no live/default partition. Local `psql` exists but `pg_isready` found no server, so schema execution was not claimed. |
| PRG-002 | CONFIRMED | The production composition's three DevOps handlers append only `github_event_received`; repository call search found no server/web invocation of the implemented agent entrypoints. |
| PRG-003 | CONFIRMED | The distributable deploy workflow contains only two `echo` steps and is not installed under `.github/workflows`; AGT-DEP dispatches its filename as a real deployment. |
| PRG-004 | CONFIRMED | Web routes/dashboard instantiate empty PrjOps providers, stakeholder production loading is absent, PrjOps jobs are unscheduled, and the monthly snapshot task is explicitly disabled. |
| PRG-005 | CONFIRMED-WITH-CORRECTION | `main()` authorizes Teams callers against one embedded fixture. This blocks real identities and is production-invalid, but normally fails closed; severity corrected from CRITICAL to HIGH. |
| PRG-006 | CONFIRMED | Coding/report workflows call `claude` or `droid` after dependency install but never install either CLI; the action comments explicitly say the invocations are unverified. |
| PRG-007 | CONFIRMED | Missing report metrics become numeric zero, the scheduled workflow supplies no production source, and absent ingest configuration exits successfully. |
| PRG-008 | CONFIRMED | Health/readiness query only PostgreSQL, state is process-local, activation notification is empty, and one healthy DB check auto-clears it. Existing task/route guards do enforce stopping and should be extended, not replaced. |
| PRG-009 | CONFIRMED | Audit REVOKE/GRANT statements are comments; no executable role bootstrap or role-denial verification exists. |
| PRG-010 | CONFIRMED | Signed GitHub JSON is serialized directly into `events.payload`; legitimate signed content can still contain pasted secrets. Sibling persistence boundaries sanitize, so inconsistent first-write handling sustains HIGH. |
| PRG-011 | CONFIRMED | Public routes fully buffer JSON/text/XLSX before auth or HMAC decisions; no app or deployment-layer size/rate control exists in the repository. |
| PRG-012 | CONFIRMED | The runtime reads an optional unvalidated `GITHUB_TOKEN` directly from process env and ADR-0005 leaves installation-token exchange open. |
| PRG-013 | CONFIRMED | Current search found exactly eight production Web files constructing `new pg.Pool`, with no shared pool/end lifecycle or server timeout configuration. |
| PRG-014 | CONFIRMED | GitHub dispatch precedes the ledger update, workflow callbacks omit `curl -f`, and confirmation tokens are deterministic task-ID HMACs without expiry. |
| PRG-015 | CONFIRMED | Queue SQL excludes `dead`, while metrics preseed the dead gauge to zero; no inspection/requeue operation or runbook was found. |
| PRG-016 | CONFIRMED | Migration docs demand backup/PITR but provide no command, ownership, RPO/RTO, or restore drill. |
| PRG-017 | CONFIRMED | Runtime platform remains undecided and the repository has no deployment/IaC/TLS/network/rollout artifact beyond a Dockerfile. |
| PRG-018 | CONFIRMED | No env template, secret-manager supply path, rotation procedure, or per-purpose callback/confirmation secret separation exists. |
| PRG-019 | CONFIRMED | Teams manifest placeholders, missing icon files, missing privacy/terms routes, and the docs-only installation flow make the package non-installable as shipped. |
| PRG-020 | CONFIRMED | XLSX docs omit the HMAC/allowlist contract implemented by both dry-run and execute routes; configuration reference omits both XLSX variables. |
| PRG-021 | CONFIRMED | Manual ops claims deployment, notifications, and DB privileges that the current no-op workflow, empty failsafe activation, and commented DDL do not provide. |
| PRG-022 | CONFIRMED | Verification artifacts still contain incompatible 359/750 counts and obsolete status statements; T30's same-commit executions observed 985 tests. |
| PRG-023 | CONFIRMED | The catalog delegates older IDs to external originals, the report cites `/mnt/user-data/uploads`, and local ID JSON contains identifiers rather than canonical requirement text. |
| PRG-024 | CONFIRMED | Traceability uses corpus `String.includes`; only missing source references for selected categories fail, so absent AC test semantics remain green. |
| PRG-025 | CONFIRMED | The 50/100 project claim has no measurable RPO/RTO, throughput, concurrency, rollback, residency, support, or cost acceptance criteria. |
| PRG-026 | CONFIRMED | No test applies schema/migrations/roles to PostgreSQL; local PostgreSQL was unavailable and repository tests use query doubles. |
| PRG-027 | CONFIRMED | CI does not build/start the container or hosted workflows, production roots remain uncovered, and Dockerfile masks Web build failure. |
| PRG-028 | CONFIRMED | The E2E report/runbook explicitly leaves authenticated dashboard, PostgreSQL, GitHub/Teams/Graph, and real-model paths incomplete. |
| PRG-029 | CONFIRMED | No traffic/load harness was found; the only relevant deploy-monitor tests pass arrays into pure functions and do not exercise capacity. |
| PRG-030 | CONFIRMED | Metrics and prose thresholds exist, but no scrape deployment, rule, receiver, dashboard, burn-rate alert, or on-call delivery artifact exists. |
| PRG-031 | CONFIRMED | Production gates cover CODEOWNERS/token/gitleaks only and omit the database, recovery, external E2E, load, tenant, alert, and rollback gates. |
| PRG-032 | CONFIRMED | No idempotent project/user provisioning flow or complete environment template exists; the Teams installation flow is referenced but absent. |
| PRG-033 | CONFIRMED | Web has no `test:coverage` and hosted CI has no plain `test` step, so all 152 Web tests are skipped entirely; current configs also set no production-root thresholds. |
| PRG-034 | CONFIRMED | `/metrics` is registered on the same Hono app without auth; no repository deployment policy isolates it. MED remains proportionate because labels are operational, not direct secrets. |
| PRG-035 | CONFIRMED | AGT-RPT still supplies four literal zero previous-week deltas and tests do not assert their calculation. |
| PRG-036 | CONFIRMED | Audit partition creation/drop remains a commented example and promised missing runbook; separate PrjOps durable retention is not instantiated. |
| PRG-037 | CONFIRMED | Fresh `pnpm audit --prod` again returned 3 moderate and 1 low advisory; CI still lacks a dependency policy gate. |
| PRG-038 | CONFIRMED | Executing `pnpm run verify:all` failed immediately because `verification/run_verification.sh` is absent. |
| PRG-039 | CONFIRMED | Executing the workflow command failed with `MODULE_NOT_FOUND` for `packages/devops/scripts/jobs/on-build-failure.mjs`. |
| PRG-040 | CONFIRMED | The implementation explicitly labels incident-as-ticket semantics provisional, and Web dashboard output consumes that calculation. |

## Correction Detail

### PRG-005: Severity CRITICAL to HIGH

The fixture path is real and blocks production authorization. However, `resolveCallerProfileFromStakeholders` returns no authorized profile for identities outside the single fixture, so the demonstrated default outcome is denial/unavailability rather than broad privilege grant or data corruption. A matching fixture identity would be incorrectly authorized for its fixture projects, but current evidence does not establish likely universal compromise. HIGH preserves its go-live-blocking status without overstating impact.

## Checked-Area Adversarial Reinspection (7/7)

1. **GitHub webhook HMAC and replay**: Tried missing/malformed/wrong-length signatures, invalid JSON, missing delivery ID, duplicate delivery ID, and alternate event names against implementation/tests. Signature verification precedes parsing/enqueue and the partial unique dedupe key is atomic. **Rechecked; not broken.** Unbounded pre-auth body buffering remains PRG-011, and unsanitized accepted payload storage remains PRG-010.
2. **Graph clientState/lifecycle**: Tried missing/empty/wrong-state notifications, mixed batches, malformed resource IDs, lifecycle events, and empty message IDs. SHA-256 constant-time comparison rejects bad states; only accepted lifecycle events are handled. **Rechecked; not broken.** Body limits remain PRG-011; the validation-token echo is required protocol behavior and returns text.
3. **Report/XLSX fail-closed configuration**: Checked missing/empty secrets, signature aliases, malformed hex, wrong body encoding, missing confirmation, and absent allowlist. Missing config returns 503 and mutations do not occur; bad signatures/allowlists fail. **Rechecked; not broken.** Bodies are still read before the disabled check (PRG-011).
4. **SQL parameterization**: Searched all server/Web query callsites and template interpolation. User values remain positional parameters; the only SQL fragment interpolation is a generated `$N` placeholder in `EventsRepo`. **Rechecked; no string-built user-controlled SQL found.**
5. **Report HTML escaping**: The original attack covered only `reportDeliveryTask`; its report type, period, and slots are escaped. A sibling-sink search then found `sendProgressReportRequests`, where `previousSummary3Lines` is inserted raw. A malicious-tag probe was preserved unchanged. **Original path held, broader claim broken; PRG-050 added.** Permission provenance remains separately broken by PRG-044.
6. **Graceful shutdown**: Rechecked repeated signal guard, readiness flag timing, HTTP close, scheduler drain, pool/telemetry close, and bounded timeout. State flips before the first await and repeated signals return; focused lifecycle tests pass. **Rechecked; not broken.** Cross-replica scheduling remains PRG-041.
7. **Dependency advisories**: Re-ran production audit and looked for high/critical rows and transitive reachability changes. Result remains 3 moderate + 1 low, no high/critical. **Rechecked; original narrow claim holds.** PRG-037 still requires owner/policy decisions.

## False-Negative Search (6/6)

| Independent lens | Result | Search/reproduction |
| --- | --- | --- |
| Concurrency/races | **New PRG-041, PRG-047** | Two schedulers duplicated work; two concurrent delivery calls also both decided to send and produced two emails because pending UPSERT is not an exclusive claim. |
| Time/calendar | **New PRG-042** | Inspected every holiday entry and calendar range check; no horizon check exists. Runtime probe misclassified 2028-01-10 as a business day. |
| Data lifecycle/PII | **New PRG-043, PRG-048** | Content survives source deletion without a subject lifecycle; Teams actions also discard the available immutable AAD ID and retain only persona-level attribution. |
| Multi-tenant/privilege | **New PRG-044** | Traced report schema → ingest → recipient filter → renderer. A project-A string in an unscoped report remained visible to a project-B-only manager. |
| Supply chain/license | **New PRG-045, PRG-049** | Distributed action tags float, and the runtime image ships the full source/dev tree as root. Lockfile uses integrity hashes; no additional concrete license conflict was established. |
| Cost/capacity | **New PRG-046** | Enumerated append-oriented tables and all production delete/retention references. Six operational stores have no bounded purge policy; audit and channel-message policies do not cover them. |

## New Finding Summary

| ID | Severity | Summary |
| --- | --- | --- |
| PRG-041 | HIGH | Scheduled tasks duplicate across server replicas. |
| PRG-042 | MED | Holiday calendar silently treats dates beyond 2027 as ordinary weekdays. |
| PRG-043 | HIGH | No user-centric PII correction/erasure lifecycle exists. |
| PRG-044 | HIGH | Standard report delivery synthesizes recipient scope and can leak cross-project details. |
| PRG-045 | HIGH | Distributed workflows use mutable action tags. |
| PRG-046 | HIGH | Non-audit operational stores have unbounded retention. |
| PRG-047 | HIGH | Delivery idempotency uses a non-exclusive read/UPSERT sequence and duplicates mail under concurrency. |
| PRG-048 | HIGH | Teams audit actors and code-task requesters retain persona, not individual identity. |
| PRG-049 | MED | Runtime container includes the full build tree and runs as root. |
| PRG-050 | MED | A latent progress-request email path interpolates external summary text as raw HTML. |

## Revise Round 1 Adversarial Notes

- **PRG-047 confirmed with evidence precision**: the caller does write `pending` before `sendMail`, contrary to the initial revise shorthand. The write is still a non-exclusive UPSERT after a read-only decision, so two concurrent calls both returned `sent` and sent two messages. The fix must return claim ownership atomically.
- **PRG-048 confirmed**: `raw.authorAadId` is available at ingestion but absent from the command actor and `coding_tasks.requested_by`; persona-only values cannot identify the requester.
- **PRG-049 confirmed**: the runtime stage copies `/repo`, has no production prune/selective copy, and declares no non-root `USER`.
- **PRG-050 confirmed as latent MED**: only tests call the function today, but an injected `<img onerror>` string was preserved in outgoing `htmlBody`; this corrects checked-area item 5 without weakening the safe standard-report renderer result.

## Final Position

The corrected audit contains 50 findings: 4 CRITICAL, 38 HIGH, 8 MED, and 0 LOW. PRG-005's downgrade does not change the NO-GO decision; PRG-041/047 and PRG-044/048 add direct reliability, confidentiality, and accountability blockers that reinforce it.
