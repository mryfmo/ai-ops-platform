# A048 learning triage

## Validated learning

- Azure Monitor log search alerts cannot directly evaluate 3-day or 7-day windows because their query range is capped at two days; persisted in-app rolling gauges preserve the SLO window without a misleading KQL definition.
- Empty metric windows must remain distinct from a perfect zero-failure result. The server exports `-1`, and the alert query excludes negative values.
- Hono's unwind-time `routePath(context, -1)` yields deterministic matched patterns, including exception-generated 500 responses, preventing raw path leakage and unbounded label cardinality.
- ZIP-governed specification mirrors must be updated canonical-first and re-extracted.

## Promotion

These reusable findings are recorded in `.agents/worklog/codex/learn/20260809_125942_learn.md`, indexed in `learn_index.md`, and reflected in the A048 plan/tests.
