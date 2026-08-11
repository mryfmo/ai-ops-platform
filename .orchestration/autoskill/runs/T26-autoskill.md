# T26 Autoskill

## Skills Used

- `agmsg-orchestration`: followed the AGMSG worker pattern and task artifact requirements.
- `ponytail`: kept implementation scoped to existing clients, validation utilities, and route handlers; no new dependencies or broad abstractions.

## Reusable Pattern

For LLM correctness tasks:

1. Confirm provider-specific parameter behavior against official docs before changing request payloads.
2. Add request-payload tests with mocked clients; do not use real LLM calls in CI.
3. Put cost reservation at the shared guard boundary, not at every caller; for PostgreSQL budget gates use an explicit transaction and acquire advisory locks before the read statement.
4. For streaming APIs, reserve before stream creation and reconcile only on non-error completion.
5. Treat provider refusal as a first-class error using the SDK's actual emitted shape; avoid defensive tests for shapes the provider adapter does not produce.
6. For lexical numeric grounding, remove known literal labels from the text before extraction instead of adding their digit fragments to an allowlist.
