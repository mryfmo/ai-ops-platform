# A045 merge validation

## Pre-merge

```text
state=OPEN
draft=false
base=main
head=522847dd8379dc376e02f38442c48cbb16bbe985
mergeable=MERGEABLE
mergeStateStatus=CLEAN
threads_total=4
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
mergeCommit=49e2e3c0a3a9d30be46b2a3ae0727009d9eec324
mergedAt=2026-08-09T00:25:33Z
local main=49e2e3c0a3a9d30be46b2a3ae0727009d9eec324
origin/main=49e2e3c0a3a9d30be46b2a3ae0727009d9eec324
accepted-head tree diff exit=0
merge parent=fac32d15038e0326818cc5e65f5fab854ec569d8
worktree=clean
```

## Exact-head main CI

```text
run=31286133025
event=push
headSha=49e2e3c0a3a9d30be46b2a3ae0727009d9eec324
status=completed
conclusion=success
build-test=success 3m49s job=93175205008
gitleaks=success 8s job=93175205019
```

`build-test` passed governance, frozen install, disposable PostgreSQL setup, production audit, lint, format, build, typecheck, coverage tests, traceability, and PostgreSQL integration.
