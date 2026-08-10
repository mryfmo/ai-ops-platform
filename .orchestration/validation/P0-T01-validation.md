# P0-T01 Validation

## Baseline identity

- `git rev-parse HEAD`: `1f8e12c97cca8604cabaa9f35d5bcb0bfda2c91c`
- `git rev-parse HEAD^{tree}`: `59cb4af42ef4d99be5289304fcfefe43cfbaef58`
- Initial `git status --porcelain --untracked-files=no`: empty.
- Initial `git status --short`: two pre-existing untracked entries, `.pnpm-store/` and the implementation-pack zip; neither was staged or modified intentionally.

## Delta and dependencies

- `git diff --shortstat ff66698..1f8e12c`: 113 files, 9,315 insertions, 1 deletion.
- Path classification: `docs/**` 109; `.orchestration/plan/**` 2; `.prettierignore` 1; generated traceability output 1; other 0.
- Runtime/test/DB/workflow/deploy/contracts/runbook diff: empty.
- Dependency manifest diff: empty.
- SHA-256: `pnpm-lock.yaml` `5bf16d460aadab866f670890ea54ef39e203dd40852b5ff04e7cbb1af63f896d`; `.mise.toml` `59cc747741443ff9c575f0a0f6ea49162f2f1946948e7274062fb2d15a63bcfb`; root `package.json` `cf11d684bb12172c16456102d50b87b832b1105a82d7004ac13ff0af18d169b9`.
- Toolchain: mise Node 22.23.1, pnpm 11.13.0, actionlint 1.7.12; local PostgreSQL 16.14.

## CI and tests

- GitHub main run `31341703185`: success, 2026-08-09T23:21:49Z–23:26:23Z (4m34s).
- GitHub PR run `31344141574` on evidence commit `ad7a5bc`: `build-test` success (4m43s) and `gitleaks` success.
- `build-test`: success on PostgreSQL 16 service; build, typecheck, coverage, traceability, and P001 integration passed.
- Coverage totals: 182 test files; 2,270 passed; 4 skipped; 2,274 total.
- Governance Node tests: 20 passed.
- `gitleaks`: success.
- Local `mise run typecheck`: pass, 4.84s.
- Local `mise run test:coverage` with disposable PostgreSQL: pass, 20.85s, same 182/2,270/4 totals.
- Local `mise run verify:db`: pass, 2.60s, `P001 PostgreSQL integration passed`, migration first apply 16 and second apply 0/skipped 16.
- Local clean `mise run ci`: pass, exit 0, 69.61s; 182 test files, 2,274 passed, 0 skipped; `P001 PostgreSQL integration passed`.
- Local `mise run format`: pass, 6.33s.
- Pack validator: `OK: 113 WBS tasks, 64 acceptance gates, 100 files`.
- `git diff --check`: pass.
- `make require-crit-review`: unavailable (`No rule to make target`); no browser Crit review was opened. The staged seven-file documentation/evidence diff was checked directly against the task's allowed paths and evidence claims.

## Environment boundary

- The initial unmodified local `mise run ci` reached the normal Next/Turbopack build and was denied process port binding by the Codex macOS runner (`Operation not permitted`). That non-zero attempt is not counted as green.
- A first webpack-shim rerun exposed contamination from the earlier migration verification (`"audit_log" is not partitioned`) and was also not counted as green. All three task-owned disposable databases were then dropped and recreated.
- The final `mise run ci` used only a repo-external `NODE_OPTIONS` shim that appends Next's official `--webpack` option; every repository task ran in order and exited 0. The shim changed no repository file, dependency, or configuration.
- GitHub runs `31344141574` and `31344397408` independently passed the normal Turbopack build and PostgreSQL 16 suite, covering the bundler path unavailable in the local runner.
- GitHub Codex finding `discussion_r3745799736` correctly rejected Owner approval as a substitute for the required command. The clean full-command rerun above satisfies the requested fix; the gate remains subject to Reviewer/Owner approval.
