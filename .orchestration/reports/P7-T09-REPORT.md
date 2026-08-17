# P7-T09 Teams-to-Workbench Handoff Report

## Outcome

Implemented a signed, short-lived, single-use Teams-to-Workbench handoff contract. The link preserves workspace, conversation, thread, and workflow references while binding the authenticated Entra identity by HMAC rather than embedding tenant or subject identifiers.

## Security Contract

- Minting requires an explicit expiry, accepts at most 300 seconds, uses an injected secret/clock/nonce source, and returns a branded URL.
- The token is domain-separated HMAC-SHA-256 over strict versioned claims. Identity is represented only by a second domain-separated digest.
- Raw message text, attachment content, attachment references, credentials, and identity identifiers are outside the exact mint input and token payload. This honors the P7-T06 sanitize-at-Control-API fail-closed and attachment-metadata-only fallback by carrying neither content class.
- Receive-side validation verifies the signature before parsing claims, then validates claim shape, expiry, identity binding, and an injected atomic `consumeOnce` authority.
- Missing, rejecting, or unavailable replay authority fails closed; no process-local replay fallback was added.
- After token consumption, the existing Workbench BFF re-resolves the current authenticated identity and calls the Control API. The signed workflow must be present in the returned grant-shaped run projection.
- Authentication, malformed/unsigned/tampered/expired tokens, identity mismatch, replay, current authorization denial, and grant-external workflow all return the same non-reflective 404 and append a fixed-code audit record without token or reflected input.
- Teams rendering accepts only a branded URL produced by the strict HTTPS/origin/path/query validator; raw or LLM-originated strings are rejected by the type boundary.

## Tests

- Web handoff suite: 12/12, including replay, expiry, tamper, unsigned, duplicate-token query, wrong identity, absent/false/throwing replay authority, grant-external workflow, upstream denial, audit non-leakage, and positive context preservation.
- Teams card suite: 7/7, including HTTP, wrong-origin, fragment, extra-query, unsigned, and wrong-path negatives plus the positive deterministic card.
- Package coverage: Web 44 files / 365 tests; Teams 4 files / 65 tests; thresholds green.
- Final fresh-database `mise run ci`: exit 0, ending in `P001 PostgreSQL integration passed`.

## Scope

- No dependency, schema, migration, long-lived link, production credential, or open PR #264/#265 file was changed.
- Runtime composition must supply a durable atomic replay authority. Its absence intentionally disables handoff rather than weakening single-use semantics.

## Handoff

- Branch: `agent/P7-T09-teams-workbench-handoff`.
- Orchestrator performs push and PR creation after `AGMSG-RESULT`.
- cost: n/a

## Revision

- Resolved the hosted Gitleaks false positive with a repository-precedent allowlist limited to the two synthetic constant declarations in `packages/web/tests/workbenchHandoff.test.ts`; default detection rules and other paths are unchanged.
