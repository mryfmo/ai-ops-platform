# P5-T03 Learning

## Reusable Findings

1. A signed BFF identity and an OBO token prove different boundaries: authenticate the envelope first, then independently validate the exchanged Work IQ claims and require the delegated token subject/tenant to match the signed context.
2. A request-bound provider can prevalidate before policy and then satisfy the concrete downstream client without a second exchange when both share the same four-part cache; the client still performs its own canonical revalidation before dispatch.
3. Authorization and policy failure evidence needs only a fixed E-code plus bounded decision metadata. Copying raw claims, policy reasons, user questions, or upstream content into an audit denial creates avoidable content leakage.
4. Repository full-CI PostgreSQL fixtures use both explicit URLs and libpq defaults. Fresh-DB runs must set `PGHOST`, `PGPORT`, and `PGUSER` in addition to task-specific database URLs/names.
5. A free-text Work IQ ask has no platform-enforceable project/source retrieval filter. Request declarations must be labeled as purpose context, while conformance evidence comes from delegated M365 permission trimming and downstream egress classification/minimization.

## Apply To

- P5-T04 gateway OBO conformance, P5-T08 permission/source differential evidence, and any Control API route that combines BFF identity, delegated downstream identity, OPA, and external dispatch.
- Fresh-database worker validation instructions and future orchestration validation artifacts.
