# P5-T01 Learning

## Reusable Findings

1. The published Work IQ resource audience is `api://workiq.svc.cloud.microsoft`, and its current least permission is delegated-only `WorkIQAgent.Ask`; no application permission is published.
2. An OBO request can use the resource's `.default` expression, but the returned access token must be validated against the concrete `scp` claim rather than accepting `.default` as a claim.
3. App-only detection is fail-closed when `scp` is absent/empty; a `roles` value or even a subject-like claim does not establish delegated user context.
4. Cache isolation must include subject, tenant, scope set, and resource audience. Subject-only or tenant-only keys permit cross-boundary token reuse.
5. Claim validation complements, but cannot replace, upstream JWT signature/lifetime verification.

## Apply To

- P5 Work IQ adapter, OBO token provider, gateway conformance, and live-tenant gates.
- Any future delegated Microsoft resource integration and its token-cache tests.
