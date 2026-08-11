# A037 report

## Status

Ready for review.

## Result

- Opened PR [#141](https://github.com/mryfmo/ai-ops-platform/pull/141) from `agent/a037-calendar-coverage` to `main` with the `ai-generated` label.
- Added a pure, injected-time calendar coverage evaluator using JST calendar dates.
- Published `aiops_calendar_coverage_days` at startup and emitted a warn log below the 180-day threshold or when holiday data is empty.
- Reused the single startup-loaded holiday calendar in both existing scheduler tasks.
- Added boundary coverage for exactly-at, before, after, expired, and empty inputs.

## Delivery

- Initial commit: `2008ec69eb9c82af483af74f32bd9fd6b95c357a`
- Revision commit: `2552b714bd1e669f31469ddfa97682900bd239db`
- GitHub checks: `build-test`, `gitleaks`, and `CodeRabbit` passed.
- No holiday data, dependencies, review threads, or merge state were changed.

## Revision result

- Strict real `YYYY-MM-DD` parsing exposes invalid entries in `invalidDates` and forces `shouldWarn=true`.
- Mixed valid/invalid data publishes the alerting `-1` gauge sentinel.
- `capability-metrics-refresh-30s` recomputes coverage from its injected wall-clock `now`.
- Regression tests cover `foo`, `2027-99-99`, mixed input, fail-closed metrics, and post-startup refresh.

## Implementation choice

The 180-day warning threshold gives the annual manual update PR six months for investigation, review, and production rollout. Existing calendar, metric, and 30-second refresh primitives were reused; no dependency or new scheduler was added.
