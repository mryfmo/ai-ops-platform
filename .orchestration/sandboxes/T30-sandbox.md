# T30 Sandbox Record

- OpenSandbox: not used.
- Fallback: direct shared workspace with read-only source review.
- Allowed writes: exact T30 artifacts under `.orchestration/` only.
- Product source/docs/workflows: not edited.
- External operations: only read-only npm advisory lookup (`pnpm audit --prod`) after approval; no application API or LLM call.
- Validation commands were allowed by the task. `mise run ci` generated a timestamp-only traceability diff, which was restored to the pre-validation HEAD state.
- Pre-existing untracked `.agents/` was observed before work and left untouched.
- Revise round 1 repeated only read operations against source/workflows; all edits remained confined to existing T30 `.orchestration/` artifacts.
