# P7-T01 Validation

## Test-first Evidence

1. The contract test was added before source implementation and failed because `src/index.js` did not exist.
2. The minimal lib/adapter implementation then made the same test suite pass.
3. The first full CI run reached formatting and failed on three new TypeScript files; repository Prettier was applied and the complete CI was rerun from the start.

## Contract Coverage

- Teams input to neutral conversation/thread/user/attachment/message mapping.
- Fixed recoverable invalid-input error without reflecting untrusted content.
- Server-authoritative conversation/workflow mapping and fail-closed thread mismatch.
- Alternate non-Teams adapter type compatibility.
- Frozen adapter surface with no persistence or business-state API.
- Injected mapping authority type and source/message-ID dedupe collision boundary.

## Commands and Results

- `pnpm --filter @aiops/channel-teams test`: PASS, 1 file / 9 tests.
- Package typecheck, lint, build, and coverage: PASS; statements 92.85%, branches 85.71%, functions 100%, lines 97.5%.
- `pnpm install --frozen-lockfile`: PASS; dependency-free empty importer is current.
- Fresh PostgreSQL 16 full `mise run ci`: PASS, exit 0; governance, Rego 25/25, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all-workspace coverage, migration reapply, and P001 DB integration passed.
- `git diff --check`: PASS.
- gitleaks 8.30.1 staged scan with `.gitleaks.toml`: PASS, no leaks found.
- `make require-crit-review`: unavailable because this repository has no such Make target. Manual staged-diff review passed: public declarations contain no Teams transport type or persistence API, and no PR #244 path is staged.
