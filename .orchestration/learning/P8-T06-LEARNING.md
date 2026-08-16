# P8-T06 Learning

## Reusable Findings

1. A review workflow can safely inspect untrusted PR content without executing it: keep the collector and validators in a trusted checkout, place the target in a second credential-free checkout, and pass only paths/SHAs as validated data.
2. Exact workflow permissions plus structural negative tests are stronger than a comment-only read-only claim; token scope, checkout credential persistence, secrets, and mutation commands can all be checked mechanically.
3. Mechanical review collection should report objective manifest-boundary violations while preserving semantic findings for the independent reviewer, avoiding both false approval and invented findings.

## Apply To

- P8 reviewer orchestration, writer-reviewer handoff, and later real Codex execution wiring.
