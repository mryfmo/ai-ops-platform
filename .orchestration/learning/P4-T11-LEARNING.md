# P4-T11 Learning

## Reusable Findings

1. Metadata-only dashboards should enforce both an explicit SQL projection and a strict response schema; either boundary alone can regress into content leakage.
2. Role scoping belongs in every aggregate and detail query. Filtering only detail rows or masking after aggregation leaks counts.
3. Re-reading active recipient assignments per request avoids stale authorization when an assignment is deactivated.
4. Out-of-scope and nonexistent identifiers should share the same 404 response to avoid an existence oracle.
5. Canonical E-code validation in SQL prevents arbitrary policy reason/error text from becoming an operational content channel.

## Apply To

- Future model/tool ledger dashboards and export endpoints.
- MCP operations alerting and registry drift monitoring.
- Any role-scoped aggregate over evidence tables.
