# P2-T05-REVIEW — PR #188 final re-review at `f81e189`

```yaml
task_id: P2-T05-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-12T18:00:19+09:00
re_reviewed_at: 2026-08-12T18:17:44+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/188
base_sha: 73a899d6f59200aad031ebfa0cdb1f18c5f2d6b9
initial_head_sha: 024a95d4fec466efaeb6a895c41281bc085475a3
head_sha: f81e189813d946fc2dbc7cd362aeba3d46d9c583
verdict: approve
summary: >-
  Head f81e189 resolves all five findings. Direct-provider egress is blocked at
  construction and per-request boundaries before token resolution; forbidden
  HTTP errors remain ineligible; real SDK connection errors use bounded causes
  and instanceof identity without trusting mutable names; and the full PR body
  is synchronized. Independent tests and current-head GitHub CI are green.
```

## Findings

### P2-T05-001 — high — gateway egress is not enforced at the fetch boundary

- Location: `packages/shared/src/clients/anthropicClient.ts:509`
- Status: resolved at `8a1d337`
- `mode` is only a TypeScript union. At runtime, any value other than the exact
  string `"gateway"` or `"direct"` skips both validation branches and constructs
  the SDK with its direct `https://api.anthropic.com` default without the
  migration flag.
- `validateGatewayBaseUrl()` rejects only the exact hostname
  `api.anthropic.com`; the equivalent FQDN `api.anthropic.com.` passes.
- More importantly, `authenticatedFetch()` never validates the actual request
  URL. Anthropic SDK 0.115.0 exposes `post(path, ...)` and treats an absolute
  path as authoritative. A gateway-mode client can therefore call the direct
  provider, and the wrapper attaches the LiteLLM virtual key as
  `Authorization: Bearer` to that direct request.
- Independent no-network capture reproduced all three requests:
  `mode: "typo"` -> direct host with `x-api-key`; gateway `client.post()` with an
  absolute Anthropic URL -> direct host with the gateway bearer token; gateway
  base URL `https://api.anthropic.com.` -> the same direct host with bearer.
- Required correction: runtime-validate the mode; normalize/reject the direct
  hostname including a terminal dot; and enforce the configured gateway origin
  on every underlying fetch before resolving or attaching the token. Prevent
  automatic cross-origin redirects as part of that boundary. Add negative tests
  for invalid mode, terminal-dot host, absolute SDK paths/`withOptions()`, and
  redirects, asserting neither the token provider nor the injected fetch is
  reached on rejection.
- Resolution: runtime mode validation and canonical origin checks now run
  before token resolution, terminal-dot Anthropic hosts are rejected, absolute
  `post()` and `withOptions()` paths are blocked with zero token/fetch calls,
  and authenticated requests force `redirect: "error"`.

### P2-T05-002 — high — forbidden 4xx errors become fallback-eligible when their message says timeout

- Location: `packages/shared/src/clients/anthropicClient.ts:606`
- Status: resolved at `8a1d337`
- The free-text timeout check runs before HTTP status classification. Thus a
  401/403 policy or authentication denial, or a 400 invalid request, is changed
  into canonical `timeout` with `fallbackEligible: true` merely because its
  message includes `timeout`/`timed out`.
- Independent reproduction:
  - 403 `policy evaluation timed out` -> `timeout`, eligible
  - 401 `authentication timed out` -> `timeout`, eligible
  - 400 `invalid timeout value` -> `timeout`, eligible
- This violates ADR-0022 and the canonical manifest rule that policy and
  invalid-request failures must not fallback. Required correction: prioritize
  authoritative forbidden HTTP statuses/types over message heuristics, and add
  conflicting-signal table cases proving 400/401/403 remain ineligible.
- Resolution: HTTP status now precedes message heuristics. Independent probes
  reconfirmed 400 as `invalid_request` and 401/403 as `policy_denied`, all with
  `fallbackEligible: false` despite timeout wording.

### P2-T05-003 — medium — real SDK connection errors lose their transient cause

- Location: `packages/shared/src/clients/anthropicClient.ts:619`
- Status: resolved at `8a1d337`
- Anthropic SDK 0.115.0 wraps fetch/DNS/RST failures in `APIConnectionError`
  whose public message is only `Connection error.` and whose original failure
  is in `cause`. The normalizer scans only the outer message, so a reproduced
  `APIConnectionError` caused by `ECONNRESET` becomes `unknown` and ineligible,
  contrary to the function's stated transport-error mapping.
- Required correction: recognize the SDK connection classes and/or safely walk
  the cause chain for known network signals. Preserve fail-closed behavior for
  non-network fetch-wrapper causes such as `E-CFG05` token/config failures.
- Resolution: the bounded cause-chain scan maps a real SDK `APIConnectionError`
  caused by `ECONNRESET` to `model_temporarily_unavailable`, while the same SDK
  wrapper around an `E-CFG05` cause remains `unknown` and ineligible.

### P2-T05-004 — medium — mutable Error.name grants fallback eligibility

- Location: `packages/shared/src/clients/anthropicClient.ts:672`
- Status: resolved at `f81e189`
- The new class fallback compares `error.name` to the strings
  `APIConnectionError` / `APIConnectionTimeoutError`. Actual SDK 0.115.0
  instances report `.name === "Error"`; the real `ECONNRESET` case succeeds only
  because the cause-chain signal is present. Conversely, any unrelated Error
  can set its mutable name to `APIConnectionError` and become
  `model_temporarily_unavailable` with `fallbackEligible: true` even when its
  message is `invalid local request`.
- This undermines the canonical fail-closed classifier. Use the SDK's exported
  error classes with `instanceof` (while retaining the bounded cause scan), or
  remove the string-name fallback and rely only on validated network/timeout
  signals. Add an actual SDK instance test plus a spoofed-name negative test.
- Resolution: string-name checks were replaced by
  `instanceof Anthropic.APIConnectionError/APIConnectionTimeoutError`. Actual
  SDK instances classify correctly, an E-CFG05-wrapped SDK error remains
  ineligible, and a spoofed Error name now remains `unknown` and ineligible.

### P2-T05-005 — low — PR description is stale after the fix commit

- Location: pull-request-description
- Status: resolved at `f81e189`
- GitHub reports exact head `8a1d337`, but the body still says head `024a95d`
  and shared `493 tests`; it does not describe the 001–003 fixes or current
  495-test result. Refresh the full PR description to match the current head.
- Resolution: the GitHub body now identifies `f81e189`, reports 495 tests, has
  no old-head marker, and summarizes remediation for P2-T05-001 through 005.

## Independent evidence

- `gh` was used first; no web fallback was needed. GitHub confirmed PR #188 is
  open and mergeable at exact base/head above, with only the two task-authorized
  files changed: https://github.com/mryfmo/ai-ops-platform/pull/188
- `pnpm --filter @aiops/shared run test`: 28 files, 493/493 tests passed.
- `pnpm --filter @aiops/shared run typecheck`: passed.
- `mise run contracts`: 31/31 contract tests passed (Spectral emitted existing
  warnings only, with zero errors).
- `git diff --check`: passed; no dependency or lockfile change exists.
- GitHub `build-test`, `gitleaks`, and CodeRabbit are successful at `024a95d`.
- `packages/shared/tests/anthropicClient.test.ts` is unchanged from the base,
  and the implementation diff leaves `AnthropicStructuredClient.call()`
  unchanged. Its existing tests pass in the independent shared run.
- All bypass/error probes used an injected capture fetch and placeholder token
  strings. No provider credential or network request was used.

## Re-review evidence at `8a1d337`

- `gh` was used first and confirmed the fix commit changes only the two
  task-authorized files. No web fallback was needed:
  https://github.com/mryfmo/ai-ops-platform/pull/188
- `pnpm --filter @aiops/shared run test`: 28 files, 495/495 tests passed.
- `pnpm --filter @aiops/shared run typecheck`: passed.
- `mise run contracts`: 31/31 passed with existing Spectral warnings only.
- `git diff --check`: passed; no dependency or lockfile change exists.
- Independent injected-fetch probes confirmed invalid mode and terminal-dot
  hosts fail at construction; absolute `post()` and `withOptions()` direct-host
  requests perform zero token resolutions and zero fetches; one valid gateway
  request resolves one placeholder token, emits no `x-api-key`, and carries
  `redirect: "error"`.
- The exact conflicting-status and real SDK cause-chain cases described in the
  three original findings now produce the required classifications.
- GitHub gitleaks and CodeRabbit are green; build-test was still in progress at
  the re-review checkpoint.

## Final re-review evidence at `f81e189`

- `gh` was used first; GitHub confirmed exact head `f81e189`, the two-file
  authorized envelope, a signed one-commit delta from `8a1d337`, a synchronized
  full PR description, and mergeable state:
  https://github.com/mryfmo/ai-ops-platform/pull/188
- `pnpm --filter @aiops/shared run test`: 28 files, 495/495 passed.
- `pnpm --filter @aiops/shared run typecheck`: passed.
- Actual SDK instance probes independently confirmed connection and timeout
  eligibility, E-CFG05 cause fail-closed behavior, and spoofed-name rejection.
- `git diff --check` passed; the full PR changes only the two authorized files,
  with no dependency or lockfile changes.
- Current-head GitHub CI is green: build-test passed in 5m40s, gitleaks passed
  in 8s, and CodeRabbit is successful.

## Verdict

Approve exact head `f81e189`; P2-T05-001 through P2-T05-005 are resolved and no
findings remain. This reviewer did not edit the PR branch, submit a GitHub
review, push, merge, change dependencies/lockfiles, or use provider credentials.
