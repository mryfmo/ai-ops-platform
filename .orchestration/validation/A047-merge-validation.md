# A047 merge validation

## Pre-merge gate

- PR state: open, ready, `MERGEABLE`, `CLEAN`.
- Base/current main: `c9699ad8e346e3c217ab1ad0f9bb3a88c5e60cb4`.
- Final PR head: `cdd1e188c967cbc20f55dd010b1bd2df7e6a27aa`.
- PR checks: build-test success (4m29s), gitleaks success (8s), CodeRabbit success.
- GraphQL review-thread gate: `totalCount=0`, `nodes=[]`.

## Post-merge gate

- PR state: `MERGED`; merge commit `be0fee59bbf2ea400e64acaee8c733a6ca0a669a`.
- Consecutive-main check: merge parent is previous main `c9699ad8e346e3c217ab1ad0f9bb3a88c5e60cb4`.
- Exact-tree check: PR head and merge commit both have tree `6547f63a502f5a496cdd6f5f15e2fff3c4217812`.
- Workflow-file guard: no `.github/workflows/` delta from previous main to merge commit.
- Local synchronization: `HEAD == origin/main == be0fee59bbf2ea400e64acaee8c733a6ca0a669a`; worktree clean.
- Merge-triggered main CI run `31291058544`: success.
  - build-test job `93188186688`: success in 3m22s, including build, typecheck, coverage tests, traceability, and real PostgreSQL integration.
  - gitleaks job `93188186705`: success in 7s.
