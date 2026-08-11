# T30 Learning Triage

## Reusable observations

1. A green lexical traceability gate is not production evidence. Require semantic mappings and production-path tests.
2. Mock query tests do not validate PostgreSQL partition/role DDL. Fresh-schema and migration tests need a real supported PostgreSQL instance.
3. Coverage totals hide composition risk. Production roots, supervisors, hosted workflows, and adapters need explicit coverage expectations.
4. “Disabled with audit” is honest degradation only after the audit store itself is proven available.
5. Runbooks must be staged and executed; line-by-line code alignment is insufficient when commands target placeholder workflows or unenforced roles.
6. Workflow lint must include repository-local reference existence; valid YAML can still deterministically fail on its first event because a script/action path is absent.

## Candidate decisions

- Candidate: make real PostgreSQL fresh-schema + migration + role denial a mandatory CI job for database-backed services.
- Candidate: require every production composition to reject in-memory/sample providers at startup.
- Candidate: require a go-live evidence ledger with owner/date/environment for external settings.

## Promotion

No rule or skill was promoted by the worker. These candidates require orchestrator/maintainer review after T30 acceptance.
