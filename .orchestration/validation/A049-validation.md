# A049 merge wave 3 validation

## PR #141

```text
state=OPEN draft=false mergeable=MERGEABLE mergeStateStatus=CLEAN
unresolved_non_outdated=0 has_next_page=false
CodeRabbit=pass; build-test=pass 4m21s; gitleaks=pass 7s
update-branch=not required
mergeCommit=61064c00209da086472d1a6fbb4a5885679e58d6
origin/main=61064c00209da086472d1a6fbb4a5885679e58d6
```

## PR #142

After #141, GitHub settled from `UNKNOWN` to `CONFLICTING/DIRTY`; `gh pr update-branch 142` failed on conflicts. The only conflict was the generated timestamp in `packages/traceability/output/traceability_matrix.md`. The newer PR-head timestamp was retained.

```text
git diff --check --cached
PASS

./node_modules/.bin/prettier --check packages/traceability/output/traceability_matrix.md
All matched files use Prettier code style!

update head=f403fb0ca480619330eb6f1c277bac31665af244 -> 8a6cf7df43b5229d105b7df09e7a938b9af26906
state=OPEN draft=false mergeable=MERGEABLE mergeStateStatus=CLEAN
unresolved_non_outdated=0 has_next_page=false
CodeRabbit=pass; build-test=pass 3m33s; gitleaks=pass 9s
mergeCommit=b90d8006b446df8ffb4ad3d24071da59817acb35
origin/main=b90d8006b446df8ffb4ad3d24071da59817acb35
```

## PR #133 and continuation ruling

#133 passed its original state/thread/check gate but its merge was rejected without a remote change:

```text
GraphQL: refusing to allow an OAuth App to create or update workflow `.github/workflows/coding-task.yml` without `workflow` scope (mergePullRequest)
state=OPEN
mergeCommit=null
```

The orchestrator then excluded #133 as operator-blocked and required `.github/workflows/` path guards on #134, #135, and #94.

## PR #134

```text
files=package.json, packages/devops/package.json, packages/server/package.json, packages/shared/package.json, packages/traceability/package.json, pnpm-lock.yaml
workflow_files=[]
state=OPEN draft=false mergeable=MERGEABLE mergeStateStatus=CLEAN
unresolved_non_outdated=0 has_next_page=false
CodeRabbit=pass; build-test=pass 4m30s; gitleaks=pass 8s
update-branch=not required
mergeCommit=7ceab5dc3b09745b0db196d2c3080d168db6ef00
origin/main=7ceab5dc3b09745b0db196d2c3080d168db6ef00
```

## PR #135

```text
files=package.json, pnpm-lock.yaml
workflow_files=[]
state=OPEN draft=false mergeable=UNKNOWN mergeStateStatus=UNKNOWN
read-only retry: mergeable=MERGEABLE mergeStateStatus=CLEAN
unresolved_non_outdated=0 has_next_page=false
CodeRabbit=pass; build-test=pass 3m28s; gitleaks=pass 7s
update-branch=not required
mergeCommit=0411d78f46f3dc1ced6f2f364e32fcc7db201b8f
origin/main=0411d78f46f3dc1ced6f2f364e32fcc7db201b8f
```

## PR #94

Initial gate:

```text
files=package.json, pnpm-lock.yaml
workflow_files=[]
state=OPEN draft=false mergeable=CONFLICTING mergeStateStatus=DIRTY
unresolved_non_outdated=0 has_next_page=false
CodeRabbit=pass; build-test=pass 4m17s; gitleaks=pass 8s
gh pr update-branch: X Cannot update PR branch due to conflicts
@dependabot rebase comment=https://github.com/mryfmo/ai-ops-platform/pull/94#issuecomment-5223735345
```

While Dependabot was rebuilding, a local three-way inspection found only a `package.json` dependency-block conflict. The mechanical combination preserved main's `tsx ^4.23.5`, `typescript-eslint ^8.66.0`, and `eslint-config-prettier ^10.1.8` while applying #94's `@eslint/js ^9.39.5`. `pnpm install --lockfile-only` passed all 812 supply-chain policy entries. A normal push of local exploration commit `e9e80f98b13d6333ce6b162142d5472dbc35fd19` was safely rejected because Dependabot had concurrently rewritten the remote head; no force push was attempted and the local commit was not used.

Dependabot rebase result and fresh final gate:

```text
headRefOid=72a771cab7c97986bd6a5e1f4d26622eabc17f3c
baseRefOid=0411d78f46f3dc1ced6f2f364e32fcc7db201b8f
files=package.json, pnpm-lock.yaml
workflow_files=[]
state=OPEN draft=false mergeable=MERGEABLE mergeStateStatus=CLEAN
unresolved_non_outdated=0 has_next_page=false
CodeRabbit=pass
build-test=pass 3m50s (run 31231851255)
gitleaks=pass 9s (run 31231851255)
mergeCommit=644a6b03bbdcfae412a97ea559e452d1d3e394e6
origin/main=644a6b03bbdcfae412a97ea559e452d1d3e394e6
```

## Final main validation

```text
git switch main
git pull --ff-only origin main
PASS: fast-forwarded b90d800..644a6b0

git status --short --branch
## main...origin/main

git rev-parse HEAD
644a6b03bbdcfae412a97ea559e452d1d3e394e6

git rev-parse origin/main
644a6b03bbdcfae412a97ea559e452d1d3e394e6
```

All four consecutive ancestry checks (#141→#142, #142→#134, #134→#135, #135→#94) exited 0.

Final main CI exact-head readback:

```text
run=31232104524
event=push
headSha=644a6b03bbdcfae412a97ea559e452d1d3e394e6
status=completed
conclusion=success
gitleaks=success 6s
build-test=success 4m11s
```

The successful `build-test` included governance, frozen lockfile install, real-DB setup, production audit, lint, format, build, typecheck, coverage, traceability, and PostgreSQL integration.

