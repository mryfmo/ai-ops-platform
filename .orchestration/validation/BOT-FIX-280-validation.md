# BOT-FIX-280 Validation

## Focused tests

```text
$ pnpm --filter @aiops/server exec vitest run tests/config.test.ts tests/jiraComposition.test.ts tests/jiraEventRouter.test.ts tests/jiraWebhook.test.ts tests/eventsPollingTask.test.ts
Test Files  5 passed (5)
Tests  94 passed (94)

$ pnpm --filter @aiops/control-plane exec vitest run tests/jiraSyncState.test.ts
Test Files  1 passed (1)
Tests  8 passed (8)

$ pnpm --filter @aiops/integrations exec vitest run tests/jiraClient.test.ts
Test Files  1 passed (1)
Tests  6 passed (6)

$ node --test tests/validate-jira-environment-mapping.test.mjs
tests 7
pass 7
fail 0

$ pnpm --filter @aiops/control-plane exec vitest run tests/jiraSyncReplay.test.ts
Test Files  1 passed (1)
Tests  23 passed (23)
```

## Replay fixture generation

```text
$ pnpm --filter @aiops/control-plane exec node scripts/record-replay-history.mjs --jira-only
exit 0
```

Jira fixture 18件のみを recorder から再生成した。

## Full CI

Command: fresh PostgreSQL 16 cluster（port 55480、role postgres、databases aiops_test / aiops_load_test / aiops_p001）を作成後に `mise run ci`。

```text
packages/server test:coverage: Test Files  96 passed (96)
packages/server test:coverage: Tests  996 passed (996)
packages/control-plane test:coverage: Test Files  39 passed (39)
packages/control-plane test:coverage: Tests  386 passed (386)
packages/integrations test:coverage: Test Files  10 passed (10)
packages/integrations test:coverage: Tests  78 passed (78)
P001 PostgreSQL integration passed
exit 0
```

Full log: `/tmp/BOT-FIX-280-ci.log`

## Diff and review gate

```text
$ git diff --check
exit 0

$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
```

The repository does not expose the requested Make target, so it did not request a Crit review. No browser or human review was started.

## Git evidence

```text
$ git log -1 --format='%H %s'
c3f6ea2cec51a809b34bfcef2879fc5450beae6e fix(jira): harden runtime sync boundaries

$ git status --porcelain
?? .claude/contextdb/
?? .orchestration/autoskill/runs/BOT-FIX-280.md
?? .orchestration/learning/BOT-FIX-280-learning.md
?? .orchestration/reports/BOT-FIX-280-REPORT.md
?? .orchestration/sandboxes/BOT-FIX-280-SANDBOX.md
?? .orchestration/tasks/BOT-FIX-280-jira-hardening.md
?? .orchestration/validation/BOT-FIX-280-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip
```

実装の tracked working tree は clean。上記は task/worklog evidence、CompactionDB local state、package store、既存 reference archive の untracked files でありコミット対象外。
