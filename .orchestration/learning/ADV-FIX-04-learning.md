# ADV-FIX-04 Learning

## Reusable findings

1. A manifest authority is not established by a trusted path alone. The issuer must bind exact bytes and digest before writer execution, persist both immutably, and deliver the same digest to coding and review consumers.
2. Repository-root contracts are not present in the server runtime container. A closed production template plus an exact-byte parity test against the real generic contract preserves fail-closed runtime deployment without adding a second package boundary.
3. Copying a post-agent guard to runner temp is insufficient by itself. Fix an aggregate digest before agent execution and verify the trusted bundle immediately before executing the post guard.
4. Fresh schema files and migrations must be tested together. This repository's DB gate applies the migration runner after fresh schema, so new migration DDL must tolerate columns, constraints, functions, and triggers already existing.
5. Real-PG suites use both `TEST_DATABASE_URL` and separate `AIOPS_TEST_DATABASE_*` variables. Full CI evidence must bind all of them to the same disposable cluster.

## Apply to

- Future task-authority issuers and delegated execution workflows.
- Database migration plans and fresh-schema parity tests.
- Independent review artifact and digest contracts.
