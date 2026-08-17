# P7-T10 Learning Triage

## Reusable Decision Candidate

[memory:decision] A Phase 1 mini-app surface should use a closed discriminated component catalog, reference-only strict specs, and a synchronous locally authored renderer. Match the spec's resource context to the authorization-shaped response, but keep acquisition authorization at the API/SQL/policy boundary.

## Why It Generalizes

- A type and strict runtime schema make script, markup, network target, handler, and unknown-component injection structurally unavailable.
- Reusing the authorized response projection prevents the UI from inventing a second data or permission authority.
- Runtime spec/data correlation catches cross-workspace mix-ups without pretending that a display-layer check replaces authorization.
- An absence test protects architecture decisions that otherwise have no runtime behavior to exercise.

## Apply To

- Future Workbench page/tool wiring and approved catalog additions.
- Other typed mini-app or agent-generated UI surfaces.
- Tests for component allowlists, extra executable fields, resource correlation, network silence, and forbidden runtime inventory.

## Disposition

- Candidate only; no skill or rule promotion was performed.
- Add a new catalog component only with an exact schema branch, locally authored renderer, scope test, and deterministic snapshot.
