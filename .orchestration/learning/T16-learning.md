# T16 Learning

## Reusable Findings

- For documentation-only tasks in this repository, `mise run ci` can still update `packages/traceability/output/traceability_matrix.md` by timestamp only. Check the diff and restore timestamp-only generated output before committing.
- Root README test counts should be checked against the current executable test suite. `pnpm -r --if-present run test -- --run --reporter=dot` confirmed 740 tests on T16.
- Page-agent documentation should be sourced from `packages/web/src/server/chat/tools.ts` and `packages/web/src/server/viewSpec.ts`; route files alone do not describe generated UI tool availability.

## Applied To

- `docs/reference/page-agent-tools.md`
- `docs/guide/dashboard.md`
- `README.md`
- T16 validation notes
