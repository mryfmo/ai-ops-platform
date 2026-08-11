# A017 Report

## Outcome

- Task: `P010-F02-T07`
- Branch: `agent/p010-f02-t07-production-provider`
- Commit: `33aa896cb0d44a6f02d46201893bcd7a2b057cb6` —
  `feat(web): add scoped PrjOps data provider`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/111
- PR base: `main` at `ae439e807ac668657fd9e92348e336f04bcb1e12`
- PR state: open, ready, and mergeable
- Label: `ai-generated`
- The PR was not merged; merge remains gated on orchestrator acceptance.

GitHub CLI was used first for PR creation and readback. Browser Crit and a user
review request were not used.

## Selected Packet

The implementation is limited to these 16 files:

```text
packages/devops/src/lib/reportPermissionFilter.ts
packages/devops/tests/reportPermissionFilter.test.ts
packages/prjops/src/lib/prjopsDataSnapshotValidator.ts
packages/prjops/tests/prjopsDataSnapshotValidator.test.ts
packages/web/src/server/config.ts
packages/web/src/server/reportData/dataApiSupport.ts
packages/web/src/server/reportData/prjopsReportData.ts
packages/web/src/server/reportData/pinnedPrjopsReportDataProvider.ts
packages/web/tests/config.test.ts
packages/web/tests/reportData/agentActivityData.test.ts
packages/web/tests/reportData/agentActivityHandler.test.ts
packages/web/tests/reportData/devopsReportData.test.ts
packages/web/tests/reportData/managerSummaryHandler.test.ts
packages/web/tests/reportData/pinnedPrjopsReportDataProvider.test.ts
packages/web/tests/reportData/prjopsReportData.test.ts
packages/web/tests/reportData/projectsHandler.test.ts
```

Diff summary: 16 files changed, 1128 insertions, 196 deletions.

## Production Provider

- A filesystem source reads a canonical absolute root through
  `open(O_RDONLY | O_NOFOLLOW)`, verifies the root identity before and after
  reading, and admits only the required snapshot directories.
- The provider verifies a pinned 40-hex commit and external 64-hex content
  checksum before exposing any data.
- Snapshot YAML is loaded only through the A012 validator. The validator now
  returns the already parsed and schema-validated documents, avoiding a second
  parser and validation bypass.
- The report interface exposes only a scoped `query({ profile, visibility })`.
  The unscoped list/get methods were removed, and consumers cannot fetch all
  rows before filtering.
- Active stakeholder, stable subject, persona, assignment, and project
  conditions are applied inside the provider query boundary.
- PRF-04 alone receives Seven Keys portfolio data; PRF-05 alone receives
  financial and board-pack inputs; owner names are limited to PRF-01–03.
- Snapshot provenance/checksum mismatch and malformed/partial snapshots return
  a sanitized 503 response. Stale authorization scope returns 403.
- Stakeholder and snapshot data are reread on every request; no cross-request
  active-recipient cache exists.
- Production configuration requires all four snapshot environment fields
  together and otherwise fails closed. T08 route composition was not changed.

## P2-05

DevOps `isProjectInScope` now denies missing or invalid `scopeMode`. The legacy
profile-based fail-open branch was removed, and callers/tests now provide an
explicit scope.

## Gates

- Phase 1 acceptance validator through P010-F01-T11: PASS, 15 records
- DevOps suite: PASS, 206 passed / 6 skipped
- PrjOps suite: PASS, 387 passed
- Web suite: PASS, 249 passed / 1 skipped
- DevOps, PrjOps, and Web typecheck: PASS
- Disposable PostgreSQL 16 load test: PASS, 500 requests, peak 1 physical
  connection, zero residual schemas/connections, cluster destroyed
- Final `MISE_LOCKED=1 mise run ci`: PASS
- Crit data Codex self-review: resolved 1 / unresolved 0
- Hosted checks: PASS (`build-test`, `gitleaks`, `CodeRabbit`)
- Linked worktree: clean and synchronized with the pushed branch

`make require-crit-review` is unavailable because the repository has no such
Make target. The receipt-qualified retry produced the same result.
