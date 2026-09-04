# SEC-DEP-01 Validation

## Audit RED

変更前（`origin/main`、fast-uri 3.1.5）:

```text
$ env CI=true pnpm audit --prod --audit-level high --json
exit_code=1
GHSA-5jgf-p345-68v8  fast-uri >=3.1.3 <3.1.6  high
GHSA-f65p-4m7j-42xc  fast-uri >=3.0.0 <3.1.6  high
GHSA-fph4-wmhf-6fwf  fast-uri >=3.1.2 <3.1.6  high
GHSA-jqff-g426-hqxp  fast-uri >=3.0.0 <3.1.6  high
metadata: moderate=4 high=4 total=8
```

## Lockfile diff（全文）

```diff
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 5111e62..f1f0cbf 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -8,7 +8,7 @@ overrides:
   postcss@8: ^8.5.19
   brace-expansion@1: ^1.1.18
   brace-expansion@2: ^2.1.4
-  fast-uri@3: ^3.1.5
+  fast-uri@3: ^3.1.6
   ip-address@10: ^10.3.1
   sharp@0.34: ^0.35.0
   '@auth/core@0': ^0.41.3
@@ -2932,8 +2932,8 @@ packages:
   fast-string-width@3.0.2:
     resolution: {integrity: sha512-gX8LrtNEI5hq8DVUfRQMbr5lpaS4nMIWV+7XEbXk2b8kiQIizgnlr12B4dA3ZEx3308ze0O4Q1R+cHts8kyUJg==}
 
-  fast-uri@3.1.5:
-    resolution: {integrity: sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==}
+  fast-uri@3.1.7:
+    resolution: {integrity: sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==}
 
   fast-wrap-ansi@0.2.2:
     resolution: {integrity: sha512-7F2Fl+TjRSenLqlU3UjSH0iyqopqoZIu7eZVpEirP2g1GtWa2G/ecEmBdgz31+Mxr+ELclgg6sokpSFIQiZ02Q==}
@@ -6762,7 +6762,7 @@ snapshots:
   ajv@8.20.0:
     dependencies:
       fast-deep-equal: 3.1.3
-      fast-uri: 3.1.5
+      fast-uri: 3.1.7
       json-schema-traverse: 1.0.0
       require-from-string: 2.0.2
 
@@ -7320,7 +7320,7 @@ snapshots:
     dependencies:
       fast-string-truncated-width: 3.0.3
 
-  fast-uri@3.1.5: {}
+  fast-uri@3.1.7: {}
 
   fast-wrap-ansi@0.2.2:
     dependencies:
```

## Audit GREEN

```text
$ env CI=true pnpm audit --prod --audit-level high
4 vulnerabilities found
Severity: 4 moderate
exit_code=0
```

high advisory 4件はすべて消えた。moderate 4件は別件であり、`--audit-level high` の合格条件を満たす。

## Full CI

```text
$ env CI=true PGHOST=127.0.0.1 PGPORT=55522 PGUSER=mryfmo AIOPS_TEST_DATABASE_NAME=aiops_sec_dep_01_test AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55522 AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55522/aiops_sec_dep_01_load AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_sec_dep_01_load TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55522/aiops_sec_dep_01_p001 P001_ALLOW_DISPOSABLE_DB=1 mise run ci
...
P001 PostgreSQL integration passed
exit_code=0
```

traceability stage が作った時刻差分は、CI 後に repo root から次のコマンドで復元した。

```text
$ git restore --source=origin/main -- packages/traceability/output/traceability_matrix.md
exit_code=0
```

## Git

```text
$ git log -1 --format='%H %s'
b433a6e6afb9257663d0dc9fb6a154d7408ef36b chore(deps): raise fast-uri floor to 3.1.6
```

```text
$ git status --porcelain
?? .orchestration/autoskill/runs/SEC-DEP-01.md
?? .orchestration/learning/SEC-DEP-01-learning.md
?? .orchestration/reports/SEC-DEP-01-REPORT.md
?? .orchestration/sandboxes/SEC-DEP-01-SANDBOX.md
?? .orchestration/tasks/CHORE-HYG-01-traceability-freshness.md
?? .orchestration/tasks/SEC-DEP-01-fast-uri-advisory.md
?? .orchestration/validation/SEC-DEP-01-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip
```

記載した untracked file は開始前からある operator/task input で、commit していない。

## Review

```text
$ make require-crit-review
make: *** No rule to make target `require-crit-review'.  Stop.
exit_code=2
```

target 不在のため、AGENTS.md の fallback に従ってローカル Crit data を作成・確認した。resolved approval record は `.agents/worklog/codex/review/SEC-DEP-01-crit-comments.json`、receipt は `.agents/worklog/codex/review/SEC-DEP-01-review-receipt.md`。

## CompactionDB

```text
$ python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'SEC-DEP-01: Keep the existing fast-uri@3 workspace override on the patched same-major floor ^3.1.6; pnpm currently resolves 3.1.7, removing GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, and GHSA-jqff-g426-hqxp from the high-severity production audit without changing other dependency resolutions.'
fc275cb7-9c22-4dea-9b0a-90feff105bea
exit_code=0
```
