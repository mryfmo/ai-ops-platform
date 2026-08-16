# P5-T08 Learning

## Reusable Findings

1. Source-reference evidence should contain only reference indexes and accessibility outcomes; returning fetched content turns a verification helper into a new leakage path.
2. Permission trimming needs an identity-bound positive probe and a distinct-user negative differential. A successful fetch is insufficient unless its returned tenant and subject match the delegated client under test.
3. Metadata-only persistence is strongest when raw fields are absent from both the TypeScript input type and PostgreSQL schema, not merely ignored by callers.
4. Append-only evidence needs a database trigger in addition to an INSERT-only repository because table owners can otherwise mutate history despite application-role grants.
5. Incomplete provenance is valid diagnostic metadata, but acceptance evidence must require non-empty references and permission context when `provenanceComplete=true`.
6. A negative permission differential is proven only when every comparison result is conclusive and at least one is an authorization-specific denial. Timeouts, malformed responses, unresolved references, and generic HTTP failures are operationally inconclusive.

## Apply To

- P5 Work IQ conformance runs, future gateway correlation, delegated-source audit receipts, and any evidence flow that verifies access without retaining content.
