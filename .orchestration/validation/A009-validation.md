# A009 Validation

## Scope

Committed diff:

```text
M tests/validate-acceptance-manifest.test.mjs
```

```text
1 file changed, 46 insertions(+), 38 deletions(-)
```

No validator logic, manifest, dependency, schema, worklog, or product file changed.

## Regression and Fix

Before the fix:

```text
node --test tests/validate-acceptance-manifest.test.mjs
tests 12
pass 3
fail 9
```

The failures reported `extra task P010-F01-T10` because T09-specific tests loaded the full advancing manifest.

After the fix, the identical command exited 0:

```text
tests 12
pass 12
fail 0
```

`manifestThroughT09()` locates the explicit `P010-F01-T09` record and slices through it. Both direct validator tests and CLI tests use that bounded value. The current T10 record remains present in the source manifest, demonstrating that later records are excluded.

## Local Gates

```text
mise run format
```

Exit 0: all matched files use Prettier code style.

```text
mise run ci
```

Exit 0: governance, lint, traceability, format, build, typecheck, and coverage tests passed.

CI transiently regenerated the traceability matrix timestamp. That out-of-scope generated difference was restored; the committed and final diff contains only the authorized test file.

The local `gitleaks` binary was unavailable. A focused secret-pattern scan of the diff found no match, and the hosted pinned gitleaks check passed.

## Crit CLI Self-Review

No browser Crit or user review request was used.

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A009-crit.json
review_outcome: P0=0, P1=0, P2=0
review_file_id: b459e0cd083c
review_comment: r_b3f8da
resolved: 1
unresolved: 0
```

Receipt: `.orchestration/validation/A009-review-receipt.md`

`make require-crit-review` exited 2 because this repository has no such Make target.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/103
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-t10-test-fixture-fix`
- Head SHA: `fb70c20a1e927715bd61bd571e7f71fd12620564`
- Mergeability: `CLEAN` / `MERGEABLE`
- Label: `ai-generated`
- Files: exactly `tests/validate-acceptance-manifest.test.mjs`
- Commit count: 1

Hosted checks:

```text
build-test  pass  3m15s
gitleaks    pass  6s
CodeRabbit  pass  Review completed
```

The final linked worktree is clean, and local HEAD equals the pushed branch SHA. The PR was not merged.
