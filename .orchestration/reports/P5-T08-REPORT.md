# P5-T08 Work IQ Provenance Evidence

## Outcome

Implemented a metadata-only, append-only receipt for delegated Work IQ `ask`/`fetch` calls and a source-reference accessibility probe for WIQ-001/002/005. The implementation never returns fetched source content as evidence and the receipt API/schema have no raw question or response field.

## Receipt Contract

- Records subject, tenant, `ask`/`fetch`, SHA-256 question hash for `ask`, source-reference metadata, permission context, provenance completeness, optional policy decision correlation, status/E-code, trace ID, and timestamp.
- Applies the existing deep secret sanitizer before JSON metadata reaches PostgreSQL.
- Uses `INSERT` only. PostgreSQL statement triggers reject `UPDATE`, `DELETE`, and `TRUNCATE` for every role; `app_role` receives only `SELECT`/`INSERT`.
- An `ask` requires a lowercase SHA-256 digest; a `fetch` requires a null question hash. Successful receipts cannot carry an E-code, and failed/blocked receipts must carry one.
- DELTA-03: this table is only for the delegated `/m365/query` path. A future gateway path correlates through policy decision/trace IDs and does not double-record the same call here and in `tool_invocations`.

## Accessibility Evidence

- Resolves at most 32 source-reference metadata objects through an injected resolver and calls an injected Work IQ `fetch` client bound to the same delegated user.
- Marks an item accessible only when fetch succeeds and returned subject/tenant exactly match the expected delegated identity.
- Returns only reference indexes, accessibility booleans, and fixed E-codes. Work IQ source content is discarded.
- The Work IQ client preserves an explicit outer/inner HTTP 403 as `E-WIQ-ACCESS-DENIED`; the two-user differential passes only when every source is reachable by user A and at least one reference returns that authorization-specific denial for distinct user B in the same tenant. Operational failures remain inconclusive.

## Scope

No route wiring, real tenant request, credential, app-only flow, external dependency, raw content persistence, existing audit/approval/tool-ledger mutation, push, PR, merge, or approval was introduced.
