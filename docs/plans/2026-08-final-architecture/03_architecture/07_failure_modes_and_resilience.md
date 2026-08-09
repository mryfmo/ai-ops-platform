# Failure Modes / Resilience

| Failure | Detection | Required behavior |
|---|---|---|
| Control API restart | readiness/trace | client retry with idempotency; workflow state preserved |
| Temporal Worker restart | task timeout | activity/workflow resume; no duplicate side effect |
| Temporal service unavailable | health/SDK error | ingress accepts only durable local queue if explicitly designed; otherwise 503 and no false acceptance |
| LiteLLM unavailable | health/model error | workflow retry/backoff; governed task never bypasses gateway |
| Bedrock unavailable | provider classification | permitted alias only Anthropic fallback; route event recorded |
| Anthropic unavailable | provider error | no hidden provider change; fail/retry by policy |
| agentgateway unavailable | gateway health | read task retry; workflow state preserved; no direct MCP bypass |
| MCP server schema drift | registry hash mismatch | quarantine server/tool until approval |
| Work IQ OBO failure | auth error | no app-only substitution; request reauth/fail |
| Graph notification duplicate | delivery ID | dedupe and 202 |
| Wispr note not ready | bounded polling | retry until deadline; mark unavailable, do not fabricate minutes |
| Plane/GitHub/Confluence write unknown | timeout after send | reconcile before retry |
| Human approval timeout | Temporal timer | expire/escalate; never auto-approve |
| AI Runner compromised | path/secret/post-run checks | discard branch/token, incident, no push |
| OTel backend down | exporter queue | application continues within buffer limit; audit ledger remains authoritative |
