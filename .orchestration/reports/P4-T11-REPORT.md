# P4-T11 MCP Operations Dashboard and Audit Queries

## Overview

Added a metadata-only MCP operations dashboard and fixed audit query over the existing policy decision, tool invocation, and action ledger tables. Recipient scope is enforced in SQL on every request; the Web BFF accepts only strict allowlisted response shapes.

## Delivered

- Fixed 24-hour tool usage, deny-rate, deny E-code, and error-class aggregates.
- Invocation correlation across trace, actor, tool, resource, policy result, and the latest matching action ledger row.
- `PRF-G/global` and `PRF-L/project` data-layer authorization with active-recipient lookup on every request.
- Signed Web BFF routes and `/app/dashboard/mcp-ops` using existing session and identity-envelope boundaries.
- Registry schema-hash state (`match`, `drift`, `unavailable`) from the P4-T02 canonical files.
- Strict no-content projection: tool input/result, resource scope, hashes, policy reasons/obligations, and external payloads are never returned.
- Operator guide at `docs/guide/mcp-operations.md`.

## Posture

- No schema, migration, dependency, LLM, registry, gateway, or P4-T10 integration-file change.
- Noncanonical reason/error strings collapse to `E-REDACTED`.
- Missing and out-of-scope invocation IDs both return 404 after SQL scoping.

## Validation Summary

- Focused server tests: 6/6 green.
- Focused web tests: 5/5 green.
- Workspace coverage: exit 0; server 80 files / 879 tests, web 41 files / 330 tests.
- Real PostgreSQL probe: in-scope aggregate/audit returned metadata only; out-of-scope aggregate returned 0 and audit returned null.
- Typecheck, governance, formatting, webpack production build, and DB integration: green.
- Exact `mise run ci` reached the Web build but the local execution sandbox denied Turbopack's helper loopback bind (`Operation not permitted`). The same source completed `next build --webpack`; remaining CI phases completed separately. Clean-runner CI remains the final environment confirmation.

## Review Focus

- SQL scope predicates are present in every aggregate and invocation lookup.
- No raw content column is selected or accepted by the Web BFF.
- Authorization-denied requests append audit events and never reach the data repository.
- Registry status is observational and cannot mutate gateway configuration.
