# Resilience and Chaos Plan

## Principles

Chaos tests are controlled experiments in disposable/staging environments. Production destructive chaos requires approved runbook and incident commander.

| Experiment | Injection | Expected behavior | Evidence |
|---|---|---|---|
| Temporal worker crash | kill during Activity/wait | workflow resumes; no duplicate side effect | history + external object count |
| Temporal service outage | block client connectivity | ingress returns accepted/temporary error per contract; no lost request | idempotency retry |
| PostgreSQL failover | terminate primary | pool recovers; append-only consistency | DB and audit checks |
| LiteLLM outage | 503/connection reset | permitted fallback only; otherwise queued/failed visibly | routing/audit trace |
| Bedrock quota | 429 | bounded backoff/fallback per policy | provider trace |
| Anthropic unavailable | 5xx | Bedrock remains; no circular fallback | route trace |
| agentgateway outage | stop gateway | fail closed; no direct MCP bypass | denied tool call |
| OPA outage | stop policy endpoint | high-risk denied; configured low-risk behavior per policy | decision log |
| Work IQ token expiry | expire OBO token | refresh/re-auth; no app-only substitution | user-visible status |
| Graph notification loss | drop webhook | delta/reconcile recovers without duplicate | event ledger |
| Wispr note delayed | note unavailable | workflow waits/retries, then human fallback | timer history |
| GitHub callback lost | PR created, callback dropped | reconcile finds PR; no duplicate PR | task mapping |
| Confluence write response lost | side effect succeeds, response lost | idempotency/query reconciliation | one page only |
| SharePoint formal publish failure | transient/permission | no partial formal state; retry/compensate | record status |
| OTel backend outage | collector/export fail | business flow continues within bounded buffer; alert | local metrics/log |
| Region outage | block Japan East | execute approved DR plan | RPO/RTO evidence |

## Pass criteria

- no unauthorized action
- no silent data loss
- no duplicate formal side effect
- state visible to operator
- retry is bounded and cancellable
- audit/correlation retained
- recovery/rollback within documented target
