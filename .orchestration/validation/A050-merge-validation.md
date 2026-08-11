<!-- 根拠: ADR-0012 / PrjOps:REQ-019 / PrjOps:SPEC-INT-051 -->

# A050 merge validation

## Pre-merge gate

- PR state OPEN, ready, MERGEABLE/CLEAN, `ai-generated` label present.
- Exact accepted head: `4e84ae4b197b9d4e0cd3ecebf6fc9a440bdd14dc`.
- Base/current remote main: `af17955b1d452be80a5fe0ab0d083e65cf58afda`.
- PR checks: build-test SUCCESS, gitleaks SUCCESS, CodeRabbit SUCCESS.
- GraphQL review-thread gate: 2 resolved, unresolved count 0.
- Workflow-file guard: the only workflow path was `.github/workflows/report-generation.yml`; exact diff was the accepted A050 producer-scope wiring (required project input, REPORT_PROJECT_IDS propagation, scoped dry-run fixture). No unrelated workflow mutation was present.

## Post-merge gate

- PR state MERGED; squash merge commit `a6f4b4b3fdcd17a554adce886c30b6d1f30dd221`.
- Consecutive-main check: sole parent is previous main `af17955b1d452be80a5fe0ab0d083e65cf58afda`.
- Exact-tree check: PR head and merge commit both have tree `1e1e734ffcc28941074637cb88ece388332f3261`.
- Remote main equals merge commit.
- Remote branch `agent/a050-metric-scope-gate` returns HTTP 404 after deletion.
- Local synchronization: `HEAD == origin/main == a6f4b4b3fdcd17a554adce886c30b6d1f30dd221`; worktree clean.
- Merge-triggered main CI run `31305322246`: success.
  - build-test job `93224639514`: success in 3m47s, including governance, dependency audit, lint, format, build, typecheck, coverage, traceability, and real PostgreSQL integration.
  - gitleaks job `93224639534`: success in 6s.
- Final remote main and local `HEAD`/`origin/main` all equal `a6f4b4b3fdcd17a554adce886c30b6d1f30dd221`; worktree clean.
