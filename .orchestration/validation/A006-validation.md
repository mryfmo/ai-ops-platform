# A006 Validation

## Scope

Committed diff:

```text
M package.json
A scripts/validate-acceptance-manifest.mjs
A tests/validate-acceptance-manifest.test.mjs
A verification/acceptance-manifest.json
```

```text
4 files changed, 974 insertions
```

No file outside the Plan-authorized product paths was committed. Package dependencies and lockfiles are unchanged.

## Test-first evidence

Initial focused run:

```text
node --test tests/validate-acceptance-manifest.test.mjs
```

Exit 1 with:

```text
ERR_MODULE_NOT_FOUND: scripts/validate-acceptance-manifest.mjs
```

Final focused run exits 0:

```text
tests 12
pass 12
fail 0
```

Coverage includes:

- independent exact 86-task golden list and phase counts
- valid real manifest and non-silent DEV-TRUST output
- CLI success and CLI exit 1
- missing, extra, duplicate, out-of-order, and blocked records
- immutable Plan hash mismatch
- nonzero command
- required null
- missing artifact
- dependency non-ancestor
- symlink artifact
- repository escape
- artifact hash mismatch
- self-reported review and ENV evidence
- requester self-review and self-approval
- incomplete `--final`

## Immutable Plan evidence

```text
commit  cf21b5edaff036adacb0002ecfa3fa825ba268a9
blob    76137212e6878edb193aeb0f41c6a37f7c3eab5f
sha256  ca3c85cf311b3942f3913032a71c721acdced370c4bc4c869515f4ed50bb9136
```

Extracted task counts:

```text
F00=4
F01=11
F02=14
F03=8
F04=8
F05=20
F06=18
F07=3
total=86
```

The test owns an independent golden fixture rather than importing the implementation's expected result as its oracle.

## Real manifest validation

Command:

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T09 verification/acceptance-manifest.json
```

Exit 0:

```text
WARNING: DEV-TRUST: 13 placeholder trust assignments are development-only; production acceptance is blocked.
OK: validated 13 acceptance records through P010-F01-T09.
```

The manifest contains F00-T01 through F00-T04 and F01-T01 through F01-T09 in canonical order. P010-F01-T10 is absent.

Artifact content is loaded from each target commit with `git show`, regular-file mode is read with `git ls-tree`, SHA-256 is recalculated, target commits must be ancestors of HEAD, and task dependencies must be ancestors of the dependent task's target commit.

DEV reviewer evidence must resolve to the tracked `docs/decisions/acceptance-trust-bootstrap.md` Git object and contain the named DEV-DEFAULT identity. A manifest-only review or ENV assertion is rejected.

## Formatting and repository CI

```text
env MISE_LOCKED=1 mise run format
```

Exit 0:

```text
All matched files use Prettier code style!
```

```text
env MISE_LOCKED=1 mise run ci
```

Exit 0. Governance, lint, traceability, format, build, typecheck, and coverage tests all passed:

- shared: 18 files / 335 tests passed
- traceability: 1 file / 56 tests passed
- devops: 19 files / 193 passed, 2 skipped
- prjops: 23 files / 347 tests passed
- server: 47 files / 474 tests passed
- web: 31 files passed and 1 skipped / 234 tests passed and 1 skipped

The traceability generator's timestamp-only output was restored after each CI run.

## Crit CLI review

No browser Crit or user review request was used.

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A006-validation.md
review_outcome: approved_after_fix
review_session: ba747cf9b927
resolved_record: r_c4216e
resolved_reply: rp_cd1cb3
resolved: 1
unresolved: 0
```

The review found that the first golden test reused implementation constants as its oracle. The test was changed to own independent golden phase counts/task IDs, then focused tests and full CI were rerun successfully.

`make require-crit-review` exited 2 because this repository has no such Make target. The resolved Crit CLI record above is the available review evidence.

## GitHub validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/100
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f01-t10-validator`
- Head SHA: `54a23a42a353f45cc12e90daa2ff648ede67676b`
- Mergeability: `CLEAN` / `MERGEABLE`
- Label: `ai-generated`
- Files: exactly the four Plan-authorized files
- Commit count: 1

Hosted checks:

```text
CodeRabbit  pass  Review completed
build-test  pass  3m10s
gitleaks    pass  10s
```

The PR description summarizes the complete diff, immutable trust boundary, DEV-TRUST limitation, T10 self-record exclusion, tests, and review evidence.

## Final repository state

```text
HEAD                                        54a23a42a353f45cc12e90daa2ff648ede67676b
origin/agent/p010-f01-t10-validator         54a23a42a353f45cc12e90daa2ff648ede67676b
origin/main                                 cf21b5edaff036adacb0002ecfa3fa825ba268a9
```

Worktree status is clean. PR #100 was not merged.

