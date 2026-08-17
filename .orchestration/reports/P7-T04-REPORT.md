# P7-T04 Rich Result Components Report

## Outcome

Implemented a pure, stateless Teams presentation boundary for six typed result kinds: status, table, bar/line chart, incident, pull request, and source references. Unknown input is parsed into an exact discriminated union before rendering; arbitrary Adaptive Card JSON is neither accepted nor passed through.

## Trust Boundary

- Every object uses exact required/optional keys. Unknown kinds, missing fields, and extra fields fail closed.
- Text slots become branded `PlainText` only after rejecting blank, oversized, control-character, markup, Markdown, and URI-bearing strings.
- Links become branded `HttpsUrl` only after accepting an absolute HTTPS URL without credentials or a fragment.
- Table and chart values accept only finite JavaScript numbers; pull-request numbers must be positive safe integers.
- `renderRichResultCard` reparses its typed argument, so an unsafe runtime cast cannot bypass validation.
- The public renderer accepts `RichResult`, not a generic Adaptive Card body/action shape.

## Deterministic Presentation

- Builders emit Adaptive Card 1.5 objects without external dependencies or state.
- Tables use the native 1.5 `Table` element.
- Adaptive Card 1.5 has no native chart element, so chart builders use deterministic Unicode bars/sparklines while retaining every numeric value as text.
- Incident, pull-request, and source actions are generated only from validated HTTPS URLs.
- Source cards retain label, source ID, version, and URL rather than copying source content.
- UTF-8 serialized cards above the conservative Teams 28 KiB ceiling fail closed.

## Scope

- No channel state, workflow state, schema, server wiring, dependency, or credential was added.
- PR #260 remains open. Its `packages/channel-teams/src/index.ts` change was not touched, so this branch intentionally has no package-root re-export. Integration may add that export after #260 merges and this branch rebases.

[memory:decision] Rich Teams output must cross an exact typed-result boundary, revalidate at runtime, emit only locally constructed card shapes, and reject markup, unsafe links, non-finite numbers, and oversized payloads before delivery.

## Deferred Gate

Real-tenant Teams rendering remains deferred until tenant access is available. This task supplies deterministic unit, snapshot, type, and clean-runner CI evidence.

## Handoff

- Branch: `agent/P7-T04-rich-result-components`
- Orchestrator owns push and non-draft PR creation after `AGMSG-RESULT`.
