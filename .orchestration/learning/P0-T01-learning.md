# P0-T01 Learning

## Validated learning

- A baseline revalidation should separate the immutable comparison chain (`pack base → approved delta → current supplement`) instead of rewriting the earlier Owner decision.
- A clean remote CI run and local disposable-DB reproduction answer different questions: the former proves the normal production build environment; the latter independently proves the database behavior and exact test totals. Environment-denied commands must remain recorded as failures.
- Documentation-only imports still require path classification beyond `docs/**`; formatter configuration and generated outputs must be called out explicitly even when runtime and dependency manifests are unchanged.

## Apply to

- Future WBS baseline gates: record full commit/tree identities, dependency hashes, all non-document exceptions, and both remote and local environment boundaries.
- Future delta reviews: preserve the prior approved delta as authority and append only the new commit range.
