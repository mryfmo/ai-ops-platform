# GOV-PR-01 Validation

Full verbatim CI logs:

- stdout: `GOV-PR-01-ci-final.stdout.log`
- stderr: `GOV-PR-01-ci-final.stderr.log`

## RED: test-first module absence

Command: `node --test scripts/mint-aiops-pr-token.test.mjs`

```text
TAP version 13
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/mryfmo/Workspace/ai-ops-platform/scripts/mint-aiops-pr-token.mjs' imported from /Users/mryfmo/Workspace/ai-ops-platform/scripts/mint-aiops-pr-token.test.mjs
# Node.js v22.23.1
# Subtest: scripts/mint-aiops-pr-token.test.mjs
not ok 1 - scripts/mint-aiops-pr-token.test.mjs
  ---
  failureType: 'testCodeFailure'
  exitCode: 1
  code: 'ERR_TEST_FAILURE'
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
```

Exit code: 1（expected RED）。

## GREEN: networkless mint test

Command: `node --test scripts/mint-aiops-pr-token.test.mjs`

```text
TAP version 13
# Subtest: mint AI PR GitHub App token (ADR-0032)
    # Subtest: signs the required RS256 JWT and requests the installation token without network-coupled code
    ok 1 - signs the required RS256 JWT and requests the installation token without network-coupled code
    # Subtest: writes only the token to stdout on success
    ok 2 - writes only the token to stdout on success
    # Subtest: fails closed before fetch when AIOPS_GH_APP_ID is missing
    ok 3 - fails closed before fetch when AIOPS_GH_APP_ID is missing
    # Subtest: fails closed before fetch when AIOPS_GH_APP_PRIVATE_KEY_PATH is missing
    ok 4 - fails closed before fetch when AIOPS_GH_APP_PRIVATE_KEY_PATH is missing
    # Subtest: fails closed before fetch when AIOPS_GH_APP_INSTALLATION_ID is missing
    ok 5 - fails closed before fetch when AIOPS_GH_APP_INSTALLATION_ID is missing
    # Subtest: fails on an HTTP error without leaking the provider body
    ok 6 - fails on an HTTP error without leaking the provider body
    # Subtest: rejects malformed JSON without printing token material
    ok 7 - rejects malformed JSON without printing token material
    # Subtest: rejects blank token without printing token material
    ok 8 - rejects blank token without printing token material
    # Subtest: rejects expired token without printing token material
    ok 9 - rejects expired token without printing token material
    1..9
ok 1 - mint AI PR GitHub App token (ADR-0032)
1..1
# tests 9
# suites 1
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 81.581208
```

Exit code: 0。

## Traceability config-inventory RED and recovery

First command: `mise run traceability`

```text
- 設定変数インベントリ不整合: config inventory: AIOPS_GH_APP_ID is in .env.example but is in neither Zod schema, config inventory: AIOPS_GH_APP_PRIVATE_KEY_PATH is in .env.example but is in neither Zod schema, config inventory: AIOPS_GH_APP_INSTALLATION_ID is in .env.example but is in neither Zod schema
E-TRACE01: トレーサビリティ検証に失敗しました
[traceability] ERROR task failed
```

`.env.example`をtask指定どおりserver runtime assignmentではなくscript-only説明コメントへ変更した後、同じcommandを再実行した。

```text
## Traceability Guards

- 根拠ヘッダ不足: —
- 存在しないADR参照: —
- 名前空間参照不正: —
- 仕様IDインデックス不正: —
- disposition不正: —
- 仕様IDカタログ不正: —
- 設定変数インベントリ不整合: —

OK: 仕様IDカタログが完全で、全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。
```

Exit code: 0。

## Full CI final staged run

Command: fresh PostgreSQL 16 on port 55491 + `CI=true mise run ci`。

```text
All matched files use Prettier code style!
packages/web build: ✓ Compiled successfully in 1783ms
packages/channel-teams test:coverage: Test Files  4 passed (4)
packages/shared test:coverage: Test Files  29 passed (29)
packages/traceability test:coverage: Test Files  1 passed (1)
packages/devops test:coverage: Test Files  22 passed (22)
packages/prjops test:coverage: Test Files  26 passed (26)
packages/integrations test:coverage: Test Files  10 passed (10)
packages/control-plane test:coverage: Test Files  39 passed (39)
packages/web test:coverage: Test Files  44 passed (44)
packages/server test:coverage: Test Files  96 passed (96)
P001 PostgreSQL integration passed
```

Exit code: 0。Full verbatim output is split by process stream into `GOV-PR-01-ci-final.stdout.log`（9246 lines）and `GOV-PR-01-ci-final.stderr.log`（141 lines）。stderrのPostgreSQL `ERROR`は拒否を確認するnegative testの期待出力で、harness全体はexit 0。

## Scope, secret scan, and review

```text
$ git diff --cached --check

$ staged credential-pattern scan
staged credential-pattern scan: clean

$ git diff --cached --name-only
.env.example
AGENTS.md
docs/adr/0032-ai-pr-identity-separation.md
runbooks/ai-pr-identity.md
scripts/mint-aiops-pr-token.mjs
scripts/mint-aiops-pr-token.test.mjs

$ git diff --cached -- package.json pnpm-lock.yaml .mise.toml mise.lock .github/workflows

$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
```

Crit evidence: `.agents/worklog/codex/review/GOV-PR-01-crit.json`。Receipt: `.agents/worklog/codex/review/GOV-PR-01-crit-receipt.md`。

## Git and CompactionDB evidence

```text
$ git log -1 --format='%H %s'
b6df5efa75b1d8319d1107141ede71414385a4f7 feat(governance): separate AI PR identity
```

CompactionDB command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'GOV-PR-01: AI-generated PR authors use GitHub App installation tokens; humans remain CODEOWNER reviewers and merge executors; main bypass_actors stays empty; stacked child PRs are retargeted before parent branch deletion.'
```

Output / verified active row:

```text
3897aed4-8d27-40e5-a4f9-6e41046a1e2c
3897aed4-8d27-40e5-a4f9-6e41046a1e2c|decision|project|GOV-PR-01: AI-generated PR authors use GitHub App installation tokens; humans remain CODEOWNER reviewers and merge executors; main bypass_actors stays empty; stacked child PRs are retargeted before parent branch deletion.
```

```text
$ git status --porcelain  # task branch after commit and artifact creation
?? .orchestration/autoskill/runs/GOV-PR-01.md
?? .orchestration/learning/GOV-PR-01-learning.md
?? .orchestration/reports/GOV-PR-01-REPORT.md
?? .orchestration/sandboxes/GOV-PR-01-SANDBOX.md
?? .orchestration/tasks/GOV-PR-01-ai-pr-identity.md
?? .orchestration/tasks/JIRA-COMP-01-deployment-composition.md
?? .orchestration/validation/GOV-PR-01-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip

$ git branch --show-current  # after completion
main
```
