# P3-T11 Learning

## Reusable Findings

1. A plain custom `Error` escaping a Temporal workflow may fail the workflow task repeatedly instead of producing a terminal workflow failure. Expected domain failures at a workflow boundary must be normalized to `ApplicationFailure` and verified by asserting its exact client-visible failure type. This was validated by orchestrator commit `2e4cca3` and the updated live probe.
2. Exact workflow-task counts are not deterministic under concurrent signal delivery because Temporal may batch signals into a workflow task. Assert a meaningful lower bound and business outcome instead of an exact task count.
3. Retry-fault probes need a real-time bound even in a time-skipping environment so a defect cannot wedge the verification process itself.

## Apply To

- Temporal workflow-boundary regression tests.
- Future Temporal chaos suites and workflow-boundary error handling reviews.
