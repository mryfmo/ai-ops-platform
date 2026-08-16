# P5-T08 Validation

## Test-first Evidence

1. Source accessibility and two-user differential fixtures failed on the absent evidence functions, then passed after the pure library was implemented.
2. Receipt repository fixtures failed on the absent module, then passed after the metadata-only `INSERT` repository was implemented.
3. A fresh PostgreSQL 16 instance applied `schema.sql`, then the migration twice, before running the append-only, schema-column, sanitization, constraint, and app-role privilege probes.
4. The first full CI run exposed a forbidden `node:crypto` import in the integrations contract surface. The question hash moved to the native Web Crypto API with no runtime import; the architecture fixture and final full CI then passed.
5. Independent review found that a comparison-user timeout or generic HTTP failure could falsely satisfy the permission differential. RED fixtures reproduced it; outer/inner 403 now map to `E-WIQ-ACCESS-DENIED`, and only that code proves the negative differential.
6. Re-review found that an explicit denial mixed with another operational failure could still pass. A RED mixed-outcome fixture reproduced it; all comparison items must now be either accessible or explicitly denied, with at least one denial.

## Synthetic Coverage

- Same-user fetch success and exact identity match.
- User A all-accessible versus user B partial denial.
- Outer/inner HTTP 403 authorization classification; operational comparison-user failures remain non-passing.
- Unresolved reference, Work IQ failure, and wrong returned identity.
- Empty/oversized reference sets and same-user differential rejection before fetch.
- Deterministic SHA-256 question hashing without plaintext retention.
- Repository input/result/provenance validation and deep metadata sanitization.
- PostgreSQL raw-column absence, constraint enforcement, migration reapply, and `UPDATE`/`DELETE`/`TRUNCATE` rejection.

## Real-tenant Harness Contract (deferred until `sandbox-m365`)

### Environment names

- `P5_T08_WORK_IQ_USER_A_TOKEN`: delegated OBO token for user A; audience `api://workiq.svc.cloud.microsoft`, exact scope `WorkIQAgent.Ask`.
- `P5_T08_WORK_IQ_USER_B_TOKEN`: delegated OBO token for a distinct user B in the same tenant.
- `P5_T08_WORK_IQ_TENANT_ID`: expected tenant ID for both validated tokens.
- `P5_T08_SOURCE_FIXTURE_PATH`: local metadata-only fixture mapping returned source references to supported Work IQ entity paths.
- `P5_T08_EVIDENCE_OUTPUT`: output path; required value `.orchestration/validation/P5-T08-REAL-TENANT.json`.
- `TEST_DATABASE_URL`: disposable PostgreSQL URL for query receipts.

Do not define client-secret/client-credential variables for this harness. Never write either token, the question, fetched source data, or the Work IQ response to a file or log.

### Procedure

1. Prepare one synthetic tenant item readable by user A and denied to user B. Record only its non-content reference fixture and expected permission relation.
2. Validate both delegated token claim sets through the P5-T01 claim validator; require the same expected tenant, different subjects, the exact Work IQ audience/scope, and no app-only roles.
3. Call the P5-T02 `ask` client as user A with a synthetic question held only in process memory. Persist its SHA-256 digest and returned metadata through `WorkIqQueryReceiptsRepo`.
4. Require `provenanceComplete=true`, at least one source reference, and non-empty permission context for the acceptance probe.
5. Resolve each returned source reference with the fixture resolver. Run the accessibility probe using user A's client, then the same reference set using user B's client.
6. Write only `{tenantId, subjectHashes, receiptId, decisionId, traceId, provenanceComplete, ownerEvidence, comparisonEvidence, passed, recordedAt}` to `P5_T08_EVIDENCE_OUTPUT`. Hash subjects before writing; evidence contains reference indexes/status/E-codes only.

### Expected values

- The receipt row has `tool_name='ask'`, a 64-character lowercase question hash, no E-code on success, and no raw question/response column.
- Owner evidence has `allAccessible=true`; every item is accessible and returned identity equals user A/expected tenant.
- Comparison evidence has `allAccessible=false`; at least one item is inaccessible for user B.
- Differential `passed=true`; provenance is complete; output and logs contain no token, question, response, or fetched content.
- Any identity/provenance mismatch, unresolved reference, upstream error, or absent negative differential fails the gate.

## Commands and Results

- Focused task Vitest: PASS, 3 files / 19 tests (16 synthetic + 3 real PostgreSQL); Work IQ client/architecture regression set: PASS, 3 files / 24 tests.
- Integrations/server TypeScript typecheck and task-file ESLint: PASS.
- `mise run ci` with separate disposable PostgreSQL databases: PASS, exit 0; governance, 25/25 Rego, contracts, audit, actionlint, lint, traceability, format, build, typecheck, all-package coverage, 18 migration applications/reapply, and `P001 PostgreSQL integration passed`.
- gitleaks 8.30.1 staged scan: PASS, no leaks found.
- Independent review P1 authorization-specific differential and P1 mixed-outcome residual: resolved; final re-review found no actionable correctness regression.
