# P8-T02 Validation

## Test-first Evidence

1. RED: `node --test scripts/coding-agent-path-guard.test.mjs` failed 10/10 with `ERR_MODULE_NOT_FOUND` before `coding-agent-path-guard.mjs` existed.
2. GREEN: the final focused suite passed 17/17.
3. CI integration: `governance:check` runs the focused suite in the protected root governance command under the approved one-entry `package.json` amendment.

## R01 Clean-runner Regression

1. RED with `contracts/node_modules` temporarily renamed: the existing path-guard suite passed 1/17 and failed 16/17 because the validator tried to execute the absent contracts-local Spectral binary.
2. GREEN with the same dependency directory absent: `node --test contracts/agent-task/agent-task.test.mjs scripts/coding-agent-path-guard.test.mjs` passed 27/27, including `$ref` sibling and unsupported keyword-form negatives.
3. Required clean-state simulation with the dependency directory absent: `pnpm run governance:check` passed 40/40, including guard 17/17. The directory was restored by an exit trap and no backup path remained.
4. The dependency-free evaluator rejects schema keywords it does not implement, so later P8-T01 schema evolution cannot silently weaken validation.
5. Staged-diff review found and closed `$ref` sibling / unsupported keyword-value-form fail-open risk before the final validation rerun.

## Malicious Fixtures

- Direct manifest-forbidden content write.
- Ignored `.env.production` credential creation.
- Existing ignored file modification outside the allowlist.
- Changed `.gitignore` hiding a newly created forbidden file.
- `.git/hooks/post-checkout` insertion.
- Workflow governance modification despite manifest allowance.
- `contracts/agent-task/**` self-modification despite manifest allowance.
- Guard-script self-modification despite manifest allowance.
- HMAC-authenticated snapshot tampering.
- Rename from allowed to forbidden.
- Forbidden file mode-only change.
- Allowed symlink resolving outside the repository.
- Allowed symlink resolving into a manifest-forbidden path.
- Dangling/unresolved allowed symlink.
- Ignored allowed symlink resolving outside the repository.
- Manifest `..` traversal.
- Positive control: an allowed content change remains accepted.

## Commands and Results

- `node --check scripts/coding-agent-path-guard.mjs`: PASS.
- `node --test scripts/coding-agent-path-guard.test.mjs`: PASS, 17/17.
- `node --test contracts/agent-task/agent-task.test.mjs scripts/coding-agent-path-guard.test.mjs` with `contracts/node_modules` absent: PASS, 27/27.
- `pnpm run governance:check` with `contracts/node_modules` absent: PASS, 40/40.
- `mise run contracts`: PASS, final 56/56. An earlier sandboxed run hit an unrelated tsx IPC socket `EPERM`; the required rerun outside that sandbox passed without code changes.
- `env CI=true mise run governance`: PASS, guard 17/17 and all governance checks green.
- `mise run actionlint`: PASS.
- `node_modules/.bin/prettier --write <P8-T02 files>`: PASS.
- Final R01 fresh-DB `env CI=true ... mise run ci`: PASS, exit 0 using recreated isolated PostgreSQL 16 databases on port 55442; governance 40/40 (guard 17/17), Rego 25/25, contracts 56/56, audit, actionlint, lint, traceability, format, build, typecheck, all-package coverage (including server 930/930), and PostgreSQL integration passed.
- Plan quality gate: repository validator, Make target, hook, reviewer definition, and CI entry point are absent; the `plan-quality-gate` checklist was applied manually to `.agents/worklog/codex/plan/20260816_170842_plan.md`.
- `/private/tmp/gitleaks git --staged --no-banner --redact --verbose .`: PASS with gitleaks 8.30.1, no leaks found.
- `make require-crit-review`: unavailable (`No rule to make target`). `crit status --json` reported no review file; browser Crit is prohibited by project policy. The complete staged diff was reviewed locally and five security findings were resolved in `.orchestration/reviews/P8-T02-review-evidence.json`.

## Known Non-blocking Baseline Output

- Contract Spectral: 0 errors, 26 warnings, 1 informational message.
- Production dependency audit: 2 moderate vulnerabilities; no dependency or lockfile changed.
- `mise` cache writes outside the workspace warn under the sandbox but do not affect command results.
- One intermediate clean-state command omitted `CI=true` and stopped at pnpm's non-TTY modules-purge confirmation after the focused 27/27 pass; the corrected `env CI=true pnpm run governance:check` passed 40/40 with dependencies still absent.
