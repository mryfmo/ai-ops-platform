# T26 Report: G5 LLM Correctness

## Summary

Status: ready_for_review

Commit: `eb07363`
PR: https://github.com/mryfmo/ai-ops-platform/pull/21

Implemented fixes for the T26 G5 findings:

- C-model-1: `claude-opus-4-8` escalation no longer sends `temperature`.
- C-4: `/api/chat` no longer sends `temperature` while Anthropic thinking is enabled.
- C-1: standard report narrative slots now reject numeric strings not present in the metrics payload.
- C-model-2: `claude-sonnet-4-6` remains intentionally pinned and is documented in ADR-0002.
- C-3b: `PgCostGuard` now supports reserve-then-reconcile with advisory-lock guarded reservation and per-agent per-request limits.
- C-6: Anthropic `stop_reason=refusal` and chat refusal-equivalent finish reasons are handled distinctly as `E-LLM-REFUSAL`.

Revise fixes added:

- T26-R1: `PgCostGuard.reserve()` now uses the repository-proven transaction pattern: `connect()` -> `BEGIN` -> advisory lock in a separate statement -> SUM/INSERT -> `COMMIT` -> `release()`.
- T26-R1b: failed structured-call attempts reconcile their reserved estimate to zero before retry, so phantom estimate rows do not permanently consume budget.
- T26-R2: numeric grounding now handles grouped numbers such as `1,500`, excludes numbers from the period label such as `2026-Q3`, and runs numeric checks even when slot length validation fails.
- T26-R3: chat streaming refusal is documented as post-HTTP-200 stream behavior; `finishReason=error` with provider refusal metadata is checked before generic error short-circuiting.

Second-revise fixes added:

- T26-R6: period labels are no longer split into allowed numeric tokens. The validator strips the exact period label literal from slot text before numeric extraction, so `2026-Q3` itself is ignored but standalone `3`, `28`, or `2026` elsewhere are still rejected unless metrics contain them.
- T26-R7: removed the dead providerMetadata/body refusal marker scan and the synthetic `finishReason=error + stop_reason=refusal` test. The chat path now documents and tests the actual AI SDK mapping, where Anthropic refusal is surfaced as `finishReason: "content-filter"` after streaming starts.
- T26-R4: documented the global advisory lock ceiling in `PgCostGuard.reserve()`: it is required for the shared daily cap but holds a pool connection during the critical section; future scaling work should shorten the critical section or add lock timeouts.
- T26-R5: made `CostGuard.reserve()` and `CostGuard.reconcileReservation()` required interface methods and removed the legacy no-reconcile fallback, preventing estimate-only reservation implementations from silently accumulating budget.
- Low cleanup: removed the dead grouped-number `Intl.NumberFormat` allowed entry; comma handling is done by normalizing extracted slot numbers before lookup.

## Documentation Confirmation

No local `claude-api` skill was available in this Codex session. I therefore used official Anthropic documentation as the source of truth, as allowed by the task.

- Anthropic extended thinking docs: `https://platform.claude.com/docs/en/build-with-claude/extended-thinking`
  - Confirms extended thinking is not compatible with modified `temperature` or `top_k`.
  - Shows `claude-sonnet-4-6` manual thinking with `budget_tokens`, while also marking budget-token based thinking deprecated and recommending adaptive thinking where applicable.
  - Shows `claude-opus-4-8` manual `budget_tokens` thinking is unsupported with 400; adaptive thinking uses effort instead.
- Anthropic models overview: `https://docs.anthropic.com/en/docs/about-claude/models/overview`
  - Confirms current model IDs include `claude-opus-4-8` and newer `claude-sonnet-5`.
- Anthropic migration guide: `https://platform.claude.com/docs/en/about-claude/models/migration-guide`
  - Confirms `claude-opus-4-8` returns 400 for non-default `temperature`, `top_p`, or `top_k`.
  - Confirms newer model families return successful HTTP responses with `stop_reason: "refusal"` and callers must handle it explicitly.

Design decision: keep `claude-sonnet-4-6` pinned for T26 because migrating to Sonnet 5 changes thinking and sampling parameter behavior. ADR-0002 documents this as intentional follow-up scope rather than silently changing models.

## Changes

- `packages/shared/src/clients/anthropicClient.ts`
  - Adds `AnthropicRefusalError`.
  - Adds request construction that omits `temperature` for `claude-opus-4-8`.
  - Reserves estimated cost before the API call and reconciles with actual usage after the response.
  - Requires reserve/reconcile as a pair on `CostGuard`; no legacy estimate-only fallback remains.
  - Keeps refusal out of the generic `E-ING03` retry/failure path.
- `packages/shared/src/clients/pgCostGuard.ts`
  - Adds `reserve()` with `pg_advisory_xact_lock` in a separate statement before the budget SUM/INSERT statement.
  - Adds `reconcileReservation()` to update the reserved row with actual cost.
  - Adds `perAgentRequestLimitUsd`.
  - Notes the global advisory lock tradeoff and upgrade path. The web route's request-local `new pg.Pool` pattern is pre-existing and remains a follow-up infra task outside T26.
- `packages/web/src/server/chat/chatHandler.ts`
  - Removes `temperature` from `streamText` when Anthropic thinking is enabled.
  - Uses cost reservation before streaming; leaves the reserved row intact when stream finish reason is `error`.
  - Treats AI SDK refusal finish reasons (`content-filter` / `refusal`) distinctly without claiming unsupported provider metadata shapes.
- `packages/shared/src/reporting/reportValidation.ts` / `reportGenerator.ts`
  - Adds deterministic numeric truthfulness validation for narrative slots.
  - This is lexical grounding only: spelled-out numbers and semantic misuse of a number that exists in metrics are explicitly out of scope without an LLM-as-judge/backstop.
  - Period labels are excluded only as exact literals in slot text; their digits are not added to the metrics allowlist.
  - Retries once, then rejects remaining ungrounded numeric output with `E-RPT04`.
- Docs updated:
  - `docs/adr/0002-claude-sdk-usage.md`
  - `docs/adr/0013-page-agent-reasoning-generative-ui.md`
  - `docs/reference/page-agent-tools.md`
  - `docs/reference/configuration.md`
  - `docs/spec/data-model.md`

## Tests Added

- `packages/shared/tests/anthropicClient.test.ts`
  - Verifies Opus 4.8 escalation omits `temperature`.
  - Verifies Anthropic refusal surfaces as `AnthropicRefusalError`.
  - Verifies failed attempt reservations are reconciled to zero before retry.
- `packages/shared/tests/pgCostGuard.test.ts`
  - Verifies transaction order (`BEGIN` -> lock -> SUM/INSERT -> `COMMIT`), daily limit rejection, per-request limit rejection, and reconciliation update.
- `packages/shared/tests/reporting.test.ts`
  - Verifies ungrounded numeric slot detection and rejection after retry.
  - Verifies grouped numbers, exact period-label exclusion, standalone label digit rejection, and length-error masking.
- `packages/web/tests/chat/chatRoute.test.ts`
  - Verifies thinking provider options are sent without `temperature`.
  - Verifies reserve/reconcile path and stream error reservation behavior.
  - Verifies the actual AI SDK refusal mapping through `finishReason: "content-filter"`.

## Validation

`mise run ci` completed successfully without `-j 1` after the revise changes.

Second-revise validation also completed successfully with parallel `mise run ci` and no `-j 1`.

Additional focused checks run before full CI:

- `pnpm --filter @aiops/shared test` -> pass, 137 tests.
- `pnpm --filter @aiops/web test -- chatRoute.test.ts` -> pass, 12 tests.
- `pnpm --filter @aiops/shared test -- reporting.test.ts anthropicClient.test.ts pgCostGuard.test.ts` -> pass, 29 tests.
- `pnpm --filter @aiops/web test -- chatRoute.test.ts` -> pass, 11 tests.
- `pnpm -r --if-present run typecheck` -> pass.
- `pnpm -r --if-present run lint` -> pass.
- `pnpm run format` -> pass.
- `mise run ci` -> pass; coverage suite includes shared 138, devops 158, prjops 196, server 223 tests.

No real LLM calls were made; all LLM behavior was validated with mocks.

Known limits / follow-up:

- Fake-pool tests can assert the transaction statement order but cannot reproduce a real PostgreSQL READ COMMITTED race. A real concurrent PG test still requires a real DB environment and is outside T26.
- Web route request-local `new pg.Pool` construction is a pre-existing web infra issue and should be handled by a separate shared-pool task.
