# A045 learning

## Validated learnings

- A response-size cap must also bound memory during transport. `Response.text()` followed by truncation is not bounded; keep a fixed-size streaming tail instead.
- A recency-ordered audit list cannot be represented as feature similarity. Make the degraded contract explicit, inject the provider boundary, and retain enough sanitized features for the successor implementation.
- Runtime wiring that creates GitHub issues must guard its own issue webhook path before LLM invocation. Stable agent markers and existing `auto-triaged` labels prevent feedback loops without ignoring all bot-created monitoring alerts.
- Secret-redaction tests should construct fake high-entropy tokens at runtime when the test file is outside the repository's narrow gitleaks allowlist.
- Webhook-to-Issue retry paths can remain stateless by persisting a deterministic source marker in the created body and performing a bounded, fail-closed search-before-create.
- A local checkout path is a trust-boundary mapping, not a process default. Generate repository-derived suggestions only for an explicit event-repository-to-absolute-path match.

## Apply to

- A053: replace the recency proxy with canonical 90-day feature similarity using the injected provider seam and enriched triage details.
- Future external-log clients: stream into a fixed byte bound and test exact tail retention.
- Future webhook writers: use stable source markers and fail closed when dedupe search is partial or ambiguous.
