# A039 report

## Status

Ready for review.

## Result

- Moved all capability composition predicates into the pure `deriveCapabilityState()` function in `src/lib`, leaving `index.ts` to normalize config/runtime facts and wire dependencies.
- Added composition tests for GitHub outbound/XLSX/PM snapshot, report delivery, Teams default channel, and Graph subscription presence.
- Added a 30-second capability refresh to the existing scheduler so `graph_subscriptions` metrics update without `/readyz` traffic or database work on each `/metrics` scrape.
- Preserved the existing subscription-ledger readiness check so schema/permission failures still make `/readyz` return 503.
- Preserved cached degraded details when `isReady()` throws and recomputed them after a successful readiness refresh.
- Regenerated the traceability matrix; only its generation timestamp changed.

## Review response

- PR #139 unresolved P1 (pure predicates): addressed.
- PR #139 unresolved P2 (metric refresh independent of `/readyz`): addressed with the existing scheduler.
- PR #139 unresolved P2 (degraded details on `isReady()` exception): addressed.
- No GitHub review thread was replied to or resolved; the orchestrator owns thread closure.

## Documentation consistency

`docs/reference/http-api.md` on the PR branch and `origin/main` still documents only `{ ready: true }` / `{ ready: false }`, while the implementation returns a `degraded` array. This is a remaining contradiction. The file was outside A039's allowed files, so it was reported rather than edited. PR #138 remains open and concerns `/metrics` authentication/log redaction; it does not currently supply the `/readyz` contract update.

## Files

- `packages/server/src/lib/degradedCapabilities.ts`
- `packages/server/src/index.ts`
- `packages/server/src/http/routes/health.ts`
- `packages/server/tests/degradedCapabilities.test.ts`
- `packages/server/tests/health.test.ts`
- `packages/traceability/output/traceability_matrix.md`

## Validation

- Test-first failures observed for missing pure derivation, exception-path degradation loss, and successful-probe stale state.
- Targeted server tests: 48 passed.
- Final `mise run ci` with disposable PostgreSQL 16: passed, including 549 server tests and PostgreSQL integration.
- Final Codex uncommitted-diff review: no actionable findings.
- `make require-crit-review` is unavailable because this repository has no target; `crit status --json` reported no review file, so no browser Crit review was opened.

## Delivery

- PR: https://github.com/mryfmo/ai-ops-platform/pull/139
- Base/head: `main` <- `agent/a034-degraded-observability`
- Commit: `3587ae03d432918cc608ed357a6c03eb265a9866`
- GitHub checks: build-test, gitleaks, and CodeRabbit passed.
