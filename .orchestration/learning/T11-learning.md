# T11 Learning

## Learnings

- The traceability verifier previously built PrjOps and DevOps corpora from `shared`, `prjops`, and `devops` only. Web UI spec references such as `SPEC-INT-064` and `AC-010-3` were invisible even when correctly referenced in `packages/web`.
- For Web-facing specs, `packages/web` must be included in traceability corpus; otherwise reports can show false "implementation reference missing" rows for UI-only acceptance criteria.
- Recharts 3 works in this Next.js 15 / React 19 setup when chart wrappers are isolated in a client component and data shaping is kept in pure functions.
- `packages/traceability/output/traceability_matrix.md` is timestamped output. Restore it after verification unless the task explicitly wants generated output committed.

## Plan Updates

- Future Web UI tasks that add spec IDs should verify whether traceability includes the Web corpus before treating missing references as implementation gaps.
- Keep chart wrapper components client-only and keep data shaping independently testable.
