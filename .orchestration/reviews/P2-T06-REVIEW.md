# P2-T06-REVIEW — PR #189 approved at `9d83834`

```yaml
task_id: P2-T06-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-12T18:55:11+09:00
re_reviewed_at: 2026-08-12T19:10:38+09:00
round_3_reviewed_at: 2026-08-12T19:19:23+09:00
round_4_reviewed_at: 2026-08-12T19:28:17+09:00
round_5_reviewed_at: 2026-08-12T19:34:52+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/189
base_sha: 137a1e04476edb04920946bedc3c83982bdeb12a
initial_head_sha: 82cc0d8eb6e5af6c8bb513f7b2ea99dc554a4096
head_sha: 9d838348ae3db237b1b2fd56faf2d7eb5fe605f5
verdict: approve
summary: >-
  Head 9d83834 resolves findings 001 through 009 and the Owner model decision.
  The shared build handler now owns the fix-suggestion applicability guard, so
  dependency and infrastructure classifications never reach the fail-closed
  generator or emit its warning. The timestamp-only generated traceability
  output has been restored to the merge base and is absent from the PR. All
  independent validations are green and no blocking findings remain.
```

## Findings

### P2-T06-001 — high — direct provider egress does not enforce the canonical activation prerequisites

- Location: `packages/server/src/index.ts:332-346`
- Status: resolved at `fd46a97`
- The direct branch is selected whenever the LiteLLM flag resolves off and
  `ANTHROPIC_API_KEY` is present. It never reads
  `MIGRATION_FLAGS.get("inference.anthropic_direct_fallback.enabled")`; instead
  it unconditionally supplies `allowDirectModeMigration: true` to the shared
  factory.
- This bypasses the independently owned `security+ai-platform` gate and its
  `classification<=internal` / `explicit-provider-allow` prerequisites defined
  in `packages/shared/src/migration/featureFlags.ts:47-51`. It also contradicts
  the break-glass runbook, which requires the exact flag and makes its kill
  switch authoritative.
- Independent config probes reproduced both unsafe states without a network
  request or provider credential:
  - default direct-fallback state `false` + placeholder provider key -> the
    index condition selects direct;
  - direct-fallback flag `true` + `_KILL=1` -> resolved state `false`, but the
    index condition still selects direct;
  - LiteLLM `primary` + LiteLLM `_KILL=1` + provider key, while direct-fallback
    remains `false` -> the process silently selects direct with the raw provider
    model defaults.
- Required correction: derive a direct-enabled decision from the resolved
  canonical direct-fallback state, require its explicit enabled value before
  constructing direct transport, honor its kill switch, and enforce/audit the
  declared classification and explicit-provider-allow prerequisites. Add
  composition/config tests for flag absent, enabled, killed, and LiteLLM-killed
  combinations.
- Re-review: the flag, provider-key, and kill-switch selection logic is now
  correct, and the three unsafe config combinations resolve disabled. However,
  `packages/server/src/index.ts:372-379` only writes the prerequisite names into
  startup audit detail. It does not evaluate either prerequisite. The one
  direct-backed `llmClient` is still injected into build logs, incident data,
  change diffs, PrjOps impact descriptions, and Teams free text, while
  `StructuredCallOptions` has no data-classification or provider-allow field.
  Thus setting the global flag makes unknown or above-internal inputs eligible
  for direct egress, contrary to the flag contract and break-glass hard stops.
- The source comment defers direct removal to P2-T07, but the canonical WBS says
  P2-T07 migrates Web and P2-T10 is the task that denies direct provider egress.
  Recording an unmet prerequisite or naming the wrong future task does not
  enforce it. Required correction remains: fail closed unless each direct call
  carries and passes both policy inputs, or keep the server direct transport
  disabled until such a policy boundary exists.
- Round 3 resolution: the server no longer constructs any direct transport.
  When the resolved direct flag and provider key express break-glass intent,
  startup records `llm_direct_fallback_unavailable` and remains fail-closed.
  The audit detail names the canonical P2-T10 follow-up and contains no secret.

### P2-T06-002 — medium — gateway-only runtime is reported as LLM-disabled

- Location: `packages/server/src/index.ts:539-563`
- Status: resolved at `ae73853`
- `llmFreeTextConfigured` remains
  `Boolean(config.ANTHROPIC_API_KEY)`. In the intended gateway configuration no
  provider key is present, even though `llmTransport` and `llmClient` exist.
  Consequently `deriveCapabilityState()` reports `llm_free_text`,
  `build_triage`, and `incident_triage` disabled and publishes false capability
  gauges for working gateway-backed consumers.
- The event-handler disabled reasons at `packages/server/src/index.ts:400-405`
  and `:454-460` also still name `ANTHROPIC_API_KEY`, so operational diagnostics
  describe the wrong missing dependency after this migration.
- Required correction: feed capability and disabled-reason decisions from the
  resolved transport/client state, not the legacy provider-key variable, and
  leave a gateway-only regression test.
- Resolution: `llmFreeTextConfigured` now follows `llmClient !== undefined`, and
  both event-handler reasons identify the transport rather than a provider key.
  The gateway-only config case is covered.

### P2-T06-003 — medium — `.env.example` cannot boot either documented mode

- Location: `.env.example:78-83`
- Status: resolved at `ae73853`
- The two new optional settings are uncommented empty assignments. Zod receives
  empty strings rather than absent values, so copying the example with the
  default-off flag fails startup with `LITELLM_BASE_URL: Invalid URL` and
  `LITELLM_VIRTUAL_KEY: Too small`.
- If an operator fills those values and enables the gateway, the same example's
  active raw `claude-sonnet-4-6` / `claude-opus-4-8` model assignments fail the
  new logical-alias validation. The exact
  `AIOPS_FLAG_INFERENCE_LITELLM_ENABLED` setting needed to activate gateway mode
  is not shown either.
- Required correction: make optional blank gateway settings comments (as the
  surrounding optional variables are), provide a coherent gateway-mode example
  using the canonical flag and aliases or omitted model overrides, and retain a
  coherent direct break-glass example separately.
- Resolution: the accepted ENVEX2 diff comments all optional LLM settings,
  provides coherent gateway/direct examples, and the config layer additionally
  normalizes blank gateway values to unset. The inventory guard is green.

### P2-T06-004 — medium — the fitness oracle still mistakes executable strings for comments

- Location: `packages/server/tests/llmGatewayFitness.test.ts:31-49`
- Status: resolved at `fd46a97`
- The SDK check recognizes only the literal constructor name `Anthropic` or a
  static `from "@anthropic-ai/sdk"` import. A format-valid dynamic import with
  an aliased constructor, for example
  `const { default: ProviderClient } = await import("@anthropic-ai/sdk")`, is
  not detected and can construct the direct SDK path.
- The provider-host exemption classifies the entire line as a comment whenever
  it starts with `/*`, even if the comment closes before executable code. An
  inline line such as
  `/* migration note */ const provider = "api.anthropic.com";` is therefore
  exempted. Independent evaluation of the exact test predicates returned
  `false` for the dynamic-import direct path and `true` for treating the inline
  executable host reference as comment-only.
- Despite the file header's claim, no assertion checks provider-key runtime
  requirements. The current tests therefore do not fully establish their own
  stated regression boundary.
- Required correction: use a syntax-aware or conservatively broader import/
  package-reference check and a sound comment treatment; add negative fixtures
  for aliased/dynamic SDK construction and inline block comments. Keep the
  shared factory as the explicit allowlisted location.
- Re-review: exact package-name dynamic imports and the original inline-block
  sample are now caught. The replacement comment stripper is still lexical
  regex, however, and removes `//` or `/*...*/` inside string literals. An
  independent evaluation of its exact predicate showed that this executable,
  format-valid direct URL is not detected:
  `const direct = "https:" + "//" + "api.anthropic.com";`.
  The stripped source ends at the `"//"` string before the forbidden host.
  A split package expression (`"@anthropic-ai/" + "sdk"`) likewise evades the
  package occurrence check. Prefer the simpler conservative raw-host ban (and
  remove comment occurrences) or a syntax-aware scanner; add the concatenated
  URL case to the oracle self-test.
- Round 3 resolution: the provider-host predicate is now a conservative raw
  ban, and its self-test covers the inline block comment and concatenated URL.
  The SDK predicate catches package-prefix references, including the split
  package sample. The separate Agent SDK allowlist is addressed by finding
  P2-T06-007 below because that package is itself runtime-reachable here.

### P2-T06-005 — low — whitespace-only virtual keys evade startup fail-fast validation

- Location: `packages/server/src/config.ts:113-114`
- Status: resolved at `ae73853`
- `LITELLM_VIRTUAL_KEY` uses `z.string().min(1)` without trimming. An independent
  probe accepted three spaces and returned `LLM_GATEWAY_ENABLED=true`; the
  shared token provider then rejects it only when the first request is made.
- Required correction: trim before the non-empty check and add the boundary
  case to the gateway config tests so invalid secret injection fails at startup.
- Resolution: `optionalTrimmed()` trims the key and turns blank-only input into
  unset, so an enabled gateway fails startup. The boundary test passes.

### P2-T06-006 — low — the full PR description still contains pre-fix details

- Location: pull-request-description
- Status: resolved at `fd46a97`
- The description identifies exact head `ae73853` and has a correction section,
  but its main deliverables still say the env worker added only three value-less
  lines and that the PR has five gateway config plus three fitness cases. The
  current diff has the larger coherent ENVEX2 block, additional direct/config
  cases, and four fitness tests. This makes the full summary internally
  contradictory after the amended commit.
- Required correction: refresh the main deliverables, not only the correction
  appendix, so they describe the complete current PR once.
- Resolution: the complete PR body now consistently identifies head `fd46a97`,
  the fail-closed direct behavior, ten config/gating cases, four fitness cases,
  and the coherent environment example.

### P2-T06-007 — high — AGT_BLD fix suggestions still use a provider-native runtime path

- Location: `packages/devops/src/agents/AGT_BLD.ts:7,13,81`; `packages/shared/src/clients/claudeAgentClient.ts:13,28,84`; `packages/server/tests/llmGatewayFitness.test.ts:29-33,56-57`
- Status: resolved at `9cc8906`
- The server wires `generateFixSuggestionIfApplicable()` into the active build
  handler at `packages/server/src/index.ts:428-432`. For test and compile
  failures, that function ignores the injected gateway-backed `llmClient` and
  calls `generateReadOnlyDiffSuggestion()`, which directly invokes
  `query()` from `@anthropic-ai/claude-agent-sdk`. The shared client explicitly
  documents `ANTHROPIC_API_KEY` as its authentication mechanism.
- This path has no LiteLLM transport, logical alias, `PgCostGuard`, or gateway
  route audit. It therefore contradicts the task's explicit survey and
  acceptance statements for `AGT_BLD classify/suggest`, "all runtime calls",
  and "no provider key in runtime", as well as the PR body's claim that all
  seven consumers are already migrated through DI.
- The new fitness test scans `server`, `prjops`, and `devops` runtime sources but
  explicitly exempts `@anthropic-ai/claude-agent-sdk`; it also does not scan the
  shared client where the provider-native query is constructed. The exact
  residual path consequently passes the oracle intended to prevent it.
- Required correction: either route this suggestion generation through a
  gateway/logical-alias client with the required read-only contract, or keep
  the server suggestion callback fail-closed until its dedicated migration is
  implemented. Remove the blanket Agent SDK exemption or add an equivalent
  reachability check so the runtime boundary cannot regress, and make the PR
  description state the resulting behavior accurately.
- Resolution: server composition no longer imports or calls
  `generateFixSuggestionIfApplicable`; its callback returns `null` after a
  fail-closed audit, and the PR body identifies the deferred P8 scoped-virtual-
  key migration. The fitness oracle now raw-bans all `@anthropic-ai/` package
  references in runtime sources and separately rejects the three known Agent
  SDK reachability symbols in server composition, with self-tests for both.

### P2-T06-008 — medium — the fail-closed callback warns for classifications that never request a fix suggestion

- Location: `packages/server/src/index.ts:427-445`; `packages/server/src/agents/devopsEventHandlers.ts:345-360`
- Status: resolved at `9d83834`
- The handler computes `needsFixSuggestion`, but when a checkout exists it calls
  `deps.generate()` for every non-unknown classification. The former
  `generateFixSuggestionIfApplicable()` seam returned `null` before auditing
  for `dependency` and `infra_timeout`. Its replacement callback now always
  appends `build_fix_suggestion_disabled` at warning severity.
- Consequently routine dependency and infrastructure classifications produce
  a false control-gap warning even though DevOps:SPEC-INT-011 only requests a
  suggestion for test and compile failures. The existing dependency-path test
  supplies a checkout but does not assert that the generate seam or warning is
  absent, so the regression is green.
- Required correction: preserve the applicability guard before writing the
  disabled audit, preferably once in the handler (`needsFixSuggestion &&
  repoCheckoutPath`) so all injected generators share the contract, and add the
  dependency/infra negative assertion. The test/compile fail-closed audit and
  `null` result should remain unchanged.
- Resolution: `createBuildEventHandler()` now calls the generate seam only when
  `needsFixSuggestion && repoCheckoutPath`; dependency and infrastructure
  classifications retain their normal triage post without invoking the seam.
  The regression test asserts both no generate call and no disabled audit.

### P2-T06-009 — low — generated timestamp-only output is outside the task edit boundary

- Location: `packages/traceability/output/traceability_matrix.md:3`
- Status: resolved at `9d83834`
- The only change is the generated timestamp. The P2-T06 task's `allowed_paths`
  section does not include traceability output, and this file was absent from
  every earlier reviewed head. It adds no behavioral or verification evidence
  to this PR and appears to be an accidental `mise run traceability` artifact.
- Required correction: remove this file from the PR diff. Continue using the
  read-only traceability invocation for reviewer evidence when output refresh
  is not an explicit deliverable.
- Resolution: the generated matrix is byte-identical to the merge base and no
  longer appears in the nine-file PR diff.

## Owner decision — escalation alias semantics

The task explicitly requests `claude-governed`, so the implementation matches
its written acceptance. However, the preserved shared behavior calls the
escalation model only after the standard model exhausts structured-output
attempts (`packages/shared/src/clients/anthropicClient.ts:324-330`), while the
canonical routing contract defines `claude-governed` by provider/data
classification and does not guarantee a stronger model than
`claude-standard`. The proxy binding can make the intended capability true, but
that is currently an unvalidated deployment assumption. Before approval, the
AI Platform/Owner should explicitly confirm that `BEDROCK_CLAUDE_GOVERNED_MODEL_ID`
is the canonical capability-escalation binding, or amend the routing contract
with a capability-specific alias. This is a policy decision, not a request to
hard-code a provider model ID in the server.

Resolution: Owner confirmed `claude-governed` as the structured-output
capability escalation binding and requires the proxy environment binding to
point at the top-capability model. The decision is recorded in config and the
PR body; no server-side provider model ID was added.

## Independent evidence

- `gh` was used first; GitHub confirmed PR #189 is open and mergeable at exact
  base/head above, with one signed commit and six changed files. No web fallback
  was needed: https://github.com/mryfmo/ai-ops-platform/pull/189
- `pnpm --filter @aiops/server run test`: 76 files passed, 1 skipped; 835 tests
  passed, 13 skipped.
- `pnpm --filter @aiops/server run typecheck`: passed.
- `mise run traceability`: passed with all traceability guards clear.
- `git diff --check` passed; no dependency or lockfile change exists.
- Placeholder-only config and predicate probes reproduced P2-T06-001,
  P2-T06-003, P2-T06-004, and P2-T06-005. No provider credential or outbound
  network request was used.
- Startup audit metadata records only mode, normalized URL host, and aliases;
  no virtual/provider token is included. Existing `PgCostGuard` reservations and
  reconciliations receive `currentModel`, so gateway aliases are retained in
  cost usage rows.
- GitHub gitleaks and CodeRabbit were successful; `build-test` remained in
  progress at this review checkpoint.

## Re-review evidence at `ae73853`

- `gh` was used first; no web fallback was needed. GitHub confirmed exact head
  `ae73853`, mergeable state, a signed amended commit, seven changed files, and
  a PR body updated with the current head and correction section:
  https://github.com/mryfmo/ai-ops-platform/pull/189
- `pnpm --filter @aiops/server run test`: 76 files passed, 1 skipped; 841 tests
  passed, 13 skipped.
- `pnpm --filter @aiops/server run typecheck`: passed.
- `pnpm --filter @aiops/devops run test`: 21 files and 210 tests passed; 6 tests
  skipped.
- Read-only `runTraceability({ writeOutput: false })`: exit 0 with no failures.
- Prettier check on all changed implementation/test/env files passed;
  `git diff --check` passed; no dependency or lockfile change exists.
- Independent config/source inspection verified resolution of the original
  flag/kill combinations, capability state, env example, blank-key validation,
  secret-free audit fields, and Owner decision.
- Exact-predicate probes reproduced the remaining oracle miss for a directly
  executable concatenated provider URL. Source tracing confirmed that direct
  mode has no classification/provider-policy input at any of its shared caller
  boundaries.
- Current-head GitHub gitleaks is successful; build-test was still in progress
  at the re-review checkpoint.

## Round 3 evidence at `fd46a97`

- `gh` was used first; no web fallback was needed. GitHub confirmed exact head
  `fd46a97b463ba5511d1ad71647f191656e50786e`, base
  `137a1e04476edb04920946bedc3c83982bdeb12a`, open/mergeable state, one signed
  amended commit, seven changed files, and a fully synchronized PR body:
  https://github.com/mryfmo/ai-ops-platform/pull/189
- `pnpm --filter @aiops/server run test`: 76 files passed, 1 skipped; 841 tests
  passed, 13 skipped.
- `pnpm --filter @aiops/server run typecheck`: passed.
- `pnpm --filter @aiops/devops run test`: 21 files and 210 tests passed; 6 tests
  skipped.
- Read-only `runTraceability({ writeOutput: false })`: exit 0 with no failures.
- Prettier check on every changed implementation/test/env/doc file passed;
  `git diff --check` passed; no dependency or lockfile change exists.
- Source tracing from the server composition callback through
  `generateFixSuggestionIfApplicable()` to the shared Agent SDK client
  reproduced P2-T06-007 without a provider credential or outbound request.
  The exact fitness predicate returns allowed for that SDK by design.
- GitHub gitleaks and CodeRabbit are successful; build-test remained in progress
  at the round 3 checkpoint.

## Round 4 evidence at `9cc8906`

- `gh` was used first; no web fallback was needed. GitHub confirmed exact head
  `9cc8906c5ea24861dce91481e0e059cc1bbcca35`, base
  `137a1e04476edb04920946bedc3c83982bdeb12a`, open/mergeable state, one amended
  commit, eight changed files, the `ai-generated` label, and a PR body updated
  for the fail-closed Agent SDK behavior:
  https://github.com/mryfmo/ai-ops-platform/pull/189
- `pnpm --filter @aiops/server run test`: 76 files passed, 1 skipped; 842 tests
  passed, 13 skipped.
- `pnpm --filter @aiops/server run typecheck`: passed.
- `pnpm --filter @aiops/devops run test`: 21 files and 210 tests passed; 6 tests
  skipped.
- Read-only `runTraceability({ writeOutput: false })`: exit 0 with no failures.
- Prettier check on every changed file passed; `git diff --check` passed; no
  dependency or lockfile change exists.
- Static source tracing confirmed that no server source imports the Agent SDK
  path and the new oracle rejects its known symbols. The same handler trace
  established P2-T06-008: `deps.generate()` is invoked for dependency and
  infrastructure classifications whenever a checkout mapping exists, while
  the new callback unconditionally writes the disabled warning.
- The eighth PR file is a one-line timestamp refresh in the tracked generated
  traceability matrix, outside the task's declared allowed paths.
- GitHub gitleaks and CodeRabbit are successful; build-test remained in progress
  at the round 4 checkpoint.

## Round 5 evidence at `9d83834`

- `gh` was used first; no web fallback was needed. GitHub confirmed exact head
  `9d838348ae3db237b1b2fd56faf2d7eb5fe605f5`, base
  `137a1e04476edb04920946bedc3c83982bdeb12a`, open/mergeable state, one amended
  commit, nine changed files, the `ai-generated` label, and a PR body updated
  for the complete fail-closed behavior and 843-test count:
  https://github.com/mryfmo/ai-ops-platform/pull/189
- The exact `9cc8906..9d83834` diff moves the applicability check into
  `createBuildEventHandler()`, adds the negative regression test, and restores
  the generated traceability matrix byte-for-byte to the merge base. The PR
  name-only diff contains exactly the nine authorized implementation, test,
  environment, and configuration-documentation files.
- `pnpm --filter @aiops/server run test`: 76 files passed, 1 skipped; 843 tests
  passed, 13 skipped.
- `pnpm --filter @aiops/server run typecheck`: passed.
- `pnpm --filter @aiops/devops run test`: 21 files and 210 tests passed; 6 tests
  skipped.
- Read-only `runTraceability({ writeOutput: false })`: exit 0 with no failures.
- Prettier check on every changed file passed; `git diff --check` passed; no
  dependency or lockfile change exists.
- Owner reported a fresh-DB standalone `mise run ci` exit 0. Hosted CI at the
  checkpoint had gitleaks and CodeRabbit successful and build-test progressing
  normally through governance, OPA, contract, audit, lint, format, build, and
  typecheck; approval does not depend on that still-running duplicate.

## Verdict

Approve exact head `9d83834` unconditionally. P2-T06-001 through P2-T06-009
and the Owner decision are resolved; no blocking findings remain. The server's
structured inference paths use the gateway and logical aliases, direct
transport remains fail-closed, and the provider-native Agent SDK suggestion
path is unreachable from server composition until its dedicated P8 migration.
This reviewer edited only this review artifact; it did not edit the PR branch,
submit a GitHub review, push, merge, change dependencies/lockfiles, or use
provider credentials.
