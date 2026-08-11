# T32 Learning Triage

## Reusable Observations

1. Catalog line count cannot determine defined-ID count; always join by `(system,id)` and report orphan definitions separately.
2. Traceability based on `String.includes` is unsafe even when all current IDs look formatted: `ISS-01` falsely matches `ISS-010` across namespaces.
3. Reverse reconstruction needs three explicit states (both-side evidence, partial, unrecoverable) and must never become normative without owner approval.
4. A production defect can be rooted in an absent concurrency/identity/provenance requirement; retrospective specification checks should accompany implementation findings.
5. Sequence gaps need history checks, not only arithmetic enumeration; “never present” still requires owner disposition before reuse.
6. Audit counts are incomplete without executable aggregation semantics: namespace key, scope assignment, kind classification, and exclusions must travel with every reported number.

## Promotion

No rule or skill was promoted. These observations should be reviewed after T32 acceptance.
