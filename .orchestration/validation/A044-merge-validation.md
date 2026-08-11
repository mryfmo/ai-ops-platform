# A044 merge validation

## Pre-merge

```text
state=OPEN
draft=false
base=main
head=884d54d6a98a1d58eda64bf9ec3700a614724779
mergeable=MERGEABLE
mergeStateStatus=CLEAN
threads_total=1
threads_unresolved=0
threads_has_next_page=false
build-test=SUCCESS
gitleaks=SUCCESS
CodeRabbit=SUCCESS
workflow_files=[]
```

The merge command fixed the accepted head with `--match-head-commit` and used `--squash`.

## Post-merge

```text
PR state=MERGED
mergeCommit=fac32d15038e0326818cc5e65f5fab854ec569d8
mergedAt=2026-08-08T05:25:45Z
local main=fac32d15038e0326818cc5e65f5fab854ec569d8
origin/main=fac32d15038e0326818cc5e65f5fab854ec569d8
accepted-head tree diff exit=0
merge parent=3461d24755719397cde390a9e471baa614e49d97
worktree=clean
```

## Exact-head main CI

```text
run=31241662316
event=push
headSha=fac32d15038e0326818cc5e65f5fab854ec569d8
status=completed
conclusion=success
build-test=success 4m29s
gitleaks=success 8s
```

`build-test` passed governance, frozen install, disposable PostgreSQL setup, production audit, lint, format, build, typecheck, coverage tests, traceability, and PostgreSQL integration.
