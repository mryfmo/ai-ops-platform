# T15 Report: consistency fixes + stack integration

## Summary

- Branch: `agent/T15`
- Base stack: `agent/T13`
- Merged: `origin/agent/T06`, `origin/agent/T08`
- Validation: `mise run ci` green with parallel execution, not `-j 1`.
- No real API calls were made. GitHub/Graph behavior is covered by injected client tests.

## Finding Response Table

| Finding | Status               | Response                                                                                                                                                                                                                      |
| ------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-1     | fixed                | Merged `origin/agent/T06` and `origin/agent/T08`; resolved spec-id, shared barrel, server composition, and lockfile conflicts while preserving both branches.                                                                 |
| A1      | fixed                | ADR-0007 exists after T06 merge and is present in traceability/ADR reference checks.                                                                                                                                          |
| A2      | fixed                | `GITHUB_PROJECT_NODE_ID` config now wires PM snapshot reconcile to `GitHubClient.listCurrentProjectV2Snapshots`; unconfigured runtime writes an explicit disabled audit record instead of using a production stub.            |
| A3      | fixed                | `statusTransitions` counts only events with non-null `fromStatus` or `toStatus`; regression test added.                                                                                                                       |
| A4      | fixed                | `PmTimeseriesRepo` test now asserts `from_status`/`to_status` INSERT values are preserved.                                                                                                                                    |
| A5      | fixed                | `projects_v2_status_update` normalization test added for project status events.                                                                                                                                               |
| B1      | fixed                | Excel import engine uses `getGraphqlRateLimit()` and sleeps until `resetAt` when remaining points are below the configured floor.                                                                                             |
| B2      | documented-scope-out | ADR-0008 corrected: import marker is a human trace marker, not a second dedupe defense. Ledger remains the dedupe source of truth.                                                                                            |
| B3      | fixed                | Excel parser sanitizes unknown header names and validation error columns; regression test added.                                                                                                                              |
| B4      | fixed                | Removed dead `void kindForSheet` traceability shim.                                                                                                                                                                           |
| C1      | fixed                | `verifyTraceability` now fails on ADR references without a matching `docs/adr/<id>-*.md` file.                                                                                                                                |
| C2      | fixed                | AGENTS.md documents spec-id namespace as `system + ID`, allowing identical numbers across PrjOps/DevOps.                                                                                                                      |
| 2-1     | fixed                | Seven Keys questionnaire is wired through `PrjopsProjectRecord.questionnaire` into `ExecutiveProjectInput.questionnaire`; K1/K2/K7 regression test added. Persistent UI/API remains outside the current provider abstraction. |
| 2-2     | documented-scope-out | Monthly PDCA pure function remains verified, but persistence/job wiring needs a monthly store design; ADR-0010 and `verification/VERIFICATION_REPORT.md` record this as requires-follow-up.                                   |
| 2-3     | fixed                | Seven Keys RAG thresholds are named calibration constants and ADR-0010 documents them as tunable initial values.                                                                                                              |
| 2-4     | fixed                | Investor metric `version` is `string`; metric values are computed from `INVESTOR_METRIC_DEFINITIONS.compute`.                                                                                                                 |
| 2-5     | fixed                | Investor summary handler now has a non-investor 403 regression test.                                                                                                                                                          |
| 2-6     | fixed                | Investor KPI/milestone/risk numeric table cells render with `tabular`.                                                                                                                                                        |
| 2-7     | fixed                | K6 grey fallback test added for no high-severity risk and no risk questionnaire.                                                                                                                                              |
| 2-8     | fixed                | AGENTS.md ADR list updated through ADR-0013.                                                                                                                                                                                  |
| 2-9     | fixed                | Old "数値4項目" comment and dead `color` mapping were removed from executive summary wiring.                                                                                                                                  |
| 2-10    | fixed                | Executive Seven Keys view test now inspects shape symbol plus text label in the RAG cell.                                                                                                                                     |
| 3-1     | fixed                | Report-generation CI now asks LLMs for slots-only JSON; metrics, report type, period, and evidence IDs are injected by repository code.                                                                                       |
| 3-2     | fixed                | CI path includes retry around LLM generation/finalization, deterministic truncation in `finalizeReportJson`, and audit JSON for retry/truncation events.                                                                      |
| 3-3     | fixed                | Reporting source files have evidence headers; `verifyTraceability` enforces evidence headers for `packages/shared/src/reporting/*.ts`.                                                                                        |
| 3-4     | fixed                | E-RPT03 empty evidence ID header regression test added.                                                                                                                                                                       |
| 3-5     | fixed                | Audit-listed test titles now include explicit REQ/SPEC/AC IDs.                                                                                                                                                                |
| 3-6     | fixed                | Client `PageAgentContext.persona` was removed; server continues to use resolver-derived persona.                                                                                                                              |

## Notes

- T08 `generateTemplate` was moved out of the shared barrel export path to prevent import-time xlsx generation during parallel CI.
- `packages/traceability/output/traceability_matrix.md` changed intentionally because T15 adds traceability guard output.
