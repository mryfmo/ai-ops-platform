# MCP Operations Dashboard and Audit Query

根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / FinalArch:MCP-004 / FinalArch:MCP-006 / ADR-0023 / WBS P4-T11

## Access

`/app/dashboard/mcp-ops` is available only through an authenticated Web session. The Web BFF signs the stable Entra subject for each request; the Hono server then reloads the active recipient assignment from PostgreSQL. Assignments are never cached.

- `PRF-G` with `scope_mode=global`: all MCP metadata.
- `PRF-L` with `scope_mode=project`: only rows whose policy decision `resource.projectId` belongs to the current recipient assignment.
- Other or inconsistent roles/scopes: `403` and an append-only authorization-denied audit event.
- A missing or out-of-scope invocation is returned as `404` without revealing which case occurred.

## Views

The dashboard shows a fixed 24-hour window:

- tool usage by server, tool, risk, and terminal status;
- policy decision count, deny rate, and canonical deny E-code distribution;
- canonical tool error-class distribution;
- P4-T02 registry declared schema hash versus the approved hash (`match`, `drift`, or `unavailable`).

All numbers are calculated by deterministic SQL/TypeScript. No LLM is used.

## Audit query

Enter an invocation UUID in the dashboard, or call the authenticated Web BFF:

```text
GET /app/api/mcp-ops/invocations/{invocationId}
```

The fixed server query joins `tool_invocations` to its `policy_decisions` row and the latest matching `action_ledger` row by workflow, trace, server, and operation. Project scope is part of the SQL `WHERE` clause, not a display-layer mask.

Returned fields are allowlisted metadata only:

- correlation: invocation, workflow, trace, actor;
- tool: server, pinned version, name, risk;
- resource: ID and in-scope project ID;
- policy: decision ID, bundle version, decision;
- result: terminal status, canonical E-code, latency;
- action ledger: operation ID, status, canonical E-code.

The API never selects or returns tool input/result content, `input_hash`, `resource_scope`, policy `reasons`/`obligations`, action `resource_key`, or external payloads. Noncanonical reason/error strings collapse to `E-REDACTED`, and the Web BFF rejects upstream objects containing fields outside the strict metadata schema.

## Registry drift response

- `match`: one canonical registry `schema_hash` equals the approved SHA-256 file.
- `drift`: the registry hash is missing, duplicated, malformed, or different.
- `unavailable`: the approved hash is invalid or either source cannot be read.

Treat `drift` and `unavailable` as fail-closed operational states; use the P4-T02 generator/check workflow to resolve them. The dashboard does not modify the registry or gateway configuration.
