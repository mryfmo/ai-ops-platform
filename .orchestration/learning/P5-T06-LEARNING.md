# P5-T06 Learning

## Reusable Findings

1. A literal client marker documents the runtime mode, but the concrete client constructor must also require an opaque token provider; an unused strict factory does not protect a production path that bypasses it.
2. `@ts-expect-error` inside a Vitest file is not checked by Vitest's transform alone; run the fixture through `tsc` so unused directives and unexpected assignability fail mechanically.
3. Capability types built with `Pick` keep a system-only interface synchronized with the existing runtime client without a forwarding wrapper or duplicated method declarations.
4. Do not invent a delegated Graph interface: the absence of that surface is part of the ADR-0024 security boundary.
5. Brand only inside the production MSAL provider after validation. Exporting a raw string-to-brand helper lets delegated callers relabel their bearer and defeats the boundary.

## Apply To

- Future Graph token-provider composition, WIQ-003 conformance, and any system/delegated credential separation test.

No rule or skill was promoted by this worker.
