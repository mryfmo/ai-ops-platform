# T27 Report: G6 Metrics Correctness

Status: ready_for_review

Branch: `agent/T27`
Base: `agent/T26`
Commit: `8f5e720`
PR: https://github.com/mryfmo/ai-ops-platform/pull/22

## Summary

Implemented the T27 metrics corrections and the revise section from `.orchestration/tasks/T27-g6-metrics-correctness.md`.

## Methodology Sources

- DORA guide, "DORA's software delivery performance metrics" (`https://dora.dev/guides/dora-metrics/`): confirms the current five-metric model, throughput/instability grouping, failed deployment recovery time, reliability as the current fifth metric, and warns against blending metrics across disparate applications/services.
- DORA 2024 research landing page (`https://dora.dev/research/2024/`): current DORA source used for report-era grounding.
- ILPA reporting template resources (`https://ilpa.org/reporting-template/`): confirms current ILPA reporting-template direction and standardization focus. This repo does not contain the full PCMT workbook, so T27 implements deterministic board-pack mechanics (targets, variance, trend) and avoids invented financial detail.

## Implemented

- D-A1/D-A5/D-A6/D-A2/3/4/D-G3:
  - `DoraSummary` now returns `null` for missing metric sets instead of misleading zero.
  - Failed deployment recovery time uses only change-caused, resolved incidents and median duration.
  - Unsupported rework rate was removed from the data model, UI, charts, report templates, and tests. There is no current deterministic data source for it and it is not the DORA 2024 fifth metric.
  - Added DORA band classifier with `na` for missing data.
  - DORA labels updated from MTTR/4 metrics to DORA 5 / failed deployment recovery time.
- Revise R-A1/R-A2/R-A3/R-A4:
  - `fetchDeployments` is now period-windowed by production deployment timestamp.
  - Failed deployment recovery causality is constrained to a 24-hour deploy-to-detection window. This is a conservative local proxy because the schema has no exact incident-deployment foreign key.
  - Portfolio DORA is calculated from the scoped raw deployment/incident records, not median-of-medians or median-of-rates.
  - Rework was removed rather than shown as a hard-coded zero.
- Revise 第3巡 F1-F4:
  - Portfolio failed deployment recovery time now passes incident-unit pooled records to `calculateDoraSummary`, so a multi-project incident contributes once to the portfolio median while still contributing to each affected project's service summary.
  - Deployment causality checks now fetch candidate failed deployments from `periodStart - 24h` through `periodEnd`; DORA deployment frequency/CFR denominators still use only `[periodStart, periodEnd)`.
  - Investor board-pack trend history now uses raw per-company snapshots and recomputes ownership-weighted values. Precomputed aggregate trend echo arrays are not accepted.
  - Dead exports `countTotalIncidentsInPeriod` and `countTotalItemsInPeriod` plus their self-tests were removed after confirming no non-test callers remained.
- NEW-1/NEW-2:
  - `devopsReportData` no longer maps rollback state to both CFR and rework.
  - Unresolved incidents are no longer converted to zero-hour recovery.
- D-C2/D-C3:
  - Throughput uses `pm_events` closed issue and merged PR events, not incident inflow or hard-coded PR zero.
  - Reopened/reclosed subject IDs are de-duplicated and `not_planned` issue closes are excluded.
  - Cycle-time/WIP were removed from the velocity card because the current production source lacks issue/PR lifecycle state for those calculations.
- D-E2/D-E3:
  - Added monthly Seven Keys questionnaire provider wiring through `PrjopsReportDataProvider`.
  - K1/K2/K6/K7 remain grey when missing and reflect questionnaire RAG when supplied.
  - K3 compares actual progress to elapsed schedule expectation when start/end/as-of dates are available.
- D-F1/D-F3:
  - Investor revenue/EBITDA are ownership-weighted.
  - Heterogeneous delay/risk metrics stay per-company detail, not cross-company sums.
  - KPI rows include target and variance from provider board-pack inputs.
  - Trend is deterministically recalculated from board-pack history snapshots; raw trend arrays are not accepted as a computed metric.
  - Milestone delay days remain `null`/未取得 because the current provider has no real delay-days source.
- D-B1/B2/B3 and D-D:
  - Incident/issue-action burndown now seeds opening backlog instead of silently clamping negative remaining.
  - Remaining counts can be evaluated at period end.
  - Coverage risk is softened linearly; test failures remain hard risk.

## Scope Notes

- Closed issue / merged PR throughput uses existing `pm_events`; no schema migration was needed.
- Exact incident-to-deployment linkage is not present in the current DB schema. T27 adds `IncidentRecord.causedByDeployment` and maps web data with the conservative existing signal available: same project with a failed deployment in the 24 hours before incident detection. The limitation is documented rather than hidden.
- Coverage data remains `null` in `devopsReportData`; T27 only softens the risk score function. Real coverage ingestion remains outside this task.
- Carry-forward items not implemented: shared metrics enum and double-signal webhook+poll integration test. No clear existing implementation target was identified in the T27 code path; recorded as follow-up, not claimed.

## Validation

- Focused devops tests: PASS, 3 files / 39 tests.
- Focused prjops tests: PASS, 3 files / 24 tests.
- Focused web tests: PASS, 5 files / 45 tests.
- 第3巡 focused devops/prjops/web tests: PASS.
- `pnpm -r --if-present run typecheck`: PASS.
- `mise run ci`: PASS, parallel command, no `-j 1`.

No real external API calls, real LLM calls, dependency additions, migrations, merges, or force-pushes were performed.
