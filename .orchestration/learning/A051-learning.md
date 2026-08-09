# A051 Learning

## Validated learning

- Decision authorization must re-read the stable subject, active state, approver profile, and project membership in one request-time database predicate. UI metadata is useful feedback but is not the security boundary.
- A generic approval row with no canonical project linkage should not be guessed into scope; falling through to the explicitly global approver role is the smallest fail-closed behavior.
- Real-database repository fixtures must advance through the migrations for every column read by the current repository. Unit mocks can hide schema/repository drift that a clean PostgreSQL run exposes immediately.

## Apply to

- Future privileged decision routes: keep the authorization predicate at the authoritative data lookup and repeat it for each decision request.
- Future PostgreSQL repository tests: initialize from the current fresh schema and apply only the existing migrations needed to represent the tested upgrade path.
