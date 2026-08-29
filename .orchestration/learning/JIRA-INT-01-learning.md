# JIRA-INT-01 Learning

## Reusable lessons

- Import packs must be checked against the target repository's current lint, traceability, no-vendor-SDK, formatting, and coverage gates; source-pack validation alone is insufficient.
- Build dependency packages before focused cross-package tests. The first Jira webhook failure came from stale `integrations/dist`, not the route implementation.
- Temporal workflow modules execute in the workflow sandbox and are not represented correctly by host-process V8 coverage. Keep the explicit exclusion list truthful and test pure state/contract logic directly.
- A new internal task queue invalidates tests that derive all queues only from the public workflow enum; assert against the canonical aggregate queue constant.

## Follow-up candidate

Add a recorded-history replay test for `jiraSync.ts`, matching the stronger replay evidence used by the other excluded Temporal workflows. This was not included in JIRA-INT-01's source pack or authorized implementation scope.

## Promotion

No new Codex learn file was promoted; these findings are recorded in the task artifacts and CompactionDB decision.
