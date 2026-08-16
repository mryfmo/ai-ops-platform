# P6-T11 Status Ingest Pipeline

## Summary

Email / Teams / GitHub payloads now converge on one sanitized, bounded event and one Temporal workflow. The workflow delegates all six-field completeness and max-three clarification decisions to the preserved contract, atomically claims each source message in PostgreSQL, reconciles every non-idempotent effect, persists accepted updates through an injected PrjOps canonical writer, sends action-specific notifications, and records metadata-only `E-ING-*` transitions through `AuditLogWriter.append`.

## Delivered

- Strict pure normalizers for email, Teams, and GitHub with deterministic source/thread identities and secret sanitization before persistence.
- Teams fetch-on-notify adapter restricted by type and runtime marker to the app-only `GraphSystemClient` surface.
- Temporal unknown-boundary validation, preserved-contract receipt parity, shadow read-only evaluation, source duplicate suppression, external-effect single-attempt/reconcile, and CAS terminal completion.
- PrjOps activity wiring for canonical persistence, notification, append-only audit, and authoritative effect reconciliation.
- PostgreSQL operational store with per-source rows and per-thread transaction advisory locking; no original message body or parallel canonical status content is stored.
- Recorded history proving claim → audit → canonical → notification → completion → audit ordering and replay determinism.
- Coverage configuration follows the existing Temporal sandbox policy: the bundled workflow is exercised by workflow/replay tests and excluded from host-process V8 coverage accounting.

## Authority Boundaries

- The preserved `statusIngestContract.ts` and `freeTextValidation.ts` were not changed.
- External `prjops-data/status_updates` remains the status-update authority. PostgreSQL contains only dedupe, clarification, side-effect, and terminal receipts.
- Graph delegated identities are structurally excluded; no LLM is used for completeness, action, count, or identity decisions.
- Shadow execution performs only the persistent thread-count read and dispatches no write, notification, or audit activity.

## Validation Summary

- Focused normalizer/adapter/activity tests: green.
- Temporal matrix: email / Teams / GitHub × accept / clarify at prior counts 0,1,2 / escalate at 3 / duplicate; shadow and lost-response reconciliation: green.
- Recorded Temporal history replay: green.
- Real PostgreSQL concurrency/constraint tests and `mise run ci`: green.
