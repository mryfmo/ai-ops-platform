# P7-T03 Validation

## Test-First Evidence

- RED: `pnpm --filter @aiops/channel-teams test` produced 24 failures out of 33 tests before implementation. Failures covered the absent normalized sender/mention fields, missing decision function, bot/app normalization, strict entity rejection, and all 16 matrix rows.
- GREEN after review fix: `pnpm --filter @aiops/channel-teams test:coverage` — 1 file / 35 tests, all pass.
- Coverage: statements 94.38%, branches 90.56%, functions 100%, lines 98.70%; all configured thresholds pass.
- `pnpm --filter @aiops/channel-teams typecheck` — PASS.
- `pnpm --filter @aiops/channel-teams lint` — PASS.

## Acceptance Matrix

- 16/16 mention × root/reply × human/bot × mapping combinations have explicit expected decisions.
- Fresh unmentioned root and unmapped reply are silent `ignore`.
- Mid-thread explicit bot mention without a mapping is `start`.
- Subscribed mapped reply is `follow_up` without requiring a mention and retains authoritative conversation/thread/workflow IDs.
- Root + mapping is fixed recoverable `error_report`.
- Self echo, other bot, Bot Framework `skill`, and compatible `application` activity are ignored even when malformed mention entities and a mapping are supplied.
- Display-name spoofing does not mention the bot; bot + human multi-mention starts once; duplicate bot-target mentions ignore.
- Empty entity, empty target, and empty mention text return fixed `E-CHANNEL-INVALID-INPUT` without reflecting input.

## Full Gate

- A new local PostgreSQL 16 cluster and three fresh databases (`p7t03_r3_test`, `p7t03_r3_load`, `p7t03_r3_p001`) ran the final `mise run ci`: PASS, exit 0.
- The first post-review CI attempt stopped at Prettier before database use; formatting the changed adapter and rerunning against the still-fresh database set passed the entire gate.
- The gate included governance, Rego, contracts, actionlint, lint, traceability, Prettier, build, typecheck, all-package coverage, migration apply/reapply, DB integration, and P001 checks.
- Final marker: `P001 PostgreSQL integration passed`.
- `git diff --check`: run before commit.
- No dependency, lockfile, schema, server, workbench, or PR #255/#256/#257 file changed.

## Review and Plan Quality

- Repository plan-quality validator/Make target/hook/subagent/CI assets are absent. The ignored plan was manually checked for required headings, positive/adversarial tests, scope, assumptions, and STOP conditions.
- `make require-crit-review` and exact-commit read-only review are performed after staging/commit; browser Crit is not used.
- Initial exact-commit review found one Medium issue: standard Bot Framework `role="skill"` was rejected rather than loop-ignored. A dedicated fixture failed RED, then passed after classifying `skill` as machine/app sender.
- Final-candidate re-review found one Medium issue: strict mention parsing rejected malformed machine activities before the flow could suppress loops. Seven fixtures failed RED; normalization now preserves a nullable invalid-mention marker and the flow ignores machine/self before human mention validation.

## Deferred / Environment

- UX-001 Teams sandbox E2E is deferred until real tenant access is available.
- No tenant, real Teams activity, credential, production endpoint, or external message side effect was used.
