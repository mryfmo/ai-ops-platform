# T21 Report: MED/LOW Fixes and Documentation Refresh

## Summary

Branch: `agent/T21`
Base: `agent/T20`

T21 addressed the remaining MED/LOW correctness findings from lens1/lens1b and documentation staleness from lens3. Bug fixes were covered by focused regression tests added before implementation. No dependency additions or real API calls were introduced.

## Findings Matrix

| Finding | Status | Resolution |
| --- | --- | --- |
| L1-4 | fixed | Split Teams card delivery into an independent idempotent delivery-log key (`recipient#teams-card`). Email success is no longer counted as failed when card delivery fails, and the card can retry later. |
| L1-5 | fixed | Rejected `NaN`/`Infinity` metrics with `Number.isFinite`; `calculateReportMetrics` now throws explicit finite-number errors. |
| L1-6 | fixed | `countChars`/`truncateText` use grapheme segmentation via `Intl.Segmenter` with a normalized fallback. Added emoji/flag/family/accent regression coverage. |
| L1-7 | fixed | Invalid `baseDate` values now throw instead of silently producing invalid ranges. |
| L1-8 | fixed | XLSX date normalization preserves leading `YYYY-MM-DD` from strings and formats `Date` objects by local calendar fields to avoid timezone off-by-one drift. |
| L1-9 | fixed | Rate-limit waiting treats `remaining === floor` as safe, rejects past `resetAt`, sleeps only when needed, and refetches the limit after waiting. |
| L1-10 | fixed | Weekly report delivery now runs on the first business day of the week, covering Monday holidays, and reads a wider recent-report window (`listRecent(100)`). |
| L1-11 | fixed | PM snapshot reconcile skipped audit now includes the partial `stored` count. Scheduler running guard was confirmed as the re-entry guard. |
| L1-12 | fixed | Bad dashboard deep-link configuration skips and audits only the affected Teams recipient while continuing other recipients. |
| L1b-1 | documented-scope-out | Fail-safe remains status/audit only. `server/src/index.ts` and `verification/VERIFICATION_REPORT.md` now state that dispatch/task stopping is not implemented. |
| L1b-2 | fixed | `deployment`/`deployment_status` webhooks normalize into `pm_events` as deployment subjects, schema accepts `deployment`, and Web timeseries counts `deployment_status` as Deploy. |
| L1b-5 | fixed | Executive Seven Keys null checks now treat `null` like missing data and render grey instead of green. |
| L3-B1 | fixed | `docs/spec/data-model.md` now documents `seven_keys_snapshots`, `standard_reports`, and `report_delivery_log`. |
| L3-B2 | fixed | `docs/spec/data-model.md` recipients row now matches schema profiles/persona/Teams fields. |
| L3-C1 | fixed | `verification/VERIFICATION_REPORT.md` now records T17 delivery verification honestly: DI tests verified, real Graph/Teams/GitHub ingest requires real environment. |
| L3-D2 | fixed | Traceability basis-header guard now covers `packages/server/src` as well as reporting sources; generated matrix confirms no missing headers. |

## Notes

- `.orchestration/` artifacts are intentionally uncommitted.
- The fail-safe item is intentionally not overclaimed; full operational stop wiring remains outside T21 scope.

## Revise Response

| Finding | Status | Resolution |
| --- | --- | --- |
| R1 / L1-7 | fixed | `handleTimeseries` now maps invalid `baseDate` errors to HTTP 400 instead of generic 500. Added invalid baseDate regression coverage. |
| R2 / L1-8 | fixed | XLSX import no longer parses non-ISO date strings through `new Date(text)`. Unsupported date strings such as `07/09/2026` become row validation errors. Added regression coverage. |
