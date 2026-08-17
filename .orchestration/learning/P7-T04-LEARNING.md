# P7-T04 Learning Triage

## Reusable Decision Candidate

[memory:decision] A rich-result renderer should accept an exact discriminated union rather than generic card JSON, brand plain text and HTTPS links at parsing time, and reparse at render time so unsafe runtime casts cannot bypass the trust boundary.

## Why It Generalizes

- It makes LLM-authored markup structurally unrepresentable at the presentation API.
- One parser protects every result builder from extra fields, unsafe links, non-finite values, and payload-size abuse.
- Deterministic builders keep snapshots meaningful and keep business state outside the channel adapter.

## Apply To

- Future Teams result kinds and channel delivery wiring.
- Other adapters that transform model/tool output into interactive UI payloads.
- Negative tests for markup injection, URL schemes, runtime casts, and payload ceilings.

## Disposition

- Candidate only; no skill or rule promotion was performed.
- The validated decision is recorded in the Codex learn index for future planning and tests.
