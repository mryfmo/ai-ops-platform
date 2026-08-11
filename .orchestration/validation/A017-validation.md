# A017 Validation

## Scope and Commit

```text
33aa896cb0d44a6f02d46201893bcd7a2b057cb6 feat(web): add scoped PrjOps data provider
```

The commit contains the exact 16-file packet listed in
`.orchestration/reports/A017-report.md`.

## Preflight

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json
WARNING: DEV-TRUST: 13 placeholder trust assignments are development-only; production acceptance is blocked.
OK: validated 15 acceptance records through P010-F01-T11.
```

The validator exited 0.

## Package Validation

```text
@aiops/devops test:  21 files passed; 206 passed / 6 skipped
@aiops/prjops test:  24 files passed; 387 passed
@aiops/web test:     33 files passed / 1 skipped; 249 passed / 1 skipped
@aiops/devops typecheck: PASS
@aiops/prjops typecheck: PASS
@aiops/web typecheck: PASS
@aiops/web lint: PASS
mise run format: PASS
git diff --check: PASS
```

The modified workspace dependencies were built before the focused Web tests so
the consumer used current generated `dist` entrypoints.

## Disposable PostgreSQL 16

The real pool test used Homebrew PostgreSQL 16.14 in an isolated cluster:

```text
cluster:  /private/tmp/aiops-a017-pg
database: aiops_a017
listen:   127.0.0.1:55432
requests: 500 production GET requests
physical connections before/peak/after requests/after pool close: 0/1/1/0
pool peak: 1
```

The first sandboxed localhost connection was denied with `EPERM`; the same
bounded test was rerun with approved local-network access and passed. Cleanup
verified zero temporary schemas and zero connections, stopped PostgreSQL, and
removed both `/private/tmp/aiops-a017-pg` and its log. Port 55432 was closed
afterward.

No production database was contacted.

## Repository Definition of Done

```text
MISE_LOCKED=1 mise run ci
```

Exit 0. Governance, lint, traceability, format, build, typecheck, and coverage
tests passed. The traceability generator's output was restored after validation
so the committed diff remains inside the selected packet.

Coverage-run test totals included:

```text
shared:       335 passed
traceability: 56 passed
devops:       206 passed / 6 skipped
prjops:       387 passed
web:          249 passed / 1 skipped
server:       477 passed
```

## Negative Source Search

Source searches found no production consumer of the removed unscoped
list/get methods and no remaining DevOps legacy scopeMode fallback branch.

## Codex and Crit CLI Self-Review

`codex review --uncommitted` inspected the packet but did not return a final
finding set before timing out, so it was not treated as approval.

The completed headless Crit data review is:

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A017-crit-comments.json
review_outcome: approved
resolved: 1
unresolved: 0
```

Receipt: `.orchestration/validation/A017-review-receipt.md`.

`make require-crit-review` and the receipt-qualified retry both exited 2 because
this repository has no such Make target.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/111
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t07-production-provider`
- Head SHA: `33aa896cb0d44a6f02d46201893bcd7a2b057cb6`
- Base SHA: `ae439e807ac668657fd9e92348e336f04bcb1e12`
- Label: `ai-generated`
- Mergeable: `MERGEABLE`

Final hosted checks:

```text
build-test  pass (2m51s)
gitleaks    pass (8s)
CodeRabbit  pass
```

## Final Repository State

The A017 linked worktree is clean and synchronized with its remote branch.
PR #111 was not merged.
