# A014 Report

## Outcome

- Branch: `agent/p010-f02-t03-stable-subject`
- Commit / HEAD: `782c45be81688bfdd640351408248967611f3e7b`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/108
- PR base: `main` at `c2c7e2da78708c28b65f61478d4081584c3551ff`
- PR state: open, ready, `CLEAN`
- Label: `ai-generated`
- The PR was not merged; merge remains gated on orchestrator acceptance.

GitHub CLI was used first for repository inspection, PR creation, PR readback,
review/comment inspection, and hosted checks. No web fallback was used.

## Changes

- Added tenant/object UUIDs, `scope_mode`, and explicit backfill
  disposition/state to the fresh recipients schema.
- Added an idempotent upgrade migration. Legacy email-only recipients are
  quarantined as inactive/pending without invented UUIDs; stable mappings are
  unique per tenant/object pair.
- Added a trusted-tenant repository lookup for active, applied stable subjects.
  Malformed, unconfigured, and foreign-tenant lookups fail before any query.
- Added source and real PostgreSQL tests for fresh, upgrade, reapply, constraints,
  privileges, negative cases, and rollback.

The committed diff is exactly the five task-authorized schema, migration,
recipient repository, and DB test files. No dependency, worklog, `docs/audit`,
email uniqueness, authorization layer, or file outside the allowed scope was
changed.

## Gates

- Phase 1 acceptance validator through P010-F01-T11: PASS, 15 records
- Test-first RED: the subject lookup test failed because
  `findActiveBySubject` did not exist
- Focused server suite: PASS, 47 files / 477 tests
- Focused DevOps suite without PostgreSQL opt-in: PASS, 196 passed / 5 skipped
- Server and DevOps typechecks: PASS
- Disposable PostgreSQL 16.14 on port 55432:
  - existing DB integration script: PASS
  - migration upgrade: 12 applied, second run 12 skipped
  - A014 PostgreSQL suite: PASS, 201/201 tests
  - fresh schema, upgrade, direct reapply, catalog checks, negative cases, and
    rollback rehearsal: PASS
- Audit application-role privileges remained INSERT and SELECT only; no
  UPDATE/DELETE privilege was introduced
- Final `MISE_LOCKED=1 mise run ci`: PASS
- Crit CLI Codex self-review: one scope-broadening P1 fixed with regression
  coverage; all review records resolved
- Hosted `build-test`: PASS
- Hosted `gitleaks`: PASS
- Hosted `CodeRabbit`: PASS
- GitHub inline review comments: 0
- GitHub submitted reviews: 0
- Final linked worktree: clean and synchronized with the pushed branch
- Disposable PostgreSQL stopped, temporary directory removed, and port 55432
  returned `no response`

The resolved Crit finding identified that profile-only scope backfill could
promote a PRF-04 recipient with a project allowlist to global scope. The
migration now requires both a global-capable profile and an empty project
allowlist before selecting global scope; a regression fixture covers the
project-scoped PRF-04 case.

`make require-crit-review` is unavailable because the repository has no such
Make target. Browser Crit and a user review request were not used.
