# SLO / SLI

## Proposed service objectives

These are target proposals; Owner approval is required before production commitment.

| Service/flow | SLI | Target | Window |
|---|---|---:|---|
| Authenticated Control API | successful non-policy-denied requests | 99.9% | monthly |
| Workflow start | accepted within 2s p95 | 99% | monthly |
| Approval signal | reflected within 5s p95 | 99% | monthly |
| Scheduled workflow | starts within 2 min of target | 99% | monthly |
| Event ingestion | durable ledger within 10s p95 | 99% | monthly |
| LiteLLM gateway | successful permitted inference | 99.5% | monthly |
| MCP read tools | successful permitted call p95 within service-specific limit | 99% | monthly |
| Teams notification | delivered within 60s p95 excluding provider outage | 99% | monthly |
| Coding task | queued→runner start within 5 min p95 | 95% | monthly |
| Audit completeness | side effects with full correlation | 100% | release/monthly |
| Unauthorized production mutation | count | 0 | always |
| Duplicate formal side effect | count | 0 | always |

## Error budget rules

- Security/authorization breach has no error budget: immediate stop.
- 50% monthly budget consumed: freeze nonessential rollout.
- 100% consumed: rollback/new path disable and reliability review.
- provider-caused failures remain visible and are not silently removed from user SLI; separate dependency SLI may be tracked.

## Alert ownership

Each alert has severity, SLO, runbook URL, primary/secondary owner, escalation and silence expiry. Unowned alerts are release blockers.
