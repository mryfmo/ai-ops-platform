# P0-T01 Report

- Branch: `agent/P0-T01-baseline-revalidation`
- Base: `1f8e12c97cca8604cabaa9f35d5bcb0bfda2c91c`
- Base tree: `59cb4af42ef4d99be5289304fcfefe43cfbaef58`
- Evidence commit: `ad7a5bc15e5b738ff026acb14d32404a5fa66edb`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/153
- Acceptance gate: `GOV-001`

- Added the canonical `baseline-delta.md` for P0-T01 and updated `BASELINE.md` with the current HEAD/tree and CI evidence.
- Kept the Owner-approved `49e2e3c→ff66698` delta as the prior authority and classified only the subsequent PR #152 squash commit.
- Verified PR #152 as 113 files: 109 documentation, 2 orchestration records, 1 formatter-ignore entry, and 1 generated traceability output. Runtime, tests, DB, workflows, deployment, and dependency manifests are unchanged.
- Recorded lockfile/toolchain hashes and versions. No dependency or implementation change was made.
- Verified main CI run `31341703185` at the current base: `build-test` and `gitleaks` succeeded with PostgreSQL 16, 182 test files, 2,270 passing tests, 4 skipped tests, and `P001 PostgreSQL integration passed`.
- Verified PR CI run `31344141574` on the evidence commit: `build-test` passed in 4m43s, `gitleaks` passed, and CodeRabbit completed without a blocking result.
- Re-ran the complete `mise run ci` locally against clean dedicated PostgreSQL 16.14 databases: exit 0 in 69.61s, 182 test files, 2,274 passed, 0 skipped, and `P001 PostgreSQL integration passed`. A repo-external test shim selected Next's official webpack option because the Codex runner denies Turbopack port binding; the normal Turbopack path remained green in PR CI.
- GOV-001 becomes current when the Owner approves this task PR; the original pack commit remains the comparison origin.
