<!-- 根拠: FinalArch:NFR-SEC-001 / FinalArch:NFR-SEC-003 / FinalArch:NFR-SEC-004 / FinalArch:GOV-003 / ADR-0022 / ADR-0023 -->

# P0-T09 Validation

## Identity and scope

- Fresh base after P0-T04: `ac83e7e751fdf56f6212385e6cf57fdee42fcb88`.
- Exact head: `d75abf2447846b8b19dda8b93c8ae51e674f813e`.
- Exact tree: `3913dcea569d5bbede1f24e69ccbdca7c900896b`.
- Tracked changes are restricted to `.env.example`, `docs/security/**`, and
  `runbooks/**`.
- Pre-existing untracked `.pnpm-store/` and the implementation-pack ZIP were
  not modified or staged.

## Content checks

- The matrix contains the required eight fields and distinguishes production
  credentials, target short-lived identities, workflow-local aliases, and
  disposable CI database values.
- The final-state residue table enumerates browser/client, application,
  runner, developer, LiteLLM, agentgateway, and OPA credential boundaries.
- The migration table contains 12 ordered phases with an explicit rollback
  path; compromised credentials are never a rollback target.
- Break-glass matches `inference.anthropic_direct_fallback` requirements,
  preserves classification and explicit-provider gates, and defines no generic
  MCP/A2A or OPA bypass.
- Official Azure, Entra, PostgreSQL, AWS, GitHub, and LiteLLM primary sources
  linked by the plan were reviewed on 2026-08-10.

## Secret and repository checks

- Gitleaks v8.30.1 archive digest was verified before use.
- `gitleaks git --redact --no-banner --exit-code 1 .`: pass; 307 commits and
  approximately 8.63 MB scanned, no leaks.
- `mise run traceability`: pass; all traceability guards green.
- `mise run format`: pass.
- `git diff --check`: pass.
- `make require-crit-review`: unavailable (`No rule to make target`); the
  complete documentation-only diff was reviewed directly and no browser Crit
  was opened under repository policy.

## Definition of Done

The full local validation on parent head `3007d0e` used a fresh task-owned
PostgreSQL 16 cluster on loopback port `55444`, with dedicated `aiops_test`,
`aiops_load_test`, and `aiops_p001` databases:

```text
env CI=true PGHOST=127.0.0.1 PGPORT=55444 AIOPS_TEST_DATABASE_NAME=aiops_test AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55444 AIOPS_LOAD_TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55444/aiops_load_test AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test TEST_DATABASE_URL=postgresql://mryfmo@127.0.0.1:55444/aiops_p001 P001_ALLOW_DISPOSABLE_DB=1 mise run ci
```

Result: exit 0. Governance, audit, actionlint, lint, traceability, format,
build, typecheck, coverage, and PostgreSQL integration passed. Coverage ran
183 test files / 2,304 tests; `P001 PostgreSQL integration passed`.

The final `d75abf2` delta only corrects WBS ownership in `.env.example` comments
and the migration plan. On that exact local head, governance (22 architecture
and canonical tests plus six Plane mapping tests), traceability, format, and
`git diff --check` passed. Exact-head GitHub CI below repeats the complete suite
including PostgreSQL.

## Publication checks

- PR: https://github.com/mryfmo/ai-ops-platform/pull/159
- Exact-head GitHub Actions run:
  https://github.com/mryfmo/ai-ops-platform/actions/runs/31357841453
- Exact-head result: `build-test` success, `gitleaks` success, and CodeRabbit
  success/rate-limited review state.
- Both Codex review threads were answered and resolved on exact head; the PR is
  open, non-draft, `CLEAN`, `MERGEABLE`, and labeled `ai-generated`.
- No merge was performed.
