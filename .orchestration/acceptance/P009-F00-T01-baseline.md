# P009-F00-T01 Baseline Evidence

- Recorded at: `2026-07-11T19:27:16+09:00`
- Status: `BLOCKED`
- HEAD: `39b95944e9f17dffce500c21f40989f6fa86092d`
- Branch: `agent/005-microsoft-graph`
- Execution plan SHA-256: `9a26dca10bc17343cbef293e7799321f0941204ce45c1c51100121f84b7cf97c`
- Worker model verified: `unverified`
- Reviewer model verified: `unverified`

## Repository state

- Branch matches `origin/agent/005-microsoft-graph`.
- User-owned dirty files were preserved: `docs/AI_Ops_Platform_Summary.pptx`, `packages/traceability/output/traceability_matrix.md`, `.agents/`, `.codex/`, and `docs/audit/`.
- `git diff --check`: exit `0`.
- Plan 001 commit `6a6c1aa` and Plan 005 commit `39b9594` are present in HEAD.

## Validation

- `mise run ci`: exit `0`.
  - shared: 246 tests passed.
  - prjops: 201 tests passed.
  - devops: 186 tests passed.
  - server: 362 tests passed.
- Negative observation retained despite green CI:
  - `claudeAgentClient.ts` line coverage: 5.88%.
  - `AGT02_collector.ts`, `AGT03_analyzer.ts`, `AGT04_reportGenerator.ts` line coverage: 0%.
- `pnpm audit --prod`: exit `1`; 4 vulnerabilities (1 low, 3 moderate): next-auth, postcss, uuid, and `@ai-sdk/provider-utils` paths.
- Repository plan-quality entry points:
  - validator: unavailable (`scripts/validate_plan_quality.py` absent).
  - Make target: unavailable (`plan-quality` target absent).
  - hook/subagent definition/CI: unavailable in this repository.
  - A fresh-context read-only review was requested as the fallback.

## GitHub dependency gate

- PR #40: `OPEN`, merge state `CLEAN`, required checks green, not merged.
- URL: https://github.com/mryfmo/ai-ops-platform/pull/40
- Plan 009 forbids starting dependent Plan branches until the dependency PR is human-merged into `main`; independent review acceptance is not a merge substitute.

## Blockers

1. Human merge of PR #40 is required before dependent product work starts.
2. Plan 002 requires authoritative `prjops-data` contract, Entra subject backfill inputs, persona priority, and PII approval.
3. Plan 005 tenant acceptance requires sandbox Microsoft 365 inputs, RSC/RBAC, public callback, and delegated/UI edit-delete actor.
4. Final completion additionally requires human branch protection, backup/SLO decisions, external E2E, credential rotation, go-live signatures, and human merge/deploy decisions.

## Acceptance decision

`BLOCKED`: local baseline is green and Plan 001/005 artifacts are present, but the explicit human/external/merge gates prevent safe execution of the dependent implementation phases. No product source was changed.

