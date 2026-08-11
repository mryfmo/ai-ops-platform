# A014 Validation

## Scope

Committed diff is exactly five task-authorized files:

```text
packages/devops/src/db/migrations/202607180000_recipients_stable_subject.sql
packages/devops/src/db/schema.sql
packages/devops/tests/recipientsStableSubjectSchema.test.ts
packages/server/src/db/recipientsRepo.ts
packages/server/tests/recipientsRepo.test.ts
472 insertions, 3 deletions
```

Commit:

```text
782c45be81688bfdd640351408248967611f3e7b feat(db): add stable subject recipients
```

SHA-256:

```text
7b42e9b6795d0a8cb32297bc7b8be88cc69150f3c06bdfca46fb3b811cfe6ddc  packages/devops/src/db/schema.sql
90c007c9c3886b301b5ff1f8c3e7a6d487770c1116702a28957c01c0954ee661  packages/devops/src/db/migrations/202607180000_recipients_stable_subject.sql
6dd38de4155040f728b6341fbc3771b2f39e87a24f0f9b393ed38f61a988f721  packages/devops/tests/recipientsStableSubjectSchema.test.ts
6f83bd835a1e36c41a0b714676524a7b3a020378734c5ee3af2820324f5557ee  packages/server/src/db/recipientsRepo.ts
f566ef0d14337e5f357e359dd55bc99e07936c9a3f15b7cce02f7b60df5e2678  packages/server/tests/recipientsRepo.test.ts
```

## Preflight

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json
OK: validated 15 acceptance records through P010-F01-T11.
```

The validator exited 0. The repository's DEV-TRUST scan reported its existing
13 warning findings without changing the acceptance result.

## Test-First Evidence

Before implementation, the new repository behavior tests failed as expected:

```text
TypeError: repo.findActiveBySubject is not a function
2 failed
```

After implementation:

```text
packages/server: 47 test files, 477 tests passed
packages/devops: 20 test files, 196 passed, 5 PostgreSQL-gated tests skipped
packages/server typecheck: PASS
packages/devops typecheck: PASS
```

## Disposable PostgreSQL Validation

PostgreSQL 16.14 was initialized in a disposable directory, listened only on
port 55432, and did not use or modify the Homebrew service.

Existing integration and migration runner:

```text
verification/run_db_integration.sh
PASS

migrations applied=12 skipped=0
migrations applied=0 skipped=12
```

The A014 PostgreSQL-enabled DevOps run passed all 201 tests across 20 files. It
executed these paths against the disposable server:

- fresh schema application
- upgrade from the legacy recipients shape
- migration runner reapplication
- direct migration SQL reapplication twice
- duplicate stable subject rejection
- partial/NULL stable subject rejection
- invalid foreign-tenant repository lookup without a DB query
- invalid scope/backfill combinations
- rollback DDL rehearsal with recipient and audit data preserved

Upgrade fixtures proved:

- unresolved legacy email rows become inactive/pending with NULL stable subject
  values rather than fabricated identifiers
- PRF-G with no project allowlist becomes global-scoped
- PRF-04 with `PJ-001` remains project-scoped
- already mapped rows become applied

Catalog queries confirmed:

```text
entra_tenant_id  uuid  nullable
entra_object_id  uuid  nullable
scope_mode       text  not null
backfill_state   text  not null
```

The named subject-pair, backfill-state, active-mapping, and scope constraints
were present and validated. The partial unique index covered
`(entra_tenant_id, entra_object_id)` only when the pair is non-NULL.

Application-role audit privileges remained:

```text
INSERT
SELECT
```

No audit UPDATE or DELETE privilege was present.

The PR body includes the complete rollback DDL. The rollback rehearsal removed
the new index, constraints, and columns while preserving existing recipient and
audit rows.

Cleanup:

```text
PostgreSQL stopped
temporary cluster directory removed
127.0.0.1:55432 - no response
```

## Repository Validation

```text
MISE_LOCKED=1 mise run ci
```

Exited 0. Governance, lint, traceability, format, build, typecheck, and coverage
tests passed. The normal CI run kept the five explicitly gated PostgreSQL tests
skipped; the separate disposable PostgreSQL run exercised and passed them.
The traceability generator's timestamp-only output was restored before commit.

## Crit CLI Self-Review

No browser Crit or user review request was used.

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A014-crit-comments.json
review_outcome: one scope-broadening P1 fixed with regression coverage; all records resolved
resolved: 1
unresolved: 0
```

The P1 showed that profile-only backfill could grant global scope to a PRF-04
recipient that had an explicit project allowlist. The migration was narrowed to
global-capable profiles with an empty allowlist, and the PostgreSQL upgrade test
now covers PRF-04 plus `PJ-001`.

Receipt: `.orchestration/validation/A014-review-receipt.md`.

`make require-crit-review` exited 2 because this repository has no such Make
target.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/108
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t03-stable-subject`
- Head SHA: `782c45be81688bfdd640351408248967611f3e7b`
- Base SHA: `c2c7e2da78708c28b65f61478d4081584c3551ff`
- Merge state: `CLEAN`
- Label: `ai-generated`

Hosted checks:

```text
build-test  pass  3m20s
gitleaks    pass  9s
CodeRabbit  pass
```

GitHub PR inspection returned zero inline review comments and zero submitted
reviews. The CodeRabbit comment was a walkthrough only and contained no
actionable finding.

## Final Repository State

```text
HEAD                                                   782c45be81688bfdd640351408248967611f3e7b
origin/agent/p010-f02-t03-stable-subject               782c45be81688bfdd640351408248967611f3e7b
origin/main                                            c2c7e2da78708c28b65f61478d4081584c3551ff
```

The A014 linked worktree is clean. PR #108 was not merged.
