# P8-T05 Learning

## Reusable Decisions

- Pin the official direct Droid binary and its checksum; disable auto-update so the
  reviewed bytes remain the executed bytes.
- Droid currently exposes no native cost, token, or turn hard-limit flags suitable for
  this contract. Keep cost/token limits at the scoped virtual-key issuer and leave the
  runner disabled until early turn enforcement is independently proven.
- In `jq`, missing values can satisfy type-order comparisons. Require numeric,
  non-negative evidence before upper-bound checks, and validate nested object/list types.
- An activation validator must prove step order and parsed YAML `continue-on-error`, not
  only search the shell text for a failure statement.

## Follow-up Boundary

Activation requires reviewed FACTORY credential handling, issuer-budget verification,
native or approved wrapper turn enforcement, and a real end-to-end evidence run. Later
work must remove the gate only in the same reviewed change that supplies those proofs.
