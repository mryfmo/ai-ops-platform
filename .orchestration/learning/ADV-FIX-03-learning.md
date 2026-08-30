# ADV-FIX-03 Learning Triage

## Candidate

[memory:decision] A pre/post boundary guard is not deployable until a trusted task issuer fixes the exact manifest bytes and digest before the writer runs. A schema/fixture alone is not a runtime authority, and a workflow input is only trustworthy when its producer is identified and outside writer control.

## Reuse

- Apply to coding-agent workflow plans, independent-review collectors, and any policy file whose content is read from an untrusted checkout.
- Preserve raw-byte digest semantics end to end; JSON parse/re-serialize can change bytes without changing meaning.
- Treat missing authority as a design STOP, not as permission to synthesize allowlists from free text.

## Promotion

- Not promoted. Orchestrator should consolidate after the authority design is implemented and validated.
