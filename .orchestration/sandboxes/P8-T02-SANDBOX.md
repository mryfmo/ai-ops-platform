# P8-T02 Sandbox Record

- Source and fixtures: repository workspace plus synthetic repositories created under the system temp directory.
- Database: a dedicated disposable PostgreSQL 16 cluster under `/tmp/aiops-p8t02-pg.l65QYf` on port 55442 with `aiops_test`, `aiops_load_test`, and `aiops_p001`; no shared or production database was used.
- External systems: GitHub PR #250/#251 metadata, file lists, checks, and PR #251 failed CI log were read with `gh`; no review, push, merge, approval, or PR state was changed.
- Secrets: fixtures use only synthetic `.invalid` identities and `NOT_A_REAL_SECRET`; no credential value or provider key was read or committed.
- Dependencies: none added; implementation uses Node.js and Git plus the existing P8-T01 validator.
- R01 clean-state simulation: `contracts/node_modules` was moved to the explicit sibling backup `contracts/node_modules.p8t02-r01` only for each command and restored by an exit trap. Validation confirmed the original directory exists and the backup does not.
- Snapshot boundary: CLI rejects snapshot locations inside the checkout or Git metadata directory, creates the file once with mode `0600`, and authenticates it with an ephemeral HMAC key not stored in the snapshot.
- Parallel isolation: PR #250 files and unrelated `packages/traceability/output/traceability_matrix.md`, `.pnpm-store/`, task-file, and reference archive state remain unstaged.
