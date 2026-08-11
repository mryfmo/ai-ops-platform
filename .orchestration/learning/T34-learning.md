# T34 Learning Triage

## Reusable Observations

1. A template test that proves “generated file parses” can prove the wrong property: executable
   example rows make an untouched template look valid while creating unintended remote objects.
2. Dry-run completeness must include remote identifier provenance and per-type value contracts;
   structural column validation alone cannot make opaque GraphQL inputs user-fillable.
3. Idempotence claims must cover the split between remote side effects and local ledger commit.
   Skipping only a terminal local status is not safe after remote-success/local-failure.
4. Runbooks need behavioral tests against scheduler selection and workflow input schemas. A valid
   SQL or CLI command can still make recovery worse when its promised next step does not exist.
5. Error-message audits should ask whether the caller can choose retry, correction, reconciliation,
   or escalation. HTTP status plus a generic noun is not an actionable contract.

## Validation

These observations were validated by the generated workbook, three adversarial Excel probes,
workflow/scheduler source comparison, 50 focused tests, and T34's 111-check artifact validator.

## Promotion

No rule or skill was promoted. Review after T34 acceptance for reuse in future artifact audits.
