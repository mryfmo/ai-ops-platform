# T27 Autoskill

## Skills Used

- `agmsg-orchestration`: followed the worker artifact and result protocol.
- `ponytail`: reused existing pure metric functions, provider interfaces, and tests; no new dependencies or broad abstractions.

## Reusable Pattern

For metrics correctness tasks:

1. Fix method semantics in pure library functions first, then adapt report-data wiring and UI formatting.
2. Return `null`/NA for unavailable metric sets instead of zero when zero would imply excellence.
3. Add explicit linkage fields at metric boundaries when source schemas cannot prove causality.
4. Keep heterogeneous portfolio facts as per-company rows unless a meaningful weighted aggregation exists.
5. Treat local worklog files as non-commit artifacts but keep them formatted when repository format checks scan them.
6. Rebuild workspace package `dist` before focused tests in another package that imports it by package name.
7. For portfolio metrics, separate per-entity expansion from pooled summary inputs so shared events are not weighted by fan-out.
