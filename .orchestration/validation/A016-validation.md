# A016 Validation

## Scope and Commits

```text
385e5083b6306d6ca9b0b56245f09d041ffcc669 feat(web): propagate Entra stable subject
bdd99139878d57b801bf1d8647bcad3893d9fef2 feat(web): resolve personas by stable subject
65df4b57a282000b253f19c8ad689fd27a669265 fix(prjops): honor global executive scope
```

The second commit contains 29 explicitly authorized implementation/test files:

```text
packages/devops/src/lib/reportPermissionFilter.ts
packages/devops/tests/reportPermissionFilter.test.ts
packages/prjops/src/data/yamlStakeholderMasterProvider.ts
packages/prjops/src/lib/reportPermissionFilter.ts
packages/prjops/tests/fixtures/stakeholders/ST-010.yaml
packages/prjops/tests/permissionAndDelivery.test.ts
packages/prjops/tests/yamlStakeholderMasterProvider.test.ts
packages/web/src/app/dashboard/page.tsx
packages/web/src/server/authGuard.ts
packages/web/src/server/chat/tools.ts
packages/web/src/server/personaResolver.ts
packages/web/src/server/reportData/dataApiSupport.ts
packages/web/src/types/global.d.ts
packages/web/tests/authGuard.test.ts
packages/web/tests/chat/chatRoute.test.ts
packages/web/tests/chat/systemPrompt.test.ts
packages/web/tests/chat/tools.test.ts
packages/web/tests/dataApiPoolLoad.test.ts
packages/web/tests/dataApiPoolRealPgLoad.test.ts
packages/web/tests/personaResolver.test.ts
packages/web/tests/personaRoute.test.tsx
packages/web/tests/personaSelectionHandler.test.ts
packages/web/tests/reportData/agentActivityHandler.test.ts
packages/web/tests/reportData/executiveSummaryHandler.test.ts
packages/web/tests/reportData/investorSummaryHandler.test.ts
packages/web/tests/reportData/managerSummaryHandler.test.ts
packages/web/tests/reportData/projectsHandler.test.ts
packages/web/tests/reportData/timeseriesHandler.test.ts
packages/web/tests/xlsxImportHandler.test.ts
```

Diff summary: 29 files changed, 1028 insertions, 506 deletions.

## Preflight

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json
WARNING: DEV-TRUST: 13 placeholder trust assignments are development-only; production acceptance is blocked.
OK: validated 15 acceptance records through P010-F01-T11.
```

The validator exited 0.

## Focused Matrices

```text
pnpm --filter @aiops/devops exec vitest run tests/reportPermissionFilter.test.ts
Test Files 1 passed (1)
Tests      10 passed (10)

pnpm --filter @aiops/prjops exec vitest run tests/permissionAndDelivery.test.ts tests/yamlStakeholderMasterProvider.test.ts
Test Files 2 passed (2)
Tests      53 passed (53)

pnpm --filter @aiops/devops run build
pnpm --filter @aiops/prjops run build
pnpm --filter @aiops/web exec vitest run tests/personaResolver.test.ts tests/authGuard.test.ts tests/chat/tools.test.ts
Test Files 3 passed (3)
Tests      47 passed (47)
```

The explicit dependency builds are required for focused Web runs because
workspace package imports use the packages' generated `dist` entrypoints.

## Package Validation

```text
@aiops/devops test:  21 files passed; 206 passed / 6 skipped
@aiops/prjops test:  24 files passed; 387 passed
@aiops/web test:     32 files passed / 1 skipped; 241 passed / 1 skipped
@aiops/devops typecheck: PASS
@aiops/prjops typecheck: PASS
@aiops/web typecheck: PASS
```

## Repository Definition of Done

```text
MISE_LOCKED=1 mise run ci
```

Exit 0. Governance, lint, traceability, format, build, typecheck, and coverage
tests passed. The traceability generator's output was restored after validation
so the committed diff remains inside task scope.

Coverage-run test totals included:

```text
shared:       335 passed
traceability: 56 passed
devops:       206 passed / 6 skipped
prjops:       387 passed
web:          241 passed / 1 skipped
server:       477 passed
```

## Negative Source Search

```text
rg -n "resolveByEmail|findByEmail|session\.user\.email|user\.email" \
  packages/web/src packages/prjops/src packages/devops/src
```

No matches.

## Crit CLI Self-Review

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A016-crit-comments.json
review_outcome: approved after seven findings were fixed
resolved: 11
unresolved: 0
```

Receipt: `.orchestration/validation/A016-review-receipt.md`.

`make require-crit-review` and the receipt-qualified retry both exited 2 because
this repository has no such Make target.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/110
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t05-entra-claims`
- Head SHA: `65df4b57a282000b253f19c8ad689fd27a669265`
- Base SHA: `8dc77976ce279fd65fda7447d9e311fb55c7709a`
- Label: `ai-generated`
- Mergeable: `MERGEABLE`
- PR body updated after the second commit to describe the full T05+T06 diff

Final hosted checks:

```text
build-test  pass (3m0s)
gitleaks    pass (8s)
CodeRabbit  pass
```

## Final Repository State

```text
HEAD                                        65df4b57a282000b253f19c8ad689fd27a669265
origin/agent/p010-f02-t05-entra-claims      65df4b57a282000b253f19c8ad689fd27a669265
origin/main                                 8dc77976ce279fd65fda7447d9e311fb55c7709a
```

The A016 linked worktree is clean. PR #110 was not merged.
