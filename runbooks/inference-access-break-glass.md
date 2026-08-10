<!-- 根拠: FinalArch:NFR-SEC-001 / FinalArch:NFR-SEC-003 / FinalArch:NFR-SEC-004 / FinalArch:GOV-003 / ADR-0022 / ADR-0023 -->

# Inference and access-plane break-glass

## Scope

This procedure restores bounded availability during a confirmed LiteLLM or agentgateway outage. It does not
bypass business approval, data classification, OPA, tenant/resource permission, or human merge controls. It is
not operational until the referenced direct adapter, provider policy, audit receipt, and Key Vault access have
been implemented and tested by their later WBS tasks.

`inference.anthropic_direct_fallback.enabled` defaults to `false` and requires both
`classification<=internal` and `explicit-provider-allow`. The runtime environment name is
`AIOPS_FLAG_INFERENCE_ANTHROPIC_DIRECT_FALLBACK_ENABLED`; `true` is the only enabled value and
`AIOPS_FLAG_INFERENCE_ANTHROPIC_DIRECT_FALLBACK_ENABLED_KILL=1` overrides it to `false`.

## Hard stops

Do not activate a direct path when any item is true:

- classification is unknown, customer-confidential, restricted, or above `internal`;
- the failure is policy, safety, authentication, authorization, invalid request, or data-boundary denial;
- explicit Anthropic provider use is absent from the model-routing policy for the requested alias;
- the direct adapter would expose a provider key to a client, developer device, agent prompt, or runner;
- the affected operation is MCP write, merge, deploy, delete, permission/retention change, production DB access,
  or Work IQ without a conformant delegated/OBO token;
- OPA or audit persistence is unavailable for an operation that requires either service;
- the old credential is suspected compromised.

Coding jobs are queued or disabled during inference break-glass. A GitHub runner never receives
`ANTHROPIC_API_KEY`, `LITELLM_MASTER_KEY`, or a GitHub App private key.

## Required approval and record

Before activation, create one restricted incident/change record with:

- incident ID, start time, affected plane, observed failure, attempted normal recovery, and requested expiry;
- affected aliases, projects, data classifications, callers, and exact permitted operation set;
- AI Platform owner and Security approver identities; the incident commander is the second person and cannot
  self-approve both roles;
- the explicit-provider-allow decision and its policy/version;
- Key Vault/provider credential record IDs, current service revision, and rollback revision — never values;
- evidence destinations and the operator assigned to revoke/close the exception.

The initial authorization expires after 60 minutes. Extension requires a new two-person decision and updated
evidence. Business approval, GitHub review, and data-owner gates remain separate and cannot be inferred from
this authorization.

## LiteLLM outage procedure

1. Confirm LiteLLM health/route failure from at least two signals and rule out policy/safety/auth/invalid-request
   errors. Record status, alias, HTTP/error class, and correlation IDs without prompt or response content.
2. Pause runner dispatch and all classifications above `internal`. Keep existing workflow/approval state intact.
3. Verify the server-side direct adapter is deployed, its egress destination is allowlisted, the requested alias
   explicitly permits Anthropic fallback, and only its dedicated managed identity can resolve the provider key.
4. Obtain the two-person approval above. Do not export or copy the provider value; authorize the exact managed
   identity to resolve the existing versioned Key Vault reference for the approved window.
5. Set `AIOPS_FLAG_INFERENCE_ANTHROPIC_DIRECT_FALLBACK_ENABLED=true` through the reviewed deployment/config
   path. Leave its kill variable unset/`0`. Deploy one canary revision with no runner/client secret injection.
6. Run a synthetic, non-sensitive request first. Then allow only the approved callers/classification and confirm
   route/provider, latency, cost, and audit receipts. Fallback is limited to transport, timeout, 429, and 5xx
   classes allowed by the routing contract.
7. Monitor direct call count, old/new revision traffic, provider spend, error class, and expiry. Any hard-stop
   condition, missing receipt, or scope drift immediately triggers the kill step.

### Kill and rollback

1. Set `AIOPS_FLAG_INFERENCE_ANTHROPIC_DIRECT_FALLBACK_ENABLED_KILL=1` or set the enabled flag to `false`.
2. Route eligible traffic back to the recovered LiteLLM revision; otherwise leave it queued/failed visibly.
3. Remove the temporary Key Vault RBAC grant/reference from every direct-path revision and deactivate those
   revisions. Confirm a process/env and egress check finds no provider key on clients/runners.
4. If a dedicated temporary provider key was issued, revoke it after LiteLLM has a separately verified key. If
   compromise is suspected, revoke first and never restore it.
5. Close the change only after the flag is `false`, kill override is normalized, direct egress is denied, old
   revisions are inactive, and post-recovery requests use LiteLLM logical aliases.

## agentgateway/OPA outage procedure

There is no generic direct MCP/A2A break-glass path.

1. Set `AIOPS_FLAG_ACCESS_AGENTGATEWAY_ENABLED_KILL=1` to stop the new gateway path and preserve workflow state.
2. If OPA is unavailable or its decision is unknown, deny/queue the operation. Never bypass OPA for a write.
3. A pre-existing, explicitly approved direct adapter may be used only for deterministic read-only operations,
   with the same actor/project/resource allowlist, a server-held connector credential, and append-only audit.
4. Work IQ may use a direct Control API adapter only after P5-T05 records that production-path exception and the
   same delegated user/OBO issuer, tenant, audience, subject, scope, and permission-trim checks pass.
5. Restore gateway traffic with one read-only canary, verify OPA/registry/schema/audience receipts, then remove
   the kill override. Write/draft levels return only through their normal approval gates.

## Evidence and post-incident obligations

Record in the append-only application audit log and restricted incident record:

- actor/approvers, reason, incident/change IDs, exact flags and revisions, start/end/expiry;
- allowed alias/operation/classification/project scope and policy/registry/model-routing versions;
- synthetic and permitted-operation correlation IDs, counts, error classes, cost, and result;
- Key Vault/provider record IDs, RBAC change IDs, GitHub workflow/task IDs, and revocation evidence;
- confirmation that no prompt, response, bearer token, secret, or reversible hash entered evidence.

Within 24 hours, Security and the service owner review access logs, rotate any credential exposed outside its
normal trust boundary, reconcile provider/tool side effects, document root cause, and create follow-up work.
Break-glass use never becomes a permanent exception; repeated use blocks phase exit until the primary path is
fixed or the architecture decision is formally revised.
