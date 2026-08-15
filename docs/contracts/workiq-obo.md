<!-- 根拠: PRD-007 / FR-M365-001..006 / ADR-0024 -->

# Work IQ Entra/OBO application contract

## Boundary

Work IQ is a signed-in-user integration. Every call MUST retain one user's delegated
Microsoft Entra context from the Control API through Work IQ. Client-credentials,
application permissions, workload identity, and background execution MUST NOT be used
as a fallback. ADR-0024 assigns those scenarios to the separate Microsoft Graph path.

The initial Work IQ tool allowlist is `fetch`, `ask`, `get_schema`, `search_paths`, and
`list_agents`. The latter two are discovery-only. `create_entity`, `update_entity`,
`delete_entity`, `do_action`, and `call_function` remain disabled. Path-level tenant
policy further limits reads to approved Microsoft 365 resources.

## Entra applications, audiences, and least scopes

Use a single-tenant Control API confidential application and separate registered
Web/Teams callers. All identifiers below are placeholders; real tenant/application
IDs, credentials, access tokens, and refresh tokens MUST NOT be committed.

| Hop                     | Token audience                     | Delegated scope                                                                                    | Why it is needed                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/Teams → Control API | `api://<CONTROL_API_CLIENT_ID>`    | `workiq.invoke` (full request value: `api://<CONTROL_API_CLIENT_ID>/workiq.invoke`)                | Authorizes only the signed-in user entry point that may start the OBO flow. It is not a Work IQ or Graph permission.                                                                                                          |
| Control API → Work IQ   | `api://workiq.svc.cloud.microsoft` | `WorkIQAgent.Ask` (registration/request value: `api://workiq.svc.cloud.microsoft/WorkIQAgent.Ask`) | This is the only currently published Work IQ delegated permission and the least permission for querying Work IQ on behalf of a signed-in user. Tenant policy and the tool/path allowlist narrow its broad service capability. |

The OBO token request MAY use `api://workiq.svc.cloud.microsoft/.default` to request
the statically admin-consented Work IQ delegated permission. `.default` is a token
request expression, not an additional granted permission; the resulting access token
MUST contain exactly `scp=WorkIQAgent.Ask`.

Do not request `offline_access`: the Control API exchanges the current user assertion
and caches only the resulting bounded access token. Do not add Microsoft Graph scopes
to either Work IQ token. `openid` and `profile`, if required for the interactive sign-in
session, are sign-in scopes and are not accepted as Work IQ API authorization.

Microsoft's current permission reference lists `WorkIQAgent.Ask` as delegated-only,
with admin consent required and no application permission. Re-check the reference at
deployment time because the Work IQ surface can change:

- [Work IQ API permissions reference](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/permissions)
- [Work IQ MCP overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/overview)

## Six-stage fail-closed token flow

1. **Receive a user access token.** The Web/Teams adapter sends an Entra access token
   issued for `api://<CONTROL_API_CLIENT_ID>`, never an ID token. The authentication
   boundary verifies its signature against tenant metadata, accepted algorithm,
   `nbf`, and `exp`. Missing, unverifiable, expired, or replay-rejected tokens stop
   before OBO; no anonymous or application identity is substituted.
2. **Validate the incoming user contract.** The Control API requires the exact
   tenant-specific v2 issuer `https://login.microsoftonline.com/<TENANT_ID>/v2.0`,
   `tid=<TENANT_ID>`, the Control API audience, a non-empty `sub`, and delegated
   `scp` containing `workiq.invoke`. `roles` without `scp`, a common/organizations
   issuer, a different tenant/audience, or a missing subject is denied and audited
   without logging claims or token content.
3. **Exchange on behalf of that user.** The Control API authenticates its confidential
   client with a certificate or managed secret and performs Entra OBO using the user
   assertion. It requests only the consented Work IQ resource. The returned token is
   signature/lifetime verified, then `validateWorkIqDelegatedClaims` requires the
   tenant-specific issuer, same `tid`, Work IQ audience, non-empty `sub`, and exactly
   `scp=WorkIQAgent.Ask`. OBO failure or any claim mismatch is terminal; client
   credentials MUST NOT be attempted.
4. **Cache with user/resource isolation.** Cache the verified Work IQ access token only
   under the key and expiry rules below. A miss repeats OBO; it never searches another
   user's, tenant's, scope's, or resource's entry.
5. **Preserve delegation through agentgateway.** Before forwarding a Work IQ call,
   enforce the gateway conformance checks below. A gateway-created app-only token,
   altered subject/tenant/scope, or wrong downstream audience is denied before the
   tool request.
6. **Handle gateway non-conformance explicitly.** The default is to stop the Work IQ
   call. Calling the Work IQ adapter directly inside the Control API is permitted only
   after an approved ADR amendment records the reason, owner, expiry, tests, and
   rollback. There is no automatic runtime bypass.

Signature and lifetime verification precede the pure claim validator. Passing an
unverified decoded JWT payload to the validator does not satisfy this contract.

## Claim validation rules

`packages/integrations/src/workiq/tokenClaims.ts` validates a verified Work IQ access
token payload without network access or token decoding. All errors use fixed messages
so rejected claims are not copied into logs.

| Claim | Required rule                                   | Rejection                                                                                          |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `iss` | Exact tenant-specific v2 issuer                 | Common, consumer, v1, other-tenant, and wildcard issuers are rejected.                             |
| `tid` | Exact configured `<TENANT_ID>`                  | Cross-tenant tokens are rejected.                                                                  |
| `aud` | Exact `api://workiq.svc.cloud.microsoft` string | Graph, Control API, array, and any other audience are rejected.                                    |
| `sub` | Non-empty string                                | A missing user subject is rejected.                                                                |
| `scp` | Exactly `WorkIQAgent.Ask`                       | Missing/empty `scp`, `roles`-only tokens, malformed scopes, and any additional scope are rejected. |

An access token obtained by client credentials normally carries application `roles`
and no delegated `scp`. That shape is always rejected, even if a role name resembles
`WorkIQAgent.Ask`. A valid-looking `sub` does not convert it into a delegated token.

## Admin consent plan

The tenant administrator performs these steps in a controlled environment, not in
source code or CI:

1. Enable Work IQ for the approved tenant and confirm eligible user licensing.
2. Create the single-tenant Control API confidential app, expose only
   `api://<CONTROL_API_CLIENT_ID>/workiq.invoke`, and authorize only the registered
   Web/Teams caller applications.
3. Add the Work IQ **delegated** permission `WorkIQAgent.Ask` to the Control API app.
   Do not add an application permission/app role or any Graph permission for this path.
4. Review the exact two delegated scopes in the table, then grant tenant-wide admin
   consent. Record the consent change in the operational audit system without token,
   secret, certificate, user subject, or real application/tenant IDs in this repo.
5. Store the Control API certificate/private key or client secret in the approved
   secret store. Only a reference may enter deployment configuration.
6. Verify with a dedicated test user that the incoming and OBO tokens meet the claim
   table, the write tools remain disabled, and revoking consent causes fail-closed
   denial. This live-tenant gate is separate from the synthetic tests in this task.

Any future Work IQ permission requires a contract/ADR review, new negative tests, and
fresh admin consent before it can be added to the exact scope allowlist.

## Token cache contract

The isolation key is the structured tuple:

```text
(subject, tenant, canonical_sorted_scope_set, resource_audience)
```

Use an unambiguous structured encoding (or its keyed digest), not delimiter
concatenation. Do not include the bearer token in the key, logs, metrics, or audit
records. The present valid tuple is one subject, `<TENANT_ID>`,
`["WorkIQAgent.Ask"]`, and `api://workiq.svc.cloud.microsoft`.

- Effective TTL is `min(token exp - now - 120 seconds, 5 minutes)`. Do not cache if
  the result is non-positive. Never extend a token beyond its `exp`.
- Evict the exact entry on sign-out/session invalidation, Entra claims challenge,
  `invalid_token`, Work IQ `401`, consent removal, or user/tenant disablement. A
  tenant-wide policy/consent change purges all entries for that tenant.
- After eviction, require a fresh valid user assertion and OBO exchange. Do not retry
  with client credentials, a stale entry, or another subject's entry.
- Cache failures are authorization failures, not reasons to bypass isolation.

## Gateway token conformance

Conformance tests for the agentgateway path MUST prove all of the following before the
path is enabled:

- The downstream token is delegated: non-empty `scp=WorkIQAgent.Ask`; `roles`-only is
  rejected.
- `tid` and `sub` are preserved from the validated user/OBO context.
- The token presented to Work IQ has exact audience
  `api://workiq.svc.cloud.microsoft`; a Control API, Graph, or gateway audience is not
  forwarded.
- Any token exchange is bound to the same subject, tenant, scope, resource, request
  correlation, and single tool invocation. Tokens are neither persisted in the action
  ledger nor exposed to policy inputs/logs.
- The gateway's tool/path policy still limits calls to the initial read/discovery
  allowlist. Authentication success cannot enable write operations.
- A mismatch returns a deny result before network dispatch. It does not silently call
  Work IQ directly or obtain an application token.

After Work IQ returns data, OPA classification and minimization run before any content
can reach an external LLM, as required by ADR-0024. This token contract does not weaken
that separate data-egress boundary.
