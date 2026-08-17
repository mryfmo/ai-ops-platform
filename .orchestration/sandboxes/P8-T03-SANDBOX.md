# P8-T03 Sandbox Record

## Isolation

- All provider calls in tests used injected `FetchLike` functions; no LiteLLM or GitHub
  credential endpoint was contacted.
- All token, App JWT, and master-key values were synthetic fixtures.
- Final full CI used a newly initialized PostgreSQL 16 cluster under
  `/private/tmp/aiops-p8t03-final-pg.jA6vuz` on port 55444. The server was stopped after CI.
- No production configuration, environment, repository secret, push, PR, merge, or approval
  operation was performed.

## Workspace Safety

- The branch was recreated from latest main after #263 merged.
- Unrelated untracked orchestration records, `.pnpm-store/`, and the reference archive were
  left untouched and will not be staged.
- Only the signed P8-T03 paths and required P8-T03 evidence are included.
