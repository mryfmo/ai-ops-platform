# P0-T01 Report

- Branch: `agent/P0-T01-baseline-revalidation`
- Base: `1f8e12c97cca8604cabaa9f35d5bcb0bfda2c91c`
- Base tree: `59cb4af42ef4d99be5289304fcfefe43cfbaef58`
- Pull request: pending
- Acceptance gate: `GOV-001`

- Added the canonical `baseline-delta.md` for P0-T01 and updated `BASELINE.md` with the current HEAD/tree and CI evidence.
- Kept the Owner-approved `49e2e3c→ff66698` delta as the prior authority and classified only the subsequent PR #152 squash commit.
- Verified PR #152 as 113 files: 109 documentation, 2 orchestration records, 1 formatter-ignore entry, and 1 generated traceability output. Runtime, tests, DB, workflows, deployment, and dependency manifests are unchanged.
- Recorded lockfile/toolchain hashes and versions. No dependency or implementation change was made.
- Verified main CI run `31341703185` at the current base: `build-test` and `gitleaks` succeeded with PostgreSQL 16, 182 test files, 2,270 passing tests, 4 skipped tests, and `P001 PostgreSQL integration passed`.
- Re-ran typecheck, full coverage, and P001 integration locally against a dedicated PostgreSQL 16.14 cluster. The local monolithic CI command hit the documented Codex runner Turbopack port-bind restriction and is not represented as green.
- GOV-001 becomes current when the Owner approves this task PR; the original pack commit remains the comparison origin.
