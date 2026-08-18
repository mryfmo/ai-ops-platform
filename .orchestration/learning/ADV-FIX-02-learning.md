# ADV-FIX-02 Learning Triage

Date: 2026-08-18

## Candidates

[memory:decision] A browser-visible approval capability must be derived only after
row-level authorization and must replace, rather than accompany, the raw repository
version field. This prevents non-decision rows from receiving replay authority.

[memory:decision] The BFF should accept only the per-row capability plus the user's
decision, then reconstruct fixed protocol fields (`action` and path-bound ID) before
identity-envelope signing. This keeps browser-controlled fields from redefining the
upstream operation.

[memory:decision] Use one PostgreSQL statement and the database clock to create the
initial CAS version and TTL. A later update or application clock adds a window where
an approval exists without usable or consistent authority.

[memory:decision] A partial unique index on pending work makes an expired row a
dedupe tombstone unless retry semantics are explicit. Supersede the expired row
inside the create transaction, increment capability version, and exclude expired
rows at read time; do not add a separate cleanup worker when create/list boundaries
can enforce the lifecycle.

## Disposition

- All candidates were validated by focused unit/integration tests and the full
  workspace coverage run.
- The learn index records the reusable trust-boundary pattern; no skill mutation or
  promotion was authorized.
