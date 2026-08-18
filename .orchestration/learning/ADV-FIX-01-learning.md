# ADV-FIX-01 Learning

## Keep

- Audit sinks intentionally reject secret-like detail. Every attacker-controlled field must be sanitized before append or the rejection becomes an audit-evasion primitive.
- Static least-privilege tests should compare repository SQL mutation targets with the provisioning allowlist; exclude SQL grammar forms such as `DO UPDATE` and `FOR UPDATE` from direct-table extraction.
- Fetch implementations may decode upstream content while preserving original representation headers. A proxy that forwards the decoded stream must remove stale encoding and length headers.
- Broad secret regexes need a left token boundary. A substring such as `sk-` inside ordinary hyphenated prose otherwise mutates trusted audit detail and can trigger the same fail-closed E-AUD02 path as a real secret.
- Sanitizing one sibling header is not sufficient: enumerate every attacker-controlled field in an audit detail, including unsigned correlation IDs retained only for operator lookup.

## Triage

- Reusable and validated, but no new skill is needed. The rules belong in project tests and existing security/proxy conventions.
- No rule promotion was performed.
