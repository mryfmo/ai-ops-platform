# P7-T08 Workbench Capability Grants Report

## Outcome

Implemented default-none Workbench capability grants by evolving the existing `grants` authority. Project, GitHub repository, and Workbench space grants are represented as namespaced targets in the existing table; no parallel authority or schema change was added.

## Authorization Contract

- Canonical targets are `workbench:project:<project-id>`, `workbench:repository:<owner/repo>`, and `workbench:space:<workspace-uuid>` with existing `level='pull'`.
- The grant subject is the stable internal `recipients.user_id` resolved from the authenticated Entra tenant/object identity on every request.
- Workspace acquisition requires both recipient scope and an active internal grant in one SQL statement. Missing, not-yet-active, expired, or revoked grants return no row.
- Project and space grants expose the workspace reference model. Repository grants expose only the matching GitHub repository source and the workspace shell; project-level runs/actions remain hidden.
- A project-scoped recipient cannot use a grant for another project. A PRF-G/global recipient still has default-none access and needs an explicit grant.
- SQL-resolved grant context is sent to the OPA decision dependency. Deny, approval, exception, malformed/fail-closed result, absent runtime wiring, inactive recipient, or invalid recipient scope produces the same non-reflective 404 as a missing workspace; append-only audit codes remain distinct.
- Successful responses carry resource type/ID, `policyBundleVersion`, and nullable `decisionId`; the Web BFF strictly parses this grant state.

## Existing Authority Evolution

- `GrantsRepo` owns the canonical Workbench target namespace.
- Existing GitHub JIT revocation input excludes `workbench:*` targets so a capability row cannot be misparsed as an owner/repository GitHub permission. Workbench expiry is enforced directly in every acquisition query.
- No grant cache, recipient cache, display-layer masking, grant mutation endpoint, dependency, schema, or migration was added.

## OPA Posture

- The bundle allows only the exact human `web-workbench` L0 UI read shape with an active capability marker, canonical project/repository/space target, non-empty workspace ID, and valid recipient scope.
- Missing grants, project mismatch, target mismatch, and unknown shapes remain default deny; every decision retains bundle version `0.2.0`.
- Exact-commit review found that the initial dependency-only implementation left production composition permanently denied. The approved scope amendment wires `OpaDecisionClient` and policy environment from validated config into the Workbench route.
- `policy.opa.enforce=enforce` now requires an HTTP(S) origin-root `OPA_BASE_URL` without credentials/query/fragment and an explicit `OPA_POLICY_ENVIRONMENT`. False/log-only configurations do not create a Workbench policy dependency and therefore remain fail-closed; there is no SQL-only allow fallback.
- The approved configuration-inventory amendment documents only those two runtime keys and adds commented placeholders; no credential value is committed.

## Validation Summary

- Test-first RED was observed for missing canonical target helpers, missing SQL grant predicates, missing route OPA enforcement, missing BFF grant schema, and missing Rego allow rule.
- Focused server grant/route tests: 14/14; config + route composition tests: 81/81; Web BFF: 4/4; OPA Rego: 29/29.
- Real PostgreSQL Workbench suite: 4/4, including default-none, grant visibility, immediate revoke, repository/space semantics, and cross-project nested-reference invisibility.
- DB-less server coverage: 86 files / 926 tests; Web coverage: 41 files / 333 tests.
- Fresh three-database `mise run ci`: exit 0, ending in `P001 PostgreSQL integration passed`.

## Handoff

- Branch: `agent/P7-T08-workbench-grants`.
- Orchestrator performs push and PR creation after `AGMSG-RESULT`.
