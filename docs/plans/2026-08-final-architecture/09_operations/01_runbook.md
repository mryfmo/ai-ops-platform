# Operations Runbook

## 1. Daily health sequence

1. Control API live/ready.
2. Temporal namespace/workers/task queues/backlog/failures.
3. PostgreSQL pool/replication/storage/partition readiness.
4. LiteLLM health, provider availability, virtual key spend/quota.
5. agentgateway/OPA health, registry/bundle version.
6. Work IQ/Graph auth and subscription status.
7. GitHub/Plane/Confluence/Wispr connector status.
8. OTel collector/exporter and alert freshness.

## 2. Common symptoms

| Symptom | First checks | Safe action |
|---|---|---|
| Workflow stuck waiting | workflow state, approval version, signal delivery | re-notify; do not mutate DB state manually |
| Duplicate external object | idempotency key/mapping/activity retry | stop workflow, reconcile, append correction |
| LLM failures | alias/provider/policy/quota | use approved fallback or queue; never expose provider key |
| MCP denied | OPA decision, capability, registry version | correct scope/approval; do not bypass gateway |
| Work IQ auth error | user/tenant issuer/audience/OBO | re-auth through home tenant; do not use app-only |
| Graph notifications missing | subscription expiry/clientState/delta | renew and reconcile |
| Coding task no PR | runner logs, changes, token scope, callback | reconcile by task/branch; avoid duplicate run |
| OTel missing | collector queue/export endpoint | preserve local logs, alert observability owner |

## 3. Manual operations

- Workflow retry/cancel uses Temporal API/CLI and records basis.
- Approval cannot be forced by direct DB update.
- External object repair uses reconciliation command with dry-run first.
- Kill switches are changed through reviewed config/IaC or approved operational procedure.
- Production secret rotation uses Key Vault/managed identity and dual-key overlap.

## 4. Break glass

Break-glass is limited to restoring availability, not bypassing business approval. Use dedicated identity, MFA, time-bound access, two-person approval, full audit, post-use revoke and 24-hour review.

## 5. Evidence

Every incident/manual action records trace/workflow/task/project, actor, reason, before/after, command/version, result and follow-up.
