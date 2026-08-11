# A011 Validation

## Scope

Committed diff is exactly 11 task-authorized files under `docs/contracts/`:

```text
4 Markdown contracts
4 JSON Schemas
3 machine fixture sets
1947 insertions
```

Commit:

```text
ff030305022b794df1d79cfbeb0af39d2d3f21e0 docs(contracts): define prjops data machine contract
```

Representative SHA-256:

```text
d76b7bb72a14a8c3dbccf2472c7e4c96d5eebac520263ec5bddbea97d521d5a8  docs/contracts/fixtures/checksum-golden-vectors.json
e682d205abb9773a33983d65184be0e103053bc840c908889e4cf730f82b72d5  docs/contracts/schema/prjops-data.schema.json
26707b913a89d75fe9a488f03e2ffc9f7993982544f66eb1e8c33c0126f60416  docs/contracts/schema/entra-subject-mapping.schema.json
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

## Contract Validation

- All 7 JSON files parse.
- All 4 Draft 2020-12 JSON Schemas validate and compile with Ajv 8.
- Both contract-case files and the checksum vector file validate against their container schemas.
- Every fixture `schema_ref` resolves to an existing file and JSON Pointer.
- Positive referenced schema cases validate and schema-negative cases fail.
- Case IDs and golden-vector IDs are unique.
- All required golden categories are present.
- All six local Markdown links resolve.
- Unknown-field, duplicate identity/mapping, filename mismatch, dangling reference,
  ownership >100, missing singleton, checksum mismatch, foreign tenant, unresolved
  mapping, inactive mapping, stale persona, illegal global scope, and investor
  out-of-scope cases have exact expected codes.

The independent checksum command decoded each fixture input from Base64, enforced
entry/path/UTF-8/BOM/newline/NFC rules, rebuilt file entries in unsigned ASCII
path order, rebuilt exact canonical manifest bytes, and recalculated SHA-256.
All 17 vectors matched.

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
review_source: .orchestration/validation/A011-crit-comments.json
review_outcome: P0=0, P1=1 resolved, P2=0
review_comment: r_c8692c
resolved: 1
unresolved: 0
```

The resolved finding removed unsupported UUID version/variant-bit constraints and
made owner signature bytes/key identity explicit and separate from ENV values.
Receipt: `.orchestration/validation/A011-review-receipt.md`.

`make require-crit-review` exited 2 because this repository has no such Make
target.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/105
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t01-machine-contract`
- Head SHA: `ff030305022b794df1d79cfbeb0af39d2d3f21e0`
- Base SHA: `7f7ebf112c69966ba4c9dcedaa9949eef8fa9c01`
- Merge state: `CLEAN`
- Label: `ai-generated`

Hosted checks:

```text
build-test  pass  2m47s
gitleaks    pass  7s
CodeRabbit  pass  Review completed
```

GitHub pull review and inline-comment endpoints returned empty arrays.

## Final Repository State

```text
HEAD                                             ff030305022b794df1d79cfbeb0af39d2d3f21e0
origin/agent/p010-f02-t01-machine-contract       ff030305022b794df1d79cfbeb0af39d2d3f21e0
origin/main                                      7f7ebf112c69966ba4c9dcedaa9949eef8fa9c01
```

The linked worktree is clean. PR #105 was not merged.
