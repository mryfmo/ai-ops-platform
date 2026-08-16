# P6-T11 Learning

## Reusable Findings

1. A retry-queue `events` table and a domain ingest claim are different authorities; sharing the table pollutes retry semantics. A narrow operational record is smaller and safer.
2. Clarification count must be serialized by thread, while dedupe must be keyed by source message. A source row plus transaction-scoped thread advisory lock satisfies both without a second head table.
3. Temporal claim receipts should be re-derived against the preserved pure contract. This turns DB/application drift into a non-retryable contract failure before any external write.
4. Append-only audit is still a non-idempotent external effect. Recording the workflow idempotency key in metadata and reconciling through `readAll` prevents blind duplicate appends after response loss.
5. Fetch-on-notify Teams ingestion needs both branded compile-time app-only separation and a runtime authentication marker check.

## Apply To

- Future source-ingest pipelines with per-thread state and per-message dedupe.
- Temporal activity implementations that append to immutable audit stores.
- Preserved-contract migrations where persistence receipts must prove parity.
