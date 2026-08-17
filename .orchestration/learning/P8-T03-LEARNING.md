# P8-T03 Learning

## Reusable Decisions

- Treat provider issuance responses as an untrusted boundary. Revalidate the requested
  scope and expiry before saving or returning a derived credential; revoke immediately if
  the response is already invalid.
- Keep root credentials behind injected issuer providers and return only a bounded derived
  credential plus an opaque cleanup lease ID.
- Mint write credentials after untrusted agent execution and inject them only into the
  smallest steps that need them. A workflow-level write permission is broader than an
  exact-repository installation token.
- Make cleanup failures observable and retain server-side lease state when revocation fails,
  so failure cannot be mistaken for successful cleanup.

## Follow-up Boundary

Environment-gated E2E must verify real LiteLLM response fields, GitHub installation scope,
post-job denial, and issuer deployment before P10-T10 removes the legacy repository secret.
