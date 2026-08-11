# A012 Validation

## Scope

Committed diff is exactly three task-authorized files:

```text
packages/prjops/src/index.ts
packages/prjops/src/lib/prjopsDataSnapshotValidator.ts
packages/prjops/tests/prjopsDataSnapshotValidator.test.ts
1035 insertions
```

Commit:

```text
265e7d4517d2ab38f79ee1ad2b62cba3baa3813a feat(prjops): validate authoritative data snapshots
```

Representative SHA-256:

```text
ee809f39b94eba805b392236282a470ff38834f8c62cc237dd88b57ef74e548c  packages/prjops/src/lib/prjopsDataSnapshotValidator.ts
2f45e29196c5f21e3f663f1fede9c288d3cc746b7782e109096ee7f0902ca301  packages/prjops/tests/prjopsDataSnapshotValidator.test.ts
```

## Preflight Acceptance

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json
```

Exit 0:

```text
WARNING: DEV-TRUST: 13 placeholder trust assignments are development-only; production acceptance is blocked.
OK: validated 15 acceptance records through P010-F01-T11.
```

## Validator Tests

- The initial focused test run failed because the validator module did not yet
  exist, recording the required RED state.
- The final PrjOps run passed 24 test files and 381 tests.
- All 17 entries in
  `docs/contracts/fixtures/checksum-golden-vectors.json` are consumed directly
  by parameterized tests; manifest bytes and content SHA-256 are asserted.
- Tests cover all 16 contract error codes without defining another code.
- Tests exercise strict schema/YAML behavior, filename identity, duplicate
  identity/mapping, dangling references, ownership boundaries, three required
  singletons, checksum mismatch, contract priority, and a complete snapshot.

## Repository CI

```text
MISE_LOCKED=1 mise run ci
```

Exit 0. Governance, lint, traceability, format, build, typecheck, and coverage
tests passed. The traceability generator's timestamp-only output was restored
after each CI run, leaving the authorized diff.

## Crit CLI Self-Review

No browser Crit or user review request was used.

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A012-crit-comments.json
review_outcome: P0=0, P1=1 resolved, P2=0
review_comment: c_493912
resolved: 1
unresolved: 0
```

The resolved finding removed an unsupported `uniqueItems` restriction from the
Seven Keys assessment array and added a contract-shaped regression test.
Receipt: `.orchestration/validation/A012-review-receipt.md`.

`make require-crit-review` exited 2 because this repository has no such Make
target.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/106
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t02-snapshot-validator`
- Head SHA: `265e7d4517d2ab38f79ee1ad2b62cba3baa3813a`
- Base SHA: `709879789234a32e4caae90f8d09b5e81bdefe36`
- Merge state: `CLEAN`
- Label: `ai-generated`

Hosted checks:

```text
build-test  pass  2m46s
gitleaks    pass  7s
CodeRabbit  pass  status only; automated comment reported review rate limiting
```

GitHub pull review and inline-comment endpoints returned empty arrays. The
CodeRabbit issue comment was informational and contained no code finding.

## Final Repository State

```text
HEAD                                             265e7d4517d2ab38f79ee1ad2b62cba3baa3813a
origin/agent/p010-f02-t02-snapshot-validator     265e7d4517d2ab38f79ee1ad2b62cba3baa3813a
origin/main                                      709879789234a32e4caae90f8d09b5e81bdefe36
```

The linked worktree is clean. PR #106 was not merged.
