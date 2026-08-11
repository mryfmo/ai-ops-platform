# A040 learning triage

## Candidate

Pino redact wildcard segments match one object level each; consecutive wildcard segments can protect known finite depths. For repositories whose logger payloads are shallow, generating a bounded static path set avoids a recursive serializer on the logging hot path.

## Decision

Not promoted. This is implementation-specific evidence for the current Pino version and should remain task-local unless another logging task demonstrates reuse.
