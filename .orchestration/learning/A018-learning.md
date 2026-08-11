# A018 Learning Triage

## Reusable Observations

1. A production composition migration is incomplete when only report data is
   replaced: the persona resolver and report query must receive the same
   provider instance so authorization and data provenance cannot diverge.
2. A configuration-optional schema still needs a production route policy.
   Constructing the fail-closed provider at the route boundary turns an absent
   snapshot into an explicit 503/banner instead of a misleading empty report.
3. A shared pool claim needs a composition-level load test. Handler unit tests
   cannot detect a route that constructs a fresh `pg.Pool` per request.

## Promotion Decision

No repository learn file or new skill was promoted. These observations are
recorded for orchestration review, while A018 explicitly forbids worklog edits.

