# T15 Learning

## Learnings

- `@aiops/shared` consumers import the built `dist` barrel during tests. Exporting a CLI module from `src/index.ts` can execute stale built side effects before `build` refreshes `dist`, especially under parallel `mise run ci`.
- CI traceability guard changes should be reflected in `packages/traceability/output/traceability_matrix.md`; this is an intentional generated-output diff, not just a timestamp-only change.
- The current PrjOps report data boundary is `PrjopsReportDataProvider`. For Seven Keys qualitative inputs, wiring the provider record through to domain input is the smallest consistent path; persistent UI/API needs a separate data-source design.

## Plan Updates

- Keep CLI-only modules out of package barrel exports unless they are side-effect-free and covered by import tests.
- Treat monthly Seven Keys PDCA persistence as a follow-up design item tied to the eventual monthly store, while keeping pure snapshot diff logic covered by tests.
