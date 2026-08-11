# A044 review receipt

```yaml
review_surface: codex-review
reviewer: codex
review_source: codex review --uncommitted (three passes, 2026-08-08)
review_outcome: actionable findings resolved; operator-governed deferrals documented
```

## Resolved records

- State and audit now commit or roll back together through one injected PostgreSQL client.
- Request body/reason bounds fail closed.
- Undelivered approvals are invisible; pending target creation is idempotent; decided rows return conflict rather than not-found.
- Audit actors include canonical tenant and object IDs.
- Valid JSON `null` is rejected as 400 before property access (RED/GREEN regression test).

## Operator-governed dispositions

- Project membership scope: explicitly deferred to A051; A044 stores `project_id` and enforces request-time active PRF-L/PRF-G role authorization.
- Per-card nonce/jti and 30-minute URL expiry: superseded for A044 by the explicit 90-second signed identity-envelope plus transactional CAS ruling.

`make require-crit-review` was attempted and was not available in this repository, so no Crit data source existed to consume.
