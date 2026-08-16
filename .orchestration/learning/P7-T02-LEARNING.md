# P7-T02 Learning

## Reusable Findings

1. Identity authorization belongs in the same acquisition query as the address lookup. Post-fetch filtering risks both data exposure and existence-oracle drift.
2. PostgreSQL `UNIQUE NULLS NOT DISTINCT` is the native minimal constraint for stable composite addresses whose root-thread component may be `NULL`.
3. When an existing primary key and a new dedupe unique key can both conflict, a named conflict target is race-sensitive. `INSERT ... ON CONFLICT DO NOTHING` followed by an exact-identity update preserves both constraints and rejects cross-scope collisions.
4. Retry-queue dedupe and domain source-message dedupe are different authorities; keep retry lifecycle out of the message/mapping tables.
5. A second identity check at the stateless channel boundary prevents an accidentally miswired authority result from reaching an AG-UI workflow.

## Apply To

- P7-T03 mention/follow-up flow, P7-T09 Teams-to-Workbench handoff, and future replaceable channel adapters.

No new dependency or skill was needed.
