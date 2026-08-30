# ADV-FIX-04 Validation

## Final gates

| Check | Exit | Evidence |
| --- | ---: | --- |
| `pnpm --filter @aiops/server exec vitest run tests/codingTaskManifest.test.ts tests/codingTasksRepo.test.ts tests/codingTaskRoutes.test.ts` | 0 | 3 files / 34 tests passed |
| `node --test scripts/collect-agent-review.test.mjs scripts/coding-task-manifest-wiring.test.mjs` | 0 | 5 tests passed; digest match/missing/mismatch and workflow ordering covered |
| `env CI=true mise run contracts` | 0 | 88 tests passed; Spectral had 0 errors |
| `node --test scripts/coding-agent-path-guard.test.mjs` | 0 | 17 tests passed, including allowed pre/post and violation/tamper/symlink rejection |
| Real-PG `codingTaskManifestPg.test.ts` | 0 | Exact persistence, lifecycle update, and both immutable-column rejections passed |
| Disposable PG fresh schema | 0 | `manifest:NO`, `manifest_sha256:NO`, `coding_tasks_block_manifest_update` |
| Disposable PG `origin/main` schema then new migration | 0 | Same two non-null columns and trigger |
| Direct migration SQL reapply twice | 0 | Existing columns skipped, backfill 0, function/trigger replaced cleanly |
| Migration runner twice | 0 | `applied=23 skipped=0`, then `applied=0 skipped=23` |
| `mise run actionlint` | 0 | All workflows accepted |
| `mise run governance` | 0 | Governance and architecture fitness accepted |
| `mise run lint` | 0 | All workspace package linters accepted |
| `mise run typecheck` | 0 | All workspace package type checks accepted |
| `mise run traceability` | 0 | Traceability guards accepted; generated tracked output restored afterward |
| `mise run format` with user-owned untracked contextdb temporarily removed and restored | 0 | All matched tracked/task files formatted |
| Final `mise run ci` with disposable PostgreSQL | 0 | `FULL_CI_EXIT=0`; coverage and `P001 PostgreSQL integration passed` |
| `git diff --cached --check` and staged diff review | 0 | No whitespace errors; authority, DB, dispatch, coding guard, and review digest flow inspected end to end |

## Expected negative exits

| Probe | Exit | Expected result |
| --- | ---: | --- |
| `UPDATE coding_tasks SET manifest_sha256=...` | 1 | `coding task manifest authority is immutable` |
| `UPDATE coding_tasks SET manifest=...` | 1 | Same immutable trigger rejection |
| Collector with empty digest | nonzero | Critical security machine finding written before exit |
| Collector with mismatched digest | nonzero | Critical security machine finding written before exit |
| Path guard forbidden/governance/credential/symlink/tamper fixtures | nonzero per fixture | All negative fixtures rejected; enclosing Node test exit 0 |

## Corrected validation failures

- System `initdb` resolved to libpq-only PostgreSQL 18 and could not find `postgres`; all DB evidence was rerun with `/opt/homebrew/opt/postgresql@16/bin/*`.
- First full-CI DB run omitted existing suites' host/port variables; rerun used the disposable cluster at `127.0.0.1:55445`.
- Immutable-SHA checkout initially renamed an existing workflow step; restored the contract-visible name and kept `ref: ${{ github.sha }}`.
- Initial migration lacked fresh-schema idempotence; changed to conditional columns/backfill/constraint and replaceable trigger, then proved direct and runner replay.

## Review gate availability

- `make require-crit-review` could not run because this repository has no such make target.
- `crit status --json` reported no review file or active session. Browser Crit is prohibited by repository operator policy, so no fabricated Crit receipt or interactive review was created.

## Environment

- Base/head before commit: `c8704c54c304669036054dfab23f92b7aa560d90`
- PostgreSQL: 16.15 disposable local clusters only
- No live GitHub dispatch, production DB, long-lived secret, ruleset, merge, or external system mutation.
