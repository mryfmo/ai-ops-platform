# P7-T07 Learning

## Reusable Findings

1. A read model can expose current workflow/action/approval state without copying it: persist only foreign-key links and live-join the authority tables in an explicit projection.
2. Exact `information_schema.columns` assertions make a no-content/no-state-duplication requirement mechanically reviewable.
3. Project consistency should be enforced while creating links (`INSERT ... SELECT` over both workspace and authority rows), not repaired or masked in the presentation layer.
4. Scope-out and absence should share a 404 after repository-level filtering so the API does not reveal workspace existence.
5. Strict BFF response parsing prevents a later upstream field addition from accidentally exposing source or workflow content.
6. Unique fixture IDs do not isolate a test from sibling `DELETE FROM table` cleanup. For parallel real-PG coverage, a per-suite schema plus a `current_schema()` assertion is a smaller and stronger boundary than worker serialization.

## Apply To

- P7-T08/T10 Workbench UI, future Workbench panels, and any presentation read model over existing authorities.

No rule or skill was promoted by this worker.
