# JIRA-COMP-02 Validation

## Test-first evidence

Composition runtimeを分離するテストを先に変更し、実装前は次のREDを確認した。

```text
Cannot find module '../src/runtime.js'
```

package exportの自己レビューでも、`default` conditionを要求するテストを先に追加した。

```text
Test Files  1 failed (1)
Expected: default: ./dist/index.js / ./dist/bootstrap.js
Received: import and types only
```

## Focused GREEN

Command: `CI=true pnpm --filter @aiops/composition run test`

```text
Test Files  2 passed (2)
Tests       19 passed (19)
```

`@aiops/composition...`の8 workspace packagesに対するbuild、typecheck、lintもexit 0。

## Production deploy verification

Command: `pnpm --filter @aiops/composition deploy --prod --legacy <temporary-dir>`の後、成果物からplain Node importを実行。

```text
node_modules/@aiops/server/dist
node_modules/@aiops/integrations/dist
node_modules/@aiops/control-plane/dist
node_modules/.pnpm/@temporalio+client@1.22.0/node_modules/@temporalio/client/package.json
runtime-imports-ok
```

Docker CLIは存在しなかった。

```text
zsh: command not found: docker
```

Dockerfileとsupervisorの全文差分は`.orchestration/validation/JIRA-COMP-02-container.diff`、実行ログは`JIRA-COMP-02-packaging.log`に保存した。

## Full CI

空のPostgreSQL 16 cluster（port 55503）で、次の環境を渡して`CI=true mise run ci`を実行した。

```text
All matched files use Prettier code style!
packages/composition test:coverage: Test Files  2 passed (2)
packages/composition test:coverage: Tests  19 passed (19)
P001 PostgreSQL integration passed
```

Exit code: 0。governance、policy、contracts、audit、actionlint、lint、traceability、format、build、typecheck、全workspace coverage、DB verificationを完走。全文ログは`.orchestration/validation/JIRA-COMP-02-ci.log`。

途中の失敗は3件とも環境要因として切り分けた。

- pnpm root symlink欠落: frozen lockfileの再installで復旧。lockfile差分なし。
- sandbox内のtsx IPC socket作成が`EPERM`: 同じCIを権限昇格して再実行。
- 2回目に同じDBを再利用し`audit_log is not partitioned`: clusterを作り直し、final runをgreenにした。

## Scope and review

```text
packages/composition/src/main.ts
packages/composition/src/runtime.ts
packages/composition/tests/containerPackaging.test.ts
packages/composition/tests/jiraComposition.test.ts
packages/server/Dockerfile
packages/server/package.json
packages/server/scripts/start-container.mjs
packages/server/src/bootstrap.ts
runbooks/jira-github-cutover.md
```

- `pnpm-lock.yaml`、外部dependency/version、server/control-plane実装ロジックの差分なし。
- `git diff --cached --check`: clean。
- staged credential-pattern scan: clean。
- Crit evidence: `.agents/worklog/codex/review/JIRA-COMP-02-crit.json`。
- Receipt: `.orchestration/validation/JIRA-COMP-02-review-receipt.md`。
- `make require-crit-review`: `No rule to make target 'require-crit-review'`。

## Git and CompactionDB

```text
04ac21a463119d731e0cd304c98c1be0d7655f74 fix(composition): package production server entry
```

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'JIRA-COMP-02: The server image has one production entry at @aiops/composition; a minimal @aiops/server/bootstrap subpath initializes config, logger, and telemetry before dynamic imports; absent server Jira environment skips Jira seam construction and Temporal connection; pnpm production deploy keeps workspace symlink topology so transitive Temporal dependencies remain resolvable.'
```

Output: `ad0bc6b9-6646-4443-89ce-01ae07ac6c2f`
