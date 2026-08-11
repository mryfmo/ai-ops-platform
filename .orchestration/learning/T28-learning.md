# T28 Learning

- Codex bot comments across stacked PRs include duplicates and comments already resolved by later tasks; triage should cluster by finding, then verify against current tip.
- `tsx` traceability can require IPC pipe creation outside the default sandbox; if it fails with `listen EPERM .../tsx-*.pipe`, rerun the required CI with approved escalation rather than switching to `-j 1`.
- For report retries, idempotency belongs in the distribution ledger, not by suppressing duplicate ingest delivery attempts.
- For import ledgers, `pending` and `failed` are recovery states; only `imported` is a terminal idempotency skip.
- Imported milestone ledger rows must retain the GitHub milestone number and seed title resolution on later incremental runs; storing a node id there makes title-based issue imports unrecoverable.
- Numeric-looking milestone titles are still titles. Resolve them through the created/imported milestone map instead of treating them as GitHub milestone numbers.
