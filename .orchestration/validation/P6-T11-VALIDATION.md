# P6-T11 Validation

## Test-first Evidence

1. Channel normalization RED: missing `statusIngestChannels.js`; GREEN: 3 tests.
2. Workflow state RED: missing `statusIngestState.js`; GREEN: preserved parity, strict unknown boundary, deterministic identities, and claim receipt validation.
3. Teams adapter RED: missing `statusIngestAdapter.js`; GREEN: app-only fetch and fail-closed reporter checks.
4. Temporal workflow RED: missing `statusIngest.js`; GREEN: complete ING-001 channel/action matrix.
5. PrjOps activity RED: missing `statusIngestActivities.js`; GREEN: append-only audit and idempotency-key reconciliation.

## Commands and Current Results

1. `pnpm --filter @aiops/shared exec vitest run tests/statusIngestChannels.test.ts`
   - PASS: 3/3.
2. `pnpm --filter @aiops/integrations exec vitest run tests/statusIngestGraphAdapter.test.ts`
   - PASS: 2/2.
3. `pnpm --filter @aiops/control-plane exec vitest run tests/statusIngestState.test.ts tests/statusIngestWorkflow.test.ts tests/statusIngestReplay.test.ts`
   - PASS: state + 3-channel matrix + replay; includes lost canonical response with exactly one write.
4. `pnpm --filter @aiops/prjops exec vitest run tests/statusIngestActivities.test.ts`
   - PASS: append-only `AuditLogWriter` record and same-key reconciliation.
5. Package typecheck/lint for shared, integrations, control-plane, and prjops.
   - PASS.
6. `pnpm --store-dir /Users/mryfmo/Library/pnpm/store/v11 install --offline --frozen-lockfile`
   - PASS: 918-entry lockfile supply-chain policy and importer-only pg resolution.
7. Real PostgreSQL and `mise run ci`.
   - PASS: PR #246 merged at `770b95b`; fresh schema plus migration reapply succeeded.
   - PASS: PostgreSQL concurrency/constraint suite 4/4 using a disposable PostgreSQL 16 cluster.
   - PASS: `mise run ci` with real DB integration (governance, policy, contracts, lint, traceability, format, build, typecheck, coverage, and DB verification).
   - PASS: control-plane coverage after applying the existing Temporal workflow exclusion policy: 297/297 tests; statements 85.73%, branches 88.95%, functions 89.58%, lines 86.48%.
8. Staged-diff safety review.
   - PASS: exact P6-T11 scope staged; `git diff --cached --check` clean; high-confidence secret-pattern scan returned no matches.
   - Local `gitleaks` binary is unavailable; the required GitHub `gitleaks` check remains an orchestrator PR gate.
   - `make require-crit-review` is unavailable in this repository (`No rule to make target`); staged source/schema/lockfile diffs were reviewed directly and no self-review finding remained.

## Safety Assertions

- Duplicate complete source claims perform zero canonical, notification, and completion writes.
- Clarification action/count receipts that differ from the preserved contract fail as `E-CP-CONTRACT`.
- Secret-like workflow input and unresolved project identity (`E-ING02`) are rejected before claim.
- Canonical, notification, and audit activities use fixed single-attempt retry and authoritative reconciliation.
- Audit detail excludes original subject/body/update content.
