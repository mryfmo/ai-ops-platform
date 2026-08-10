<!-- 根拠: PrjOps:REQ-030 / PrjOps:REQ-041 / PrjOps:REQ-042 -->

# P0-T05 Validation

## Identity

- Base HEAD: `e41e6e67cf5f42b70b8aa0b15c2b2266fcdd3862`
- Base tree: `7321c5a2b40078921496ec145e2526fbd7b87562`
- Toolchain: Node 22.23.1, pnpm 11.13.0, Vitest 4.1.10, PostgreSQL 16.14.
- Initial tracked status: clean. Pre-existing untracked `.pnpm-store/` and implementation-pack zip were not modified or staged.

## Load and latency commands

- `pnpm --filter @aiops/server run test -- loadBaseline`: exit 0; Vitest 4 scope mismatch, 74 files / 807 passed / 4 skipped.
- `pnpm run verify:load`: exit 0; same scope mismatch, server 74 files and web 38 files executed.
- `pnpm --filter @aiops/server exec vitest run loadBaseline.test.ts --reporter=verbose`: 1 file / 10 passed; metric JSON captured.
- `pnpm --filter @aiops/web exec vitest run dataApiPoolLoad.test.ts --reporter=verbose`: 1 file / 1 passed; 500-request metric captured.
- First sandboxed real-PostgreSQL command: non-zero `connect EPERM`; environment-denied and not counted green.
- Escalated `pnpm run verify:load:postgres`: exit 0, web 38 files / 312 passed.
- Targeted escalated real-PostgreSQL Vitest: 1 file / 1 passed; 500 GETs, physical connections 0→1→1→0, pool peak 1.
- PostgreSQL round-trip Node command: 200 `SELECT 1` samples after 10 warm-ups; mean 0.145ms, p50 0.139ms, p95 0.247ms, max 0.367ms.
- `ANTHROPIC_API_KEY` presence check: unset; real LLM latency remains `ENV-blocked`.

## Final repository gate

- `mise run ci`: exit 0 in approximately 60 seconds; governance, audit, actionlint, lint, traceability, format, build, typecheck, coverage, and DB integration passed.
- Coverage totals: 182 test files, 2,274 passed, 0 skipped.
- Database integration: `P001 PostgreSQL integration passed`; migrations first apply 16 and second apply 0/skipped 16.
- Local Next build: official `--webpack` selector supplied by a repository-external `NODE_OPTIONS` shim because this runner denies Turbopack subprocess port binding. No repository file or dependency changed.
- Normal Turbopack control: main CI run `31345396762` on base `e41e6e6` passed build-test and gitleaks.
- The first full-CI attempt completed after its terminal handle was lost; because its exit status was not captured, it was not counted green. Databases were recreated before the final recorded run.
- `pnpm exec prettier --check` for all task files: pass after formatting the baseline report.
- `git diff --check`: pass.
- `make require-crit-review`: unavailable (`No rule to make target`); browser Crit was not opened under the repository policy. The documentation-only scope was reviewed directly from the complete diff.
- Cleanup check: `pg_isready` returned `no response` on task port 55434 after cluster shutdown.
