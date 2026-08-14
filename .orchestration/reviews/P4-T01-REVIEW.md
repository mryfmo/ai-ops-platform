# P4-T01-REVIEW — PR #228 revise at `ff91857`

```yaml
task_id: P4-T01-REVIEW
reviewer: codex-deep-dot
reviewed_at: 2026-08-14T21:14:23+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/228
base_sha: da14ca282198e60dd15584597f954f241cbd8648
head_sha: ff91857e204dfe56dde94bc2de86d29ec3b60aca
verdict: revise
findings_open: 5
findings_resolved: 0
summary: >-
  The exact current config is deny-all and the pinned vendor image is genuine,
  but the blocking contract and smoke evidence do not preserve or prove that
  posture. Live mutations passed the repository checker and the v1.4.1 vendor
  validator while enabling allow-all MCP authorization, a generic LLM proxy,
  an externally attached management UI, and unreviewed identity bindings.
  The P4 entry/license gate is also still explicitly OPEN.
```

## Findings

### P4-T01-001 — high — MCP-001 is neither preserved nor exercised past authentication

- Location: `contracts/mcp-gateway/check-gateway-config.mjs:72-81`;
  `deploy/agentgateway/smoke.sh:88-90`;
  `.orchestration/reports/P4-T01-REPORT.md:28-40`;
  canonical evidence requirement at
  `docs/plans/2026-08-final-architecture/08_verification/02_acceptance_test_catalog.yaml:203-211`.
- The checker equates any non-empty `mcpAuthorization.rules` array with a
  default-deny allowlist. An exact-head live mutation from `["false"]` to
  `["true"]` was accepted. In agentgateway v1.4.1, `true` is a valid CEL allow
  expression, so this change makes every discovered tool visible and callable
  while the blocking gate remains green.
- The runtime smoke cannot compensate. It deliberately discards the private
  key and sends only unauthenticated requests, so `POST /mcp -> 401` stops at
  `jwtAuth`. It has zero targets and never reaches MCP authorization, never
  performs `tools/list` with a valid token, and never calls an unknown or
  denied tool. The required evidence is specifically `OPA/gateway tests` plus
  `unknown tool denied`; neither is present.
- Vendor behavior itself is sound: v1.4.1 applies the authorization predicate
  while merging `tools/list`, and tool calls use the same authorization set.
  The missing evidence is in this repository's gate and smoke, not in that
  vendor mechanism.
- Required correction: until P4-T02 owns generated rules, pin the exact
  deny-all sentinel and reject `true`/broad-rule mutations. Add an authenticated
  runtime fixture with a synthetic target that proves denied tools are removed
  from `tools/list` and an unknown/denied `tools/call` fails. If MCP-001 is not
  intended to be complete in T01, remove the gate-complete claims and record it
  as blocked rather than green.

### P4-T01-002 — high — exact-key scanning can expose both an LLM proxy and the management UI

- Location: `contracts/mcp-gateway/check-gateway-config.mjs:21-40,61-70,83-88`;
  `contracts/mcp-gateway/gateway-config.test.mjs:20-31`;
  `deploy/agentgateway/smoke.sh:92-94`.
- `forbidKeysDeep()` rejects only keys literally named `llm`, `ai`, or
  `stdio`. The vendor schema also permits generic HTTP `routes`/`routeGroups`
  with ordinary `host` backends and a top-level `ui` attachment. Neither form
  needs a forbidden key.
- A live mutation added a generic `/v1/chat/completions` route with
  `backends: [{host: api.openai.com:443}]` and `ui: {gateways: default}`. The
  repository checker accepted it, the exact pinned v1.4.1 binary reported
  `Configuration is valid!`, and the running gateway returned `200 text/html`
  for `/ui` and `400` rather than `404` for `/v1/chat/completions`. Thus both
  documented invariants can regress while CI and `--validate-only` remain
  green. Setting `adminAddr: off` does not disable a UI explicitly attached to
  the public gateway.
- The A2A check is similarly presence-only: it accepts additional generic
  routes/backends and does not require the marker to remain backend-free with
  the expected 503 direct response. The current two-path 404 smoke only proves
  those paths are absent in today's exact config; it does not test the claimed
  contract against semantically equivalent routes.
- Required correction: validate an allowed configuration shape, not forbidden
  words. For T01, reject top-level `ui`, `routeGroups`, reusable `backends`,
  TCP routes, and every route except the exact authenticated, backend-free A2A
  503 marker. Add the generic-host and external-UI mutations as negative tests
  and probe the admin/UI surfaces explicitly.

### P4-T01-003 — high — “pinned” JWT identity accepts arbitrary issuer, audience, and JWKS source

- Location: `contracts/mcp-gateway/check-gateway-config.mjs:42-49`;
  `.orchestration/reports/P4-T01-REPORT.md:14-18`.
- `assertJwtAuthStrict()` checks only non-empty strings/arrays and permits
  either a file or URL. It does not compare the issuer, audience, or JWKS path
  with the reviewed platform values and does not require MCP and A2A to share
  the same binding.
- The exact-head checker accepted
  `issuer=https://attacker.invalid`, `audiences=[attacker-audience]`, and an
  arbitrary JWKS URL. A second vendor validation using the same unreviewed
  issuer/audience with a local JWKS also returned `Configuration is valid!`.
  A reachable attacker-controlled JWKS therefore turns `mode: strict` into
  strict validation of the wrong trust domain while the repository contract
  remains green.
- Required correction: compare both surfaces against exact canonical constants
  for issuer, audience, and the file-only JWKS mount; reject URL sources and
  any MCP/A2A mismatch. Add issuer, audience, file-to-URL, and cross-surface
  drift fixtures. This can later be replaced by a versioned environment
  identity manifest, but non-empty checks are not a pin.

### P4-T01-004 — high — P4 is proceeding while its binding entry and license gates remain OPEN

- Location: `.orchestration/tasks/P4-T01-agentgateway-deploy.md:6-13`;
  `docs/plans/2026-08-final-architecture/06_implementation/03_phase_acceptance.md:11`;
  `docs/decisions/P0-baseline-gate.md:64-71`;
  `docs/security/2026-08-10-license-service-review-register.md:86-100,259-270,293-303`;
  `deploy/agentgateway/deployment.yaml:4-8`.
- The canonical P4 entry requires an exact agentgateway/OPA pin and MCP
  registry. The binding P0 decision additionally says agentgateway and OPA
  Apache notice review must finish before P4 entry. The register still lists
  exact release/image, dependency/SBOM licenses, notice handling, and all
  decision roles as OPEN; OPA and the registry are deferred to later tasks.
- The PR independently verifies the agentgateway digest and upstream OCI
  license label, but `deployment.yaml` declaring `license: Apache-2.0` is not
  an SBOM/dependency/NOTICE review or Owner/Security approval. The report's
  “Apache-2.0 single OSS image” wording overstates the approved supply-chain
  status.
- Required correction: resolve the P4 entry/license prerequisites before
  accepting this as a deploy task, or add a binding Owner/Security amendment
  that classifies T01 as non-enabled preparatory configuration and keeps P4
  entry/runtime use blocked until OPA pin, registry, SBOM/dependency licenses,
  Apache notices, and approval evidence are complete. Narrow the report and PR
  claims to the evidence actually established.

### P4-T01-005 — low — a timestamp-only generated artifact is outside the granted paths

- Location: `packages/traceability/output/traceability_matrix.md:3`;
  `.orchestration/tasks/P4-T01-agentgateway-deploy.md:17-24`.
- The task grants `deploy/agentgateway/**`, `contracts/mcp-gateway/**`, one
  `contracts/package.json` line, and `.orchestration/**`. The PR also changes
  the traceability matrix only to refresh its generation timestamp; no matrix
  result changed.
- Required correction: remove the timestamp-only diff, or record an explicit
  scope amendment if generated traceability output is intentionally retained.

## Vendor verification

- Official authorization documentation states that MCP authorization rules
  filter tools and gate calls:
  https://agentgateway.dev/docs/standalone/latest/tutorials/authorization/
- The reviewed source is the exact v1.4.1 release commit
  `163ea2146acb7b82082acea30ed691b29079095f`. Its MCP RBAC returns allow when no
  rules exist and evaluates configured rules; `handler.rs` filters
  `tools/list` through that evaluator:
  https://github.com/agentgateway/agentgateway/blob/163ea2146acb7b82082acea30ed691b29079095f/crates/agentgateway/src/mcp/rbac.rs#L41-L58
  and
  https://github.com/agentgateway/agentgateway/blob/163ea2146acb7b82082acea30ed691b29079095f/crates/agentgateway/src/mcp/handler.rs#L713-L727
- `--validate-only` parses and normalizes local configuration/resources; it is
  vendor-schema validation, not validation of this repository's architectural
  allowlist:
  https://github.com/agentgateway/agentgateway/blob/163ea2146acb7b82082acea30ed691b29079095f/crates/agentgateway-app/src/commands/run.rs#L110-L136
- The same source explicitly supports generic routes/route groups and an
  externally attached UI:
  https://github.com/agentgateway/agentgateway/blob/163ea2146acb7b82082acea30ed691b29079095f/crates/agentgateway/src/types/local.rs#L357-L394

## Positive checks

- GitHub CLI was used first. PR metadata, body, commit, changed files, comments,
  review threads, and checks were inspected at exact head
  `ff91857e204dfe56dde94bc2de86d29ec3b60aca`. There are no review threads.
- Exact-head GitHub Actions run `31795968717` is green: `build-test` and
  `gitleaks` succeeded; CodeRabbit status is success.
- The current checked-in config itself has the intended deny-all sentinel, no
  targets, no LLM/AI/stdio keys, strict JWT bindings on MCP and A2A, a 503 A2A
  placeholder, adminAddr off, readiness/stats/OTLP endpoints, and no committed
  private key or credential.
- `mise run contracts` passes all 37 tests. `git diff --check`, supported-file
  Prettier checks, and `bash -n deploy/agentgateway/smoke.sh` pass. The shdoc
  file-level annotations match the script's observable workflow.
- The image index digest exists locally and exactly matches the pin. OCI labels
  identify v1.4.1, source revision `163ea214…`, and Apache-2.0. The official
  release was published on 2026-07-29, so the requested 24-hour hold is met.
- No implementation file, dependency, gate, PR review state, merge state, or
  remote branch was changed by this review.

## Understand-diff fallback

`.ua/knowledge-graph.json` is absent, so impact analysis used the exact
merge-base diff plus direct consumer/schema tracing. No diff overlay was
written because the task permits editing only the review and validation
artifacts.

## Verdict

Revise. Findings 001-004 are blocking security/governance gaps. Finding 005 is
non-blocking by itself but should be cleaned up with the fix round.
