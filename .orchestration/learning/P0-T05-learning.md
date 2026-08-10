<!-- 根拠: PrjOps:REQ-030 / PrjOps:REQ-041 / PrjOps:REQ-042 -->

# P0-T05 Learning

## Validated learning

- After the Vitest 4 upgrade, `vitest run -- <file>` does not narrow test selection; WBS/root scripts using that form can pass while executing the entire package. Use direct `vitest run <file>` when collecting file-specific baseline metrics.
- Functional wall-clock, real local database behavior, and production latency are separate evidence classes. A fast stub or loopback value must not satisfy a production SLA.
- For an unavailable provider, `ENV-blocked` needs explicit exit conditions and must never be represented as zero latency or green.
- PostgreSQL connection stability and query latency answer different questions: retain both the 500-route pool invariant and the direct round-trip distribution.

## Apply to

- Future performance evidence: pin commit/tree/toolchain/source hashes and label every metric as stub, local functional, local real dependency, or representative environment.
- Future WBS command reviews: verify that the stated filter actually reduces the collected test file count.
- Future LLM/Graph gates: require approved nonproduction credentials, fixed workload, request IDs, failures/retries, and percentile latency before clearing `ENV-blocked`.
