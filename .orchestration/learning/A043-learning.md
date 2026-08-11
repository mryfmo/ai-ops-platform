# A043 learning triage

## Validated learnings

- Evidence validators can pass vacuously when the artifact has no evidence markers. The renderer and lookup contract must be established together, while explicitly valid empty data remains a zero-reference case.
- Forbidden-term checks against rendered HTML must normalize terms with the renderer's escaping; raw `includes()` checks miss encoded ampersands and apostrophes.
- A provider needed only by restricted audiences should be loaded lazily at the per-recipient gate. Provider failure must fail closed for those audiences without stopping unrelated recipients.

## Applied to

- Pure gate construction and renderer tests.
- Encoded forbidden-term regression test.
- Personal-name provider failure isolation test.
- Project learn index entry `20260808_112826_learn.md`.
