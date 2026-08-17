# P8-T07 Learning

## Keep

- A Temporal idempotent-write activity must distinguish an exact committed retry from a merely equal current state. Verify the append-only transition fields as well as the authority snapshot before returning success.
- Put writer/reviewer graph, actor, version, and commit-range rules in one pure transition function; let the repository independently enforce the same trust-boundary invariants before CAS.
- Advance workflow state only from an exact persistence receipt, never directly from a signal.

## Avoid

- Treating `UPDATE ... WHERE version` row-count zero as unconditional failure or unconditional success. Re-read, then accept only exact persisted evidence and reject every divergence.
- Lowering coverage thresholds for Temporal sandbox accounting; host-test the exported boundary parser/receipt validator instead.

## Autoskill triage

- No new skill is warranted. These are project-specific CAS and Temporal patterns already captured in tests and the report.
