# A044 approvals foundation report

## Status

Ready for review. A044 now supplies authenticated approval creation, listing, and CAS decisions for change approvals, plus the report/JIT persistence foundation. No downstream deployment, report-delivery, or grant action is triggered by a decision.

## Delivered

- Added a dedicated `WEB_BFF_IDENTITY_SECRET` contract. Auth.js-derived Entra `(tenant_id, object_id)` is bound to `v1|method|path|sha256(body)|tenant|object|issuedAt` with HMAC-SHA256, a 90-second TTL, canonical inputs, and constant-time verification. Missing configuration disables approvals with 503/degraded capability.
- Added fresh schema and migration for `approvals`, including nullable `project_id` for A051, pending-target uniqueness, delivery visibility, decision constraints, and append-only audit integration.
- Added `ApprovalsRepo` with idempotent pending creation, delivered-only listing, atomic state/audit transactions, `markDelivered`, and pending CAS conflict handling.
- Added Hono list/decision routes. Stable subjects are resolved against an active recipient assignment on every request. Change decisions allow only PRF-L/PRF-G; all other profiles and report/JIT decisions fail closed with 403 and audit evidence.
- Added authenticated Web BFF routes and approval UI. Reject requires a reason; the BFF enforces same origin, ignores browser-supplied identity, bounds inputs, signs the exact upstream request, sanitizes upstream failures, and rejects JSON `null` as 400.
- Wired AGT_CHG to create an approval, send only the WebUI decision link, and expose the approval only after successful Graph delivery. A retry reuses the same pending target rather than creating duplicate actionable records.
- Added logger redaction and configuration inventory coverage for the new secret.

## Rulings and deferred scope

- The investigation gate established that loopback/internal routing is not an identity trust boundary. The operator selected the dedicated signed-envelope design and explicitly authorized config/docs/logger scope.
- The operator selected the minimal authorization gate for A044: PRF-L/PRF-G may decide change approvals; all other actions fail closed. Fine-grained `project_id` scope enforcement is explicitly deferred to A051, with the nullable column added now.
- The operator specified the 90-second request identity envelope plus transactional CAS and explicitly did not require a per-card nonce in A044. Older 30-minute nonce/jti text is therefore not implemented in this task.

## Review disposition

Three independent `codex review --uncommitted` passes were performed. Atomic audit/state, input bounds, undelivered visibility, pending deduplication, decided-row conflict semantics, tenant-qualified audit actors, and JSON-null validation were fixed. Repeated project-scope and nonce findings were dismissed only because the operator rulings assign those contracts to A051 / the A044 envelope design.

`make require-crit-review` was attempted but this repository has no such target, so the available Codex review surface was used. See `.orchestration/validation/A044-review-receipt.md`.

## Validation

- RED/GREEN tests covered signing/tampering/expiry, route authn/authz, CAS and atomic rollback, real PostgreSQL schema/repository behavior, delivery ordering/deduplication, Web UI, same-origin BFF behavior, config/degradation, and secret redaction.
- Final `mise run ci` passed with real PostgreSQL on 2026-08-08, including governance, audit, lint, traceability, formatting, build, typecheck, coverage tests, and database integration.
- No dependency or lockfile changes.

## Allowed-file notes

The existing `packages/devops/tests/agtHumanReviewCards.test.ts` was extended instead of the task's non-existent `agtChg.test.ts`. Identity/config/docs/logger/recipient files were added under the explicit task updates that authorized the signed identity secret, its redaction, and request-time active role resolution.

## Pull request

- Commit: `884d54d6a98a1d58eda64bf9ec3700a614724779`
- PR: https://github.com/mryfmo/ai-ops-platform/pull/144
- GitHub checks: `build-test` pass, `gitleaks` pass, CodeRabbit pass; merge state `CLEAN`.
- The automated project-scope review thread received the A044/A051 operator ruling and was resolved. No unresolved review threads remain.
