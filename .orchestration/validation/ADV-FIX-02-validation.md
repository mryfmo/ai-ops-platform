# ADV-FIX-02 Validation

Date: 2026-08-18

## Test-first evidence

| Check | Result |
| --- | --- |
| Focused server tests before implementation | expected exit 1; 5 failures exposed missing TTL/capability/body propagation |
| Focused web tests before implementation | expected exit 1; 8 failures exposed wrong BFF body, false empty state, and silent status errors |
| Focused server tests without PostgreSQL | exit 0; 39 passed, 4 skipped |
| Focused web tests | exit 0; 13 passed |
| Focused server tests with disposable PostgreSQL 16 | exit 0; 43 passed |
| `pnpm --filter @aiops/shared run test` | exit 0; 498 passed |
| `pnpm --filter @aiops/server run test` | exit 0; 952 passed, 27 skipped in the DB-less run |
| `pnpm --filter @aiops/web run test` | exit 0; 370 passed, 1 skipped |

The route integration obtains `version`/`correlation` from `GET /approvals`, posts
the exact decision body through `app.request()`, passes identity/correlation
verification, performs CAS, and reaches the signal stub. Existing negative tests
cover correlation bound to another identity, stale version, expiry, and authority
receipt mismatch; new tests also prove capability omission for unauthorized and
legacy-null-version rows.

## Repository gates

| Check | Exit/result |
| --- | --- |
| `mise run lint` | 0 |
| `mise run traceability` | 0 |
| `mise run build` | 0 |
| `mise run typecheck` | 0 |
| `mise run test:coverage` with disposable PostgreSQL | 0; server 979, web 371, all workspace thresholds passed |
| `mise run verify:db` | 0; P001 PostgreSQL integration passed |
| `git diff --check` | 0 |
| changed-file `pnpm exec prettier --check ...` | 0 |
| `mise run ci` | 1 at format only |

The full CI command passed governance, Rego, contracts, audit, actionlint, lint,
and traceability, then stopped because the pre-existing, untracked,
orchestrator-owned `.claude/contextdb/config.json` is not Prettier-formatted. The
orchestrator explicitly waived that file and prohibited editing it. Every
ADV-FIX-02 changed source/test file passes the direct Prettier check; the remaining
post-format gates were run individually and passed.

## Review and secret checks

- `make require-crit-review`: exit 2 because the target does not exist.
- `crit status --json`: exit 0 with `review_file_exists=false`; browser Crit was not
  opened under the repository prohibition.
- Manual diff review found no unresolved finding after all executable checks.
- Local `gitleaks` binary was unavailable (exit 127); the PR's GitHub gitleaks check
  is the authoritative clean-runner evidence.
