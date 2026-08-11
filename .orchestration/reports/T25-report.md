# T25 Report: G4 observability

## Summary

- A-1 fixed: server runtime logs now use pino structured JSON logs with configurable `LOG_LEVEL`. CLI stdout/stderr output is kept as process streams, not `console.*`.
- A-2 fixed: OpenTelemetry Node SDK auto-instrumentation is wired for HTTP/pg and starts only when an OTLP trace endpoint is configured. When unset, startup logs one explicit `telemetry disabled` structured record.
- A-2/A-13 fixed: `GET /metrics` exposes Prometheus text for events queue depth/age, scheduler task duration/failures, report delivery outcomes, and PostgreSQL pool counts.
- A-13 fixed: `runbooks/observability-slo.md` documents SLOs and alert thresholds for ingest latency, report delivery success, and scheduler task success.
- A-3 fixed: `/readyz` returns 503 during graceful shutdown as well as failsafe/dependency failure.
- A-4 fixed: signal shutdown flips readiness false, awaits HTTP drain via `server.close`, then `scheduler.stop`, `pool.end`, and telemetry shutdown with a timeout.
- T24 carry-over fixed: migration docs warn that one-transaction migrations cannot use `CREATE INDEX CONCURRENTLY`; rollback failure now releases the migration client with `release(err)`.
- T25 revise fixed: shutdown signal handling is single-entry, graceful shutdown clears its timeout timer, and event queue gauges reset drained statuses to zero.

## Finding Map

| Audit finding | Status | Evidence |
| --- | --- | --- |
| A-1 structured logs | fixed | `packages/server/src/observability/logger.ts`, `packages/server/src/index.ts`; `rg "console\\." packages/server/src packages/devops/src` returns no matches. |
| A-2 OpenTelemetry | fixed | `packages/server/src/observability/telemetry.ts`, config keys `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`; `telemetry.test.ts` covers disabled explicit log. |
| A-2 metrics | fixed | `packages/server/src/observability/metrics.ts`, `/metrics`, events queue metrics, task duration/failure metrics, delivery metrics, DB pool gauges. |
| A-13 SLO/alerts | fixed | `runbooks/observability-slo.md`, `docs/README.md`, `docs/reference/http-api.md`. |
| A-3 readiness during shutdown | fixed | `createReadinessCheck` and `app.test.ts` shutdown readiness case. |
| A-4 graceful shutdown | fixed | `serverLifecycle.ts` and `serverLifecycle.test.ts` verify readiness flip and drain order. |
| T24 transaction-incompatible DDL note | fixed | `.claude/skills/db-migration/SKILL.md`, `runbooks/database-migrations.md`. |
| T24 rollback double failure test | fixed | `packages/devops/tests/migrate.test.ts` covers rollback failure `release(err)`. |
| T25-R1 shutdown signal reentry | fixed | `createShutdownSignalHandler` gates repeated signals via `isShuttingDown`; `serverLifecycle.test.ts` covers double invocation only running shutdown once. |
| T25-R2 shutdown timeout leak | fixed | `gracefulShutdown` clears the timeout in `finally`; `serverLifecycle.test.ts` verifies successful shutdown leaves no fake timers. |
| T25-R3 stale queue gauges | fixed | `MetricsRegistry.setEventQueue` resets `queued/delayed/dispatched/dead` gauges before applying rows; `metrics.test.ts` covers drain-to-zero. |

## Notes

- Added only T25-approved dependencies: `pino`, `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`.
- Custom metrics use the native `/metrics` text endpoint to avoid adding `prom-client`.
- No real API calls or real DB calls were made by tests.

## Validation

- `pnpm --filter @aiops/server test`: PASS, 36 files / 220 tests.
- `pnpm --filter @aiops/devops test`: PASS, 16 files / 158 tests.
- `pnpm --filter @aiops/server lint`: PASS.
- `pnpm --filter @aiops/devops lint`: PASS.
- `pnpm --filter @aiops/server typecheck`: PASS.
- `pnpm --filter @aiops/devops typecheck`: PASS.
- `pnpm exec prettier --check .`: PASS.
- `mise run ci`: PASS, no `-j 1`; sandbox run failed first with known `tsx` IPC EPERM, sandbox-external rerun passed.
- revise `mise run ci`: PASS, no `-j 1`; sandbox run failed first with known `tsx` IPC EPERM, sandbox-external rerun passed.

## PR

- Branch: `agent/T25`
- Base: `agent/T24`
- Commits: `ce25e38`, `36e3d25`
- URL: https://github.com/mryfmo/ai-ops-platform/pull/20
