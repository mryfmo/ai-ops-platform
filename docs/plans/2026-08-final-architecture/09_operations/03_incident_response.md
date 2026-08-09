# Incident Response

## Severity

- SEV1: unauthorized access/write, secret exposure, cross-tenant/project data leak, production-wide outage.
- SEV2: duplicate formal side effect, approval bypass risk, major workflow/gateway outage.
- SEV3: partial degradation/SLO breach with workaround.
- SEV4: low-impact defect.

Severity is determined by deterministic rules and human incident commander; LLM may summarize evidence but cannot finalize severity.

## Response flow

1. Detect and create incident/trace.
2. Contain: kill switch, token revoke, traffic rollback, affected connector disable.
3. Preserve evidence: logs/traces/workflow history/config/digests without secrets.
4. Correlate deployment/PR/model/policy/tool/event.
5. AI generates RCA hypothesis and repair PR only.
6. Human validates, approves and deploys through GitHub Environment.
7. Verify SLO/data reconciliation.
8. Publish postmortem to SharePoint; update Confluence runbook; Plane actions.

## Special playbooks

- **MCP/tool compromise**: remove registry entry, revoke OAuth, block outbound, diff tool schema, inspect calls.
- **LLM gateway compromise**: rotate virtual/provider keys, disable direct path, inspect prompt/log exposure.
- **Runner compromise**: cancel jobs, revoke PR token, invalidate artifacts, inspect commits/dependencies.
- **M365 exposure**: disable app/consent, revoke sessions, engage tenant/security/legal.
- **Duplicate write**: stop workflow, identify authoritative object, append reconciliation event; do not delete evidence blindly.

## Postmortem minimum

Impact, timeline, detection gap, technical/root organizational cause, contributing factors, data impact, decisions, corrective actions/owners/due dates, verification and recurrence guard.
