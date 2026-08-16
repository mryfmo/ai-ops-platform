<!-- 根拠: DevOps:REQ-010 / DevOps:REQ-012 / DevOps:SPEC-INT-020 / TH-003 / TMP-003 / TMP-005 / ADR-0021 -->

# P3-T13 Validation

## Focused and Package Gates

1. Server deployment state/task/repository suite:
   - PASS: 4 files / 33 tests.
2. Control-plane deployment workflow/state/schedule/replay suite:
   - PASS after final cutover test: workflow file 11 tests.
   - PASS in fresh-DB full-CI package coverage: 30 files / 276 tests.
   - PASS after the final unique-sequence assertion: deployment replay 7 tests.
3. Control-plane coverage:
   - PASS: statements 88.96%, branches 92.14%, functions 91.47%, lines 89.55%.
   - `src/workflows/deployment.ts` uses the existing Temporal sandbox exclusion
     precedent; the orchestrator approved the one-line addition. No threshold
     was removed or lowered. Workflow execution is pinned by time-skipping and
     recorded-history replay tests.
4. Control-plane and server `typecheck` / `lint`:
   - PASS.
5. Temporal shadow evidence:
   - PASS: expected 15, observed 15, complete true.
   - PASS: `unreasonedDifferences=0`.
   - Concrete targets: `deployDispatchWorkflow`, `prodMonitorWorkflow`.
6. `git diff --check`:
   - PASS.

## Fresh Database Definition of Done

- Recreated disposable PostgreSQL 16 databases `aiops_p3t13_test`,
  `aiops_p3t13_load`, and `aiops_p3t13_p001` on `127.0.0.1:55432`.
- Ran `mise run ci` with the repository's isolated DB variables.
- PASS: exit 0 through governance, policy, contracts, audit, actionlint, lint,
  traceability, format, build, typecheck, workspace coverage, and DB integration.
- Server package result in the final run: 84 files / 922 tests.
- Final DB marker: `P001 PostgreSQL integration passed`.
- Removed all three disposable databases after validation.

## Review and Secret Gates

- `make require-crit-review`: unavailable because the repository has no such
  target. Browser Crit was not opened; a direct staged-diff review was used.
- Manual review checked state authority, all CAS-to-external-write edges, D-04,
  the unchanged upstream D-16 boundary, malformed envelopes, pending/sent ledger
  handling, exact inventory, replay identities, scope, and unrelated worktree
  preservation.
- RESOLVED: the first CAS receipt query used a same-statement CTE fallback that
  could retain a pre-wait Read Committed snapshot. Stale receipt observation now
  uses a new authoritative `SELECT` statement after the failed CAS, so a
  concurrent winner is observed without authorizing the loser.
- `/private/tmp/gitleaks git --staged --no-banner --redact --verbose --config
  .gitleaks.toml .`: PASS, no leaks found.
