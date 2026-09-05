# CHORE-HYG-01 Validation

## Focused regression

```text
$ env CI=true pnpm --filter @aiops/traceability run test -- verifyTraceability.test.ts
Test Files  1 passed (1)
Tests  130 passed (130)
Duration  2.59s
exit_code=0
```

## Idempotent traceability runs

同じ command を2回連続で実行した。いずれも generator の出力後に matrix diff はなく、exit 0。

```text
$ env CI=true mise run traceability
[traceability] $ pnpm exec tsx packages/traceability/src/verifyTraceability.ts && git diff --exit-code -- packages/traceability/output/traceability_matrix.md
この生成物はコミット時点のリポジトリ状態を反映する。
OK: 仕様IDカタログが完全で、全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。
exit_code=0

$ env CI=true mise run traceability
[traceability] $ pnpm exec tsx packages/traceability/src/verifyTraceability.ts && git diff --exit-code -- packages/traceability/output/traceability_matrix.md
この生成物はコミット時点のリポジトリ状態を反映する。
OK: 仕様IDカタログが完全で、全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。
exit_code=0
```

## Stale matrix RED and restore

一時的に index 上の由来行を stale な文へ置き換え、generator を含む通常の task を実行した。

```text
$ env CI=true mise run traceability
[traceability] $ pnpm exec tsx packages/traceability/src/verifyTraceability.ts && git diff --exit-code -- packages/traceability/output/traceability_matrix.md
diff --git a/packages/traceability/output/traceability_matrix.md b/packages/traceability/output/traceability_matrix.md
index 30c1e63..c5645ee 100644
--- a/packages/traceability/output/traceability_matrix.md
+++ b/packages/traceability/output/traceability_matrix.md
@@ -1,6 +1,6 @@
 # トレーサビリティ検証結果
 
-この生成物は意図的に陳腐化した検証用の状態です。
+この生成物はコミット時点のリポジトリ状態を反映する。
 
 凡例: 「source参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。
[traceability] ERROR task failed
exit_code=1
```

generator が正しい worktree 出力へ戻した後、次の command でその出力を index に戻した。

```text
$ git add packages/traceability/output/traceability_matrix.md
exit_code=0
$ git diff --cached --quiet
exit_code=0
$ git diff --quiet
exit_code=0
```

## Full CI

競合プロセスがないことを確認してから、fresh PostgreSQL 16 cluster と3つの使い捨てDBで再実行した。

```text
$ env CI=true PGHOST=127.0.0.1 PGPORT=55524 PGUSER=mryfmo AIOPS_TEST_DATABASE_NAME=aiops_chore_hyg_01_final2_test AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55524 AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55524/aiops_chore_hyg_01_final2_load AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_chore_hyg_01_final2_load TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55524/aiops_chore_hyg_01_final2_p001 P001_ALLOW_DISPOSABLE_DB=1 mise run ci
[audit] $ pnpm audit --prod --audit-level high
4 vulnerabilities found
Severity: 4 moderate
...
packages/traceability test:coverage: Test Files  1 passed (1)
packages/traceability test:coverage: Tests  130 passed (130)
...
migrations applied=24 skipped=0
migrations applied=0 skipped=24
P001 PostgreSQL integration passed
exit_code=0
```

最初の試行は、同じ共有ワークツリーで別タスクの全CIが並走し、Vitest の coverage 一時ディレクトリが削除されて exit 1 になった。実装由来ではないことを確認し、別プロセス完了後に fresh cluster で再実行して上記のとおり成功した。

## Review

```text
$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
exit_code=2

$ crit status --json
"review_file": "/Users/mryfmo/.crit/reviews/9c3a0ea25996/review.json"
"review_file_exists": false
"sessions": []
exit_code=0
```

target と既存 data がなかったため、AGENTS.md の fallback に従ってローカル Crit data を作成した。resolved approval record は `.agents/worklog/codex/review/CHORE-HYG-01-crit-comments.json`、receipt は `.agents/worklog/codex/review/CHORE-HYG-01-review-receipt.md`。

## CompactionDB

```text
$ python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'CHORE-HYG-01: traceability matrix output must remain deterministic by omitting wall-clock and commit-hash provenance. The mise traceability task regenerates the matrix and then runs git diff --exit-code on the tracked output. Freshness therefore depends on rerunning CI on the current integration commit; require up-to-date branches or a merge queue after base movement. aiops-pr-bot permissions are contents:write, pull_requests:write, and metadata:read; Issues permission is unnecessary for PR labels as measured on PR #291.'
3cd8ca44-01af-4c63-8c06-ee635108b57a
exit_code=0
```

## Git

```text
$ git log -1 --format='%H %s'
e38182f504d7f3785e3b5f052b734f9408278d4a Merge remote-tracking branch 'origin/main' into agent/CHORE-HYG-01
exit_code=0
```

```text
$ git status --porcelain
?? .orchestration/autoskill/runs/CHORE-HYG-01.md
?? .orchestration/learning/CHORE-HYG-01-learning.md
?? .orchestration/reports/CHORE-HYG-01-REPORT.md
?? .orchestration/sandboxes/CHORE-HYG-01-SANDBOX.md
?? .orchestration/tasks/BOT-FIX-289-useless-assignment.md
?? .orchestration/tasks/CHORE-HYG-01-traceability-freshness.md
?? .orchestration/validation/CHORE-HYG-01-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip
exit_code=0
```

CHORE-HYG-01 の5成果物以外は開始前からある operator/task input。tracked worktree と index は clean で、`origin/main...HEAD` の差分は task allowlist 内の5ファイルだけだった。`git diff --check origin/main...HEAD` も exit 0。
