# P8-T01 Validation

## Test-first Evidence

1. RED: `pnpm --dir contracts test` failed with `ERR_MODULE_NOT_FOUND` before `manifest-validator.mjs` existed.
2. GREEN: `pnpm --dir contracts exec node --test agent-task/agent-task.test.mjs` passed 2 suites / 9 tests.
3. Existing gate: `mise run contracts` passed 8 suites / 55 tests; Spectral reported only the repository's existing non-blocking warnings.

## Negative Coverage

- Same writer/reviewer, unknown or swapped role, and malformed execution-profile label.
- Allowed/forbidden overlap and absolute, traversal, backslash, or unsupported wildcard paths.
- Missing/non-positive budget limits, unpinned CLI, master/provider key use, production-network access, wrong-task branch, and incomplete callback evidence.
- Pairwise concurrent subtree overlap, duplicate task claim, and duplicate branch claim.
- A pairwise-disjoint assignment set remains accepted.

## Commands and Results

- `pnpm exec prettier --write <P8-T01 files>`: PASS.
- `pnpm --dir contracts exec node --test agent-task/agent-task.test.mjs`: PASS, 9/9.
- `mise run contracts`: PASS, 55/55.
- `actionlint -shellcheck= -pyflakes= .github/workflows/*.yml`: PASS.
- Fresh-DB `mise run ci`: PASS, exit 0; governance, Rego 25/25, contracts 55/55, actionlint, lint, traceability, format, build, typecheck, all-package coverage, and PostgreSQL integration passed.
- gitleaks 8.30.1 staged scan: PASS, no leaks found.
- `gh pr view` file-list comparison: PASS, zero overlap with open PR #244/#245/#246.
- `make require-crit-review`: unavailable (`No rule to make target`).
- `crit status --json`: no review file exists. Project policy prohibits opening browser Crit, so the staged diff was reviewed locally for correctness, security, scope, and traceability; no actionable finding remained.
- `python3 .claude/hooks/contextdb_cli.py memory add --help`: unavailable because the project CLI file is absent.

## Known Non-blocking Baseline Output

- Contract Spectral: 0 errors, 26 warnings, 1 informational message.
- Production dependency audit: 2 moderate vulnerabilities; the task adds no dependency or lockfile change.
