# P5-T07 Validation

## Test-first Evidence

1. Rego fixtures were added before the rules. The RED run failed because the existing default decision could not satisfy the new customer-confidential obligation shape.
2. The TypeScript fixture was added before implementation. The RED run failed on the absent `src/activities/m365Egress` module.
3. A defense-in-depth fixture then proved an accidentally allowed restricted result reached dispatch; the control-plane local restricted stop made it green.
4. A bounded-obligation fixture proved a 1,000,000-byte policy limit was accepted; the absolute 16 KiB ceiling made it green.
5. A malformed-runtime-input fixture proved the typed boundary could throw before policy; the route-level fail-closed guard made it green.
6. Independent review found a retained-field secret bypass; a RED fixture reproduced the unchanged dispatch payload and the existing shared LLM sanitizer made it green.
7. Final-diff review found nested M365 metadata bypassing top-level redaction; a RED fixture reproduced it and the JSON serialization replacer made recursive redaction green.

## Commands and Results

1. `mise run policy:rego`
   - PASS: 25/25 Rego tests.
2. `env CI=true pnpm --filter @aiops/policy run test`
   - PASS: 2 files / 13 tests.
3. `env CI=true pnpm --filter @aiops/control-plane exec vitest run tests/m365Egress.test.ts`
   - PASS: 1 file / 19 tests.
4. `env CI=true pnpm --filter @aiops/control-plane run test`
   - PASS: 26 files / 241 tests (final coverage run).
5. Policy/control-plane typecheck and lint; `bash -n deploy/opa/smoke.sh`
   - PASS.
6. `./deploy/opa/build-bundle.sh /private/tmp/P5-T07-policy.tar.gz`
   - PASS: bundle manifest revision `0.2.0`.
7. Fresh PostgreSQL `mise run ci`
   - PASS: exit 0; governance, policy, contracts, audit, actionlint, lint, traceability, format, build, typecheck, coverage, and DB verification completed.
   - PASS marker: `P001 PostgreSQL integration passed`.

## Negative Coverage

- restricted × Bedrock/Anthropic/none; restricted accidental policy allow
- customer-confidential × Anthropic; public Anthropic without explicit policy data; confidential Anthropic despite injected data drift
- unknown classification; incomplete provenance falsely paired with a lower class
- absent requested-field/source-system labels
- no decision, deny, approval, or fail-closed decision result
- provider mismatch, missing/unsupported redactions, absent/unbounded byte limit
- unsummarized and oversized customer-confidential output

## Amendments

- Orchestrator approved the workspace-only `@aiops/policy` link in control-plane and the resulting lockfile link.
- Orchestrator approved the workspace-only `@aiops/shared` link needed to reuse `sanitizeForLlmInput`; the lockfile diff is limited to that link.
- Orchestrator approved only the OPA deployment/smoke version strings needed for `0.2.0` parity; no posture field changed.

## Review

- `codex --profile review review --commit f829d0c`: P1 retained-field secret bypass found.
- Disposition: resolved by applying the existing `sanitizeForLlmInput()` immediately before size validation and dispatch, with a dedicated regression fixture.
- `codex --profile review review --base main` at `31b18d7`: P1 nested sensitive-metadata bypass found.
- Disposition: resolved with recursive key redaction during deterministic JSON serialization and a nested fixture.
- `codex --profile review review --commit b44f770`: clean; no actionable defect identified.

## R01 Runtime Import Revision

- RED: plain Node ESM import of `packages/control-plane/dist/activities/m365Egress.js` failed with `ERR_MODULE_NOT_FOUND` for `@aiops/shared/dist/secretSanitizer`.
- Fix: changed the existing shared sanitizer import to the `.js`-suffixed package subpath required by the wildcard exports map.
- GREEN: rebuilt control-plane, then the exact Node ESM import probe printed `IMPORT OK`.
- Focused result: `tests/m365Egress.test.ts` PASS, 1 file / 19 tests; control-plane typecheck and lint PASS.
- Fresh PostgreSQL `mise run ci`: PASS, exit 0 with `P001 PostgreSQL integration passed`.
