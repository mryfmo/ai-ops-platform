# A023 Validation

## Test-first Evidence

Before implementation:

```text
node --test tests/validate-plane-environment-mapping.test.mjs
ERR_MODULE_NOT_FOUND:
scripts/validate-plane-environment-mapping.mjs
exit 1
```

After the minimal stdlib implementation:

```text
node --test tests/validate-plane-environment-mapping.test.mjs
tests 6
pass 6
fail 0
```

The matrix covers:

- tracked development fixture and explicit replacement warning;
- owner-signed production shape;
- malformed JSON and unknown properties at all object levels;
- duplicate project UUID, same-row workspace/project UUID, and inconsistent
  cross-project workspace mapping;
- HTTP and userinfo URLs;
- noncanonical `PJ-*`;
- stale contract version;
- development replacement bypass;
- unsigned production;
- development placeholder host in production.

## Contract CLI

```text
pnpm run plane-mapping:validate
WARNING: DEV-DEFAULT: replace before go-live with owner-signed production values.
OK: validated 3 Plane project mappings.
```

The script is also part of `pnpm run governance:check`, so hosted CI executes
the same focused test and tracked-fixture validation.

## Repository Definition of Done

```text
mise run ci
```

Exited 0 and covered governance, lint, traceability, format, build, typecheck,
and coverage tests. Coverage-run totals included:

```text
shared:       335 passed
traceability: 56 passed
devops:       206 passed / 6 skipped
prjops:       387 passed
server:       477 passed
web:          303 passed / 1 skipped
```

The generated traceability matrix was restored after CI.

## Crit CLI Self-Review

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A023-crit-comments.json
review_outcome: approved
resolved: 1
unresolved: 0
```

Receipt: `.orchestration/validation/A023-review-receipt.md`.

`make require-crit-review` exited 2 because the target is absent. Browser Crit
and user review requests were not used.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/116
- State: `OPEN`
- Draft: `true`
- Base: `main`
- Head: `agent/p014-fa-plane-sandbox`
- Base SHA: `5c441d06a60f920f27f0a8ac0c9dca9509e4f561`
- Head SHA: `e19b1cda95fb699cc3eec72b881714fba5db7c60`
- Mergeable: `MERGEABLE`
- Merge state: `CLEAN`
- Label: `ai-generated`

Hosted checks:

```text
build-test  pass (3m28s)
gitleaks    pass (8s)
CodeRabbit  pass (draft review skipped)
```

Final worktree is clean and synchronized with the pushed branch.
