# P8-T01 Learning

## Reusable Findings

1. A small path language—exact repository-relative paths plus final `/**` subtrees—makes One-Writer overlap deterministic without a glob dependency or ambiguous expansion semantics.
2. JSON Schema should validate structure and fixed security posture; cross-field invariants such as distinct identities, task-owned branches, and path disjointness belong in a small pure validator.
3. Adding a contract test to the existing `mise run contracts` step is sufficient CI integration when that step already runs in the protected `build-test` job.
4. Execution-profile values are routing labels, not durable statements about model capability; validators should enforce label syntax without embedding capability assumptions.

## Apply To

- Future P8 runner admission, manifest storage, and repository-lock lifecycle tasks.
