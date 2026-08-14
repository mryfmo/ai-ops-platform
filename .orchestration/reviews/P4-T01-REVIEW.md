# P4-T01-REVIEW — PR #228 revise at `76b262f`

```yaml
task_id: P4-T01-REVIEW
reviewer: codex-deep-dot
initial_reviewed_at: 2026-08-14T21:14:23+09:00
round_2_reviewed_at: 2026-08-15T00:42:31+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/228
base_sha: da14ca282198e60dd15584597f954f241cbd8648
initial_head_sha: ff91857e204dfe56dde94bc2de86d29ec3b60aca
head_sha: 76b262f72d10453122dcbf4c0082c11236c60261
verdict: revise
findings_open: 5
findings_resolved: 3
summary: >-
  Findings 001-003 are resolved at 76b262f: the governed configuration now
  rejects the original authorization, route/UI, and identity mutations. The
  review remains revise because the authenticated smoke can pass against an
  unrelated empty target, operational endpoint/posture values remain mutable,
  the binding Owner/Security entry ruling is still pending, finding 005 was
  not actually reverted, and unrelated P4-T02/T03 task files entered the PR.
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

---

## Round 2 at `76b262f`

### Disposition of findings 001–005

- `P4-T01-001`: resolved for the governed config. The checker now pins
  `mcpAuthorization.rules` to exactly `["false"]` and rejects targets before
  onboarding. The checked-in authenticated smoke reaches a valid session,
  observes an empty filtered list, and denies `synthetic_echo`. The remaining
  evidence-integrity weakness is tracked separately as finding 006.
- `P4-T01-002`: resolved. The checker now accepts only the four reviewed
  top-level keys, one exact gateway, an empty MCP target set, and one
  backend-free A2A marker. The prior generic-host route and top-level UI
  mutations are rejected, and `/ui` returns 404 in the exact-head smoke.
- `P4-T01-003`: resolved. MCP and A2A JWT policy objects must deep-equal the
  canonical strict issuer, audience, and file-only JWKS binding. Independent
  issuer/audience/URL/cross-surface mutations fail.
- `P4-T01-004`: partially addressed but open. Repository artifacts now state
  that this is non-enabled preparatory configuration and that the license/P4
  entry gate is OPEN. The required binding Owner/Security ruling has not been
  recorded, and the public PR description still presents an unqualified
  production configuration and “Apache-2.0 single OSS image.” It also retains
  the old blocklist/6-test/37-test description instead of the Round-2 state.
- `P4-T01-005`: open. The exact merge-base diff still changes only the
  traceability matrix generation timestamp, now to
  `2026-08-14T12:26:10.961Z`, despite the commit/report claiming it was
  reverted.

### P4-T01-006 — medium — authenticated smoke can pass against a different empty MCP target

- Location: `contracts/mcp-gateway/check-gateway-config.mjs:133-153`;
  `deploy/agentgateway/smoke-fixture.config.yaml:38-43`;
  `deploy/agentgateway/smoke.sh:114-157`;
  `deploy/agentgateway/smoke-mcp-probe.mjs:64-94`.
- `validateSmokeFixture()` permits arbitrary `host`, `port`, and `path` values
  for the sole `synthetic` target. The direct probe always checks
  `127.0.0.1:$TARGET_PORT`, while the gateway follows the independently
  configured fixture endpoint. The two observations are not cryptographically
  or structurally tied to the same server. `SMOKE_HOST_ADDR` is declared and
  assigned but never applied to the fixture.
- Live refutation: an isolated fixture changed only the gateway target port
  from 8931 to 8932, which the checker accepted. Port 8932 served a separate
  MCP decoy with zero tools and an unknown-tool error; port 8931 still ran the
  real `synthetic_echo` target. The full smoke exited 0 and printed all three
  authorization success lines. The empty list and failed call were produced
  by the decoy's behavior, not by deny-all filtering of the directly observed
  tool.
- Required correction: bind the staged fixture endpoint to the exact target
  launched by the script (including the effective host address, port, and
  path), and make the contract reject endpoint drift. Assert a target-issued
  nonce/counter proving that the gateway fetched `synthetic_echo` from that
  same process while the subsequent call never reached it; require the exact
  vendor authorization error instead of accepting any failure. Either use
  `SMOKE_HOST_ADDR` in the staged fixture or remove the nonfunctional option
  and docker-compatible claim.

### P4-T01-007 — medium — the “reviewed exact shape” still permits telemetry and posture drift

- Location: `contracts/mcp-gateway/check-gateway-config.mjs:78-102`;
  `deploy/agentgateway/config.yaml:10-21`;
  `deploy/agentgateway/deployment.yaml:9-22`.
- The checker pins key names but only requires non-empty readiness, stats, and
  OTLP endpoint values. It does not pin `otlpProtocol`, does not compare the
  runtime endpoint/ports to `deployment.yaml`, and ignores the deployment port
  and OTLP metadata entirely.
- Exact-head mutations changing OTLP to
  `https://attacker.invalid:4317`, readiness/stats ports, A2A response body,
  and deployment port/OTLP metadata were all accepted. An external telemetry
  sink is a materially different egress/data boundary, while port drift makes
  the declared deployment posture inconsistent with the runtime config.
- Required correction: deep-equal the reviewed operational values or compare
  them to one canonical deployment manifest: readiness `:15021`, stats
  `:15020`, OTLP internal collector + `grpc`, gateway `:3000`, and the exact
  A2A marker response. Add external-OTLP and config/manifest mismatch fixtures.

### P4-T01-008 — medium — Round 2 swept unrelated future task contracts into PR #228

- Location: Round-2 commit `76b262f` adds
  `.orchestration/tasks/P4-T02-registry-generator.md` (96 lines) and
  `.orchestration/tasks/P4-T03-opa-decision-client.md` (82 lines).
- These files were untracked before the fix commit, are not P4-T01 deliverables,
  and define separate writer tasks/PRs with their own scopes and gates. They
  are absent from the PR description and were not part of the requested
  findings fix. Merging them here couples two unreviewed future task contracts
  to the gateway preparation PR.
- Required correction: remove both files from PR #228 and commit them through
  their owning orchestration change, or record an explicit P4-T01 scope
  amendment and update the full PR description so they receive deliberate
  review.

### Round-2 positive checks

- GitHub CLI was used first. PR metadata, full body, commits, files, comments,
  review threads, and checks were inspected at exact head
  `76b262f72d10453122dcbf4c0082c11236c60261`. No review threads exist.
- Exact-head Actions run `31800452150` is green: `build-test` and `gitleaks`
  succeeded; CodeRabbit status is success.
- Focused gateway tests pass 9/9. Full `mise run contracts` passes 40/40.
  `git diff --check`, supported-file Prettier, and `bash -n` pass.
- The normal exact-head two-phase smoke passes: governed 401/404 posture,
  authenticated `tools/list` empty, and `tools/call` denied.
- The original allow-all CEL, generic LLM route, attached UI, and wrong-issuer
  live mutations are now rejected.
- No implementation file, PR state, remote branch, dependency, gate, or user
  untracked file was modified by this review.

### Round-2 verdict

Revise. Findings 004 and 005 remain open; findings 006-008 are new. The core
MCP/route/JWT contract fixes are correct, but approval is not unconditional
until the evidence chain, operational values, governance ruling/PR claims, and
scope contamination are resolved.
