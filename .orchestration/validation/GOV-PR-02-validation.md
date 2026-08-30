# GOV-PR-02 Validation

## Initial non-TTY environment stop

Command: `pnpm run governance:check`

```text
Scope: all 11 workspace projects
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY Aborted removal of modules directory due to no TTY

If you are running pnpm in CI, set the CI environment variable to "true", or set "confirmModulesPurge" to "false".
ERROR Command failed with exit code 1: /Users/mryfmo/.local/share/mise/installs/pnpm/11.13.0/pnpm install
```

Exit code: 1。test開始前の環境停止。既存learnに従い、以後は`CI=true`を明示した。

## Focused governance check

Command: `CI=true pnpm run governance:check`

Verbatim output: `GOV-PR-02-governance.log`（444 lines）。該当箇所:

```text
$ node scripts/check-codeowners.mjs && node --test scripts/verify-canonical-spec-mirrors.test.mjs scripts/coding-agent-path-guard.test.mjs scripts/mint-aiops-pr-token.test.mjs tests/architecture-fitness.test.mjs && node scripts/verify-canonical-spec-mirrors.mjs && node scripts/check-architecture-fitness.mjs && pnpm run plane-mapping:validate && pnpm run jira-mapping:validate
# Subtest: mint AI PR GitHub App token (ADR-0032)
    1..9
ok 18 - mint AI PR GitHub App token (ADR-0032)
# tests 49
# pass 49
# fail 0
```

Exit code: 0。

## Full CI

Command: fresh PostgreSQL 16 on port 55495 + `CI=true mise run ci`。

Verbatim output: `GOV-PR-02-ci.log`（9686 lines）。末尾:

```text
P001 PostgreSQL integration passed
```

Exit code: 0。使い捨てDB clusterは終了後に停止した。

## Scope and review

```text
$ git diff --cached --check

$ git diff --cached --stat
 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

$ git diff --cached --name-only
package.json

allowed-path check: package.json only
one-script check: governance:check only
credential-pattern scan: clean

$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
```

Crit evidence: `.agents/worklog/codex/review/GOV-PR-02-crit.json`。Receipt: `.agents/worklog/codex/review/GOV-PR-02-crit-receipt.md`。

## Git and CompactionDB evidence

```text
$ git log -1 --format='%H %s'
28df986883486d07c486acdd974333af4fba6d8f test(governance): run mint token suite in governance check

$ git status --porcelain
?? .orchestration/autoskill/runs/GOV-PR-02.md
?? .orchestration/learning/GOV-PR-02-learning.md
?? .orchestration/reports/GOV-PR-02-REPORT.md
?? .orchestration/sandboxes/GOV-PR-02-SANDBOX.md
?? .orchestration/tasks/GOV-PR-02-mint-test-ci-wiring.md
?? .orchestration/validation/GOV-PR-02-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip
```

tracked差分なし。task artifactsと作業前からあるstore/referenceだけがuntracked。

```text
$ python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'GOV-PR-02: scripts/mint-aiops-pr-token.test.mjs is part of the root governance:check node --test graph so mise run ci detects mint-token regressions.'
c27dd14f-2880-458f-a7d9-8d0ba1ee0491
```
