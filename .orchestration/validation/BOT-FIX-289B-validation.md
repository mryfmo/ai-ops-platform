# BOT-FIX-289B Validation

## Rule sweep — RED

変更前に、ローカルの ESLint core 10.9.1 で対象ルールを直接有効化した。

```text
$ env CI=true ./node_modules/.bin/eslint packages/*/src --config eslint.config.mjs --rule 'preserve-caught-error:error'
packages/composition/src/runtime.ts
  38:11  error  There is no `cause` attached to the symptom error being thrown  preserve-caught-error
packages/devops/src/agents/AGT_RPT.ts
  140:11  error  There is no `cause` attached to the symptom error being thrown  preserve-caught-error
packages/server/src/config.ts
  591:11  error  There is no `cause` attached to the symptom error being thrown  preserve-caught-error
packages/server/src/index.ts
  266:13  error  There is no `cause` attached to the symptom error being thrown  preserve-caught-error
packages/web/src/server/config.ts
  178:11  error  There is no `cause` attached to the symptom error being thrown  preserve-caught-error
✖ 5 problems (5 errors, 0 warnings)
exit_code=1
```

TypeScript compiler AST の全 source sweep は、catch 内の組み込み Error 構築を23件、うち cause なしを22件検出した。18件は引数なし catch、残りは上記5件だった。ルール実装も確認し、既定の `requireCatchParameter=false` では引数なし catch が対象外になるため、5件だけを修正した。

## Test-first RED

AGT_RPT の既存 security test に、捕捉した object と `cause` の参照同一性を追加して実装前に実行した。

```text
$ env CI=true pnpm --filter @aiops/devops run test -- agtRpt.test.ts
Test Files  1 failed | 21 passed (22)
Tests  1 failed | 211 passed | 6 skipped (218)
AssertionError: expected undefined to be Error: marker-leak-should-not-appear
exit_code=1
```

既存の JSON-spread、メール本文、secret marker 非流出の assertion は維持した。

## Focused tests — GREEN

```text
$ env CI=true ../../node_modules/.bin/vitest run tests/jiraComposition.test.ts  # packages/composition
Test Files  1 passed (1)
Tests  16 passed (16)
exit_code=0

$ env CI=true ../../node_modules/.bin/vitest run tests/agtRpt.test.ts  # packages/devops
Test Files  1 passed (1)
Tests  13 passed (13)
exit_code=0

$ env CI=true ../../node_modules/.bin/vitest run tests/config.test.ts tests/jiraComposition.test.ts  # packages/server
Test Files  2 passed (2)
Tests  78 passed (78)
exit_code=0

$ env CI=true ../../node_modules/.bin/vitest run tests/config.test.ts  # packages/web
Test Files  1 passed (1)
Tests  12 passed (12)
exit_code=0
```

## Rule sweep — GREEN

```text
$ env CI=true ./node_modules/.bin/eslint packages/*/src --config eslint.config.mjs --rule 'preserve-caught-error:error'
exit_code=0
```

`@eslint/js@10` の recommended 設定全体は依存変更禁止のため導入していない。現行の ESLint core 10.9.1 に組み込まれた該当ルールを直接実行した。

## Full CI

最初の実行は `packages/server/src/index.ts` の Prettier 指摘だけで停止した。対象ファイルへ既存 formatter を適用し、同じ fresh DB cluster で全工程を先頭から再実行した。

```text
$ ./node_modules/.bin/prettier --write packages/server/src/index.ts
packages/server/src/index.ts 45ms
exit_code=0

$ env CI=true PGHOST=127.0.0.1 PGPORT=55526 PGUSER=mryfmo AIOPS_TEST_DATABASE_NAME=aiops_bot_fix_289b_test AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55526 AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55526/aiops_bot_fix_289b_load AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_bot_fix_289b_load TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55526/aiops_bot_fix_289b_p001 P001_ALLOW_DISPOSABLE_DB=1 mise run ci
[audit] $ pnpm audit --prod --audit-level high
4 vulnerabilities found
Severity: 4 moderate
...
packages/devops test:coverage: Test Files  22 passed (22)
packages/devops test:coverage: Tests  218 passed (218)
...
packages/web test:coverage: Test Files  44 passed (44)
packages/web test:coverage: Tests  371 passed (371)
...
packages/composition test:coverage: Test Files  2 passed (2)
packages/composition test:coverage: Tests  19 passed (19)
...
migrations applied=24 skipped=0
migrations applied=0 skipped=24
P001 PostgreSQL integration passed
exit_code=0
```

CI が更新した traceability matrix は HEAD へ戻した。検証後、一時 PostgreSQL cluster `/tmp/aiops-bot-fix-289b-pg.XNe2vt` は停止・削除した。

## Review

```text
$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
exit_code=2

$ crit comments --session e45e3c8be150 --all --json
[{"scope":"review","id":"r_775f88","resolved":true,"resolved_round":1,...}]
exit_code=0
```

target 不在のため AGENTS.md の Crit-data fallback を使った。完全な resolved record は `.agents/worklog/codex/review/BOT-FIX-289B-crit-comments.json`、receipt は `.agents/worklog/codex/review/BOT-FIX-289B-review-receipt.md`。全差分を確認し、指摘なし。

## CompactionDB

```text
$ python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-289B: when a catch clause replaces an accessible caught error with a built-in Error, preserve the exact caught binding via ErrorOptions cause while keeping the constructor and message unchanged. Repository-wide verification uses the locally installed ESLint 10 preserve-caught-error rule forced over packages/*/src; parameterless catches remain outside the recommended default because requireCatchParameter is false. Before adding cause, confirm external boundaries classify or render only wrapper messages and do not serialize the raw cause.'
c0ec5cbd-23d7-430f-ad4c-8354c165da5c
exit_code=0
```

## Git

```text
$ git log -1 --format='%H %s'
54f4e6555d6fc494a79bcff9f2ed71e4666a4069 fix(errors): preserve caught causes across packages
exit_code=0
```

cost: n/a
