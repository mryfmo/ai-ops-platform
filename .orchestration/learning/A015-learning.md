# A015 Learning

## Validated Learnings

- A dry-run digest and an owner payload signature protect different boundaries:
  the signature authenticates canonical logical content, while the exact raw
  digest prevents JSON/CSV bytes from changing between dry-run and apply.
- A visible localhost URL is not sufficient sandbox proof if connection query
  parameters can override the actual host. Sandbox confirmation must reject
  alternate connection parameters before constructing the pool.
- An algorithm label must be bound to the public-key type and curve. Generic
  SHA-256 verification alone can accept an RSA signature under an ES256 label.
- A014 intentionally makes pending legacy rows inactive. T04 may activate only
  that pending quarantine state; an already-applied inactive row remains
  fail-closed for `migrate_active`.

## Application

- Applied to the pure signed mapping parser/planner, sandbox CLI boundary,
  transaction integration tests, and operator runbook.
- Worklog learn update was not performed because A015 forbids worklog edits.
