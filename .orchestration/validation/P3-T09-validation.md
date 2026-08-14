# P3-T09 validation

- test-first red: focused suite failed because `verification/temporal-shadow/shadow.ts` did not exist
- focused: `pnpm --filter @aiops/server exec vitest run tests/temporalShadow.test.ts --maxWorkers=1` → 1 file / 4 tests green, including conditional JIT inclusion/exclusion plus inline and composition-override interval mutation rejection
- deterministic runner: `pnpm exec esbuild verification/temporal-shadow/run.ts --bundle --platform=node --format=cjs --outfile=/private/tmp/p3t09-shadow.cjs` then `mise exec -- node --permission --allow-fs-read=. --allow-fs-read=/private/tmp/p3t09-shadow.cjs --import=./verification/temporal-shadow/deny-network.mjs /private/tmp/p3t09-shadow.cjs` → inventory 15/15, matches 12, reasoned differences 3 (including completion-anchored `runOnStart` recurrence), unreasoned differences 0, external writes 0
- server package after review fixes: 78 files / 860 tests green under coverage
- server typecheck/lint: green
- verification harness ESLint and Prettier: green
- source integrity: `packages/server/src/index.ts` has no diff from `origin/main`; scheduler registration, behavior, and order are unchanged
- dependencies: no manifest or lockfile diff
- full CI after review fixes: `VITEST_MAX_WORKERS=1 mise run ci` exit 0 in the same shell after recreating dedicated `p3t09_test`, `p3t09_load_test`, and `p3t09_p001` PostgreSQL databases
- sandbox note: the first restricted-sandbox database connection was rejected; the authorized rerun against the same disposable databases completed successfully
- repository review gate: `make require-crit-review` is unavailable in this repository (`No rule to make target`)
- independent Codex reviews: all reported timing, conditional inventory, action/workflow derivation, dependency/helper-call additions, predicate drift, rationale, and side-effect enforcement gaps were reproduced and resolved; the runner now checks exact legacy and Temporal workflow AST full-call inventories plus production guard hashes, guarded-action due conditions, child structure and interval phase, every scheduler array element, and the complete bundle under file/process/network denial
