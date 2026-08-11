# A015 Validation

## Scope

Committed diff is exactly four task-authorized files:

```text
packages/devops/src/lib/recipientBackfill.ts
packages/devops/src/tools/backfillRecipients.ts
packages/devops/tests/recipientBackfill.test.ts
runbooks/recipient-stable-subject-backfill.md
1281 insertions
```

Commit:

```text
2c45b29bffc50c4df3ef066d56994ee9ab7b8f5c feat(db): add recipient backfill CLI
1936eea72a17cf11b7e9c393c3698da56f1c2741 docs(db): add backfill traceability IDs
```

SHA-256:

```text
29b5226472fa09e8fe34315098f004fde895aea17fa3e5bc4aaef47f712cb450  packages/devops/src/lib/recipientBackfill.ts
6e29c5195551cae3430c695542318583e432328ff8e8fe3da6ec291cb3222439  packages/devops/src/tools/backfillRecipients.ts
d2f36c9bf464f2ca72290da65837edc84b8d8edcba1074888c5756548f6fa537  packages/devops/tests/recipientBackfill.test.ts
b581034f1af89de56fc5c2fe7e2b82dc0ca23783c1b7926ad9b4cc107a10027b  runbooks/recipient-stable-subject-backfill.md
```

## Preflight

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json
WARNING: DEV-TRUST: 13 placeholder trust assignments are development-only; production acceptance is blocked.
OK: validated 15 acceptance records through P010-F01-T11.
```

The validator exited 0.

## Test-First and Pure Validation

Before implementation:

```text
Error: Cannot find module '../src/lib/recipientBackfill.js'
1 failed suite
```

After implementation, the normal DevOps suite passed 204 tests and skipped the
six explicitly PostgreSQL-gated tests. Typecheck, lint, formatting, and
`git diff --check` passed.

The parser matrix covers:

- strict unknown/missing-field rejection
- UTF-8 JSON and RFC 4180 CSV normalization
- exact CSV header and repeated metadata
- Ed25519 and ES256/P-256 verification
- algorithm/key-type mismatch
- payload SHA-256 and invalid signature
- protected tenant/repository/commit/key evidence mismatch
- duplicate legacy IDs and duplicate stable subjects
- foreign tenant
- unresolved and already-applied inactive recipients
- exact idempotent applied mapping

The CLI matrix covers:

- unknown/duplicate/missing arguments
- exact digest mismatch before any update
- missing sandbox confirmation before DB connection
- exact database-name confirmation
- rejection of host-override query parameters
- update failure rollback

## Disposable PostgreSQL Validation

PostgreSQL 16.14 was initialized in one disposable cluster, listened only on
port 55432, and did not use or modify the Homebrew service.

Existing integration:

```text
P001 PostgreSQL integration passed
migrations applied=12 skipped=0
migrations applied=0 skipped=12
```

Final A015 PostgreSQL-enabled run:

```text
Test Files  21 passed (21)
Tests       210 passed (210)
```

The real-DB test used an isolated schema and proved:

- dry-run returned summary/digest without changing any recipient row
- a trigger failure on the second update rolled back the first update
- apply changed both pending rows in one transaction
- `migrate_active` became active/applied
- `deactivate` remained inactive/applied
- identical reapply returned `applied: 0`, `already_applied: 2`
- no active email-only recipient remained

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

The final post-Crit run exited 0. Governance, lint, traceability, format, build,
typecheck, and coverage tests passed. The normal CI run kept the six explicitly
gated PostgreSQL tests skipped; the separate disposable PostgreSQL run exercised
and passed them. The traceability generator's timestamp-only output was restored
before commit.

## Crit CLI Self-Review

No browser Crit or user review request was used.

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A015-crit-comments.json
review_outcome: two trust-boundary P1 findings fixed with regression coverage; all records resolved
resolved: 2
unresolved: 0
```

Findings:

1. PostgreSQL URL query parameters could override a visible localhost
   destination. Apply now rejects all URL query parameters/fragments before
   pool construction.
2. Generic SHA-256 verification could accept an RSA key under an ES256 label.
   Verification now binds Ed25519 to Ed25519 keys and ES256 to EC P-256 keys.

Receipt: `.orchestration/validation/A015-review-receipt.md`.

`make require-crit-review` exited 2 because this repository has no such Make
target.

## GitHub Review Follow-up

GitHub Codex left one P2 requesting a recognized catalog ID in every new-file
header. The change added `DevOps:SPEC-INT-054` to all four headers and the three
test suite titles, reran full CI, pushed commit `1936eea`, and refreshed the PR
description to cover the complete two-commit diff. Per write-safety policy, the
GitHub thread was not replied to or resolved.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/109
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t04-backfill`
- Head SHA: `1936eea72a17cf11b7e9c393c3698da56f1c2741`
- Base SHA: `bd9887d493d37dfc7c3acd5f13dd35021f40fa10`
- Label: `ai-generated`
- Merge state: `CLEAN`
- Mergeable: `MERGEABLE`

Hosted checks:

```text
gitleaks    pass  6s
CodeRabbit  pass  rate-limit notification only
build-test  pass  3m26s
```

## Final Repository State

```text
HEAD                                      1936eea72a17cf11b7e9c393c3698da56f1c2741
origin/agent/p010-f02-t04-backfill        1936eea72a17cf11b7e9c393c3698da56f1c2741
origin/main                               bd9887d493d37dfc7c3acd5f13dd35021f40fa10
```

The A015 linked worktree is clean. PR #109 was not merged.
