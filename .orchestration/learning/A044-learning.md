# A044 learning triage

## Validated learnings

1. An internal URL on the same listener is routing, not an identity trust boundary. A sibling BFF must pass an independently verifiable token or a request-bound signed identity envelope.
2. Approval state mutation and append-only audit evidence must share one database transaction; separate writers can otherwise commit an unaudited decision.
3. Creating an approval before an external card send requires two-phase visibility. `delivered_at` plus pending-target idempotency avoids both orphan actionable rows and duplicate cards producing multiple decisions.
4. Authorization deferrals need schema seams and explicit fail-closed behavior. A044 records nullable `project_id`, applies the ruled role gate, and leaves fine project membership to A051.

## Application

These findings are promoted to `.agents/worklog/codex/learn/20260808_131436_learn.md` and apply to trust-boundary design, repository transaction tests, delivery retry tests, and A051 project-scope enforcement.
