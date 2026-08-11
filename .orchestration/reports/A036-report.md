# A036 report

## Status

Ready for review.

## Result

- Added a 1 MiB operational request-body limit to `POST /webhooks/graph` with the existing `hono/body-limit` middleware.
- Documented that 1 MiB is a project policy cap, not a published Microsoft Graph webhook maximum. The current subscriptions omit `includeResourceData`, leaving about 100x headroom for metadata-only batches and future `validationTokens`.
- Kept Hono's default 413 response for oversized requests.
- Intentionally omitted append-only audit logging for oversized unauthenticated input to avoid attacker-controlled log amplification. Graph delivery failure remains visible upstream, and channel polling is the existing recovery path.
- Added positive and adversarial tests, including an oversized body without `Content-Length` so the streaming enforcement path is exercised.
- Regenerated the traceability matrix; only its generation timestamp changed.

## Files

- `packages/server/src/http/routes/graphNotifications.ts`
- `packages/server/tests/graphNotificationsBodyLimit.test.ts`
- `packages/traceability/output/traceability_matrix.md`

## Validation

- Targeted test: 2 passed.
- Server typecheck and lint: passed.
- `mise run ci` with disposable PostgreSQL 16: passed, including 530 server tests and PostgreSQL integration.
- Codex uncommitted-diff review: no findings.
- `make require-crit-review` was unavailable because this repository has no Make target by that name; `crit status --json` also reported no review file, so no browser Crit review was opened.

## Delivery

- Commit: `3fcaec42cbe88d9c2ffb623f79eed10a8c7c1866`
- Draft PR: https://github.com/mryfmo/ai-ops-platform/pull/140
- Base/head: `main` <- `agent/a036-graph-body-limit`
- Label: `ai-generated`
- GitHub checks: build-test, gitleaks, and CodeRabbit all passed.
