# A017 Learning Triage

## Reusable Observations

1. A pinned snapshot provider should consume the parsed documents returned by
   the schema validator. Re-parsing validated source text creates an unnecessary
   second interpretation path and requires consumer packages to depend on the
   serialization library.
2. Scope safety is easiest to audit when the provider interface exposes only a
   scoped query. Retaining unscoped list/get methods lets downstream consumers
   accidentally recreate fetch-all-then-filter behavior.
3. Filesystem snapshot integrity requires more than path normalization:
   no-follow file opens, root identity checks around the read, accepted commit
   provenance, and an external content checksum close distinct substitution
   windows.
4. Focused cross-package Web tests can read stale generated workspace
   entrypoints. Build the modified dependencies before consumer-only focused
   tests; full `mise run ci` already enforces the correct order.

## Promotion Decision

No repository learn file or new skill was promoted. These observations are
recorded for orchestration review, while A017 explicitly forbids worklog edits.

