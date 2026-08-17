# P7-T05 Learning Triage

## Reusable Decision Candidate

[memory:decision] A channel approval payload is an untrusted capability hint: bind its ID/version and the signed tenant/subject into a correlation MAC, reauthorize on every submit, make the database pending+version+expiry CAS authoritative, and emit the workflow signal only from the winning receipt.

## Why It Generalizes

- Prevents stale cards, cross-identity forwarding, self approval, and double-click/replay from becoming workflow decisions.
- Keeps UI/channel data out of the authority chain.
- Preserves deterministic ordering across the database and an external workflow system.

## Apply To

- Future Teams card actions and other interactive channel adapters.
- P3-T03 Temporal composition and runtime E2E.
- Negative tests for stale capabilities, identity substitution, replay, and downstream authority mismatch.

## Disposition

- Validated by unit, route, concurrent PostgreSQL, and fresh full-CI evidence.
- No skill or rule promotion was performed.
