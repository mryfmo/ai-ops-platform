# Component Spec: agentgateway MCP/A2A Access Plane

## Scope

- MCP server federation
- A2A agent connectivity where explicitly approved
- OAuth/OIDC/API-key handling
- tool/resource policy enforcement integration
- rate limits、timeouts、observability

## Non-scope

- LLM inference routing
- durable workflow
- formal approval state
- business ledger

## Platform-owned registry

各entryは次を持つ。

```yaml
id: github-read
protocol: mcp
transport: streamable-http
owner: ai-coe
version: pinned
risk: L1
operations: [read]
resources: repository-scoped
auth: oauth-or-github-app
allowed_callers: [control-plane, claude-runner, droid-runner]
```

## Initial MCP set

| Server | Initial mode | Notes |
|---|---|---|
| Wispr | read-only | meeting notes/summary; normal dictation dataは対象外 |
| GitHub | read-only/lockdown | investigation/context。writeはGitHub App/runner path |
| Plane | read + draft | delete/permission/critical state禁止 |
| Confluence | read + draft | formal publication/space permission/delete禁止 |
| Work IQ | read/ask/get_schema | OBO conformanceを通過した場合のみgateway経由 |

## Approval

- L0/L1 read: auto allow with audit。
- L2 draft: staged action + batch approval。
- L3 limited write: explicit Teams/Web approval + Temporal action ledger。
- L4 code branch/PR: runner path only。
- L5/L6: not registered。

## Conformance

- protocol version negotiation
- server discovery/list cache invalidation
- schema hash drift
- OAuth audience/resource binding
- revoke/expiry
- prompt injection corpus
- response size/timeouts
- concurrent user token isolation
