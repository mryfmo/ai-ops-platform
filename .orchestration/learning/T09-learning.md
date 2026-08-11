# T09 Learning

## What Was Learned

- In this repo's clean GitHub Actions checkout, workspace typecheck can fail before package build because referenced package declaration files do not exist yet.
- Building workspaces before typecheck is the smallest reliable CI fix for the existing TypeScript project-reference setup.
- gitleaks PR workflows need explicit `pull-requests: read` permission when workflow permissions are restricted.
- For Seven Keys canonical reporting, missing qualitative questionnaire data should be modeled as explicit `grey` / `未評価`, not inferred from available GitHub metrics.

## Where To Apply

- Future CI workflow edits should preserve build before typecheck unless TypeScript project references are redesigned.
- Future PR security workflows that inspect PR commits should declare the least required `pull-requests: read` permission.
- Future Seven Keys work should keep qualitative and quantitative evidence sources separate.

## Validation

- Confirmed by local `mise run -j 1 ci` pass.
- Confirmed by GitHub checks pass on PR #6.
