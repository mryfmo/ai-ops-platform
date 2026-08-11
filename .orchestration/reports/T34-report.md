# T34 Worker Report

## Status

Ready for review. The audit is read-only with respect to product code, documentation,
specifications, schemas, accepted audits, and acceptance records.

## Canonical Audit

- `.orchestration/audit/user_facing_artifact_audit.md`

## Results

- Audited all six required groups without sampling: Excel, 3 guides, 4 references,
  Teams README, 10 runbooks, and three route families.
- Filed 11 new findings: HIGH 8 / MED 3. All four requested defect types are represented.
- Filed no duplicate of PRG-001..050 or SPC-001..026; eleven observed duplicates were
  retained only in the deduplication ledger.
- Generated the real Excel workbook. It has three executable example rows, no instruction
  sheet, and no data validation. The untouched workbook parses as three valid imports.
- Documented every missing Excel prerequisite, exact GitHub node-ID retrieval commands,
  field-type/value mappings, and a complete HMAC-signed dry-run/execute/re-run sequence.
- Reproduced unknown field acceptance, corrupt-workbook exception, and duplicate remote
  creation after a ledger-commit failure.
- Found two additional non-Excel HIGH operator failures: false/destructive Graph subscription
  recovery and a coding-task dispatch command missing required `project_id`.

## Validation

`node .orchestration/validation/T34-validate.mjs` passed 111 checks: UFA sequence,
required fields, severity, four defect types, 18/18 document coverage, Excel knowledge,
all six groups, and deduplication. Excel tests passed 19/19; the three route suites passed
31/31. Product tracked diff is empty.

No live GitHub or Microsoft Graph data/write call was made. Local `gh` authentication was
invalid, so current node-ID commands were checked against official GitHub documentation
and the repository's current GraphQL client contract.
