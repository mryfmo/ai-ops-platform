# P2-T09 independent review receipt

- review_surface: `codex-review-profile`
- reviewer: `codex --profile review`
- scope: `verification/model-gateway/**`
- outcome: `APPROVED`

Resolved findings:

1. Real-tenant mode now validates distinct aliases and tool/thinking/cache response structures.
2. Gateway error checks parse the returned LiteLLM error body before applying the shared normalizer.
3. SSE checks require nonempty content, a nonempty finish reason in the final JSON event, and exactly one terminal `[DONE]`; a negative regression test covers duplicate/early markers.
4. External URLs use WHATWG parsing, reject userinfo, and permit plaintext HTTP only for exact IPv4/IPv6/localhost loopback hosts.

Verification after resolution: pinned gateway suite 13/13 green; fresh-DB `mise run ci` exit 0.

Revision `P2-T09-001` resolved the reviewer low finding by deleting the unused suite-local route allowlist rather than adding an unrequested duplicate boundary. The image's baked-in allowlist remains the actual runtime boundary.
