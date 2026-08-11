# T20 Report: Critical/High Adversarial Review Fixes

## Summary

Implemented T20 CRITICAL/HIGH fixes on `agent/T20` from `agent/T17`.

PR: https://github.com/mryfmo/ai-ops-platform/pull/15

## Finding Map

| Finding | Status | Resolution |
| --- | --- | --- |
| L2-1 CRITICAL: xlsx import unauthenticated | fixed | `/xlsx-import/dry-run` and `/xlsx-import/execute` now require HMAC-SHA256 over the raw XLSX body via `XLSX_IMPORT_SECRET`. Missing secret fails closed with 503 + `xlsx_import_disabled`; missing/bad signatures return 401 + `xlsx_import_rejected`; execute checks `XLSX_IMPORT_ALLOWED_REPOS` and rejects outside repos with 403 + `xlsx_import_repo_rejected`. |
| L1-1/L1b-4 HIGH: Excel import non-atomic duplicate | fixed | Import ledger now writes `pending` before GitHub writes and transitions to `imported` with `markImported`. Pending/failed rows are treated as existing ledger rows, preventing duplicate GitHub writes on retry. Failure progress now includes error text; DB ledger records `error`. |
| L1-2 HIGH: report ID generatedAt timestamp causes duplicate delivery | fixed | `standardReportId` now hashes content identity only: `reportType`, `period.label`, `metrics`, and `slots` with stable key ordering. `period.generatedAt` remains stored but no longer changes the ID. |
| L1-3 HIGH: mail send before delivery log causes unmarked duplicates | fixed | Delivery log is now `pending` before email send and `sent` after success. Pending replay sends with `(再送)` in the subject. PostgreSQL delivery log stores `status` and `exists` only treats `sent` as delivered. |
| L3-A1 HIGH: ADR-0003 contradicts removed workflows | fixed | ADR-0003 body no longer claims `packages/prjops/src/workflows/*.yml` is shipped. AGT01/AGT06 headers explicitly state package-local scheduler/workflows are not implemented at T20. T17 process report wording was corrected locally. |
| L3-D1 HIGH: traceability corpus excludes server | fixed | Traceability corpus now includes `packages/server` src/tests for both PrjOps and DevOps indices. Generated traceability matrix was refreshed and remains green. |

## Notes

- No dependency additions.
- No real API calls.
- The import and delivery state transitions use dedicated DB table UPDATEs, not `audit_log` mutation.
- `.orchestration/reports/T17-report.md` wording was corrected as ignored process evidence and is intentionally not part of the commit.
