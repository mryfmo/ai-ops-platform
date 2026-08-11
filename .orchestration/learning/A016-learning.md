# A016 Learning Triage

## Reusable Observations

1. Auth.js v5 passes the raw, already OIDC-validated ID-token claims profile to
   the JWT callback even though the display profile contains name/email/image.
   Stable `tid`/`oid` propagation belongs in that callback, and constructing a
   new JWT/session is the smallest way to prevent default PII fields surviving.
2. A stable-subject migration must update claim propagation and every
   authorization caller atomically. Removing email from the session before
   `requireSession`, dashboard, data API, and chat callers migrate creates a
   fail-closed but completely nonfunctional intermediate release.
3. Focused cross-package tests can read stale workspace `dist` entrypoints.
   Build the modified dependency packages before running a consumer-only
   focused test; full `mise run ci` already enforces the correct order.

## Plan Gap

The current identity and persona contracts do not define Entra role values or
semantic role conflicts. A016 treats roles as opaque integrity-checked strings.
The plan owner must define role-to-persona semantics before later authorization
enforcement.

## Promotion Decision

No repository learn file, reusable rule, or skill was promoted. The observations
are recorded for orchestration review, but this task explicitly forbids worklog
edits and the plan gap remains unresolved.
