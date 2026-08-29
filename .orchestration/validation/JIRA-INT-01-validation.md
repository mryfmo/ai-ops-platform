# JIRA-INT-01 Validation

All command output below is verbatim. The full CI command used the task-local PostgreSQL environment described in the sandbox record; the invoked repository target remained `mise run ci`.

## `mise run ci`

```text
[ci] $ mise run db:require && mise run governance && mise run policy:rego && mise run contracts && mise run audit && mise run actionlint && mise run lint && mise run traceability && mise run format && mise run build && mise run typecheck && mise run test:coverage && mise run verify:db
[db:require] $ missing=""
[governance] $ pnpm run governance:check
(node:11784) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node scripts/check-codeowners.mjs && node --test scripts/verify-canonical-spec-mirrors.test.mjs scripts/coding-agent-path-guard.test.mjs tests/architecture-fitness.test.mjs && node scripts/verify-canonical-spec-mirrors.mjs && node scripts/check-architecture-fitness.mjs && pnpm run plane-mapping:validate && pnpm run jira-mapping:validate[22m
(node:11834) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:11835) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: FinalArch:COD-001 allows a content change wholly inside the manifest allowlist
ok 1 - FinalArch:COD-001 allows a content change wholly inside the manifest allowlist
  ---
  duration_ms: 413.768875
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a direct manifest-forbidden write
ok 2 - FinalArch:COD-004 rejects a direct manifest-forbidden write
  ---
  duration_ms: 315.086334
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an ignored credential file
ok 3 - FinalArch:COD-004 rejects an ignored credential file
  ---
  duration_ms: 328.548541
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects modification of an existing ignored path outside the allowlist
ok 4 - FinalArch:COD-004 rejects modification of an existing ignored path outside the allowlist
  ---
  duration_ms: 331.298333
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a forbidden file hidden by a changed ignore rule
ok 5 - FinalArch:COD-004 rejects a forbidden file hidden by a changed ignore rule
  ---
  duration_ms: 328.614833
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a .git hook insertion
ok 6 - FinalArch:COD-004 rejects a .git hook insertion
  ---
  duration_ms: 292.510667
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects workflow governance modification even if manifest allows it
ok 7 - FinalArch:COD-004 rejects workflow governance modification even if manifest allows it
  ---
  duration_ms: 329.153916
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects self-modification of the manifest contract
ok 8 - FinalArch:COD-004 rejects self-modification of the manifest contract
  ---
  duration_ms: 340.796833
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects self-modification of the path guard
ok 9 - FinalArch:COD-004 rejects self-modification of the path guard
  ---
  duration_ms: 338.657791
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a tampered baseline snapshot
ok 10 - FinalArch:COD-004 rejects a tampered baseline snapshot
  ---
  duration_ms: 267.527959
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects rename-based boundary swaps
ok 11 - FinalArch:COD-004 rejects rename-based boundary swaps
  ---
  duration_ms: 333.796708
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a forbidden mode-only change
ok 12 - FinalArch:COD-004 rejects a forbidden mode-only change
  ---
  duration_ms: 327.395791
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an allowed symlink that escapes the repository
ok 13 - FinalArch:COD-004 rejects an allowed symlink that escapes the repository
  ---
  duration_ms: 324.538666
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an allowed symlink into a forbidden path
ok 14 - FinalArch:COD-004 rejects an allowed symlink into a forbidden path
  ---
  duration_ms: 331.778125
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an unresolved allowed symlink
ok 15 - FinalArch:COD-004 rejects an unresolved allowed symlink
  ---
  duration_ms: 331.283584
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an ignored allowed symlink escape
ok 16 - FinalArch:COD-004 rejects an ignored allowed symlink escape
  ---
  duration_ms: 331.596625
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects traversal in the validated manifest before snapshotting
ok 17 - FinalArch:COD-004 rejects traversal in the validated manifest before snapshotting
  ---
  duration_ms: 134.089875
  type: 'test'
  ...
# (node:11836) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: SPEC-INT-010 accepts an allowlisted regular Markdown entry
ok 18 - SPEC-INT-010 accepts an allowlisted regular Markdown entry
  ---
  duration_ms: 1.635916
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects invalid UTF-8 filenames
ok 19 - SPEC-INT-010 rejects invalid UTF-8 filenames
  ---
  duration_ms: 0.322
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects absolute, traversal, slash, backslash, and control filenames
ok 20 - SPEC-INT-010 rejects absolute, traversal, slash, backslash, and control filenames
  ---
  duration_ms: 0.085542
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects renamed and non-allowlisted Unicode lookalike entries
ok 21 - SPEC-INT-010 rejects renamed and non-allowlisted Unicode lookalike entries
  ---
  duration_ms: 0.588709
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects NFC-equivalent duplicate entries
ok 22 - SPEC-INT-010 rejects NFC-equivalent duplicate entries
  ---
  duration_ms: 0.365
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects symlink, directory, and FIFO archive entries
ok 23 - SPEC-INT-010 rejects symlink, directory, and FIFO archive entries
  ---
  duration_ms: 0.163917
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects central/local filename mismatches
ok 24 - SPEC-INT-010 rejects central/local filename mismatches
  ---
  duration_ms: 0.138542
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects truncated ZIP records
ok 25 - SPEC-INT-010 rejects truncated ZIP records
  ---
  duration_ms: 0.089083
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects duplicate local-header offsets
ok 26 - SPEC-INT-010 rejects duplicate local-header offsets
  ---
  duration_ms: 0.319375
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects archives and declared entries above the limits before expansion
ok 27 - SPEC-INT-010 rejects archives and declared entries above the limits before expansion
  ---
  duration_ms: 0.422833
  type: 'test'
  ...
# Subtest: SPEC-INT-010 bounds expansion when the ZIP declares a false small size
ok 28 - SPEC-INT-010 bounds expansion when the ZIP declares a false small size
  ---
  duration_ms: 4.045916
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects missing, extra, and oversized mirror entries
ok 29 - SPEC-INT-010 rejects missing, extra, and oversized mirror entries
  ---
  duration_ms: 13.602958
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects mirror hash mismatches
ok 30 - SPEC-INT-010 rejects mirror hash mismatches
  ---
  duration_ms: 2.164041
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects a symlink used as the canonical ZIP path
ok 31 - SPEC-INT-010 rejects a symlink used as the canonical ZIP path
  ---
  duration_ms: 0.634667
  type: 'test'
  ...
# (node:11837) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: FinalArch:INV-005/006/009/013/019 and GOV-005 reject every required negative fixture
ok 32 - FinalArch:INV-005/006/009/013/019 and GOV-005 reject every required negative fixture
  ---
  duration_ms: 26.506833
  type: 'test'
  ...
# Subtest: FinalArch:INV-020 accepts an exact flag registry and a complete 20-invariant matrix
ok 33 - FinalArch:INV-020 accepts an exact flag registry and a complete 20-invariant matrix
  ---
  duration_ms: 16.204167
  type: 'test'
  ...
# Subtest: FinalArch:INV-020 rejects an incomplete invariant matrix
ok 34 - FinalArch:INV-020 rejects an incomplete invariant matrix
  ---
  duration_ms: 12.739042
  type: 'test'
  ...
# Subtest: FinalArch:INV-005 rejects computed global fetch targets
ok 35 - FinalArch:INV-005 rejects computed global fetch targets
  ---
  duration_ms: 14.862709
  type: 'test'
  ...
# Subtest: FinalArch:INV-006 rejects LLM routing in agentgateway configuration
ok 36 - FinalArch:INV-006 rejects LLM routing in agentgateway configuration
  ---
  duration_ms: 11.558834
  type: 'test'
  ...
# Subtest: FinalArch:INV-013 enforces MCP tools per server
ok 37 - FinalArch:INV-013 enforces MCP tools per server
  ---
  duration_ms: 9.713
  type: 'test'
  ...
# Subtest: FinalArch:INV-019 scans root environment and infrastructure configuration
ok 38 - FinalArch:INV-019 scans root environment and infrastructure configuration
  ---
  duration_ms: 8.307666
  type: 'test'
  ...
# Subtest: FinalArch:GOV-005 rejects adversarial WBS ownership bypasses
ok 39 - FinalArch:GOV-005 rejects adversarial WBS ownership bypasses
  ---
  duration_ms: 94.011334
  type: 'test'
  ...
# Subtest: FinalArch:INV-017 root focused-test scripts use Vitest 4 file filters directly
ok 40 - FinalArch:INV-017 root focused-test scripts use Vitest 4 file filters directly
  ---
  duration_ms: 0.543208
  type: 'test'
  ...
1..40
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5451.304042
OK: canonical ZIP archives match their allowlisted spec mirrors (PrjOps 8, DevOps 6).
(node:21087) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
OK: architecture fitness checks passed (INV-001..INV-020 mapped).
(node:21093) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node --test tests/validate-plane-environment-mapping.test.mjs && node scripts/validate-plane-environment-mapping.mjs docs/contracts/fixtures/plane-environment-mapping.dev.json[22m
(node:21148) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:21149) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: ADR-0019 P014-FA-T02 accepts the tracked development mapping with an explicit replacement warning
ok 1 - ADR-0019 P014-FA-T02 accepts the tracked development mapping with an explicit replacement warning
  ---
  duration_ms: 34.273875
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 accepts an owner-signed production mapping without DEV defaults
ok 2 - ADR-0019 P014-FA-T02 accepts an owner-signed production mapping without DEV defaults
  ---
  duration_ms: 0.268083
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects malformed JSON and unknown properties
ok 3 - ADR-0019 P014-FA-T02 rejects malformed JSON and unknown properties
  ---
  duration_ms: 30.057167
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects duplicate and cross-project Plane UUID mappings
ok 4 - ADR-0019 P014-FA-T02 rejects duplicate and cross-project Plane UUID mappings
  ---
  duration_ms: 0.393084
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects unsafe URLs and noncanonical project identities
ok 5 - ADR-0019 P014-FA-T02 rejects unsafe URLs and noncanonical project identities
  ---
  duration_ms: 0.481083
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects stale versions and incomplete go-live replacement
ok 6 - ADR-0019 P014-FA-T02 rejects stale versions and incomplete go-live replacement
  ---
  duration_ms: 1.060125
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 114.6715
WARNING: DEV-DEFAULT: replace before go-live with owner-signed production values.
OK: validated 3 Plane project mappings.
(node:21153) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node --test tests/validate-jira-environment-mapping.test.mjs && node scripts/validate-jira-environment-mapping.mjs docs/contracts/fixtures/jira-environment-mapping.dev.json[22m
(node:21209) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:21210) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: accepts tracked development mapping and emits go-live replacement warning
ok 1 - accepts tracked development mapping and emits go-live replacement warning
  ---
  duration_ms: 36.24
  type: 'test'
  ...
# Subtest: accepts owner-signed production mapping
ok 2 - accepts owner-signed production mapping
  ---
  duration_ms: 0.252
  type: 'test'
  ...
# Subtest: rejects unknown fields, malformed JSON, and noncanonical PJ keys
ok 3 - rejects unknown fields, malformed JSON, and noncanonical PJ keys
  ---
  duration_ms: 29.030958
  type: 'test'
  ...
# Subtest: rejects duplicate Jira or GitHub mappings
ok 4 - rejects duplicate Jira or GitHub mappings
  ---
  duration_ms: 0.315708
  type: 'test'
  ...
# Subtest: rejects unknown/protected statuses and unsafe URLs
ok 5 - rejects unknown/protected statuses and unsafe URLs
  ---
  duration_ms: 0.510042
  type: 'test'
  ...
# Subtest: rejects stale versions and incomplete production replacement
ok 6 - rejects stale versions and incomplete production replacement
  ---
  duration_ms: 0.966625
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 112.616084
WARNING: DEV-DEFAULT: replace Jira mapping before go-live with owner-signed production values.
OK: validated 2 Jira project mappings.
[policy:rego] $ if ! command -v opa >/dev/null 2>&1; then
PASS: 29/29
[contracts] $ pnpm --dir contracts install --frozen-lockfile && pnpm --dir contracts run check
(node:21218) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
Already up to date
Done in 24ms using pnpm v11.13.0
(node:21219) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ pnpm run lint && pnpm run test[22m
(node:21266) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ spectral lint --ruleset .spectral.yaml --fail-severity error openapi/*.yaml asyncapi/*.yaml[22m
(node:21315) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

[4m/Users/mryfmo/Workspace/ai-ops-platform/contracts/asyncapi/events.v1.yaml[24m
  3:1       [33mwarning[39m  asyncapi-servers                  AsyncAPI object must have non-empty "servers" object.
  3:11  [34minformation[39m  asyncapi-latest-version           The latest version is not used. You should update to the "3.1.0" version.  asyncapi
  5:6       [33mwarning[39m  asyncapi-3-tags                   AsyncAPI document must have non-empty "tags" array.                        info
  5:6       [33mwarning[39m  asyncapi-info-contact             Info object must have "contact" object.                                    info
  5:6       [33mwarning[39m  asyncapi-info-description         Info "description" must be present and non-empty string.                   info
  5:6       [33mwarning[39m  asyncapi-info-license             Info object must have "license" object.                                    info
 20:24      [33mwarning[39m  asyncapi-3-operation-description  Operation "description" must be present and non-empty string.              operations.publishWorkflowEvent
 23:27      [33mwarning[39m  asyncapi-3-operation-description  Operation "description" must be present and non-empty string.              operations.receiveIntegrationEvent

[4m/Users/mryfmo/Workspace/ai-ops-platform/contracts/openapi/control-api.v1.yaml[24m
   5:6   [33mwarning[39m  info-contact           Info object must have "contact" object.                        info
  18:10  [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./workflows.post
  18:10  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./workflows.post
  38:9   [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./workflows/{workflowId}.get
  38:9   [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./workflows/{workflowId}.get
  50:10  [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./workflows/{workflowId}/signals/{signalName}.post
  50:10  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./workflows/{workflowId}/signals/{signalName}.post
  70:10  [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./agent-runs.post
  70:10  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./agent-runs.post
  88:10  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./m365/query.post
 103:10  [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./meetings/{meetingId}/process.post
 103:10  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./meetings/{meetingId}/process.post
  130:9  [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./health/live.get
  130:9  [33mwarning[39m  operation-operationId  Operation must have "operationId".                             paths./health/live.get
  130:9  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./health/live.get
  135:9  [33mwarning[39m  operation-description  Operation "description" must be present and non-empty string.  paths./health/ready.get
  135:9  [33mwarning[39m  operation-operationId  Operation must have "operationId".                             paths./health/ready.get
  135:9  [33mwarning[39m  operation-tags         Operation must have non-empty "tags" array.                    paths./health/ready.get
 158:22  [33mwarning[39m  oas3-unused-component  Potentially unused component has been detected.                components.schemas.VersionedPayload

[33m[1m✖ 27 problems (0 errors, 26 warnings, 1 info, 0 hints)[22m[39m
[33m[1m[22m[39m(node:21327) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node --test check-contracts.test.mjs model-routing/model-aliases.test.mjs model-routing/service-config.test.mjs mcp-gateway/gateway-config.test.mjs tools/registry-contract.test.mjs agent-task/agent-task.test.mjs agent-review/agent-review.test.mjs agent-execution/claude-profile.test.mjs agent-execution/droid-profile.test.mjs deploy-workflow/deploy-workflow.test.mjs[22m
(node:21377) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:21378) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: accepts the bounded PR-only Claude execution profile [FinalArch:COD-003]
ok 1 - accepts the bounded PR-only Claude execution profile [FinalArch:COD-003]
  ---
  duration_ms: 100.257209
  type: 'test'
  ...
# Subtest: rejects profile substitution and raised fixed ceilings [FinalArch:COD-003]
ok 2 - rejects profile substitution and raised fixed ceilings [FinalArch:COD-003]
  ---
  duration_ms: 31.141333
  type: 'test'
  ...
# Subtest: rejects floating or unverified Claude CLI artifacts [FinalArch:COD-003]
ok 3 - rejects floating or unverified Claude CLI artifacts [FinalArch:COD-003]
  ---
  duration_ms: 8.979042
  type: 'test'
  ...
# Subtest: rejects provider keys and weakened virtual-key isolation [FinalArch:COD-003]
ok 4 - rejects provider keys and weakened virtual-key isolation [FinalArch:COD-003]
  ---
  duration_ms: 6.175083
  type: 'test'
  ...
# Subtest: rejects non-PR execution and widened tool or network policy [FinalArch:COD-003]
ok 5 - rejects non-PR execution and widened tool or network policy [FinalArch:COD-003]
  ---
  duration_ms: 8.198416
  type: 'test'
  ...
# Subtest: rejects missing runtime, cost, token, turn, or evidence bounds [FinalArch:COD-003]
ok 6 - rejects missing runtime, cost, token, turn, or evidence bounds [FinalArch:COD-003]
  ---
  duration_ms: 14.293416
  type: 'test'
  ...
# (node:21379) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: accepts the pinned fail-closed Droid execution structure [FinalArch:COD-005]
ok 7 - accepts the pinned fail-closed Droid execution structure [FinalArch:COD-005]
  ---
  duration_ms: 13.313833
  type: 'test'
  ...
# Subtest: pins Droid project settings to LiteLLM and hard-blocks unsafe commands [FinalArch:COD-005]
ok 8 - pins Droid project settings to LiteLLM and hard-blocks unsafe commands [FinalArch:COD-005]
  ---
  duration_ms: 4.307125
  type: 'test'
  ...
# Subtest: rejects floating, altered, or unverified Droid CLI artifacts [FinalArch:COD-005]
ok 9 - rejects floating, altered, or unverified Droid CLI artifacts [FinalArch:COD-005]
  ---
  duration_ms: 10.6085
  type: 'test'
  ...
# Subtest: requires the unconditional pre-invocation activation stop [FinalArch:COD-005]
ok 10 - requires the unconditional pre-invocation activation stop [FinalArch:COD-005]
  ---
  duration_ms: 15.442209
  type: 'test'
  ...
# Subtest: rejects provider keys and weakened LiteLLM virtual-key routing [FinalArch:COD-005]
ok 11 - rejects provider keys and weakened LiteLLM virtual-key routing [FinalArch:COD-005]
  ---
  duration_ms: 8.623833
  type: 'test'
  ...
# Subtest: rejects non-agent branches and weakened tool, network, or deploy policy [FinalArch:COD-005]
ok 12 - rejects non-agent branches and weakened tool, network, or deploy policy [FinalArch:COD-005]
  ---
  duration_ms: 6.797375
  type: 'test'
  ...
# Subtest: rejects missing runtime, cost, token, turn, or evidence bounds [FinalArch:COD-005]
ok 13 - rejects missing runtime, cost, token, turn, or evidence bounds [FinalArch:COD-005]
  ---
  duration_ms: 21.38
  type: 'test'
  ...
# (node:21380) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: independent review artifact contract [FinalArch:FR-AGT-005 / FinalArch:COD-006]
    # Subtest: accepts structured findings that match the manifest reviewer and profile
    ok 1 - accepts structured findings that match the manifest reviewer and profile
      ---
      duration_ms: 588.017292
      type: 'test'
      ...
    # Subtest: accepts the shared lowercase UUID task_id shape and rejects malformed variants
    ok 2 - accepts the shared lowercase UUID task_id shape and rejects malformed variants
      ---
      duration_ms: 1053.051916
      type: 'test'
      ...
    # Subtest: rejects missing finding fields and reviewer or profile substitution
    ok 3 - rejects missing finding fields and reviewer or profile substitution
      ---
      duration_ms: 3635.503959
      type: 'test'
      ...
    # Subtest: rejects incomplete dimensions and collection evidence inconsistent with the diff
    ok 4 - rejects incomplete dimensions and collection evidence inconsistent with the diff
      ---
      duration_ms: 908.819459
      type: 'test'
      ...
    1..4
ok 14 - independent review artifact contract [FinalArch:FR-AGT-005 / FinalArch:COD-006]
  ---
  duration_ms: 6185.965166
  type: 'suite'
  ...
# Subtest: review workflow security [FinalArch:COD-006]
    # Subtest: allows only a read-only token and a credential-free, data-only target checkout
    ok 1 - allows only a read-only token and a credential-free, data-only target checkout
      ---
      duration_ms: 0.722625
      type: 'test'
      ...
    # Subtest: requires the manifest digest dispatch authority to reach the trusted collector unchanged
    ok 2 - requires the manifest digest dispatch authority to reach the trusted collector unchanged
      ---
      duration_ms: 0.223041
      type: 'test'
      ...
    # Subtest: rejects write scope, persisted checkout credentials, and branch mutation
    ok 3 - rejects write scope, persisted checkout credentials, and branch mutation
      ---
      duration_ms: 0.553292
      type: 'test'
      ...
    1..3
ok 15 - review workflow security [FinalArch:COD-006]
  ---
  duration_ms: 1.829875
  type: 'suite'
  ...
# Subtest: mechanical review collection [FinalArch:FR-AGT-005]
    # Subtest: rejects abbreviated revisions and manifest path traversal before diff collection
    ok 1 - rejects abbreviated revisions and manifest path traversal before diff collection
      ---
      duration_ms: 54.19925
      type: 'test'
      ...
    # Subtest: collects diff/spec/security evidence and reports forbidden paths without executing target code
    ok 2 - collects diff/spec/security evidence and reports forbidden paths without executing target code
      ---
      duration_ms: 1053.731334
      type: 'test'
      ...
    1..2
ok 16 - mechanical review collection [FinalArch:FR-AGT-005]
  ---
  duration_ms: 1108.14925
  type: 'suite'
  ...
# (node:21381) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: agent task manifest contract [FinalArch:FR-AGT-001..006]
    # Subtest: accepts a bounded, PR-only, callback-complete manifest
    ok 1 - accepts a bounded, PR-only, callback-complete manifest
      ---
      duration_ms: 1.427208
      type: 'test'
      ...
    # Subtest: accepts the exact lowercase UUID shape used by production coding_tasks without widening arbitrary labels
    ok 2 - accepts the exact lowercase UUID shape used by production coding_tasks without widening arbitrary labels
      ---
      duration_ms: 1.423834
      type: 'test'
      ...
    # Subtest: rejects writer==reviewer, unknown roles, and malformed profile labels
    ok 3 - rejects writer==reviewer, unknown roles, and malformed profile labels
      ---
      duration_ms: 0.467958
      type: 'test'
      ...
    # Subtest: rejects overlapping allowed/forbidden scopes and malformed path globs
    ok 4 - rejects overlapping allowed/forbidden scopes and malformed path globs
      ---
      duration_ms: 0.894458
      type: 'test'
      ...
    # Subtest: rejects missing and non-positive budget limits
    ok 5 - rejects missing and non-positive budget limits
      ---
      duration_ms: 0.501584
      type: 'test'
      ...
    # Subtest: rejects a branch for another task and incomplete callback evidence
    ok 6 - rejects a branch for another task and incomplete callback evidence
      ---
      duration_ms: 0.340542
      type: 'test'
      ...
    # Subtest: rejects unpinned runners and master/provider key or production-network access
    ok 7 - rejects unpinned runners and master/provider key or production-network access
      ---
      duration_ms: 0.42075
      type: 'test'
      ...
    1..7
ok 17 - agent task manifest contract [FinalArch:FR-AGT-001..006]
  ---
  duration_ms: 6.021125
  type: 'suite'
  ...
# Subtest: One Writer overlap gate [FinalArch:COD-003]
    # Subtest: rejects concurrent writers whose allowed path scopes intersect
    ok 1 - rejects concurrent writers whose allowed path scopes intersect
      ---
      duration_ms: 0.704916
      type: 'test'
      ...
    # Subtest: rejects duplicate task or branch claims even when paths are disjoint
    ok 2 - rejects duplicate task or branch claims even when paths are disjoint
      ---
      duration_ms: 0.416125
      type: 'test'
      ...
    # Subtest: accepts pairwise-disjoint concurrent assignments
    ok 3 - accepts pairwise-disjoint concurrent assignments
      ---
      duration_ms: 0.339917
      type: 'test'
      ...
    1..3
ok 18 - One Writer overlap gate [FinalArch:COD-003]
  ---
  duration_ms: 1.70225
  type: 'suite'
  ...
# Subtest: dependency-free schema subset gate [FinalArch:COD-004]
    # Subtest: enforces $ref siblings and rejects unsupported keyword forms
    ok 1 - enforces $ref siblings and rejects unsupported keyword forms
      ---
      duration_ms: 0.155208
      type: 'test'
      ...
    1..1
ok 19 - dependency-free schema subset gate [FinalArch:COD-004]
  ---
  duration_ms: 0.185959
  type: 'suite'
  ...
# (node:21382) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: versioned contract validation [FinalArch:CON-001, FinalArch:CON-002, FinalArch:CON-004, FinalArch:CON-005]
    # Subtest: validates provenance, refs, runtime parity, and the stored baseline [FinalArch:CON-001, FinalArch:CON-002]
    ok 1 - validates provenance, refs, runtime parity, and the stored baseline [FinalArch:CON-001, FinalArch:CON-002]
      ---
      duration_ms: 3279.309875
      type: 'test'
      ...
    # Subtest: rejects a removed OpenAPI operation [FinalArch:CON-001]
    ok 2 - rejects a removed OpenAPI operation [FinalArch:CON-001]
      ---
      duration_ms: 0.665416
      type: 'test'
      ...
    # Subtest: rejects newly required fields and removed enum values [FinalArch:CON-002, FinalArch:CON-004]
    ok 3 - rejects newly required fields and removed enum values [FinalArch:CON-002, FinalArch:CON-004]
      ---
      duration_ms: 0.9205
      type: 'test'
      ...
    # Subtest: rejects a newly required OpenAPI parameter [FinalArch:CON-001]
    ok 4 - rejects a newly required OpenAPI parameter [FinalArch:CON-001]
      ---
      duration_ms: 0.630375
      type: 'test'
      ...
    # Subtest: rejects protocol scalar and constraint-array changes [FinalArch:CON-001, FinalArch:CON-002]
    ok 5 - rejects protocol scalar and constraint-array changes [FinalArch:CON-001, FinalArch:CON-002]
      ---
      duration_ms: 2.051333
      type: 'test'
      ...
    # Subtest: preserves required event fields for N-1 consumers [FinalArch:CON-002]
    ok 6 - preserves required event fields for N-1 consumers [FinalArch:CON-002]
      ---
      duration_ms: 0.377417
      type: 'test'
      ...
    # Subtest: rejects less-common tightened JSON Schema constraints [FinalArch:CON-004]
    ok 7 - rejects less-common tightened JSON Schema constraints [FinalArch:CON-004]
      ---
      duration_ms: 1.057959
      type: 'test'
      ...
    # Subtest: rejects unknown and oversized policy input [FinalArch:CON-004]
    ok 8 - rejects unknown and oversized policy input [FinalArch:CON-004]
      ---
      duration_ms: 2902.738042
      type: 'test'
      ...
    # Subtest: rejects malformed Draft 2020-12 schemas [FinalArch:CON-001, FinalArch:CON-004]
    ok 9 - rejects malformed Draft 2020-12 schemas [FinalArch:CON-001, FinalArch:CON-004]
      ---
      duration_ms: 441.569542
      type: 'test'
      ...
    # Subtest: allows an optional additive field [FinalArch:CON-001]
    ok 10 - allows an optional additive field [FinalArch:CON-001]
      ---
      duration_ms: 0.512375
      type: 'test'
      ...
    1..10
ok 20 - versioned contract validation [FinalArch:CON-001, FinalArch:CON-002, FinalArch:CON-004, FinalArch:CON-005]
  ---
  duration_ms: 6630.637791
  type: 'suite'
  ...
# (node:21383) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: P10-T05 build provenance workflow [FinalArch:PRD-010 / REL-003]
    # Subtest: accepts the canonical OIDC-only digest, SBOM, signature, and provenance workflow
    ok 1 - accepts the canonical OIDC-only digest, SBOM, signature, and provenance workflow
      ---
      duration_ms: 1.022875
      type: 'test'
      ...
    # Subtest: rejects floating actions, mutable tags, arbitrary build paths, and long-lived AWS credentials
    ok 2 - rejects floating actions, mutable tags, arbitrary build paths, and long-lived AWS credentials
      ---
      duration_ms: 0.68925
      type: 'test'
      ...
    # Subtest: rejects missing OIDC, tag-scanned SBOM, or provenance detached from the build digest
    ok 3 - rejects missing OIDC, tag-scanned SBOM, or provenance detached from the build digest
      ---
      duration_ms: 0.361625
      type: 'test'
      ...
    1..3
ok 21 - P10-T05 build provenance workflow [FinalArch:PRD-010 / REL-003]
  ---
  duration_ms: 2.545208
  type: 'suite'
  ...
# Subtest: P10-T05 staged rollout workflow [FinalArch:FR-OBS-005 / REL-003]
    # Subtest: accepts digest-only staging and one approved production job with ordered fail-closed gates
    ok 1 - accepts digest-only staging and one approved production job with ordered fail-closed gates
      ---
      duration_ms: 0.333791
      type: 'test'
      ...
    # Subtest: rejects tag deploys, missing Environment approval, and missing OIDC
    ok 2 - rejects tag deploys, missing Environment approval, and missing OIDC
      ---
      duration_ms: 0.289833
      type: 'test'
      ...
    # Subtest: rejects skipped or reordered 0/10/50/100 gates and non-failure rollback
    ok 3 - rejects skipped or reordered 0/10/50/100 gates and non-failure rollback
      ---
      duration_ms: 0.506459
      type: 'test'
      ...
    # Subtest: rejects unpinned actions and every long-lived AWS credential reference
    ok 4 - rejects unpinned actions and every long-lived AWS credential reference
      ---
      duration_ms: 0.297041
      type: 'test'
      ...
    1..4
ok 22 - P10-T05 staged rollout workflow [FinalArch:FR-OBS-005 / REL-003]
  ---
  duration_ms: 1.779375
  type: 'suite'
  ...
# Subtest: P10-T05 ECS release guard [FinalArch:FR-OBS-005 / REL-003]
    # Subtest: rejects a mutable image before invoking AWS
    ok 1 - rejects a mutable image before invoking AWS
      ---
      duration_ms: 24.51475
      type: 'test'
      ...
    # Subtest: continues the single pre-traffic pause once and requires terminal rollback
    ok 2 - continues the single pre-traffic pause once and requires terminal rollback
      ---
      duration_ms: 0.906917
      type: 'test'
      ...
    1..2
ok 23 - P10-T05 ECS release guard [FinalArch:FR-OBS-005 / REL-003]
  ---
  duration_ms: 26.230166
  type: 'suite'
  ...
# (node:21384) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: agentgateway MCP/A2A-only config [FinalArch:MCP-001]
    # Subtest: accepts the governed MCP/A2A-only configuration [FinalArch:MCP-001]
    ok 1 - accepts the governed MCP/A2A-only configuration [FinalArch:MCP-001]
      ---
      duration_ms: 9.962667
      type: 'test'
      ...
    # Subtest: rejects broad authorization rules — only the deny-all sentinel is allowed (P4-T01-001) [FinalArch:MCP-001]
    ok 2 - rejects broad authorization rules — only the deny-all sentinel is allowed (P4-T01-001) [FinalArch:MCP-001]
      ---
      duration_ms: 16.743166
      type: 'test'
      ...
    # Subtest: rejects LLM surfaces including generic host-backend routes (P4-T01-002 / ADR-0023) [FinalArch:MCP-001]
    ok 3 - rejects LLM surfaces including generic host-backend routes (P4-T01-002 / ADR-0023) [FinalArch:MCP-001]
      ---
      duration_ms: 23.069917
      type: 'test'
      ...
    # Subtest: rejects a management UI attachment and admin re-enablement (P4-T01-002) [FinalArch:MCP-001]
    ok 4 - rejects a management UI attachment and admin re-enablement (P4-T01-002) [FinalArch:MCP-001]
      ---
      duration_ms: 3.203958
      type: 'test'
      ...
    # Subtest: pins the JWT identity: issuer, audience, file-only JWKS, shared across surfaces (P4-T01-003) [FinalArch:MCP-001]
    ok 5 - pins the JWT identity: issuer, audience, file-only JWKS, shared across surfaces (P4-T01-003) [FinalArch:MCP-001]
      ---
      duration_ms: 14.598333
      type: 'test'
      ...
    # Subtest: pins the A2A marker: backend-free, /a2a only, 503 (P4-T01-002) [FinalArch:MCP-001]
    ok 6 - pins the A2A marker: backend-free, /a2a only, 503 (P4-T01-002) [FinalArch:MCP-001]
      ---
      duration_ms: 4.809916
      type: 'test'
      ...
    # Subtest: pins operational values: OTLP sink, ports, A2A body, deployment consistency (P4-T01-007) [FinalArch:MCP-001]
    ok 7 - pins operational values: OTLP sink, ports, A2A body, deployment consistency (P4-T01-007) [FinalArch:MCP-001]
      ---
      duration_ms: 10.712375
      type: 'test'
      ...
    # Subtest: rejects an unpinned or drifted image and weakened posture [FinalArch:MCP-001]
    ok 8 - rejects an unpinned or drifted image and weakened posture [FinalArch:MCP-001]
      ---
      duration_ms: 4.492792
      type: 'test'
      ...
    1..8
ok 24 - agentgateway MCP/A2A-only config [FinalArch:MCP-001]
  ---
  duration_ms: 88.332666
  type: 'suite'
  ...
# Subtest: agentgateway smoke fixture equivalence (P4-T01-001) [FinalArch:MCP-001]
    # Subtest: accepts the checked-in fixture (governed config + exactly one synthetic target)
    ok 1 - accepts the checked-in fixture (governed config + exactly one synthetic target)
      ---
      duration_ms: 1.53275
      type: 'test'
      ...
    # Subtest: rejects a fixture that weakens authorization or auth relative to the governed config
    ok 2 - rejects a fixture that weakens authorization or auth relative to the governed config
      ---
      duration_ms: 8.370458
      type: 'test'
      ...
    # Subtest: rejects endpoint drift toward a decoy target (P4-T01-006)
    ok 3 - rejects endpoint drift toward a decoy target (P4-T01-006)
      ---
      duration_ms: 4.949334
      type: 'test'
      ...
    1..3
ok 25 - agentgateway smoke fixture equivalence (P4-T01-001) [FinalArch:MCP-001]
  ---
  duration_ms: 15.019875
  type: 'suite'
  ...
# (node:21385) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: model alias manifest [FinalArch:LLM-002]
    # Subtest: matches the canonical routing contract and LiteLLM config shape [FinalArch:LLM-002]
    ok 1 - matches the canonical routing contract and LiteLLM config shape [FinalArch:LLM-002]
      ---
      duration_ms: 595.699042
      type: 'test'
      ...
    # Subtest: rejects an application-visible raw provider model ID [FinalArch:LLM-002]
    ok 2 - rejects an application-visible raw provider model ID [FinalArch:LLM-002]
      ---
      duration_ms: 543.846625
      type: 'test'
      ...
    # Subtest: rejects a fallback without preserved data classifications [FinalArch:LLM-002]
    ok 3 - rejects a fallback without preserved data classifications [FinalArch:LLM-002]
      ---
      duration_ms: 506.333333
      type: 'test'
      ...
    # Subtest: fails closed for an unknown fallback error [FinalArch:LLM-002]
    ok 4 - fails closed for an unknown fallback error [FinalArch:LLM-002]
      ---
      duration_ms: 491.735375
      type: 'test'
      ...
    # Subtest: rejects an unguarded native LiteLLM fallback [FinalArch:LLM-002]
    ok 5 - rejects an unguarded native LiteLLM fallback [FinalArch:LLM-002]
      ---
      duration_ms: 450.572459
      type: 'test'
      ...
    # Subtest: rejects classification drift between a source alias and its fallback binding [FinalArch:LLM-002]
    ok 6 - rejects classification drift between a source alias and its fallback binding [FinalArch:LLM-002]
      ---
      duration_ms: 448.790917
      type: 'test'
      ...
    1..6
ok 26 - model alias manifest [FinalArch:LLM-002]
  ---
  duration_ms: 3037.795584
  type: 'suite'
  ...
# (node:21651) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: LiteLLM service config [FinalArch:LLM-001][FinalArch:LLM-003]
    # Subtest: accepts the inference-only proxy configuration [FinalArch:LLM-001]
    ok 1 - accepts the inference-only proxy configuration [FinalArch:LLM-001]
      ---
      duration_ms: 25.511292
      type: 'test'
      ...
    # Subtest: rejects a route allowlist that opens passthrough/MCP/A2A surfaces [FinalArch:LLM-001]
    ok 2 - rejects a route allowlist that opens passthrough/MCP/A2A surfaces [FinalArch:LLM-001]
      ---
      duration_ms: 2.390459
      type: 'test'
      ...
    # Subtest: rejects an undeclared or unbound runtime route boundary [FinalArch:LLM-001]
    ok 3 - rejects an undeclared or unbound runtime route boundary [FinalArch:LLM-001]
      ---
      duration_ms: 5.234917
      type: 'test'
      ...
    # Subtest: binds the image pins to the license register [FinalArch:LLM-001]
    ok 4 - binds the image pins to the license register [FinalArch:LLM-001]
      ---
      duration_ms: 3.257709
      type: 'test'
      ...
    # Subtest: rejects deploying the enterprise-bundling base image directly [FinalArch:LLM-003]
    ok 5 - rejects deploying the enterprise-bundling base image directly [FinalArch:LLM-003]
      ---
      duration_ms: 2.4005
      type: 'test'
      ...
    # Subtest: rejects enabled telemetry [FinalArch:LLM-001]
    ok 6 - rejects enabled telemetry [FinalArch:LLM-001]
      ---
      duration_ms: 2.797625
      type: 'test'
      ...
    # Subtest: rejects every enterprise path reference [FinalArch:LLM-003]
    ok 7 - rejects every enterprise path reference [FinalArch:LLM-003]
      ---
      duration_ms: 11.066417
      type: 'test'
      ...
    # Subtest: rejects an enterprise env reference [FinalArch:LLM-003]
    ok 8 - rejects an enterprise env reference [FinalArch:LLM-003]
      ---
      duration_ms: 2.391375
      type: 'test'
      ...
    # Subtest: rejects MCP gateway config surface [FinalArch:LLM-001]
    ok 9 - rejects MCP gateway config surface [FinalArch:LLM-001]
      ---
      duration_ms: 1.796917
      type: 'test'
      ...
    # Subtest: rejects A2A agents config surface [FinalArch:LLM-001]
    ok 10 - rejects A2A agents config surface [FinalArch:LLM-001]
      ---
      duration_ms: 5.037541
      type: 'test'
      ...
    # Subtest: rejects DB-backed object loading left at the v1.96.2 default [FinalArch:LLM-001]
    ok 11 - rejects DB-backed object loading left at the v1.96.2 default [FinalArch:LLM-001]
      ---
      duration_ms: 2.492625
      type: 'test'
      ...
    # Subtest: rejects the ANTHROPIC_API_KEY passthrough fallback in the env contract [FinalArch:LLM-003]
    ok 12 - rejects the ANTHROPIC_API_KEY passthrough fallback in the env contract [FinalArch:LLM-003]
      ---
      duration_ms: 5.133791
      type: 'test'
      ...
    # Subtest: rejects a literal master key [FinalArch:LLM-003]
    ok 13 - rejects a literal master key [FinalArch:LLM-003]
      ---
      duration_ms: 0.980709
      type: 'test'
      ...
    # Subtest: rejects re-enabled native fallbacks [FinalArch:LLM-001]
    ok 14 - rejects re-enabled native fallbacks [FinalArch:LLM-001]
      ---
      duration_ms: 2.598208
      type: 'test'
      ...
    # Subtest: rejects a public endpoint declaration [FinalArch:LLM-001]
    ok 15 - rejects a public endpoint declaration [FinalArch:LLM-001]
      ---
      duration_ms: 1.054583
      type: 'test'
      ...
    1..15
ok 27 - LiteLLM service config [FinalArch:LLM-001][FinalArch:LLM-003]
  ---
  duration_ms: 75.096167
  type: 'suite'
  ...
# (node:21750) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: MCP registry contract gate [FinalArch:MCP-001][FinalArch:MCP-004]
    # Subtest: pins the normalized schema hash and validates the disabled canonical registry [FinalArch:MCP-001]
    ok 1 - pins the normalized schema hash and validates the disabled canonical registry [FinalArch:MCP-001]
      ---
      duration_ms: 506.453792
      type: 'test'
      ...
    # Subtest: rejects unapproved schema drift and enabled entries without endpoints [FinalArch:MCP-001]
    ok 2 - rejects unapproved schema drift and enabled entries without endpoints [FinalArch:MCP-001]
      ---
      duration_ms: 531.97875
      type: 'test'
      ...
    # Subtest: matches the governed config and the enabled-mixed golden output byte-for-byte [FinalArch:MCP-001]
    ok 3 - matches the governed config and the enabled-mixed golden output byte-for-byte [FinalArch:MCP-001]
      ---
      duration_ms: 402.857208
      type: 'test'
      ...
    # Subtest: rejects hand-edited generated config and high-risk registry operations [FinalArch:MCP-004]
    ok 4 - rejects hand-edited generated config and high-risk registry operations [FinalArch:MCP-004]
      ---
      duration_ms: 336.534042
      type: 'test'
      ...
    1..4
ok 28 - MCP registry contract gate [FinalArch:MCP-001][FinalArch:MCP-004]
  ---
  duration_ms: 1778.452084
  type: 'suite'
  ...
1..28
# tests 88
# suites 15
# pass 88
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7457.663458
[audit] $ pnpm audit --prod --audit-level high
(node:22481) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[31m2[39m vulnerabilities found
Severity: [1m[33m2 moderate[39m[22m
[actionlint] $ actionlint -shellcheck= -pyflakes= .github/workflows/*.yml
[lint] $ pnpm -r --if-present run lint
(node:22487) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
Scope: 10 of 11 workspace projects
[36mpackages/channel-teams[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[35mpackages/policy[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[34mpackages/shared[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[33mpackages/traceability[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[34mpackages/shared[39m [96mlint[39m: [90m(node:22627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/shared[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/traceability[39m [96mlint[39m: [90m(node:22673) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/traceability[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/channel-teams[39m [96mlint[39m: [90m(node:22535) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/channel-teams[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/policy[39m [96mlint[39m: [90m(node:22581) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/policy[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/policy[39m [96mlint[39m: Done
[36mpackages/channel-teams[39m [96mlint[39m: Done
[33mpackages/traceability[39m [96mlint[39m: Done
[34mpackages/shared[39m [96mlint[39m: Done
[32mpackages/control-plane[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[31mpackages/devops[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[36mpackages/prjops[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[35mpackages/integrations[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[36mpackages/prjops[39m [96mlint[39m: [90m(node:22839) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/prjops[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/devops[39m [96mlint[39m: [90m(node:22793) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/devops[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/integrations[39m [96mlint[39m: [90m(node:22885) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/integrations[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/control-plane[39m [96mlint[39m: [90m(node:22747) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/control-plane[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/integrations[39m [96mlint[39m: Done
[31mpackages/devops[39m [96mlint[39m: Done
[36mpackages/prjops[39m [96mlint[39m: Done
[32mpackages/control-plane[39m [96mlint[39m: Done
[34mpackages/server[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[33mpackages/web[39m [96mlint[39m$ eslint . --config ../../eslint.config.mjs
[34mpackages/server[39m [96mlint[39m: [90m(node:23000) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/server[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mlint[39m: [90m(node:22954) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mlint[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mlint[39m: Done
[34mpackages/server[39m [96mlint[39m: Done
[traceability] $ pnpm exec tsx packages/traceability/src/verifyTraceability.ts
(node:23013) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
(node:23014) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
# トレーサビリティ検証結果

生成日時: 2026-08-29T22:22:31.791Z

凡例: 「source参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。
「テスト参照あり」= `packages/*/tests` 配下のテストコードにIDが1回以上出現。
注記: 参照の存在は構文上の接続だけを示し、要件の振る舞いを検証した証明ではありません。
ISS/TOBE/ASMは文書間トレーサビリティの記録用IDであり、実装コードへの直接参照を必須としない（参考値）。

## PrjOps

| カテゴリ   | 総数 | source参照あり | テスト参照あり | source参照なし                                                                                                                                                                            |
| ---------- | ---- | -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ        | 35   | 35 (100%)      | 27 (77%)       | —                                                                                                                                                                                         |
| SPEC-EXT   | 27   | 22 (81%)       | 7 (26%)        | PrjOps:SPEC-EXT-001, PrjOps:SPEC-EXT-002, PrjOps:SPEC-EXT-022, PrjOps:SPEC-EXT-028, PrjOps:SPEC-EXT-031                                                                                   |
| SPEC-INT   | 31   | 31 (100%)      | 26 (84%)       | —                                                                                                                                                                                         |
| AC         | 39   | 28 (72%)       | 29 (74%)       | PrjOps:AC-001-2, PrjOps:AC-002-2, PrjOps:AC-003-1, PrjOps:AC-003-2, PrjOps:AC-003-3, PrjOps:AC-004-1, PrjOps:AC-005-3, PrjOps:AC-006-1, PrjOps:AC-006-2, PrjOps:AC-020-2, PrjOps:AC-036-1 |
| ISS(参考)  | 10   | 1 (10%)        | 1 (10%)        | PrjOps:ISS-002, PrjOps:ISS-003, PrjOps:ISS-004, PrjOps:ISS-005, PrjOps:ISS-006, PrjOps:ISS-007, PrjOps:ISS-008, PrjOps:ISS-009, PrjOps:ISS-010                                            |
| TOBE(参考) | 10   | 2 (20%)        | 0 (0%)         | PrjOps:TOBE-02, PrjOps:TOBE-03, PrjOps:TOBE-04, PrjOps:TOBE-05, PrjOps:TOBE-06, PrjOps:TOBE-07, PrjOps:TOBE-08, PrjOps:TOBE-09                                                            |
| ASM(参考)  | 7    | 4 (57%)        | 3 (43%)        | PrjOps:ASM-001, PrjOps:ASM-005, PrjOps:ASM-007                                                                                                                                            |

## DevOps

| カテゴリ  | 総数 | source参照あり | テスト参照あり | source参照なし                                                                                                                                                                                                                                 |
| --------- | ---- | -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ       | 27   | 27 (100%)      | 18 (67%)       | —                                                                                                                                                                                                                                              |
| SPEC-EXT  | 25   | 18 (72%)       | 7 (28%)        | DevOps:SPEC-EXT-002, DevOps:SPEC-EXT-003, DevOps:SPEC-EXT-011, DevOps:SPEC-EXT-012, DevOps:SPEC-EXT-031, DevOps:SPEC-EXT-032, DevOps:SPEC-EXT-044                                                                                              |
| SPEC-INT  | 31   | 31 (100%)      | 20 (65%)       | —                                                                                                                                                                                                                                              |
| TH        | 7    | 7 (100%)       | 7 (100%)       | —                                                                                                                                                                                                                                              |
| AC        | 45   | 30 (67%)       | 22 (49%)       | DevOps:AC-001a, DevOps:AC-001b, DevOps:AC-010b, DevOps:AC-015a, DevOps:AC-015b, DevOps:AC-016a, DevOps:AC-016b, DevOps:AC-018c, DevOps:AC-019a, DevOps:AC-020a, DevOps:AC-021a, DevOps:AC-022a, DevOps:AC-027a, DevOps:AC-029a, DevOps:AC-030a |
| ISS(参考) | 8    | 0 (0%)         | 0 (0%)         | DevOps:ISS-01, DevOps:ISS-02, DevOps:ISS-03, DevOps:ISS-04, DevOps:ISS-05, DevOps:ISS-06, DevOps:ISS-07, DevOps:ISS-08                                                                                                                         |

## Implementation Dispositions

この表はsource参照の存在と要件完了を分離する。`partial`は未完了、`superseded`は原仕様を置換済みだが保持義務の完了を意味せず、greenの完成証明ではない。

| ID                  | 状態       | 置換先                                               | 実装済み範囲                                                                                                                | 未完了・保持義務                                                                                                                                                                 | 根拠                                                                                                                                             | Owner             |
| ------------------- | ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| PrjOps:REQ-011      | partial    | —                                                    | PRF-01本人のアクション期限順・参加プロジェクト色表示<br>参加プロジェクトと本人課題の取得側フィルタ                          | 正本データからの受信者別生成とAGT-07検証・配信の本番結線<br>月曜08:00 JST境界とN受信者N成果物の統合検証                                                                          | docs/spec/prjops/03_PRD.md<br>docs/audit/09-remediation-plan.md                                                                                  | T-P0-11           |
| PrjOps:REQ-030      | partial    | —                                                    | 外部I/Oなしの100案件・2,000受信者 分析→個別生成→AGT-07検証baseline                                                          | 正本取得・受信者解決・全profile・永続化を含む本番同等経路の測定<br>代表環境のcommit SHA・開始終了時刻・失敗0件の証跡                                                             | docs/spec/prjops/03_PRD.md<br>docs/audit/09-remediation-plan.md                                                                                  | P010-F06-T17      |
| PrjOps:SPEC-INT-010 | superseded | ADR-0001<br>DEC-SPEC-001<br>DEC-SPEC-004<br>ADR-0014 | prjops-systemをai-ops-platform monorepoのpackages/prjopsへ置換<br>prjops-dataとreport archiveを注入可能な論理境界として分離 | private prjops-data repositoryとmachine account/PRF-03書込制御<br>immutable 40-character SHAでのproduction読込と環境証跡<br>PostgreSQL/LTR archiveのretention・権限・restore証跡 | docs/spec/prjops/05_内部仕様書.md<br>docs/adr/0001-monorepo.md<br>docs/adr/0014-integration-delivery.md<br>docs/spec/productization-decisions.md | P010-F02-T01..T14 |

## Traceability Guards

- 根拠ヘッダ不足: —
- 存在しないADR参照: —
- 名前空間参照不正: —
- 仕様IDインデックス不正: —
- disposition不正: —
- 仕様IDカタログ不正: —
- 設定変数インベントリ不整合: —


OK: 仕様IDカタログが完全で、全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。
(node:23020) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
[format] $ pnpm run format
(node:23025) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ prettier --check .[22m
(node:23074) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
Checking formatting...
All matched files use Prettier code style!
[build] $ pnpm -r --if-present run build
(node:23093) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
Scope: 10 of 11 workspace projects
[36mpackages/channel-teams[39m [96mbuild[39m$ tsc -p tsconfig.json
[35mpackages/policy[39m [96mbuild[39m$ tsc -p tsconfig.json
[34mpackages/shared[39m [96mbuild[39m$ tsc -p tsconfig.json
[33mpackages/traceability[39m [96mbuild[39m$ tsc -p tsconfig.json
[35mpackages/policy[39m [96mbuild[39m: Done
[36mpackages/channel-teams[39m [96mbuild[39m: Done
[33mpackages/traceability[39m [96mbuild[39m: Done
[34mpackages/shared[39m [96mbuild[39m: Done
[32mpackages/control-plane[39m [96mbuild[39m$ tsc -p tsconfig.json
[31mpackages/devops[39m [96mbuild[39m$ tsc -p tsconfig.json
[36mpackages/prjops[39m [96mbuild[39m$ tsc -p tsconfig.json
[35mpackages/integrations[39m [96mbuild[39m$ tsc -p tsconfig.json
[35mpackages/integrations[39m [96mbuild[39m: Done
[31mpackages/devops[39m [96mbuild[39m: Done
[36mpackages/prjops[39m [96mbuild[39m: Done
[32mpackages/control-plane[39m [96mbuild[39m: Done
[34mpackages/server[39m [96mbuild[39m$ tsc -p tsconfig.json
[33mpackages/web[39m [96mbuild[39m$ next build
[33mpackages/web[39m [96mbuild[39m: ▲ Next.js 16.3.0 (Turbopack)
[33mpackages/web[39m [96mbuild[39m: [90m(node:23615) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: ✓ Running next.config.mjs took 15ms
[33mpackages/web[39m [96mbuild[39m:   Creating an optimized production build ...
[33mpackages/web[39m [96mbuild[39m: [90m(node:23615) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/server[39m [96mbuild[39m: Done
[33mpackages/web[39m [96mbuild[39m: ✓ Compiled successfully in 3.3s
[33mpackages/web[39m [96mbuild[39m:   Running TypeScript ...
[33mpackages/web[39m [96mbuild[39m:   Finished TypeScript in 2.6s ...
[33mpackages/web[39m [96mbuild[39m:   Collecting page data using 7 workers ...
[33mpackages/web[39m [96mbuild[39m: [90m(node:23657) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: [90m(node:23662) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: [90m(node:23658) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: [90m(node:23656) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: [90m(node:23661) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: [90m(node:23659) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m: [90m(node:23660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/web[39m [96mbuild[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/web[39m [96mbuild[39m:   Generating static pages using 7 workers (0/8) ...
[33mpackages/web[39m [96mbuild[39m:   Generating static pages using 7 workers (2/8) 
[33mpackages/web[39m [96mbuild[39m:   Generating static pages using 7 workers (4/8) 
[33mpackages/web[39m [96mbuild[39m:   Generating static pages using 7 workers (6/8) 
[33mpackages/web[39m [96mbuild[39m: ✓ Generating static pages using 7 workers (8/8) in 326ms
[33mpackages/web[39m [96mbuild[39m:   Finalizing page optimization ...
[33mpackages/web[39m [96mbuild[39m: Route (app)
[33mpackages/web[39m [96mbuild[39m: ┌ ○ /
[33mpackages/web[39m [96mbuild[39m: ├ ○ /_not-found
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/approvals
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/approvals/[approvalId]
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/auth/[...nextauth]
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/chat
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/data/agent-activity
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/data/executive-summary
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/data/investor-summary
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/data/manager-summary
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/data/projects
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/data/timeseries
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/health
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/mcp-ops
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/mcp-ops/invocations/[invocationId]
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/persona
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/workbench/workspaces/[workspaceId]
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/xlsx-import
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /api/xlsx-import/template
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /approvals
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /dashboard
[33mpackages/web[39m [96mbuild[39m: ├ ƒ /dashboard/mcp-ops
[33mpackages/web[39m [96mbuild[39m: ├ ○ /dashboard/xlsx-import
[33mpackages/web[39m [96mbuild[39m: └ ○ /login
[33mpackages/web[39m [96mbuild[39m: ƒ Proxy (Middleware)
[33mpackages/web[39m [96mbuild[39m: ○  (Static)   prerendered as static content
[33mpackages/web[39m [96mbuild[39m: ƒ  (Dynamic)  server-rendered on demand
[33mpackages/web[39m [96mbuild[39m: Done
[typecheck] $ pnpm -r --if-present run typecheck
(node:23672) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
Scope: 10 of 11 workspace projects
[36mpackages/channel-teams[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[35mpackages/policy[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[34mpackages/shared[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[33mpackages/traceability[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[36mpackages/channel-teams[39m [96mtypecheck[39m: Done
[35mpackages/policy[39m [96mtypecheck[39m: Done
[33mpackages/traceability[39m [96mtypecheck[39m: Done
[34mpackages/shared[39m [96mtypecheck[39m: Done
[32mpackages/control-plane[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[31mpackages/devops[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[36mpackages/integrations[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[35mpackages/prjops[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[36mpackages/integrations[39m [96mtypecheck[39m: Done
[31mpackages/devops[39m [96mtypecheck[39m: Done
[35mpackages/prjops[39m [96mtypecheck[39m: Done
[32mpackages/control-plane[39m [96mtypecheck[39m: Done
[34mpackages/server[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[33mpackages/web[39m [96mtypecheck[39m$ tsc -p tsconfig.json --noEmit
[33mpackages/web[39m [96mtypecheck[39m: Done
[34mpackages/server[39m [96mtypecheck[39m: Done
[test:coverage] $ pnpm -r --if-present run test:coverage
(node:24192) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
Scope: 10 of 11 workspace projects
[36mpackages/channel-teams[39m [96mtest:coverage[39m$ vitest run --coverage
[35mpackages/shared[39m [96mtest:coverage[39m$ vitest run --coverage
[34mpackages/traceability[39m [96mtest:coverage[39m$ vitest run --coverage
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(node:24241) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24287) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/traceability[39m [96mtest:coverage[39m: [90m(node:24333) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/traceability[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/traceability[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/traceability
[34mpackages/traceability[39m [96mtest:coverage[39m:       Coverage enabled with v8
[36mpackages/channel-teams[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/channel-teams
[36mpackages/channel-teams[39m [96mtest:coverage[39m:       Coverage enabled with v8
[35mpackages/shared[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/shared
[35mpackages/shared[39m [96mtest:coverage[39m:       Coverage enabled with v8
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(node:24349) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24357) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24355) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24358) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24356) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24360) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(node:24353) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(node:24350) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24359) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24354) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/traceability[39m [96mtest:coverage[39m: [90m(node:24351) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/traceability[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(node:24352) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/channel-teams[39m [96mtest:coverage[39m:  Test Files  4 passed (4)
[36mpackages/channel-teams[39m [96mtest:coverage[39m:       Tests  65 passed (65)
[36mpackages/channel-teams[39m [96mtest:coverage[39m:    Start at  07:23:00
[36mpackages/channel-teams[39m [96mtest:coverage[39m:    Duration  436ms (transform 244ms, setup 0ms, import 457ms, tests 28ms, environment 0ms)
[36mpackages/channel-teams[39m [96mtest:coverage[39m:  % Coverage report from v8
[36mpackages/channel-teams[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[36mpackages/channel-teams[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m     94[0m | [32;1m   89.59[0m | [32;1m    100[0m | [32;1m  98.63[0m | [31;1m                 [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m src/adapters     [0m | [32;1m  91.22[0m | [32;1m   87.14[0m | [32;1m    100[0m | [32;1m     98[0m | [31;1m                 [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m  teams.ts        [0m | [32;1m  91.22[0m | [32;1m   87.14[0m | [32;1m    100[0m | [32;1m     98[0m | [31;1m40               [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m src/components   [0m | [32;1m  94.11[0m | [32;1m    86.9[0m | [32;1m    100[0m | [32;1m  99.18[0m | [31;1m                 [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m  richResult.ts   [0m | [32;1m  94.11[0m | [32;1m    86.9[0m | [32;1m    100[0m | [32;1m  99.18[0m | [31;1m191              [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m src/lib          [0m | [32;1m  96.49[0m | [32;1m   95.52[0m | [32;1m    100[0m | [32;1m  97.87[0m | [31;1m                 [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m  approvalCard.ts [0m | [32;1m  92.85[0m | [32;1m   91.66[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m54               [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m  channel.ts      [0m | [32;1m    100[0m | [32;1m   97.22[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m181              [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1m  ...andoffCard.ts[0m | [32;1m   90.9[0m | [32;1m   94.73[0m | [32;1m    100[0m | [32;1m   90.9[0m | [31;1m31               [0m 
[36mpackages/channel-teams[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[36mpackages/channel-teams[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1mStatements   : 94% ( 235/250 )[0m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1mBranches     : 89.59% ( 198/221 )[0m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1mFunctions    : 100% ( 64/64 )[0m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: [32;1mLines        : 98.63% ( 217/220 )[0m
[36mpackages/channel-teams[39m [96mtest:coverage[39m: ================================================================================
[36mpackages/channel-teams[39m [96mtest:coverage[39m: Done
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24362) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24361) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24363) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24365) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24364) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24366) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24367) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24368) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24369) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24370) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24372) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24371) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24373) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24374) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24377) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24378) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24379) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24380) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24381) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24382) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24384) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24385) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24386) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24387) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24388) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24390) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(node:24391) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/shared[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/shared[39m [96mtest:coverage[39m:  Test Files  29 passed (29)
[35mpackages/shared[39m [96mtest:coverage[39m:       Tests  498 passed (498)
[35mpackages/shared[39m [96mtest:coverage[39m:    Start at  07:23:00
[35mpackages/shared[39m [96mtest:coverage[39m:    Duration  3.22s (transform 1.24s, setup 0ms, import 3.62s, tests 4.49s, environment 2ms)
[35mpackages/shared[39m [96mtest:coverage[39m:  % Coverage report from v8
[35mpackages/shared[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[35mpackages/shared[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[35mpackages/shared[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  87.96[0m | [32;1m      81[0m | [32;1m  89.46[0m | [32;1m  90.26[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m src              [0m | [32;1m  88.46[0m | [32;1m   89.81[0m | [32;1m  81.72[0m | [32;1m   88.1[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [33;1m  auditLog.ts     [0m | [33;1m  51.61[0m | [33;1m   69.23[0m | [33;1m  54.54[0m | [33;1m  51.85[0m | [31;1m79-100           [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...ionContext.ts[0m | [32;1m  98.78[0m | [32;1m   95.71[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m174,192,216      [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ids.ts          [0m | [31;1m  41.86[0m | [31;1m      25[0m | [31;1m   42.1[0m | [31;1m  41.86[0m | [31;1m...94-106,119-137[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [33;1m  language.ts     [0m | [33;1m     75[0m | [33;1m      75[0m | [33;1m     50[0m | [33;1m     75[0m | [31;1m33               [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  periodBuckets.ts[0m | [32;1m    100[0m | [32;1m   91.11[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m...86,235,302,317[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...tSanitizer.ts[0m | [32;1m    100[0m | [32;1m   93.54[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m109,158          [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m src/calendar     [0m | [32;1m  83.69[0m | [32;1m      80[0m | [32;1m  89.47[0m | [32;1m  85.36[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...ssCalendar.ts[0m | [32;1m  83.69[0m | [32;1m      80[0m | [32;1m  89.47[0m | [32;1m  85.36[0m | [31;1m45,96,142,190-201[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m src/clients      [0m | [32;1m  90.63[0m | [32;1m   81.42[0m | [32;1m  94.07[0m | [32;1m  93.62[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...opicClient.ts[0m | [32;1m  95.05[0m | [32;1m   92.24[0m | [32;1m  96.77[0m | [32;1m     97[0m | [31;1m...21,160,547,663[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...gentClient.ts[0m | [32;1m    100[0m | [32;1m      85[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m87-90,97         [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  fetchPolicy.ts  [0m | [32;1m    100[0m | [32;1m      95[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m46,69            [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  githubClient.ts [0m | [32;1m  83.13[0m | [33;1m   67.84[0m | [32;1m  95.45[0m | [32;1m  88.92[0m | [31;1m...71,690,714-729[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  graphClient.ts  [0m | [32;1m  95.59[0m | [32;1m   89.61[0m | [32;1m  93.93[0m | [32;1m  97.01[0m | [31;1m...46,189,268,405[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [33;1m  pgAuditLog.ts   [0m | [33;1m  64.28[0m | [31;1m    37.5[0m | [33;1m     50[0m | [33;1m  69.23[0m | [31;1m18,27,39-42      [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  pgCostGuard.ts  [0m | [32;1m     90[0m | [32;1m   80.43[0m | [32;1m     90[0m | [32;1m  89.58[0m | [31;1m156-159,212      [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m src/html         [0m | [32;1m    100[0m | [32;1m   86.66[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...itizeCheck.ts[0m | [32;1m    100[0m | [32;1m   86.66[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m64,94            [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [33;1m src/reporting    [0m | [33;1m  77.93[0m | [33;1m   72.95[0m | [32;1m  88.23[0m | [32;1m  81.09[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ...ortMetrics.ts[0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m12-48            [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ...ReportJson.ts[0m | [31;1m      0[0m | [31;1m       0[0m | [32;1m    100[0m | [31;1m      0[0m | [31;1m17-46            [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...umberGuard.ts[0m | [32;1m     90[0m | [33;1m   66.66[0m | [32;1m    100[0m | [32;1m  89.47[0m | [31;1m64-65            [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ...portSchema.ts[0m | [31;1m      0[0m | [32;1m     100[0m | [32;1m    100[0m | [31;1m      0[0m | [31;1m8                [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ...lotsSchema.ts[0m | [31;1m      0[0m | [32;1m     100[0m | [32;1m    100[0m | [31;1m      0[0m | [31;1m9                [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...veContract.ts[0m | [32;1m  91.66[0m | [32;1m   91.66[0m | [32;1m    100[0m | [32;1m   90.9[0m | [31;1m30               [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...tGenerator.ts[0m | [32;1m  91.66[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m  96.77[0m | [31;1m120              [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  reportPrompt.ts [0m | [32;1m  83.33[0m | [32;1m     100[0m | [33;1m     75[0m | [32;1m  83.33[0m | [31;1m21               [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  reportSchema.ts [0m | [32;1m    100[0m | [33;1m      50[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m74               [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...Validation.ts[0m | [32;1m  83.05[0m | [32;1m   80.98[0m | [32;1m     84[0m | [32;1m  87.82[0m | [31;1m...67,274,305-315[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...stChannels.ts[0m | [32;1m  85.18[0m | [32;1m   82.75[0m | [32;1m    100[0m | [32;1m     88[0m | [31;1m...9,73,80,98,104[0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...stContract.ts[0m | [32;1m  90.47[0m | [32;1m   87.75[0m | [32;1m    100[0m | [32;1m  96.77[0m | [31;1m57               [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ...ReportJson.ts[0m | [31;1m      0[0m | [31;1m       0[0m | [32;1m    100[0m | [31;1m      0[0m | [31;1m9-11             [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m src/security     [0m | [32;1m  93.54[0m | [32;1m    92.3[0m | [32;1m    100[0m | [32;1m  96.29[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  ...tyEnvelope.ts[0m | [32;1m  93.54[0m | [32;1m    92.3[0m | [32;1m    100[0m | [32;1m  96.29[0m | [31;1m38               [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m src/xlsxImport   [0m | [32;1m  91.74[0m | [33;1m   78.29[0m | [32;1m  90.69[0m | [32;1m  94.91[0m | [31;1m                 [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  engine.ts       [0m | [32;1m  91.86[0m | [32;1m   80.76[0m | [32;1m  84.21[0m | [32;1m  97.29[0m | [31;1m153-154          [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [31;1m  ...teTemplate.ts[0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m11-17            [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1m  parser.ts       [0m | [32;1m  94.38[0m | [32;1m   82.08[0m | [32;1m    100[0m | [32;1m  97.29[0m | [31;1m212-213          [0m 
[35mpackages/shared[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[35mpackages/shared[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1mStatements   : 87.96% ( 1886/2144 )[0m
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1mBranches     : 81% ( 1352/1669 )[0m
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1mFunctions    : 89.46% ( 348/389 )[0m
[35mpackages/shared[39m [96mtest:coverage[39m: [32;1mLines        : 90.26% ( 1707/1891 )[0m
[35mpackages/shared[39m [96mtest:coverage[39m: ================================================================================
[35mpackages/shared[39m [96mtest:coverage[39m: Done
[34mpackages/traceability[39m [96mtest:coverage[39m:  Test Files  1 passed (1)
[34mpackages/traceability[39m [96mtest:coverage[39m:       Tests  129 passed (129)
[34mpackages/traceability[39m [96mtest:coverage[39m:    Start at  07:23:00
[34mpackages/traceability[39m [96mtest:coverage[39m:    Duration  4.54s (transform 95ms, setup 0ms, import 161ms, tests 4.09s, environment 0ms)
[34mpackages/traceability[39m [96mtest:coverage[39m:  % Coverage report from v8
[34mpackages/traceability[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[34mpackages/traceability[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[34mpackages/traceability[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[34mpackages/traceability[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  94.53[0m | [32;1m   87.53[0m | [32;1m  97.75[0m | [32;1m  95.98[0m | [31;1m                 [0m 
[34mpackages/traceability[39m [96mtest:coverage[39m: [32;1m ...raceability.ts[0m | [32;1m  94.53[0m | [32;1m   87.53[0m | [32;1m  97.75[0m | [32;1m  95.98[0m | [31;1m...1087-1089,1117[0m 
[34mpackages/traceability[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[34mpackages/traceability[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[34mpackages/traceability[39m [96mtest:coverage[39m: [32;1mStatements   : 94.53% ( 484/512 )[0m
[34mpackages/traceability[39m [96mtest:coverage[39m: [32;1mBranches     : 87.53% ( 281/321 )[0m
[34mpackages/traceability[39m [96mtest:coverage[39m: [32;1mFunctions    : 97.75% ( 87/89 )[0m
[34mpackages/traceability[39m [96mtest:coverage[39m: [32;1mLines        : 95.98% ( 430/448 )[0m
[34mpackages/traceability[39m [96mtest:coverage[39m: ================================================================================
[34mpackages/traceability[39m [96mtest:coverage[39m: Done
[33mpackages/control-plane[39m [96mtest:coverage[39m$ vitest run --coverage
[32mpackages/devops[39m [96mtest:coverage[39m$ vitest run --coverage
[31mpackages/prjops[39m [96mtest:coverage[39m$ vitest run --coverage
[36mpackages/integrations[39m [96mtest:coverage[39m$ vitest run --coverage
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24447) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24493) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24585) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24539) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/devops
[32mpackages/devops[39m [96mtest:coverage[39m:       Coverage enabled with v8
[33mpackages/control-plane[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane
[33mpackages/control-plane[39m [96mtest:coverage[39m:       Coverage enabled with v8
[31mpackages/prjops[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/prjops
[31mpackages/prjops[39m [96mtest:coverage[39m:       Coverage enabled with v8
[36mpackages/integrations[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/integrations
[36mpackages/integrations[39m [96mtest:coverage[39m:       Coverage enabled with v8
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24609) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24607) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24611) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24608) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24620) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24606) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24623) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24618) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24615) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24619) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24617) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24621) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24626) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24612) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24624) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24625) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24614) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24628) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24630) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24616) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24610) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24622) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24633) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24613) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24634) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24637) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24638) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24640) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24641) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24642) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24645) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(node:24643) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[36mpackages/integrations[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24649) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24650) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24651) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24652) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24653) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24654) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24656) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24657) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24658) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24662) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24661) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24665) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24666) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24667) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24669) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24670) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24668) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24671) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24672) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24677) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24678) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24675) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24682) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24681) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24684) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24683) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(node:24686) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[32mpackages/devops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(node:24685) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[31mpackages/prjops[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[36mpackages/integrations[39m [96mtest:coverage[39m:  Test Files  10 passed (10)
[36mpackages/integrations[39m [96mtest:coverage[39m:       Tests  77 passed (77)
[36mpackages/integrations[39m [96mtest:coverage[39m:    Start at  07:23:05
[36mpackages/integrations[39m [96mtest:coverage[39m:    Duration  3.18s (transform 3.45s, setup 0ms, import 14.31s, tests 450ms, environment 1ms)
[36mpackages/integrations[39m [96mtest:coverage[39m:  % Coverage report from v8
[36mpackages/integrations[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[36mpackages/integrations[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[36mpackages/integrations[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  83.24[0m | [33;1m   78.15[0m | [32;1m  98.24[0m | [32;1m  89.33[0m | [31;1m                 [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [33;1m src/graph        [0m | [33;1m  76.47[0m | [33;1m   68.18[0m | [32;1m    100[0m | [32;1m  86.66[0m | [31;1m                 [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [33;1m  ...estAdapter.ts[0m | [33;1m  76.47[0m | [33;1m   68.18[0m | [32;1m    100[0m | [32;1m  86.66[0m | [31;1m23,36            [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [33;1m src/jira         [0m | [33;1m  79.54[0m | [33;1m   72.18[0m | [32;1m    100[0m | [32;1m  87.41[0m | [31;1m                 [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [33;1m  client.ts       [0m | [33;1m  79.54[0m | [33;1m   72.18[0m | [32;1m    100[0m | [32;1m  87.41[0m | [31;1m...07,324,334,346[0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m src/lib          [0m | [32;1m     80[0m | [33;1m   73.75[0m | [32;1m    100[0m | [32;1m  84.72[0m | [31;1m                 [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m  ...ionProfile.ts[0m | [32;1m     90[0m | [32;1m    87.5[0m | [32;1m    100[0m | [32;1m  88.23[0m | [31;1m25,42            [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [33;1m  mcpPolicy.ts    [0m | [33;1m     75[0m | [33;1m   65.38[0m | [32;1m    100[0m | [32;1m     82[0m | [31;1m...38,142,145,148[0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m src/mcp          [0m | [32;1m  86.13[0m | [33;1m   79.36[0m | [32;1m  94.87[0m | [32;1m   94.5[0m | [31;1m                 [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m  ...edToolCall.ts[0m | [32;1m  91.25[0m | [32;1m   87.65[0m | [32;1m    100[0m | [32;1m  95.94[0m | [31;1m220-223,260      [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m  ...yGenerator.ts[0m | [32;1m  83.54[0m | [33;1m   73.14[0m | [32;1m  93.54[0m | [32;1m  93.65[0m | [31;1m...79,183,188,247[0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m src/workiq       [0m | [32;1m   84.8[0m | [32;1m   83.67[0m | [32;1m    100[0m | [32;1m  87.15[0m | [31;1m                 [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m  restClient.ts   [0m | [32;1m  80.82[0m | [33;1m   78.49[0m | [32;1m    100[0m | [32;1m  84.12[0m | [31;1m...46,265,294,298[0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1m  ...ceEvidence.ts[0m | [32;1m  91.89[0m | [32;1m     100[0m | [32;1m    100[0m | [32;1m  91.42[0m | [31;1m84,95-96         [0m 
[36mpackages/integrations[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[32mpackages/devops[39m [96mtest:coverage[39m:  Test Files  21 passed (21)
[32mpackages/devops[39m [96mtest:coverage[39m:       Tests  216 passed (216)
[32mpackages/devops[39m [96mtest:coverage[39m:    Start at  07:23:05
[32mpackages/devops[39m [96mtest:coverage[39m:    Duration  3.19s (transform 2.47s, setup 0ms, import 7.56s, tests 3.00s, environment 1ms)
[32mpackages/devops[39m [96mtest:coverage[39m:  % Coverage report from v8
[32mpackages/devops[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[32mpackages/devops[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[32mpackages/devops[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  87.23[0m | [32;1m   80.38[0m | [32;1m   87.2[0m | [32;1m  87.17[0m | [31;1m                 [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m src/agents       [0m | [32;1m  81.87[0m | [32;1m   83.58[0m | [33;1m  69.76[0m | [33;1m  79.86[0m | [31;1m                 [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [31;1m  AGT_BLD.ts      [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m21-101           [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [33;1m  AGT_CHG.ts      [0m | [33;1m  68.96[0m | [33;1m    62.5[0m | [31;1m   37.5[0m | [33;1m  66.66[0m | [31;1m50-62,150-171    [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  AGT_DEP.ts      [0m | [32;1m  95.45[0m | [32;1m    87.5[0m | [33;1m     75[0m | [32;1m     95[0m | [31;1m75               [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [33;1m  AGT_INC.ts      [0m | [33;1m     76[0m | [32;1m   83.33[0m | [31;1m  42.85[0m | [33;1m  73.91[0m | [31;1m52-72,157-163    [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  AGT_RPT.ts      [0m | [32;1m  97.29[0m | [32;1m    92.3[0m | [32;1m    100[0m | [32;1m  97.14[0m | [31;1m76               [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [33;1m src/db           [0m | [33;1m  70.45[0m | [33;1m   61.53[0m | [31;1m  42.85[0m | [33;1m  70.73[0m | [31;1m                 [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [33;1m  migrate.ts      [0m | [33;1m  70.45[0m | [33;1m   61.53[0m | [31;1m  42.85[0m | [33;1m  70.73[0m | [31;1m43-48,104-111,116[0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m src/lib          [0m | [32;1m  94.82[0m | [32;1m   82.69[0m | [32;1m    100[0m | [32;1m  95.36[0m | [31;1m                 [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  ...skActivity.ts[0m | [32;1m    100[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m60               [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  deployMonitor.ts[0m | [32;1m  97.43[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m39,87            [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  ...ateMachine.ts[0m | [32;1m     90[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m58               [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  doraMetrics.ts  [0m | [32;1m    100[0m | [33;1m   54.34[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m...99-103,109-123[0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  ...ntBackfill.ts[0m | [32;1m  88.81[0m | [32;1m   81.81[0m | [32;1m    100[0m | [32;1m  89.62[0m | [31;1m...74,292,360,372[0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m src/templates    [0m | [32;1m  93.02[0m | [32;1m   84.61[0m | [32;1m  85.71[0m | [32;1m  92.85[0m | [31;1m                 [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1m  ...ileReports.ts[0m | [32;1m  90.32[0m | [32;1m   84.61[0m | [32;1m     80[0m | [32;1m     90[0m | [31;1m30,40,178        [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [33;1m src/tools        [0m | [33;1m  71.42[0m | [33;1m   72.22[0m | [32;1m  81.81[0m | [33;1m  74.68[0m | [31;1m                 [0m 
[32mpackages/devops[39m [96mtest:coverage[39m: [33;1m  ...Recipients.ts[0m | [33;1m  71.42[0m | [33;1m   72.22[0m | [32;1m  81.81[0m | [33;1m  74.68[0m | [31;1m...42-270,275-277[0m 
[32mpackages/devops[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[36mpackages/integrations[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1mStatements   : 83.24% ( 601/722 )[0m
[36mpackages/integrations[39m [96mtest:coverage[39m: [33;1mBranches     : 78.15% ( 551/705 )[0m
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1mFunctions    : 98.24% ( 112/114 )[0m
[36mpackages/integrations[39m [96mtest:coverage[39m: [32;1mLines        : 89.33% ( 553/619 )[0m
[36mpackages/integrations[39m [96mtest:coverage[39m: ================================================================================
[31mpackages/prjops[39m [96mtest:coverage[39m:  Test Files  26 passed (26)
[31mpackages/prjops[39m [96mtest:coverage[39m:       Tests  367 passed (367)
[31mpackages/prjops[39m [96mtest:coverage[39m:    Start at  07:23:05
[31mpackages/prjops[39m [96mtest:coverage[39m:    Duration  3.22s (transform 2.03s, setup 0ms, import 8.66s, tests 1.04s, environment 2ms)
[31mpackages/prjops[39m [96mtest:coverage[39m:  % Coverage report from v8
[31mpackages/prjops[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[31mpackages/prjops[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[31mpackages/prjops[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  90.55[0m | [32;1m   83.39[0m | [32;1m  93.66[0m | [32;1m  92.49[0m | [31;1m                 [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m src/agents       [0m | [32;1m  87.41[0m | [32;1m   86.25[0m | [33;1m  73.91[0m | [32;1m  87.32[0m | [31;1m                 [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...chestrator.ts[0m | [32;1m   90.9[0m | [32;1m     100[0m | [33;1m  66.66[0m | [32;1m     90[0m | [31;1m40               [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...3_analyzer.ts[0m | [32;1m    100[0m | [32;1m   88.23[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m116-117          [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...istributor.ts[0m | [32;1m  93.33[0m | [32;1m      88[0m | [32;1m    100[0m | [32;1m  93.02[0m | [31;1m69,102,158       [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  AGT06_tracker.ts[0m | [32;1m  96.29[0m | [32;1m   92.85[0m | [32;1m    100[0m | [32;1m  95.65[0m | [31;1m111              [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...7_verifier.ts[0m | [32;1m  83.33[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m  83.33[0m | [31;1m72-73,76-77      [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [33;1m  ...Activities.ts[0m | [33;1m  52.38[0m | [33;1m      50[0m | [33;1m     50[0m | [33;1m     55[0m | [31;1m49-52,67-92,130  [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m src/data         [0m | [32;1m  81.71[0m | [33;1m   75.66[0m | [32;1m  86.88[0m | [32;1m  85.59[0m | [31;1m                 [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...ngestStore.ts[0m | [32;1m    100[0m | [32;1m    91.3[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m56,79            [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [33;1m  ...taProvider.ts[0m | [33;1m   59.4[0m | [31;1m   48.52[0m | [33;1m  77.77[0m | [33;1m  64.36[0m | [31;1m43-85,131,177,211[0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...erProvider.ts[0m | [32;1m   93.7[0m | [32;1m   90.81[0m | [32;1m     92[0m | [32;1m  97.29[0m | [31;1m101,103,290      [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m src/lib          [0m | [32;1m  93.74[0m | [32;1m   87.77[0m | [32;1m  98.12[0m | [32;1m  95.81[0m | [31;1m                 [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...onReminder.ts[0m | [32;1m     95[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m34               [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  commandParser.ts[0m | [32;1m    100[0m | [32;1m   88.88[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m121-122,126,161  [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...eSevenKeys.ts[0m | [32;1m  95.52[0m | [32;1m    92.3[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m106,114,168-192  [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...Validation.ts[0m | [32;1m  87.17[0m | [32;1m   92.68[0m | [32;1m   87.5[0m | [32;1m  92.59[0m | [31;1m77-78            [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...ntDelivery.ts[0m | [32;1m  89.47[0m | [32;1m   81.81[0m | [32;1m    100[0m | [32;1m  89.47[0m | [31;1m72,76            [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...torMetrics.ts[0m | [32;1m    100[0m | [32;1m      95[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m138              [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...Validation.ts[0m | [32;1m  95.23[0m | [32;1m   91.42[0m | [32;1m    100[0m | [32;1m  94.44[0m | [31;1m53,111           [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...tValidator.ts[0m | [32;1m  90.08[0m | [32;1m   80.12[0m | [32;1m  98.38[0m | [32;1m  93.03[0m | [31;1m...32-633,646,658[0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...ateMachine.ts[0m | [32;1m  89.47[0m | [33;1m   78.26[0m | [32;1m  85.71[0m | [32;1m  94.11[0m | [31;1m61               [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...sionFilter.ts[0m | [32;1m   87.5[0m | [32;1m   87.87[0m | [32;1m    100[0m | [32;1m     90[0m | [31;1m43-45            [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  statusJudge.ts  [0m | [32;1m  97.22[0m | [32;1m      88[0m | [32;1m    100[0m | [32;1m  96.77[0m | [31;1m37               [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m src/templates    [0m | [32;1m  97.77[0m | [33;1m   67.14[0m | [32;1m   97.5[0m | [32;1m   97.7[0m | [31;1m                 [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  ...ileReports.ts[0m | [32;1m  97.14[0m | [33;1m   60.37[0m | [32;1m  94.73[0m | [32;1m  96.96[0m | [31;1m180              [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  reportShell.ts  [0m | [32;1m    100[0m | [32;1m   92.85[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m77               [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1m  svgCharts.ts    [0m | [32;1m  96.15[0m | [33;1m   66.66[0m | [32;1m    100[0m | [32;1m     96[0m | [31;1m29               [0m 
[31mpackages/prjops[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[32mpackages/devops[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1mStatements   : 87.23% ( 615/705 )[0m
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1mBranches     : 80.38% ( 377/469 )[0m
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1mFunctions    : 87.2% ( 150/172 )[0m
[32mpackages/devops[39m [96mtest:coverage[39m: [32;1mLines        : 87.17% ( 530/608 )[0m
[32mpackages/devops[39m [96mtest:coverage[39m: ================================================================================
[36mpackages/integrations[39m [96mtest:coverage[39m: Done
[32mpackages/devops[39m [96mtest:coverage[39m: Done
[31mpackages/prjops[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1mStatements   : 90.55% ( 1083/1196 )[0m
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1mBranches     : 83.39% ( 733/879 )[0m
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1mFunctions    : 93.66% ( 266/284 )[0m
[31mpackages/prjops[39m [96mtest:coverage[39m: [32;1mLines        : 92.49% ( 961/1039 )[0m
[31mpackages/prjops[39m [96mtest:coverage[39m: ================================================================================
[31mpackages/prjops[39m [96mtest:coverage[39m: Done
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:09.949Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 756 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:09.970Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:09.962Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 772 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:09.973Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:09.963Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 771 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:09.977Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.009Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.022Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.040Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.073Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.073Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.073Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.073Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.074Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.074Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.075Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.075Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.786Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 663 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.789Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.823Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.862Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.862Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.863Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.863Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.947Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 833 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.952Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:10.990Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.039Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.039Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.040Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.040Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.232Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.233Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.233Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.233Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.494Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1096 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.516Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.526Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1124 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-accept'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.529Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.544Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1155 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.547Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.625Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1225 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-deadline'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.628Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.654Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 763 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.657Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.685Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.734Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.734Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.735Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.735Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.816Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.817Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.823Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.824Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.825Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.827Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-accept'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.861Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.863Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-deadline'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.950Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.950Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.950Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.951Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.953Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.953Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.956Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:11.956Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.003Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.005Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.007Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1897 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.009Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.009Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.010Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.017Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.017Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.021Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.021Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.125Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1061 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.128Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.146Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.250Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.250Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.251Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.251Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.311Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 2192 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p3-t11-timeout-faults'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.313Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24628) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.335Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.336Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.391Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 638 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-3'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.393Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.451Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.493Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.494Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.494Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.494Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24628) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.614Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.614Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p3-t11-timeout-faults'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.661Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ABZjaGFvcy90aW1lb3V0L2FjdGl2aXR5ACQyMjU4ODA4NS0wYjIwLTRjZDItYWQ3ZS1jMzQ0NmEzOTU5OTMAAAAAAAAABQAAAAE='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'createExternalObject'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'chaos/timeout/activity'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'22588085-0b20-4cd2-ad7e-c3446a395993'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'replayProbeWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: TimeoutFailure: P3-T11 synthetic start-to-close timeout[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at createExternalObject (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:681:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.689Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'chaos/timeout/activity'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'22588085-0b20-4cd2-ad7e-c3446a395993'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'replayProbeWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: external side effect unresolved for key "chaos/timeout/activity#createExternalObject#0"; manual/ledger reconcile required[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/replayProbe.ts:48:31[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at MessagePort.<anonymous> (node:internal/per_context/messageport:23:28)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activator.startWorkflowNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+workflow@1.22.0/node_modules/[4m@temporalio/workflow[24m/src/internals.ts:638:11) {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.720Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ADNncmFwaC1zdWJzY3JpcHRpb24vZGVsdGE6Y2hhb3MtaGVhcnRiZWF0LXRpbWVvdXQ6OTkAJGY1Zjc4NjdjLTkxNmEtNGQxYS1iNzA1LWIyNTkxMjliODg3MwAAAAAAAAAKAAAAAQ=='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'runGraphSubscriptionDelta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/delta:chaos-heartbeat-timeout:99'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f5f7867c-916a-4d1a-b705-b259129b8873'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: TimeoutFailure: P3-T11 synthetic heartbeat deadline exceeded[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at runGraphSubscriptionDelta (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:688:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.722Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m2[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ADNncmFwaC1zdWJzY3JpcHRpb24vZGVsdGE6Y2hhb3MtaGVhcnRiZWF0LXRpbWVvdXQ6OTkAJGY1Zjc4NjdjLTkxNmEtNGQxYS1iNzA1LWIyNTkxMjliODg3MwAAAAAAAAAKAAAAAg=='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'runGraphSubscriptionDelta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/delta:chaos-heartbeat-timeout:99'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f5f7867c-916a-4d1a-b705-b259129b8873'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: TimeoutFailure: P3-T11 synthetic heartbeat deadline exceeded[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at runGraphSubscriptionDelta (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:688:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.723Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m3[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ADNncmFwaC1zdWJzY3JpcHRpb24vZGVsdGE6Y2hhb3MtaGVhcnRiZWF0LXRpbWVvdXQ6OTkAJGY1Zjc4NjdjLTkxNmEtNGQxYS1iNzA1LWIyNTkxMjliODg3MwAAAAAAAAAKAAAAAw=='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'runGraphSubscriptionDelta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/delta:chaos-heartbeat-timeout:99'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f5f7867c-916a-4d1a-b705-b259129b8873'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: TimeoutFailure: P3-T11 synthetic heartbeat deadline exceeded[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at runGraphSubscriptionDelta (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:688:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.726Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m4[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ADNncmFwaC1zdWJzY3JpcHRpb24vZGVsdGE6Y2hhb3MtaGVhcnRiZWF0LXRpbWVvdXQ6OTkAJGY1Zjc4NjdjLTkxNmEtNGQxYS1iNzA1LWIyNTkxMjliODg3MwAAAAAAAAAKAAAABA=='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'runGraphSubscriptionDelta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/delta:chaos-heartbeat-timeout:99'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f5f7867c-916a-4d1a-b705-b259129b8873'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: TimeoutFailure: P3-T11 synthetic heartbeat deadline exceeded[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at runGraphSubscriptionDelta (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:688:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.727Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m5[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ADNncmFwaC1zdWJzY3JpcHRpb24vZGVsdGE6Y2hhb3MtaGVhcnRiZWF0LXRpbWVvdXQ6OTkAJGY1Zjc4NjdjLTkxNmEtNGQxYS1iNzA1LWIyNTkxMjliODg3MwAAAAAAAAAKAAAABQ=='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'runGraphSubscriptionDelta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/delta:chaos-heartbeat-timeout:99'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f5f7867c-916a-4d1a-b705-b259129b8873'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: TimeoutFailure: P3-T11 synthetic heartbeat deadline exceeded[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at runGraphSubscriptionDelta (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:688:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.733Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/delta:chaos-heartbeat-timeout:99'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'f5f7867c-916a-4d1a-b705-b259129b8873'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: [Error: Activity task failed] {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: TimeoutFailure: P3-T11 synthetic heartbeat deadline exceeded[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m        at syntheticTimeout (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:665:17)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m        at runGraphSubscriptionDelta (/Users/mryfmo/Workspace/ai-ops-platform/verification/chaos/run.ts:688:17) {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.737Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.737Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.738Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.738Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-timeout-faults'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: 2026-08-29T22:23:12.745988Z  WARN temporalio_sdk_core::worker::workflow::workflow_stream: There were leftover buffered tasks when evicting run
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.988Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 865 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-active'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.992Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 885 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.993Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:12.995Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.015Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 750 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-3'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.018Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.032Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 847 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-accept'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.035Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.040Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 869 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.043Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.044Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.195Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.195Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.205Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.205Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-active'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.227Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.228Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-accept'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.234Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.235Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.263Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.263Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.266Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.267Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.283Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 775 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-4'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.286Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.293Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.293Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.295Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.296Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.299Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.300Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.302Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.303Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.306Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.336Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.336Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.336Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.336Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.341Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.341Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.343Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.343Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.679Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 565 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-4'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.690Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.723Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.781Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.781Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.782Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.782Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.864Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 576 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.867Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.944Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 593 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-5'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.947Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.985Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.988Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 556 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-stale'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:13.991Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.035Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.035Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.037Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.037Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.055Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 593 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-lost-response'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.058Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.109Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.109Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.152Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 663 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-accept'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.155Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.182Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.182Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.184Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.184Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-renewal-fire-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.221Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.221Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-stale'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.281Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.281Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-lost-response'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.297Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.297Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.299Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.299Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.343Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ABxpbmNpZGVudC9qaXQtZXhwaXJ5Omdsb2JhbDowACQ4ODg5ZmU4Ny1hN2YzLTRkZjUtYWY2OC1jNjJiOTU1OWIyMWIAAAAAAAAAFgAAAAE='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'revokeExpiredGrant'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/jit-expiry:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'8889fe87-a7f3-4df5-af68-c62b9559b21b'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'jitExpiryWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: Error: synthetic response loss after revoke[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at revokeExpiredGrant [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90mtests/jitHealthWorkflow.test.ts:162:17[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.349Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.350Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-accept'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.365Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.365Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.367Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.367Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.470Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.470Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.471Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.471Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-accept'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.502Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 710 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-5'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.505Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.533Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.574Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.574Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.574Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.574Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.646Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 589 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-6'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.649Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.675Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.730Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.730Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.731Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.732Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.952Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 612 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:14.954Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.053Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 606 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.055Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.094Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 584 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-unresolved'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.097Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.177Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.177Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.224Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.224Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.227Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.227Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-delta-period'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.250Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 653 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-6'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.252Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.253Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.257Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.274Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.307Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.307Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.308Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.308Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.315Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 685 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.319Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.320Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.320Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.327Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.328Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-cutover-parallel'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.339Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.340Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-jit-unresolved'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.397Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ABxpbmNpZGVudC9qaXQtZXhwaXJ5Omdsb2JhbDowACRmMjM4MGExNi1hODU3LTQyMWQtYWUwYS1iOTdjZTdlY2RiMzMAAAAAAAAAFgAAAAE='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'revokeExpiredGrant'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/jit-expiry:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f2380a16-a857-421d-ae0a-b97ce7ecdb33'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'jitExpiryWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: Error: GitHub timeout[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at revokeExpiredGrant [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90mtests/jitHealthWorkflow.test.ts:182:17[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.422Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/jit-expiry:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'f2380a16-a857-421d-ae0a-b97ce7ecdb33'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'jitExpiryWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: external side effect unresolved for key "incident/jit-expiry:global:0:00000000-0000-4000-8000-000000000001#revokeExpiredGrant#1788042255373"; manual/ledger reconcile required[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:87:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at unresolvedFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:187:69[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at MessagePort.<anonymous> (node:internal/per_context/messageport:23:28)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.426Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.426Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.428Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.428Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-unresolved'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.448Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 692 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-7'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.452Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.470Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.494Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.494Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.496Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.496Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.496Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.496Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.621Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.622Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.626Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.626Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.941Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 556 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:15.944Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.013Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 682 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-7'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.016Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.048Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.074Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 602 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.077Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.093Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.093Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.093Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.093Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-7'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.131Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 610 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-8'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.135Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.169Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.189Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.189Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.192Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 613 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.196Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.253Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.253Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.254Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.254Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.256Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.256Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.259Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.259Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-no-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.284Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 628 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.291Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.292Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.320Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.411Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.411Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.414Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.414Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.415Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.415Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-claim-race'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.498Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/jit-expiry:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'72999708-a931-45dd-9644-651a7b43d2f6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'jitExpiryWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: JIT revocation receipt must use schemaVersion 1 with an object payload[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:80:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at contractFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:94:11[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at validatedRevocation [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:184:6[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.502Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.503Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.505Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.505Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-jit-malformed-receipt'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.554Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.556Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.662Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.662Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.663Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.663Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.790Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 680 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-8'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.792Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.828Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.928Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.928Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.929Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.930Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-8'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.951Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 672 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-9'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.954Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-9'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:16.969Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-9'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.019Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-9'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.019Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-9'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.019Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-9'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.019Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-9'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.029Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 609 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.032Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24725) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.168Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 596 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-d16'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.170Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d16'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.191Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 545 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-deadline'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.193Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.216Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.216Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.267Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ACtncmFwaC1zdWJzY3JpcHRpb24vcmVuZXdhbDpzdWJzY3JpcHRpb24tMTowACQ2NjgxM2Y0MC03NjJiLTQwN2QtYWYxMi0zYTQ3ODFhMWMxMGIAAAAAAAAAEAAAAAE='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'renewGraphSubscription'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/renewal:subscription-1:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'66813f40-762b-407d-af12-3a4781a1c10b'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: Error: synthetic response loss after Graph write[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at renewGraphSubscription [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90mtests/graphSubscriptionWorkflow.test.ts:191:17[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.276Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 580 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.282Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.288Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.289Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.290Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.290Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.385Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.385Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-deadline'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.392Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d16'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.392Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-d16'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.448Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d16'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.450Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d16'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.453Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d16'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.453Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d16'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.455Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.455Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.459Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.459Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-deadline'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.471Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.471Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.537Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.537Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.538Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.538Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.598Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 564 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-10'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.601Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-10'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.615Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-10'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.636Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-10'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.636Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-10'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.636Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-10'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.636Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-10'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.928Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 499 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:17.937Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.090Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 494 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-d04'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.091Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 499 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.093Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d04'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.095Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.181Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.181Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.183Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 495 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.187Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.232Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 569 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-11'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.235Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-11'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.265Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-11'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.274Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.274Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.276Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.277Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-concurrent'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.308Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-11'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.308Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-11'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.308Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-11'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.309Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-11'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.326Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d04'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.326Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-d04'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.326Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.327Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.399Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.399Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.400Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.400Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.405Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d04'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.405Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d04'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.409Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.410Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.411Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d04'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.411Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-d04'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.530Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.530Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.531Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.531Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.971Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 628 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-12'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.970Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 948 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.974Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-12'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.982Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:18.992Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-12'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.016Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 586 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.019Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.037Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.051Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-12'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.051Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-12'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.051Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-12'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.051Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-12'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.073Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 525 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.076Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.101Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 535 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-active'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.102Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 539 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-pending'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.104Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.103Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.139Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.139Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.140Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.140Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.264Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.264Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.301Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.301Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.321Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.321Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.325Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.326Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-delta'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.337Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.337Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-active'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.342Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.343Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-pending'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.408Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.408Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.409Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.409Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.421Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.421Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.423Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.423Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.424Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/deploy-dispatch:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'451c0997-183f-41c6-aafc-158290f38256'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'deployDispatchWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: deployment deploy ledger is pending for bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb; automatic redispatch is forbidden[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/deployment.ts:92:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at unresolvedFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/deployment.ts:160:13[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at MessagePort.<anonymous> (node:internal/per_context/messageport:23:28)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.430Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.430Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.431Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.431Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-pending'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.659Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 583 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-13'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.666Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-13'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.705Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-13'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.770Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-13'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.770Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-13'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.771Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-13'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.771Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-13'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.870Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 711 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.873Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.906Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.944Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.944Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.945Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:19.946Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.043Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 591 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.046Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.057Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 573 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.062Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.136Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 563 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.139Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.167Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 607 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-malformed'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.170Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.301Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.301Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.304Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.304Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.379Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.379Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'jit-health-health-malformed'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.384Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.384Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.394Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.394Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.396Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.396Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-shadow-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.399Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 605 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-14'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.401Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-14'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.417Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.417Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.418Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-14'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.419Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.420Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.434Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/health:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'415d128a-8b8f-4cff-b09c-e0b8cef00143'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'healthEvaluationWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: health evaluation receipt must use schemaVersion 1 with an object payload[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:80:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at contractFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:114:11[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at validatedHealth [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:228:21[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.438Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.438Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.441Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.441Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-malformed'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.459Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ACFpbmNpZGVudC9kZXBsb3ktZGlzcGF0Y2g6Z2xvYmFsOjAAJGY4ZGUzZDcyLTUyOGUtNDBlOC1iNmM3LWYzY2VkOWJhN2QyOQAAAAAAAAAcAAAAAQ=='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'dispatchDeployment'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/deploy-dispatch:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'f8de3d72-528e-40e8-b6c7-f3ced9ba7d29'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'deployDispatchWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: Error: lost response[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at dispatchDeployment [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90mtests/deploymentWorkflow.test.ts:309:19[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.466Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-14'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.466Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-14'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.467Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-14'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.467Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-14'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.478Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.478Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.480Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.480Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-dispatch-reconcile'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.618Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 662 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.621Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.649Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.686Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.686Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.686Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:20.686Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.036Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 552 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-15'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.038Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-15'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.055Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-15'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.087Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 540 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.090Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.139Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 573 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.142Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.158Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-15'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.159Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-15'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.159Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-15'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.160Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-15'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.224Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 615 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.228Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.272Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 634 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-monitor-active'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.278Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24747) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.380Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.381Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.381Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.381Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.427Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.427Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.442Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0ACtncmFwaC1zdWJzY3JpcHRpb24vcmVuZXdhbDpzdWJzY3JpcHRpb24tMTowACRlNGQ1YWEyMC1jZDI4LTRmMDAtOWNmYi04OGUxOWY1YWViOTMAAAAAAAAAEAAAAAE='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'renewGraphSubscription'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/renewal:subscription-1:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'e4d5aa20-cd28-4f00-9cfb-88e19f5aeb93'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: Error: Graph unavailable[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at renewGraphSubscription [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90mtests/graphSubscriptionWorkflow.test.ts:286:17[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.462Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.463Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.465Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.466Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-unresolved-write'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.479Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.480Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-monitor-active'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.487Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.490Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.490Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.490Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.490Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 766 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-3'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.495Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.496Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.496Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.498Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.498Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-suppressed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.526Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.545Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.545Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.546Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.547Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-active'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.550Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.550Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.550Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:21.550Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.082Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 570 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.085Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.132Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 573 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-4'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.136Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.155Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 549 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.158Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.173Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.196Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 554 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.204Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.224Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.224Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.225Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.225Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-4'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.270Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.270Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.370Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.370Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24632) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.384Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.387Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.387Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.388Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.400Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.400Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.458Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 775 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-monitor-contract'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.460Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.471Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/renewal:subscription-1:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'4c8a6d03-d1d5-4e28-84e5-88925e7e97ef'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: graph subscription activity receipt must use schemaVersion 1 with an object payload[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/graphSubscription.ts:83:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at contractFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/graphSubscription.ts:97:11[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at validatedReceipt [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/graphSubscription.ts:192:8[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.479Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.479Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.481Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.481Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-renewal-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.503Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/health:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'8921f761-ccb9-43a6-8071-12a67e1fdede'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'healthEvaluationWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: health evaluation receipt has an inconsistent decision[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:80:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at contractFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:122:11[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at validatedAppliedHealth [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/jitHealth.ts:240:30[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.510Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.510Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.514Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.514Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'jit-health-health-unconfirmed-failsafe'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24631) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.666Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.666Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'deployment-monitor-contract'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.728Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'incident/prod-monitor:global:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'e8d6ae37-76fe-4364-94fc-05e903e97189'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'prodMonitorWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: deployment plan kind does not match operation[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/deployment.ts:85:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at contractFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/deployment.ts:222:11[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at MessagePort.<anonymous> (node:internal/per_context/messageport:23:28)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.734Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.734Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.740Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.740Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'deployment-monitor-contract'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24755) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24756) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.943Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 705 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-5'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.953Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:22.976Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.015Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.015Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.016Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.016Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.023Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 619 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.026Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.156Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 995 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.164Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.191Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 562 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.196Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.209Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.231Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.231Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.275Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.275Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.276Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.276Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.300Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.300Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.301Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.301Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-clarify-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.408Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.408Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.463Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'graph-subscription/reconcile:subscription-1:0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'abdc8989-d420-4254-a3e8-bd6d0b112c08'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'graphSubscriptionWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: graph subscription activity receipt must use schemaVersion 1 with an object payload[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/graphSubscription.ts:83:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at contractFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/graphSubscription.ts:97:11[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at validatedReceipt [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/graphSubscription.ts:210:18[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.466Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.467Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.468Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.468Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'graph-subscription-malformed-result'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24759) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.716Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 677 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-6'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.721Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.740Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.783Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.783Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.784Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.785Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-6'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.979Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 551 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-escalate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:23.982Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24760) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.041Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 746 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.044Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.067Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.084Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.124Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.124Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.125Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.125Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p3-t11-restart-cache-zero'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.208Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.209Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-escalate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.324Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.325Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.326Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.326Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24764) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.720Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1117 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.726Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.771Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.855Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.855Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.856Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.857Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.869Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 772 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.872Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.909Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.933Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.933Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.934Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:24.934Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.009Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 528 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-escalate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.012Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.201Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1304 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p8-t07-handoff-happy'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.205Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-happy'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.235Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.235Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-escalate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.362Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.363Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.366Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.366Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24756) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.489Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-happy'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.490Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p8-t07-handoff-happy'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.697Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 814 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.700Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.709Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 757 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-3'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.713Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.719Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1104 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.724Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.729Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.731Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-happy'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.732Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-happy'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.734Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-happy'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.734Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-happy'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.751Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.767Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.767Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.767Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.767Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.785Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.798Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.798Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.800Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.800Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.878Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.878Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.878Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:25.878Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24770) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.113Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1227 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.120Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.180Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.215Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 682 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-escalate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.218Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.294Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.294Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.296Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.297Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.400Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1093 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.407Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.411Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.411Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-escalate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.457Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.460Z[39m[90m [INFO] asset workflow-bundle-ecd5fb29c435c3f1c669.js 1.49 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../../node_modules/.pnpm/ 438 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/@temporalio+common@1.22.0/node_modules/@temporal...(truncated) 161 KiB 35 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/@temporalio+workflow@1.22.0/node_modules/@tempor...(truncated) 202 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../../node_modules/.pnpm/@temporalio+workflow@1.22.0/node_modules/@temporalio/wo...(truncated) 12.9 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 25 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/nexus-rpc@0.0.2/node_modules/nexus-rpc/lib/ 22.3 KiB 13 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ../../node_modules/.pnpm/long@5.3.2/node_modules/long/umd/index.js 49.8 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ../../node_modules/.pnpm/ms@3.0.0-canary.1/node_modules/ms/dist/index.cjs 3.41 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./tests/fixtures/ 925 bytes[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./tests/fixtures/replayProbeMutated-autogenerated-entrypoint.cjs 542 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./tests/fixtures/replayProbeMutated.ts 383 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 684 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.464Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'1.49MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.491Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.491Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.491Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.492Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-escalate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.504Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.526Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.526Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.527Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.527Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: 2026-08-29T22:23:26.542191Z  WARN temporalio_sdk_core::worker::workflow: Failing workflow task run_id=f914d485-5d63-4fbf-9d05-16f130461f22 failure=Failure { failure: Some(Failure { message: "[TMPRL1100] Nondeterminism error: Timer machine does not handle this event: HistoryEvent(id: 5, ActivityTaskScheduled)", source: "", stack_trace: "", encoded_attributes: None, cause: None, failure_info: Some(ApplicationFailureInfo(ApplicationFailureInfo { r#type: "", non_retryable: false, details: None, next_retry_delay: None, category: Unspecified })) }), force_cause: NonDeterministicError }
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.543Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.543Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.543Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.543Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.602Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 716 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p8-t07-handoff-stale'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.606Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.739Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 838 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.743Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.769Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24756) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.798Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.798Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.800Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.800Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.815Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.815Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'p8-t07-handoff-stale'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.914Z[39m[90m [WARN] Workflow failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'coding/P8-T07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  runId: [32m'26448ed9-1a64-4eba-9370-8dbc7aeb2549'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'writerReviewerHandoffWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: ApplicationFailure: E-HANDOFF-CAS: receipt differs from proposed state[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Function.nonRetryable (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+common@1.22.0/node_modules/[4m@temporalio/common[24m/src/failure.ts:253:11)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at nonRetryable [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/writerReviewerHandoff.ts:76:27[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at casFailure [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/writerReviewerHandoff.ts:124:66[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at assertWriterReviewerHandoffReceipt [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90msrc/workflows/writerReviewerHandoff.ts:160:12[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at Script.runInContext (node:vm:149:12)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Proxy.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/reusable-vm.js:220:45)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at ReusableVMWorkflow.activate (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/vm-shared.js:404:37)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at handleRequest (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:73:47)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at MessagePort.<anonymous> (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/workflow/workflow-worker-thread.js:145:28)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:843:20)[39m[90m {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    [cause]: [90mundefined[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.923Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.924Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.930Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:26.930Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'p8-t07-handoff-stale'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24772) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.150Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 823 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.153Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.188Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.257Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.257Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.258Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.258Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.297Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 746 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-1'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.300Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.321Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.328Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 760 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-3'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.330Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.371Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.371Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.375Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 731 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-duplicate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.371Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.378Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.378Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-1'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.378Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.433Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.433Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.433Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.433Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-3'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.631Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 804 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.634Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.644Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.644Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-email-duplicate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.649Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24776) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.702Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.702Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.702Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.703Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.740Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.740Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.742Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.742Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.915Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 1032 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-0'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.920Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24792) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.957Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.966Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 686 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:27.972Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.003Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.036Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.036Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.037Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.037Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-0'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.041Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.041Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.041Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.041Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.100Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 686 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'fake_replay_queue-2'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.105Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.135Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.163Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.163Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.164Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.164Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'fake_replay_queue-2'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24902) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=some-other-client.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24903) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24985) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.qa[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25110) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25235) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25241) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25234) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25278) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.staging[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.527Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 647 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.530Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25526) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25525) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.staging[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25609) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.707Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.707Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25775) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25823) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25859) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25901) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:25902) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.797Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.797Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.798Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:28.798Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-teams-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m-----[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mCertificate request self-signature ok[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90msubject=CN=aiops-temporal-worker.dev[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:26150) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:26151) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:26152) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:26276) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.290Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 357 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-duplicate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.292Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.402Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.402Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-github-duplicate'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.445Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.445Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.446Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.446Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-github-duplicate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.878Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 307 ms { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:29.881Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.003Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.003Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks { sdkComponent: [32m'worker'[39m[90m, taskQueue: [32m'status-ingest-shadow'[39m[90m }[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.035Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.035Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.035Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.035Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-shadow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.468Z[39m[90m [INFO] asset workflow-bundle-86636c500be34f2840a0.js 2.21 MiB [emitted] [immutable] (name: main)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mruntime modules 1.34 KiB 4 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ../ 449 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../../node_modules/.pnpm/ 438 KiB 76 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ../shared/dist/ 10.6 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/reporting/statusIngestContract.js 3.49 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ../shared/dist/secretSanitizer.js 7.07 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mmodules by path ./src/ 194 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/workflows/ 109 KiB 17 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  modules by path ./src/lib/*.ts 84.7 KiB[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    ./src/lib/idempotency.ts 2.14 KiB [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m    + 11 modules[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  ./src/contracts/index.ts 482 bytes [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90moptional modules 30 bytes [optional][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_payload_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  __temporal_custom_failure_converter (ignored) 15 bytes [optional] [built] [code generated][39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90mwebpack 5.109.2 compiled successfully in 308 ms {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.471Z[39m[90m [INFO] Workflow bundle created {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  size: [32m'2.20MB'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(node:24627) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.596Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'RUNNING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.596Z[39m[90m [INFO] No Nexus services registered, not polling for Nexus tasks {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.635Z[39m[90m [WARN] Activity failed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  isLocal: [33mfalse[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  attempt: [33m1[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  namespace: [32m'default'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskToken: [32m'AAdkZWZhdWx0AC5yZXBvcnQvc3RhdHVzLWluZ2VzdDplbWFpbDplbWFpbC1sb3N0LXJlc3BvbnNlACRjZGRmYTZmYS02NDVjLTRjMGQtYjE2Ny0xMmRjY2UyYTg5Y2UAAAAAAAAAHQAAAAE='[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityId: [32m'5'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  activityType: [32m'persistCanonicalStatusUpdate'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowId: [32m'report/status-ingest:email:email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowRunId: [32m'cddfa6fa-645c-4c0d-b167-12dcce2a89ce'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  workflowType: [32m'statusIngestWorkflow'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  error: Error: synthetic response loss[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at h.activities.persistCanonicalStatusUpdate [90m(/Users/mryfmo/Workspace/ai-ops-platform/packages/control-plane/[39m[90mtests/statusIngestWorkflow.test.ts:230:13[90m)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at executeNextHandler (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:100:54)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.execute (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:102:26)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:150:29[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at NativeConnection.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/connection.js:172:46)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Client.withAbortSignal (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+client@1.22.0/node_modules/[4m@temporalio/client[24m/lib/base-client.js:65:38)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at Activity.executeWithClient (/Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:149:33)[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m      at /Users/mryfmo/Workspace/ai-ops-platform/node_modules/[4m.pnpm[24m/@temporalio+worker@1.22.0_esbuild@0.28.1/node_modules/[4m@temporalio/worker[24m/lib/activity.js:162:43[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  [90m    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:91:14)[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  durationMs: [33m0[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.658Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.658Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINING'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.658Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'DRAINED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m[35m2026-08-29T22:23:30.658Z[39m[90m [INFO] Worker state changed {[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  sdkComponent: [32m'worker'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  taskQueue: [32m'status-ingest-email-lost-response'[39m[90m,[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m  state: [32m'STOPPED'[39m[90m[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [90m}[39m
[33mpackages/control-plane[39m [96mtest:coverage[39m:  Test Files  38 passed (38)
[33mpackages/control-plane[39m [96mtest:coverage[39m:       Tests  362 passed (362)
[33mpackages/control-plane[39m [96mtest:coverage[39m:    Start at  07:23:05
[33mpackages/control-plane[39m [96mtest:coverage[39m:    Duration  25.65s (transform 1.64s, setup 0ms, import 27.76s, tests 131.18s, environment 2ms)
[33mpackages/control-plane[39m [96mtest:coverage[39m:  % Coverage report from v8
[33mpackages/control-plane[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[33mpackages/control-plane[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[33mpackages/control-plane[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  84.12[0m | [32;1m   87.21[0m | [32;1m  91.24[0m | [32;1m  85.82[0m | [31;1m                 [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m src/activities   [0m | [32;1m  85.55[0m | [32;1m   85.61[0m | [32;1m    100[0m | [32;1m  90.24[0m | [31;1m                 [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  m365Egress.ts   [0m | [32;1m  94.11[0m | [32;1m    90.9[0m | [32;1m    100[0m | [32;1m  93.33[0m | [31;1m62               [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...redentials.ts[0m | [32;1m  84.66[0m | [32;1m   85.15[0m | [32;1m    100[0m | [32;1m  89.93[0m | [31;1m...93,427,436-441[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m src/lib          [0m | [32;1m  88.15[0m | [32;1m   89.38[0m | [32;1m  94.81[0m | [32;1m  88.51[0m | [31;1m                 [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...ymentState.ts[0m | [32;1m  86.02[0m | [32;1m   87.87[0m | [32;1m  92.85[0m | [32;1m  87.35[0m | [31;1m...51,300,312,318[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...nSchedules.ts[0m | [32;1m  91.66[0m | [32;1m   92.85[0m | [32;1m    100[0m | [32;1m   90.9[0m | [31;1m29               [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...ptionState.ts[0m | [32;1m  92.85[0m | [32;1m   93.33[0m | [32;1m     80[0m | [32;1m  92.85[0m | [31;1m76,79,134        [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  jiraSyncState.ts[0m | [32;1m  82.26[0m | [32;1m   83.97[0m | [32;1m    100[0m | [32;1m  81.06[0m | [31;1m...31,448,459,463[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...hSchedules.ts[0m | [32;1m   90.9[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m   90.9[0m | [31;1m24               [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...ealthState.ts[0m | [32;1m  86.76[0m | [32;1m    87.5[0m | [32;1m  91.66[0m | [32;1m  86.76[0m | [31;1m...38,156,161,165[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  m365Egress.ts   [0m | [32;1m   97.5[0m | [32;1m   92.64[0m | [32;1m    100[0m | [32;1m  97.22[0m | [31;1m184              [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...eSyncState.ts[0m | [32;1m  93.18[0m | [32;1m   94.64[0m | [32;1m    100[0m | [32;1m  95.23[0m | [31;1m123,239,248,268  [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...iveryState.ts[0m | [32;1m   98.7[0m | [32;1m   99.04[0m | [32;1m    100[0m | [32;1m  98.66[0m | [31;1m181              [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [33;1m  ...ngestState.ts[0m | [33;1m  62.13[0m | [33;1m   65.25[0m | [33;1m  73.33[0m | [33;1m  63.54[0m | [31;1m...71,217,238-306[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...ralProfile.ts[0m | [32;1m  92.53[0m | [32;1m   91.48[0m | [32;1m    100[0m | [32;1m  92.18[0m | [31;1m...27,161,181,185[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m src/temporal     [0m | [32;1m  92.59[0m | [32;1m   86.66[0m | [32;1m  88.88[0m | [32;1m  92.59[0m | [31;1m                 [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  connection.ts   [0m | [32;1m  85.71[0m | [33;1m   77.77[0m | [32;1m     80[0m | [32;1m  85.71[0m | [31;1m72,75            [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [33;1m src/workflows    [0m | [33;1m   68.7[0m | [33;1m   73.75[0m | [33;1m  75.55[0m | [33;1m  71.92[0m | [31;1m                 [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [33;1m  cancellation.ts [0m | [33;1m  66.66[0m | [33;1m      50[0m | [32;1m    100[0m | [33;1m  66.66[0m | [31;1m15               [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [31;1m  ...bscription.ts[0m | [31;1m    9.3[0m | [31;1m       0[0m | [31;1m   12.5[0m | [31;1m  10.25[0m | [31;1m83-217           [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [33;1m  ...werHandoff.ts[0m | [33;1m  59.61[0m | [32;1m    82.6[0m | [33;1m  63.63[0m | [33;1m  57.77[0m | [31;1m107,122,132-169  [0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1m  ...ndoffState.ts[0m | [32;1m  84.44[0m | [33;1m   79.64[0m | [32;1m    100[0m | [32;1m   92.1[0m | [31;1m...45,252,262,271[0m 
[33mpackages/control-plane[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[33mpackages/control-plane[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1mStatements   : 84.12% ( 1134/1348 )[0m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1mBranches     : 87.21% ( 1235/1416 )[0m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1mFunctions    : 91.24% ( 198/217 )[0m
[33mpackages/control-plane[39m [96mtest:coverage[39m: [32;1mLines        : 85.82% ( 1078/1256 )[0m
[33mpackages/control-plane[39m [96mtest:coverage[39m: ================================================================================
[33mpackages/control-plane[39m [96mtest:coverage[39m: Done
[35mpackages/server[39m [96mtest:coverage[39m$ vitest run --coverage
[34mpackages/web[39m [96mtest:coverage[39m$ vitest run --coverage
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26374) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26328) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/server
[35mpackages/server[39m [96mtest:coverage[39m:       Coverage enabled with v8
[34mpackages/web[39m [96mtest:coverage[39m:  RUN  v4.1.10 /Users/mryfmo/Workspace/ai-ops-platform/packages/web
[34mpackages/web[39m [96mtest:coverage[39m:       Coverage enabled with v8
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26391) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26389) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26388) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26386) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26385) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26387) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26390) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26395) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26397) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26396) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26392) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26394) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26398) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26393) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26400) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26409) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26418) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26422) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26425) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26427) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26428) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26430) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26431) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26433) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26434) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26439) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26444) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26449) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26450) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26452) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26453) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26454) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26455) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26456) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26457) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26458) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26459) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26460) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26461) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26462) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26463) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26464) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26465) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26466) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26467) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26468) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26469) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26470) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26471) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26472) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26473) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26474) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26475) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26476) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26477) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26481) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26482) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26483) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26484) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26485) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26487) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26488) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26489) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26490) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26491) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26492) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26494) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26495) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26499) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26500) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26503) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26505) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26507) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26508) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26506) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26509) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26510) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26512) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26513) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26514) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26515) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26516) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26517) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26518) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26519) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26520) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26521) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26522) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26523) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26524) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26525) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26526) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26527) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26528) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26529) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26530) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26531) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26532) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26533) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26534) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26535) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26536) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26537) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26538) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26539) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26540) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26541) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26542) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26543) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26544) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26547) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26549) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26550) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26551) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26552) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26553) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26554) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26555) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26556) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26557) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26558) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26559) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26560) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26561) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26562) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26563) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26564) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(node:26565) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[34mpackages/web[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26566) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26567) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26568) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26569) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26570) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26571) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26572) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26576) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26577) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26578) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(node:26579) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.[39m
[35mpackages/server[39m [96mtest:coverage[39m: [90m(Use `node --trace-warnings ...` to show where the warning was created)[39m
[34mpackages/web[39m [96mtest:coverage[39m:  Test Files  44 passed (44)
[34mpackages/web[39m [96mtest:coverage[39m:       Tests  365 passed (365)
[34mpackages/web[39m [96mtest:coverage[39m:    Start at  07:23:31
[34mpackages/web[39m [96mtest:coverage[39m:    Duration  13.56s (transform 4.58s, setup 0ms, import 32.68s, tests 6.58s, environment 40.06s)
[34mpackages/web[39m [96mtest:coverage[39m:  % Coverage report from v8
[34mpackages/web[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[34mpackages/web[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[34mpackages/web[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[34mpackages/web[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  82.92[0m | [33;1m    73.4[0m | [32;1m  83.62[0m | [32;1m  85.68[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m src              [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  auth.ts         [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m17-38            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  proxy.ts        [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m19-28            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m src/app          [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  layout.tsx      [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m11-17            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  page.tsx        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m11               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m .../api/approvals[0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m6-11             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...s/[approvalId][0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m7-10             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m .../[...nextauth][0m | [31;1m      0[0m | [32;1m     100[0m | [32;1m    100[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [32;1m    100[0m | [31;1m      0[0m | [31;1m9                [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m src/app/api/chat [0m | [32;1m  86.66[0m | [31;1m      25[0m | [33;1m     50[0m | [32;1m  86.66[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  route.ts        [0m | [32;1m  86.66[0m | [31;1m      25[0m | [33;1m     50[0m | [32;1m  86.66[0m | [31;1m53-54            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m ...anager-summary[0m | [32;1m    100[0m | [33;1m      50[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  route.ts        [0m | [32;1m    100[0m | [33;1m      50[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m43               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m ...ata/timeseries[0m | [32;1m    100[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  route.ts        [0m | [32;1m    100[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m32-38            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...app/api/health[0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m15-20            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...pp/api/mcp-ops[0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m6-11             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...[invocationId][0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m6-14             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m .../[workspaceId][0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m6-12             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...pi/xlsx-import[0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m6-11             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...mport/template[0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  route.ts        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m6-11             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m src/app/approvals[0m | [33;1m  72.09[0m | [33;1m   51.35[0m | [33;1m  78.57[0m | [33;1m  77.14[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...valsPanel.tsx[0m | [32;1m  83.78[0m | [33;1m   54.28[0m | [32;1m  84.61[0m | [32;1m     90[0m | [31;1m32,53,92         [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  page.tsx        [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m8-14             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m src/app/dashboard[0m | [33;1m  70.49[0m | [31;1m   44.89[0m | [32;1m  83.33[0m | [33;1m  76.36[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  page.tsx        [0m | [33;1m     70[0m | [31;1m   44.89[0m | [32;1m     80[0m | [33;1m  75.92[0m | [31;1m72-73,198-254    [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...hboard/mcp-ops[0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  McpOpsPanel.tsx [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m2-54             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  page.tsx        [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m8-14             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m ...rd/xlsx-import[0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  page.tsx        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m5                [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m src/app/login    [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  SignInButton.tsx[0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m7-15             [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  page.tsx        [0m | [31;1m      0[0m | [32;1m     100[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m11               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m src/components   [0m | [32;1m   82.8[0m | [33;1m   69.69[0m | [32;1m   91.3[0m | [32;1m  87.19[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  ...ardClient.tsx[0m | [33;1m  77.62[0m | [33;1m   55.95[0m | [32;1m  85.18[0m | [32;1m  82.94[0m | [31;1m...61,275,313,330[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...aSelector.tsx[0m | [32;1m   90.9[0m | [32;1m    87.5[0m | [32;1m    100[0m | [32;1m   90.9[0m | [31;1m30               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...ectPicker.tsx[0m | [32;1m    100[0m | [32;1m   93.54[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m49,65            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...portPanel.tsx[0m | [32;1m  88.37[0m | [33;1m   76.19[0m | [32;1m    100[0m | [32;1m  92.68[0m | [31;1m40-41,70         [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m ...ponents/charts[0m | [33;1m  73.91[0m | [33;1m   54.54[0m | [32;1m   92.3[0m | [33;1m  66.66[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  ...rtsPanels.tsx[0m | [33;1m     60[0m | [31;1m    37.5[0m | [32;1m     80[0m | [33;1m  54.54[0m | [31;1m43,63-98,129     [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m ...omponents/chat[0m | [33;1m  71.42[0m | [33;1m   68.65[0m | [32;1m   87.5[0m | [32;1m  83.63[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  ChatPanel.tsx   [0m | [33;1m  71.42[0m | [33;1m   68.65[0m | [32;1m   87.5[0m | [32;1m  83.63[0m | [31;1m...46,186-190,223[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m src/components/ui[0m | [32;1m    100[0m | [32;1m   94.73[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...Container.tsx[0m | [32;1m    100[0m | [33;1m   66.66[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m23               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m ...mponents/views[0m | [33;1m  62.76[0m | [31;1m    37.7[0m | [33;1m     50[0m | [33;1m  63.73[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  ...ivityView.tsx[0m | [33;1m  58.33[0m | [33;1m      50[0m | [31;1m   37.5[0m | [33;1m  58.33[0m | [31;1m61-72,104        [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...nKeysView.tsx[0m | [32;1m    100[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m56,117           [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  ...eportView.tsx[0m | [31;1m  37.03[0m | [31;1m      25[0m | [31;1m     20[0m | [31;1m     40[0m | [31;1m...8,72-77,99-105[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [31;1m  ...mmaryView.tsx[0m | [31;1m  45.83[0m | [31;1m   28.57[0m | [31;1m  31.57[0m | [31;1m  45.83[0m | [31;1m...,86-90,145-154[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  McpOpsView.tsx  [0m | [32;1m    100[0m | [31;1m   18.75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m19-100           [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m ...ents/workbench[0m | [32;1m    100[0m | [32;1m   86.48[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  GadgetView.tsx  [0m | [32;1m    100[0m | [32;1m   86.48[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m30,39-51,77-101  [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m src/server       [0m | [32;1m  90.44[0m | [32;1m   83.07[0m | [32;1m    100[0m | [32;1m   93.1[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...valsClient.ts[0m | [32;1m  81.48[0m | [33;1m   71.42[0m | [32;1m    100[0m | [33;1m  79.59[0m | [31;1m...09,112,115,133[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  authGuard.ts    [0m | [32;1m  94.73[0m | [32;1m   94.11[0m | [32;1m    100[0m | [32;1m  94.11[0m | [31;1m28,33            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  config.ts       [0m | [32;1m  97.43[0m | [32;1m   93.75[0m | [32;1m    100[0m | [32;1m  97.14[0m | [31;1m155              [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  entraClaims.ts  [0m | [32;1m  97.29[0m | [32;1m   96.29[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m41               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  mcpOpsClient.ts [0m | [32;1m  89.28[0m | [33;1m   71.42[0m | [32;1m    100[0m | [32;1m  88.46[0m | [31;1m78,104,111       [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  ...naResolver.ts[0m | [33;1m  79.45[0m | [33;1m   70.96[0m | [32;1m    100[0m | [32;1m  89.28[0m | [31;1m49-52,172-173    [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...tSelection.ts[0m | [32;1m    100[0m | [32;1m   93.54[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m46-52            [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...enchClient.ts[0m | [32;1m   92.3[0m | [33;1m   78.57[0m | [32;1m    100[0m | [32;1m   91.3[0m | [31;1m91,118           [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...nchHandoff.ts[0m | [32;1m  89.21[0m | [32;1m   89.09[0m | [32;1m    100[0m | [32;1m  95.34[0m | [31;1m108,202,233,279  [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...ortHandler.ts[0m | [32;1m  89.47[0m | [33;1m    73.8[0m | [32;1m    100[0m | [32;1m     92[0m | [31;1m24,66,99,123     [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...portPolicy.ts[0m | [32;1m    100[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m7                [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m src/server/chat  [0m | [32;1m  92.99[0m | [32;1m   83.49[0m | [32;1m  97.61[0m | [32;1m  93.95[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  chatHandler.ts  [0m | [32;1m  85.71[0m | [33;1m   74.07[0m | [32;1m  93.33[0m | [32;1m   87.5[0m | [31;1m...20-124,159,163[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  provider.ts     [0m | [32;1m    100[0m | [32;1m   85.71[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m18,34,38         [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m ...ver/reportData[0m | [32;1m  90.38[0m | [33;1m   77.32[0m | [32;1m  97.14[0m | [32;1m  94.32[0m | [31;1m                 [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...tivityData.ts[0m | [32;1m    100[0m | [33;1m      50[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m41               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...ReportData.ts[0m | [32;1m  97.91[0m | [32;1m   86.56[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m...31,267,277-279[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...aryHandler.ts[0m | [32;1m    100[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m27               [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...taProvider.ts[0m | [32;1m  84.79[0m | [33;1m   70.73[0m | [32;1m  96.07[0m | [32;1m  89.17[0m | [31;1m...10,262,296,458[0m 
[34mpackages/web[39m [96mtest:coverage[39m: [32;1m  ...ReportData.ts[0m | [32;1m    100[0m | [32;1m   96.15[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m219              [0m 
[34mpackages/web[39m [96mtest:coverage[39m: [33;1m  ...iesHandler.ts[0m | [33;1m  73.58[0m | [33;1m   60.86[0m | [32;1m  83.33[0m | [32;1m  87.17[0m | [31;1m63-64,67-68,85   [0m 
[34mpackages/web[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[34mpackages/web[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[34mpackages/web[39m [96mtest:coverage[39m: [32;1mStatements   : 82.92% ( 1564/1886 )[0m
[34mpackages/web[39m [96mtest:coverage[39m: [33;1mBranches     : 73.4% ( 1035/1410 )[0m
[34mpackages/web[39m [96mtest:coverage[39m: [32;1mFunctions    : 83.62% ( 434/519 )[0m
[34mpackages/web[39m [96mtest:coverage[39m: [32;1mLines        : 85.68% ( 1449/1691 )[0m
[34mpackages/web[39m [96mtest:coverage[39m: ================================================================================
[34mpackages/web[39m [96mtest:coverage[39m: Done
[35mpackages/server[39m [96mtest:coverage[39m:  Test Files  95 passed (95)
[35mpackages/server[39m [96mtest:coverage[39m:       Tests  990 passed (990)
[35mpackages/server[39m [96mtest:coverage[39m:    Start at  07:23:31
[35mpackages/server[39m [96mtest:coverage[39m:    Duration  14.19s (transform 4.51s, setup 0ms, import 59.18s, tests 14.23s, environment 6ms)
[35mpackages/server[39m [96mtest:coverage[39m:  % Coverage report from v8
[35mpackages/server[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[35mpackages/server[39m [96mtest:coverage[39m: File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
[35mpackages/server[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[35mpackages/server[39m [96mtest:coverage[39m: [32;1mAll files         [0m | [32;1m  83.98[0m | [33;1m   77.42[0m | [32;1m  81.56[0m | [32;1m   86.3[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [31;1m src              [0m | [31;1m  40.41[0m | [31;1m   49.59[0m | [31;1m  26.71[0m | [31;1m  39.72[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  config.ts       [0m | [32;1m  99.21[0m | [32;1m   93.33[0m | [32;1m  95.83[0m | [32;1m  99.16[0m | [31;1m338              [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [31;1m  index.ts        [0m | [31;1m   2.69[0m | [31;1m     3.7[0m | [31;1m   3.12[0m | [31;1m   2.35[0m | [31;1m189-190,219-1126 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [31;1m  main.ts         [0m | [31;1m      0[0m | [31;1m       0[0m | [31;1m      0[0m | [31;1m      0[0m | [31;1m14-38            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...rLifecycle.ts[0m | [32;1m   92.3[0m | [33;1m    62.5[0m | [32;1m    100[0m | [32;1m   91.3[0m | [31;1m28-29            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/agents       [0m | [32;1m   82.5[0m | [33;1m   68.46[0m | [32;1m  92.68[0m | [32;1m  87.79[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ntHandlers.ts[0m | [32;1m  82.58[0m | [33;1m   72.12[0m | [32;1m  88.88[0m | [32;1m  89.62[0m | [31;1m...94,435,496,502[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ationAgent.ts[0m | [32;1m   82.4[0m | [33;1m    62.1[0m | [32;1m    100[0m | [32;1m  85.71[0m | [31;1m...94,315,358-359[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/auth         [0m | [32;1m  94.68[0m | [32;1m   86.76[0m | [32;1m     85[0m | [32;1m  96.38[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...enProvider.ts[0m | [32;1m  97.72[0m | [32;1m   89.18[0m | [32;1m     90[0m | [32;1m   97.5[0m | [31;1m53               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...enProvider.ts[0m | [32;1m  94.44[0m | [32;1m    90.9[0m | [33;1m     75[0m | [32;1m  94.11[0m | [31;1m35               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...enProvider.ts[0m | [32;1m  90.62[0m | [32;1m      80[0m | [32;1m  83.33[0m | [32;1m  96.15[0m | [31;1m84               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/db           [0m | [32;1m  86.35[0m | [33;1m   74.44[0m | [32;1m  92.05[0m | [32;1m   89.7[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...LedgerRepo.ts[0m | [32;1m    100[0m | [32;1m   89.28[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m71,105-123       [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...rStateRepo.ts[0m | [32;1m   90.9[0m | [32;1m   81.81[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m19-25            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ndoffsRepo.ts[0m | [32;1m  84.92[0m | [33;1m   73.75[0m | [32;1m    100[0m | [32;1m  87.93[0m | [31;1m...62,269,288,290[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  agentRunsRepo.ts[0m | [32;1m    100[0m | [33;1m   72.72[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m42,66-67         [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  approvalsRepo.ts[0m | [33;1m  79.64[0m | [33;1m   73.14[0m | [32;1m  90.47[0m | [32;1m  85.71[0m | [31;1m...33-337,357,399[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ppingsRepo.ts[0m | [32;1m  95.23[0m | [32;1m   90.69[0m | [32;1m    100[0m | [32;1m  94.44[0m | [31;1m117              [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...ssagesRepo.ts[0m | [33;1m  61.53[0m | [31;1m   34.61[0m | [33;1m     50[0m | [33;1m  54.54[0m | [31;1m28,56-61,105-113 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...gTasksRepo.ts[0m | [32;1m    100[0m | [32;1m   82.75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m80-82,177        [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...ymentsRepo.ts[0m | [33;1m  69.81[0m | [33;1m   54.54[0m | [33;1m  78.57[0m | [32;1m  81.81[0m | [31;1m...65,178,200-227[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  eventsRepo.ts   [0m | [32;1m  92.79[0m | [32;1m   82.17[0m | [32;1m  93.75[0m | [32;1m  95.04[0m | [31;1m295,364-367      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  grantsRepo.ts   [0m | [33;1m  53.84[0m | [31;1m   38.46[0m | [33;1m     60[0m | [33;1m  58.33[0m | [31;1m38-55            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ptionsRepo.ts[0m | [32;1m  83.33[0m | [33;1m   56.25[0m | [32;1m    100[0m | [32;1m  89.18[0m | [31;1m152-153,162-163  [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ppingsRepo.ts[0m | [32;1m    100[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m64               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...LedgerRepo.ts[0m | [32;1m    100[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m16               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...denceRepos.ts[0m | [32;1m  88.88[0m | [32;1m      80[0m | [32;1m   90.9[0m | [32;1m   87.5[0m | [31;1m27,199           [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  mcpOpsRepo.ts   [0m | [32;1m   90.9[0m | [33;1m    67.5[0m | [32;1m  94.11[0m | [32;1m     95[0m | [31;1m52,68            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...seriesRepo.ts[0m | [33;1m     50[0m | [32;1m     100[0m | [33;1m  66.66[0m | [33;1m     50[0m | [31;1m87-101           [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  pool.ts         [0m | [33;1m     50[0m | [32;1m     100[0m | [33;1m     50[0m | [33;1m     50[0m | [31;1m31               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...annelsRepo.ts[0m | [32;1m    100[0m | [33;1m      70[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m41-43            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...pientsRepo.ts[0m | [32;1m     92[0m | [32;1m   86.11[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m25,37,68-88      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...eryLogRepo.ts[0m | [33;1m   62.5[0m | [31;1m   16.66[0m | [32;1m     80[0m | [33;1m   62.5[0m | [31;1m23-30            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...etricsRepo.ts[0m | [32;1m    100[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m41               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...pshotsRepo.ts[0m | [32;1m  96.29[0m | [32;1m    84.7[0m | [32;1m    100[0m | [32;1m  98.03[0m | [31;1m69               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...pshotsRepo.ts[0m | [32;1m  83.33[0m | [31;1m   43.75[0m | [32;1m  88.88[0m | [32;1m  81.81[0m | [31;1m59-64            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...eportsRepo.ts[0m | [33;1m  76.47[0m | [33;1m   63.63[0m | [33;1m     75[0m | [33;1m     75[0m | [31;1m36-37,71-78      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  workbenchRepo.ts[0m | [32;1m  94.28[0m | [32;1m      80[0m | [32;1m    100[0m | [32;1m  94.11[0m | [31;1m85,121           [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...owRunsRepo.ts[0m | [32;1m    100[0m | [33;1m      50[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m61-88            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/http/routes  [0m | [32;1m  88.99[0m | [33;1m   79.75[0m | [32;1m  97.64[0m | [32;1m  92.85[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  approvals.ts    [0m | [32;1m  85.15[0m | [32;1m   84.16[0m | [32;1m    100[0m | [32;1m  95.32[0m | [31;1m74,96,147,197,241[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  codingTasks.ts  [0m | [32;1m  87.95[0m | [33;1m   77.04[0m | [32;1m     90[0m | [32;1m  88.88[0m | [31;1m...07,288,329-337[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  githubWebhook.ts[0m | [32;1m  95.23[0m | [33;1m   78.57[0m | [32;1m    100[0m | [32;1m  95.23[0m | [31;1m52               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ifications.ts[0m | [32;1m  96.96[0m | [33;1m   75.67[0m | [32;1m    100[0m | [32;1m  96.96[0m | [31;1m107              [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  jiraWebhook.ts  [0m | [32;1m  84.21[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m  88.57[0m | [31;1m83,105-113,119   [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  m365Delegated.ts[0m | [32;1m  88.05[0m | [33;1m   77.77[0m | [32;1m     90[0m | [32;1m  88.52[0m | [31;1m...20,177,188-189[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  mcpOps.ts       [0m | [33;1m  79.59[0m | [33;1m   69.44[0m | [32;1m    100[0m | [32;1m     90[0m | [31;1m80-81,97-98      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  reportIngest.ts [0m | [32;1m  86.48[0m | [33;1m      76[0m | [32;1m    100[0m | [32;1m  88.88[0m | [31;1m39,62-70,90      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  webuiProxy.ts   [0m | [32;1m  95.55[0m | [32;1m   86.36[0m | [32;1m    100[0m | [32;1m  95.12[0m | [31;1m69,77            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  workbench.ts    [0m | [32;1m  91.83[0m | [33;1m   78.26[0m | [32;1m    100[0m | [32;1m  95.34[0m | [31;1m34,181           [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  xlsxImport.ts   [0m | [32;1m   94.2[0m | [32;1m   87.09[0m | [32;1m    100[0m | [32;1m  96.77[0m | [31;1m46,152           [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/lib          [0m | [32;1m  93.02[0m | [32;1m   86.57[0m | [32;1m   96.8[0m | [32;1m  96.15[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...arCoverage.ts[0m | [32;1m    100[0m | [32;1m      95[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m50               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...skManifest.ts[0m | [32;1m  90.47[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m     95[0m | [31;1m182              [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  confirmToken.ts [0m | [32;1m  97.56[0m | [32;1m   96.15[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m84               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...tTaskState.ts[0m | [32;1m    100[0m | [32;1m   96.77[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m64               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ventRouter.ts[0m | [32;1m    100[0m | [32;1m   84.78[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m...20,123-128,180[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...cleHandler.ts[0m | [32;1m   92.3[0m | [32;1m      80[0m | [32;1m    100[0m | [32;1m   92.3[0m | [31;1m30-38            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...nValidator.ts[0m | [32;1m  96.29[0m | [32;1m   94.73[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m42               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...tionPolicy.ts[0m | [32;1m  95.45[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m17               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...ventRouter.ts[0m | [33;1m  72.22[0m | [33;1m      72[0m | [32;1m    100[0m | [32;1m   87.8[0m | [31;1m59-62,83,92      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...stryStatus.ts[0m | [33;1m     60[0m | [32;1m   85.71[0m | [31;1m     25[0m | [33;1m  57.14[0m | [31;1m28-36            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...cationGate.ts[0m | [32;1m  96.66[0m | [33;1m   79.16[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m54,59,67,91-93   [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...leResolver.ts[0m | [33;1m  72.72[0m | [33;1m      75[0m | [32;1m    100[0m | [32;1m  85.71[0m | [31;1m30               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/observability[0m | [32;1m  92.17[0m | [32;1m   89.47[0m | [32;1m  88.23[0m | [32;1m  91.42[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  httpMetrics.ts  [0m | [32;1m    100[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m37               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  metrics.ts      [0m | [32;1m   91.8[0m | [32;1m   86.95[0m | [32;1m     90[0m | [32;1m  91.22[0m | [31;1m104-106,121-122  [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  telemetry.ts    [0m | [32;1m     90[0m | [32;1m      92[0m | [33;1m  77.77[0m | [32;1m  88.88[0m | [31;1m37-38,71,75      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/scheduler    [0m | [32;1m  89.28[0m | [33;1m      75[0m | [32;1m     85[0m | [32;1m   92.1[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  scheduler.ts    [0m | [32;1m  89.28[0m | [33;1m      75[0m | [32;1m     85[0m | [32;1m   92.1[0m | [31;1m78-79,137-139,164[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m ...cheduler/tasks[0m | [32;1m  92.86[0m | [32;1m   86.93[0m | [32;1m  96.34[0m | [32;1m  94.03[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...DeployTask.ts[0m | [32;1m  84.37[0m | [33;1m   68.75[0m | [32;1m    100[0m | [32;1m  89.65[0m | [31;1m91-100           [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ollingTask.ts[0m | [32;1m  86.95[0m | [32;1m    87.5[0m | [32;1m    100[0m | [32;1m  86.04[0m | [31;1m...04,222-223,226[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...ollingTask.ts[0m | [32;1m  97.05[0m | [32;1m    87.8[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m66,98-111        [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...hcheckTask.ts[0m | [32;1m    100[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m42               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...oncileTask.ts[0m | [32;1m    100[0m | [32;1m    87.5[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m72               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...cationTask.ts[0m | [32;1m  83.33[0m | [33;1m      50[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m25               [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...oncileTask.ts[0m | [32;1m    100[0m | [32;1m   83.33[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m32,60            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...rackerTask.ts[0m | [32;1m  91.13[0m | [32;1m   89.13[0m | [33;1m     75[0m | [32;1m  90.66[0m | [31;1m77-86,149-158    [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...nalyzeTask.ts[0m | [32;1m   90.9[0m | [32;1m      90[0m | [32;1m    100[0m | [32;1m  90.38[0m | [31;1m54-63,150-158    [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...onitorTask.ts[0m | [33;1m  79.31[0m | [33;1m   79.16[0m | [32;1m    100[0m | [32;1m  85.18[0m | [31;1m46-54,94,97      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...liveryTask.ts[0m | [32;1m  95.53[0m | [32;1m   87.15[0m | [32;1m  96.87[0m | [32;1m  97.57[0m | [31;1m133,309-320      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  ...apshotTask.ts[0m | [32;1m    100[0m | [32;1m   88.88[0m | [32;1m    100[0m | [32;1m    100[0m | [33;1m51,70            [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m src/tools        [0m | [32;1m  81.92[0m | [32;1m   84.15[0m | [33;1m     75[0m | [32;1m  84.95[0m | [31;1m                 [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...bscription.ts[0m | [33;1m     70[0m | [33;1m   76.66[0m | [33;1m     60[0m | [33;1m   72.5[0m | [31;1m87-109,114-116   [0m 
[35mpackages/server[39m [96mtest:coverage[39m: [32;1m  graphSmoke.ts   [0m | [32;1m  90.96[0m | [32;1m   89.04[0m | [32;1m  81.81[0m | [32;1m   92.3[0m | [31;1m...19-320,326-328[0m 
[35mpackages/server[39m [96mtest:coverage[39m: [33;1m  ...eDeadEvent.ts[0m | [33;1m  63.63[0m | [33;1m   65.38[0m | [33;1m     60[0m | [33;1m  72.22[0m | [31;1m75-82,87-89      [0m 
[35mpackages/server[39m [96mtest:coverage[39m: -------------------|---------|----------|---------|---------|-------------------
[35mpackages/server[39m [96mtest:coverage[39m: =============================== Coverage summary ===============================
[35mpackages/server[39m [96mtest:coverage[39m: [32;1mStatements   : 83.98% ( 3179/3785 )[0m
[35mpackages/server[39m [96mtest:coverage[39m: [33;1mBranches     : 77.42% ( 2401/3101 )[0m
[35mpackages/server[39m [96mtest:coverage[39m: [32;1mFunctions    : 81.56% ( 637/781 )[0m
[35mpackages/server[39m [96mtest:coverage[39m: [32;1mLines        : 86.3% ( 2950/3418 )[0m
[35mpackages/server[39m [96mtest:coverage[39m: ================================================================================
[35mpackages/server[39m [96mtest:coverage[39m: Done
[verify:db] $ bash verification/run_db_integration.sh
NOTICE:  drop cascades to 46 other objects
DETAIL:  drop cascades to table status_ingest_records
drop cascades to table schema_migrations
drop cascades to table events
drop cascades to table pm_events
drop cascades to table pm_snapshots
drop cascades to table seven_keys_snapshots
drop cascades to table deployments
drop cascades to table incidents
drop cascades to table grants
drop cascades to table recipients
drop cascades to table action_reminder_state
drop cascades to table standard_reports
drop cascades to table report_delivery_log
drop cascades to table report_snapshots
drop cascades to table audit_log
drop cascades to function audit_log_block_mutation()
drop cascades to function ensure_audit_log_partition(text,date)
drop cascades to function audit_retention_candidates(date)
drop cascades to table partner_companies
drop cascades to table project_channels
drop cascades to table channel_messages
drop cascades to table graph_subscriptions
drop cascades to table llm_usage
drop cascades to table coding_tasks
drop cascades to function coding_tasks_block_manifest_mutation()
drop cascades to table approvals
drop cascades to table import_ledger
drop cascades to table workflow_runs
drop cascades to table channel_conversation_mappings
drop cascades to table action_ledger
drop cascades to table workbench_workspaces
drop cascades to table workbench_workspace_sources
drop cascades to table workbench_workspace_runs
drop cascades to table workbench_pending_actions
drop cascades to table policy_decisions
drop cascades to table model_invocations
drop cascades to table tool_invocations
drop cascades to table work_iq_query_receipts
drop cascades to function work_iq_query_receipts_block_mutation()
drop cascades to table id_mapping_heads
drop cascades to table id_mappings
drop cascades to table meeting_artifacts
drop cascades to table agent_runs
drop cascades to table agent_handoffs
drop cascades to table agent_handoff_transitions
drop cascades to function agent_handoff_transitions_block_mutation()
DROP SCHEMA
CREATE SCHEMA
DO
GRANT
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE FUNCTION
CREATE FUNCTION
 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2026_08
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2026_09
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2026_08
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2026_09
(1 row)

CREATE TABLE
CREATE TABLE
DO
CREATE FUNCTION
DO
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
CREATE TRIGGER
DO
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
CREATE TRIGGER
CREATE TABLE
CREATE INDEX
DO
SET
INSERT 0 1
               trace_id               
--------------------------------------
 00000000-0000-0000-0000-000000000001
(1 row)

INSERT 0 1
INSERT 0 1
DO
RESET
ERROR:  no partition of relation "audit_log" found for row
DETAIL:  Partition key of the failing row contains (retention_class) = (invalid).
SET
ERROR:  permission denied for table audit_log
SET
ERROR:  permission denied for table audit_log
ERROR:  new row for relation "action_reminder_state" violates check constraint "action_reminder_state_action_id_check"
DETAIL:  Failing row contains (invalid, 1, 2026-08-30 07:23:46.473672+09, null).
ERROR:  new row for relation "action_reminder_state" violates check constraint "action_reminder_state_check"
DETAIL:  Failing row contains (ACT-002, 1, null, null).
SET
ERROR:  permission denied for table action_reminder_state
 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2025_05
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2025_05
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2025_05
(1 row)

SET
 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2031_01
(1 row)

SET
 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2031_02
(1 row)

INSERT 0 2
DO
RESET
SET
DO
RESET
CREATE SCHEMA
CREATE TABLE
CREATE TABLE
CREATE TABLE
SET
DO
RESET
NOTICE:  drop cascades to table audit_shadow.audit_log
DROP SCHEMA
INSERT 0 1
INSERT 0 1
DO
ERROR:  updated partition constraint for default partition "audit_log_devops_1y_default" would be violated by some row
CONTEXT:  SQL statement "CREATE TABLE audit_log_devops_1y_2030_04 PARTITION OF audit_log_devops_1y FOR VALUES FROM ('2030-04-01T00:00:00Z'::timestamptz) TO ('2030-05-01T00:00:00Z'::timestamptz)"
PL/pgSQL function ensure_audit_log_partition(text,date) line 19 at EXECUTE
DO
(node:26612) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ tsx src/db/migrate.ts[22m
(node:26660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:26666) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
migrations applied=24 skipped=0
(node:26669) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ tsx src/db/migrate.ts[22m
(node:26720) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:26726) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
migrations applied=0 skipped=24
NOTICE:  drop cascades to 46 other objects
DETAIL:  drop cascades to table schema_migrations
drop cascades to table events
drop cascades to table pm_events
drop cascades to table pm_snapshots
drop cascades to table seven_keys_snapshots
drop cascades to table deployments
drop cascades to table incidents
drop cascades to table grants
drop cascades to table recipients
drop cascades to table action_reminder_state
drop cascades to table standard_reports
drop cascades to table report_delivery_log
drop cascades to table report_snapshots
drop cascades to table audit_log
drop cascades to function audit_log_block_mutation()
drop cascades to function ensure_audit_log_partition(text,date)
drop cascades to function audit_retention_candidates(date)
drop cascades to table partner_companies
drop cascades to table project_channels
drop cascades to table channel_messages
drop cascades to table graph_subscriptions
drop cascades to table llm_usage
drop cascades to table coding_tasks
drop cascades to function coding_tasks_block_manifest_mutation()
drop cascades to table approvals
drop cascades to table import_ledger
drop cascades to table workflow_runs
drop cascades to table channel_conversation_mappings
drop cascades to table action_ledger
drop cascades to table workbench_workspaces
drop cascades to table workbench_workspace_sources
drop cascades to table workbench_workspace_runs
drop cascades to table workbench_pending_actions
drop cascades to table policy_decisions
drop cascades to table model_invocations
drop cascades to table tool_invocations
drop cascades to table work_iq_query_receipts
drop cascades to function work_iq_query_receipts_block_mutation()
drop cascades to table id_mapping_heads
drop cascades to table id_mappings
drop cascades to table meeting_artifacts
drop cascades to table agent_runs
drop cascades to table agent_handoffs
drop cascades to table agent_handoff_transitions
drop cascades to function agent_handoff_transitions_block_mutation()
drop cascades to table status_ingest_records
DROP SCHEMA
CREATE SCHEMA
CREATE TABLE
INSERT 0 3
DO
psql:/Users/mryfmo/Workspace/ai-ops-platform/packages/devops/src/db/migrations/202607110000_audit_log_partitions.sql:60: NOTICE:  relation "audit_log_log_id_seq" already exists, skipping
CREATE SEQUENCE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE FUNCTION
 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2026_08
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2026_09
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2026_08
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2026_09
(1 row)

CREATE TABLE
CREATE TABLE
CREATE FUNCTION
DO
DO
DO
NOTICE:  drop cascades to 3 other objects
DETAIL:  drop cascades to table audit_log
drop cascades to function ensure_audit_log_partition(text,date)
drop cascades to function audit_retention_candidates(date)
DROP SCHEMA
CREATE SCHEMA
CREATE TABLE
INSERT 0 1
psql:/Users/mryfmo/Workspace/ai-ops-platform/packages/devops/src/db/migrations/202607110000_audit_log_partitions.sql:58: ERROR:  non-empty legacy audit_log requires reviewed retention classification
CONTEXT:  PL/pgSQL function inline_code_block line 33 at RAISE
DO
NOTICE:  drop cascades to table audit_log
DROP SCHEMA
CREATE SCHEMA
CREATE TABLE
INSERT 0 1
DO
psql:/var/folders/r2/_gkywj713g54lbxkc_hv7j400000gn/T/p001-mismatch.XXXXXX.sql:60: NOTICE:  relation "audit_log_log_id_seq" already exists, skipping
CREATE SEQUENCE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE TABLE
CREATE FUNCTION
 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2026_08
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_prjops_5y_2026_09
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2026_08
(1 row)

 ensure_audit_log_partition  
-----------------------------
 audit_log_devops_1y_2026_09
(1 row)

CREATE TABLE
CREATE TABLE
CREATE FUNCTION
psql:/var/folders/r2/_gkywj713g54lbxkc_hv7j400000gn/T/p001-mismatch.XXXXXX.sql:226: ERROR:  audit_log copy validation failed: before=1, after=2, content_mismatch=f
CONTEXT:  PL/pgSQL function inline_code_block line 58 at RAISE
DO
P001 PostgreSQL integration passed
```

## `pnpm run jira-mapping:validate`

```text
(node:26766) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node --test tests/validate-jira-environment-mapping.test.mjs && node scripts/validate-jira-environment-mapping.mjs docs/contracts/fixtures/jira-environment-mapping.dev.json[22m
(node:26816) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:26817) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: accepts tracked development mapping and emits go-live replacement warning
ok 1 - accepts tracked development mapping and emits go-live replacement warning
  ---
  duration_ms: 33.683875
  type: 'test'
  ...
# Subtest: accepts owner-signed production mapping
ok 2 - accepts owner-signed production mapping
  ---
  duration_ms: 0.250208
  type: 'test'
  ...
# Subtest: rejects unknown fields, malformed JSON, and noncanonical PJ keys
ok 3 - rejects unknown fields, malformed JSON, and noncanonical PJ keys
  ---
  duration_ms: 32.631041
  type: 'test'
  ...
# Subtest: rejects duplicate Jira or GitHub mappings
ok 4 - rejects duplicate Jira or GitHub mappings
  ---
  duration_ms: 0.320208
  type: 'test'
  ...
# Subtest: rejects unknown/protected statuses and unsafe URLs
ok 5 - rejects unknown/protected statuses and unsafe URLs
  ---
  duration_ms: 0.506
  type: 'test'
  ...
# Subtest: rejects stale versions and incomplete production replacement
ok 6 - rejects stale versions and incomplete production replacement
  ---
  duration_ms: 0.524875
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 114.133208
WARNING: DEV-DEFAULT: replace Jira mapping before go-live with owner-signed production values.
OK: validated 2 Jira project mappings.
```

## `pnpm run governance:check`

```text
(node:26821) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node scripts/check-codeowners.mjs && node --test scripts/verify-canonical-spec-mirrors.test.mjs scripts/coding-agent-path-guard.test.mjs tests/architecture-fitness.test.mjs && node scripts/verify-canonical-spec-mirrors.mjs && node scripts/check-architecture-fitness.mjs && pnpm run plane-mapping:validate && pnpm run jira-mapping:validate[22m
(node:26872) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:26873) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: FinalArch:COD-001 allows a content change wholly inside the manifest allowlist
ok 1 - FinalArch:COD-001 allows a content change wholly inside the manifest allowlist
  ---
  duration_ms: 403.55475
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a direct manifest-forbidden write
ok 2 - FinalArch:COD-004 rejects a direct manifest-forbidden write
  ---
  duration_ms: 334.480042
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an ignored credential file
ok 3 - FinalArch:COD-004 rejects an ignored credential file
  ---
  duration_ms: 334.3305
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects modification of an existing ignored path outside the allowlist
ok 4 - FinalArch:COD-004 rejects modification of an existing ignored path outside the allowlist
  ---
  duration_ms: 339.076666
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a forbidden file hidden by a changed ignore rule
ok 5 - FinalArch:COD-004 rejects a forbidden file hidden by a changed ignore rule
  ---
  duration_ms: 341.067625
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a .git hook insertion
ok 6 - FinalArch:COD-004 rejects a .git hook insertion
  ---
  duration_ms: 295.36825
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects workflow governance modification even if manifest allows it
ok 7 - FinalArch:COD-004 rejects workflow governance modification even if manifest allows it
  ---
  duration_ms: 330.898333
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects self-modification of the manifest contract
ok 8 - FinalArch:COD-004 rejects self-modification of the manifest contract
  ---
  duration_ms: 325.70675
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects self-modification of the path guard
ok 9 - FinalArch:COD-004 rejects self-modification of the path guard
  ---
  duration_ms: 335.558875
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a tampered baseline snapshot
ok 10 - FinalArch:COD-004 rejects a tampered baseline snapshot
  ---
  duration_ms: 273.287875
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects rename-based boundary swaps
ok 11 - FinalArch:COD-004 rejects rename-based boundary swaps
  ---
  duration_ms: 330.683333
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects a forbidden mode-only change
ok 12 - FinalArch:COD-004 rejects a forbidden mode-only change
  ---
  duration_ms: 334.744333
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an allowed symlink that escapes the repository
ok 13 - FinalArch:COD-004 rejects an allowed symlink that escapes the repository
  ---
  duration_ms: 333.277709
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an allowed symlink into a forbidden path
ok 14 - FinalArch:COD-004 rejects an allowed symlink into a forbidden path
  ---
  duration_ms: 329.963833
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an unresolved allowed symlink
ok 15 - FinalArch:COD-004 rejects an unresolved allowed symlink
  ---
  duration_ms: 323.095959
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects an ignored allowed symlink escape
ok 16 - FinalArch:COD-004 rejects an ignored allowed symlink escape
  ---
  duration_ms: 328.907958
  type: 'test'
  ...
# Subtest: FinalArch:COD-004 rejects traversal in the validated manifest before snapshotting
ok 17 - FinalArch:COD-004 rejects traversal in the validated manifest before snapshotting
  ---
  duration_ms: 133.714833
  type: 'test'
  ...
# (node:26874) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: SPEC-INT-010 accepts an allowlisted regular Markdown entry
ok 18 - SPEC-INT-010 accepts an allowlisted regular Markdown entry
  ---
  duration_ms: 1.669709
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects invalid UTF-8 filenames
ok 19 - SPEC-INT-010 rejects invalid UTF-8 filenames
  ---
  duration_ms: 0.329667
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects absolute, traversal, slash, backslash, and control filenames
ok 20 - SPEC-INT-010 rejects absolute, traversal, slash, backslash, and control filenames
  ---
  duration_ms: 0.089542
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects renamed and non-allowlisted Unicode lookalike entries
ok 21 - SPEC-INT-010 rejects renamed and non-allowlisted Unicode lookalike entries
  ---
  duration_ms: 0.618417
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects NFC-equivalent duplicate entries
ok 22 - SPEC-INT-010 rejects NFC-equivalent duplicate entries
  ---
  duration_ms: 0.37
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects symlink, directory, and FIFO archive entries
ok 23 - SPEC-INT-010 rejects symlink, directory, and FIFO archive entries
  ---
  duration_ms: 0.164042
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects central/local filename mismatches
ok 24 - SPEC-INT-010 rejects central/local filename mismatches
  ---
  duration_ms: 0.138625
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects truncated ZIP records
ok 25 - SPEC-INT-010 rejects truncated ZIP records
  ---
  duration_ms: 0.084541
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects duplicate local-header offsets
ok 26 - SPEC-INT-010 rejects duplicate local-header offsets
  ---
  duration_ms: 0.322584
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects archives and declared entries above the limits before expansion
ok 27 - SPEC-INT-010 rejects archives and declared entries above the limits before expansion
  ---
  duration_ms: 0.347125
  type: 'test'
  ...
# Subtest: SPEC-INT-010 bounds expansion when the ZIP declares a false small size
ok 28 - SPEC-INT-010 bounds expansion when the ZIP declares a false small size
  ---
  duration_ms: 3.912083
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects missing, extra, and oversized mirror entries
ok 29 - SPEC-INT-010 rejects missing, extra, and oversized mirror entries
  ---
  duration_ms: 13.363458
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects mirror hash mismatches
ok 30 - SPEC-INT-010 rejects mirror hash mismatches
  ---
  duration_ms: 1.947667
  type: 'test'
  ...
# Subtest: SPEC-INT-010 rejects a symlink used as the canonical ZIP path
ok 31 - SPEC-INT-010 rejects a symlink used as the canonical ZIP path
  ---
  duration_ms: 0.691875
  type: 'test'
  ...
# (node:26875) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: FinalArch:INV-005/006/009/013/019 and GOV-005 reject every required negative fixture
ok 32 - FinalArch:INV-005/006/009/013/019 and GOV-005 reject every required negative fixture
  ---
  duration_ms: 22.867334
  type: 'test'
  ...
# Subtest: FinalArch:INV-020 accepts an exact flag registry and a complete 20-invariant matrix
ok 33 - FinalArch:INV-020 accepts an exact flag registry and a complete 20-invariant matrix
  ---
  duration_ms: 11.125209
  type: 'test'
  ...
# Subtest: FinalArch:INV-020 rejects an incomplete invariant matrix
ok 34 - FinalArch:INV-020 rejects an incomplete invariant matrix
  ---
  duration_ms: 9.098833
  type: 'test'
  ...
# Subtest: FinalArch:INV-005 rejects computed global fetch targets
ok 35 - FinalArch:INV-005 rejects computed global fetch targets
  ---
  duration_ms: 8.524541
  type: 'test'
  ...
# Subtest: FinalArch:INV-006 rejects LLM routing in agentgateway configuration
ok 36 - FinalArch:INV-006 rejects LLM routing in agentgateway configuration
  ---
  duration_ms: 7.296292
  type: 'test'
  ...
# Subtest: FinalArch:INV-013 enforces MCP tools per server
ok 37 - FinalArch:INV-013 enforces MCP tools per server
  ---
  duration_ms: 8.225292
  type: 'test'
  ...
# Subtest: FinalArch:INV-019 scans root environment and infrastructure configuration
ok 38 - FinalArch:INV-019 scans root environment and infrastructure configuration
  ---
  duration_ms: 6.713042
  type: 'test'
  ...
# Subtest: FinalArch:GOV-005 rejects adversarial WBS ownership bypasses
ok 39 - FinalArch:GOV-005 rejects adversarial WBS ownership bypasses
  ---
  duration_ms: 52.092833
  type: 'test'
  ...
# Subtest: FinalArch:INV-017 root focused-test scripts use Vitest 4 file filters directly
ok 40 - FinalArch:INV-017 root focused-test scripts use Vitest 4 file filters directly
  ---
  duration_ms: 0.511959
  type: 'test'
  ...
1..40
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5479.592375
OK: canonical ZIP archives match their allowlisted spec mirrors (PrjOps 8, DevOps 6).
(node:36133) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
OK: architecture fitness checks passed (INV-001..INV-020 mapped).
(node:36138) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node --test tests/validate-plane-environment-mapping.test.mjs && node scripts/validate-plane-environment-mapping.mjs docs/contracts/fixtures/plane-environment-mapping.dev.json[22m
(node:36193) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:36194) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: ADR-0019 P014-FA-T02 accepts the tracked development mapping with an explicit replacement warning
ok 1 - ADR-0019 P014-FA-T02 accepts the tracked development mapping with an explicit replacement warning
  ---
  duration_ms: 36.211166
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 accepts an owner-signed production mapping without DEV defaults
ok 2 - ADR-0019 P014-FA-T02 accepts an owner-signed production mapping without DEV defaults
  ---
  duration_ms: 0.2385
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects malformed JSON and unknown properties
ok 3 - ADR-0019 P014-FA-T02 rejects malformed JSON and unknown properties
  ---
  duration_ms: 31.363292
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects duplicate and cross-project Plane UUID mappings
ok 4 - ADR-0019 P014-FA-T02 rejects duplicate and cross-project Plane UUID mappings
  ---
  duration_ms: 0.395
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects unsafe URLs and noncanonical project identities
ok 5 - ADR-0019 P014-FA-T02 rejects unsafe URLs and noncanonical project identities
  ---
  duration_ms: 0.507208
  type: 'test'
  ...
# Subtest: ADR-0019 P014-FA-T02 rejects stale versions and incomplete go-live replacement
ok 6 - ADR-0019 P014-FA-T02 rejects stale versions and incomplete go-live replacement
  ---
  duration_ms: 0.675583
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 117.350959
WARNING: DEV-DEFAULT: replace before go-live with owner-signed production values.
OK: validated 3 Plane project mappings.
(node:36199) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `pnpm --trace-warnings ...` to show where the warning was created)
[2m$ node --test tests/validate-jira-environment-mapping.test.mjs && node scripts/validate-jira-environment-mapping.mjs docs/contracts/fixtures/jira-environment-mapping.dev.json[22m
(node:36254) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
TAP version 13
# (node:36255) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
# (Use `node --trace-warnings ...` to show where the warning was created)
# Subtest: accepts tracked development mapping and emits go-live replacement warning
ok 1 - accepts tracked development mapping and emits go-live replacement warning
  ---
  duration_ms: 31.949125
  type: 'test'
  ...
# Subtest: accepts owner-signed production mapping
ok 2 - accepts owner-signed production mapping
  ---
  duration_ms: 0.260417
  type: 'test'
  ...
# Subtest: rejects unknown fields, malformed JSON, and noncanonical PJ keys
ok 3 - rejects unknown fields, malformed JSON, and noncanonical PJ keys
  ---
  duration_ms: 31.984708
  type: 'test'
  ...
# Subtest: rejects duplicate Jira or GitHub mappings
ok 4 - rejects duplicate Jira or GitHub mappings
  ---
  duration_ms: 0.355041
  type: 'test'
  ...
# Subtest: rejects unknown/protected statuses and unsafe URLs
ok 5 - rejects unknown/protected statuses and unsafe URLs
  ---
  duration_ms: 0.654333
  type: 'test'
  ...
# Subtest: rejects stale versions and incomplete production replacement
ok 6 - rejects stale versions and incomplete production replacement
  ---
  duration_ms: 0.556084
  type: 'test'
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 111.8465
WARNING: DEV-DEFAULT: replace Jira mapping before go-live with owner-signed production values.
OK: validated 2 Jira project mappings.
```

## `git log -1 --format='%H %s'`

```text
d199b16fc092e122f2e91734e9091b8f09b64e69 feat(jira): import governed Jira GitHub integration
```

## `git status --porcelain`

```text
?? .claude/contextdb/
?? .orchestration/acceptance/ADV-FIX-01-ACCEPTANCE.md
?? .orchestration/acceptance/ADV-FIX-02-ACCEPTANCE.md
?? .orchestration/acceptance/ADV-FIX-03-ACCEPTANCE.md
?? .orchestration/autoskill/runs/ADV-FIX-03.md
?? .orchestration/autoskill/runs/JIRA-INT-01.md
?? .orchestration/learning/ADV-FIX-03-learning.md
?? .orchestration/learning/JIRA-INT-01-learning.md
?? .orchestration/reports/ADV-FIX-03-REPORT.md
?? .orchestration/reports/JIRA-INT-01-REPORT.md
?? .orchestration/sandboxes/ADV-FIX-03-SANDBOX.md
?? .orchestration/sandboxes/JIRA-INT-01-SANDBOX.md
?? .orchestration/tasks/ADV-FIX-01-hotfixes.md
?? .orchestration/tasks/ADV-FIX-02-approval-path.md
?? .orchestration/tasks/ADV-FIX-03-guard-wiring.md
?? .orchestration/tasks/ADV-FIX-04-manifest-authority.md
?? .orchestration/tasks/JIRA-INT-01-jira-integration.md
?? .orchestration/validation/ADV-FIX-03-validation.md
?? .orchestration/validation/JIRA-INT-01-validation.md
?? .pnpm-store/
?? references/ai-ops-platform-final-implementation-pack_2026-08-09.zip
?? references/ai-ops-platform-jira-fixed.zip
```

## Status interpretation

Tracked product files are clean after commit. The JIRA-INT-01 orchestration files are expected task artifacts; all other untracked entries predated this worker task and were preserved. No tracked deletion is present.
