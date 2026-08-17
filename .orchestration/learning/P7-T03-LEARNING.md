# P7-T03 Learning Triage

## Reusable Decision Candidate

[memory:decision] In mention-driven channel adapters, machine-sender suppression must precede mention/mapping logic; structured target IDs are authoritative; unmapped ambient traffic stays silent; exactly one bot-target mention is the explicit subscription/start signal; mapped replies reuse the identity-scoped conversation authority.

## Why It Generalizes

- Prevents bot loops and ambient-channel noise without display-name heuristics.
- Separates presentation flow from workflow/business state.
- Preserves P7-T02 tenant/subject/thread acquisition and avoids workflow-ID-only resolution.

## Apply To

- Future Teams runtime wiring and UX-001 tenant E2E.
- Other replaceable channel adapters implementing explicit mention/subscription semantics.
- Negative tests for bot echo, application activities, duplicate bot targets, and unrelated-thread silence.

## Disposition

- Candidate only; no skill or rule promotion was performed.
- Add to Codex learn index after final validation/review because the behavior is mechanically validated and reusable.
