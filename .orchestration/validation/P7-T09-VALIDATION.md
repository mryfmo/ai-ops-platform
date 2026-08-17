# P7-T09 Validation

## Test-First Evidence

- RED Web: the new 11-case suite failed because `src/server/workbenchHandoff.js` did not exist.
- RED Teams: all 7 cases failed because `buildWorkbenchHandoffCard` did not exist.
- GREEN focused: Web 12/12 and Teams 7/7.
- Web and Teams typecheck/lint: PASS.
- Web coverage: 44 files / 365 tests, 82.92% statements, 73.40% branches, 83.62% functions, 85.68% lines.
- Teams coverage: 4 files / 65 tests, 94.00% statements, 89.59% branches, 100% functions, 98.63% lines.

## Acceptance Matrix

- Positive: identity-bound signed token restores exact workspace/conversation/thread/workflow context only after atomic consume and current Workbench authorization.
- Replay: second use returns the fixed denial before a second authorization fetch.
- Expired, tampered, unsigned, and wrong-identity tokens: fixed denial before consume/fetch.
- Missing, false, or throwing replay authority: fixed denial with no authorization fetch.
- Grant-external workflow and Control API denial: identical fixed denial.
- Audit details contain fixed reason codes only and never include the token or reflected attacker input.
- Duplicate `token` query parameters are rejected rather than selecting the first value.
- Token payload excludes raw Entra identity, secret, message text, and attachment data.
- Expiry and verified URL brands have compile-time negative assertions with `@ts-expect-error`.

## Full Gate

- The first full-gate attempt stopped only at Prettier for four new files; formatting was applied before further validation.
- Final post-review gate used newly created PostgreSQL 16 databases `p7t09_final2_1941_test`, `p7t09_final2_1941_load`, and `p7t09_final2_1941_p001`.
- `mise run ci`: PASS, exit 0. It covered governance, 29/29 Rego, contracts, dependency audit, actionlint, lint, traceability, format, build, typecheck, all-package coverage, migration apply/reapply, and DB integration.
- Final marker: `P001 PostgreSQL integration passed`.
- `git diff --check`: PASS.

## Plan Quality and Review Surface

- The repository plan-quality template/validator/hook targets referenced by the skill are absent. The ignored worklog plan was manually checked for required headings, acceptance negatives, security ordering, allowed paths, exact baseline references, and stop conditions.
- `make require-crit-review` was unavailable (`No rule to make target`). `crit status --json` reported no review file/session. Browser Crit is prohibited by repository policy, so the exact staged diff was reviewed locally in `.orchestration/reviews/P7-T09-REVIEW.md`.
- Exact staged review found one query-ambiguity issue: duplicate `token` parameters were accepted because the first value was selected. A RED negative was added, the handler now requires exactly one token key, and focused/full gates were rerun green.

## Environment

- No real Teams tenant, Entra credential, production endpoint, message body, attachment, or external workflow was used.
- All identities, links, decisions, and fetch responses were synthetic; database validation used dedicated local disposable databases.
