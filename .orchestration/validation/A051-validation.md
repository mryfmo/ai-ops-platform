# A051 Validation

## Behavior

- RED: six server route assertions failed before scope enforcement; the new Web UI unauthorized-row test also failed before disabled metadata was consumed.
- Server focused/coverage: 811 tests passed on a clean disposable PostgreSQL database.
- Web: 312 tests passed in coverage; the focused UI suite verified that an unauthorized row remains visible, explains the denial, disables its textarea/buttons, and issues no POST.
- DevOps: 216 tests executed (210 passed, 6 skipped), including the existing AGT_CHG `projectId` propagation regression.
- Full coverage: shared 457, traceability 122, devops 216, prjops 356, web 312, server 811; exit 0.
- `mise run verify:db`: exit 0, including `P001 PostgreSQL integration passed`.

## Quality gates

- `mise run lint`: passed.
- `mise run typecheck`: passed.
- `mise run format`: passed.
- `mise run traceability`: passed and regenerated the matrix.
- `pnpm --filter @aiops/server build`: passed.
- `pnpm --filter @aiops/web exec next build --webpack`: passed.
- `git diff --check`: passed.
- Gitleaks 8.30.1 equivalent scan: no leaks found (274 commits, approximately 7.46 MB).
- External plan-quality validator: passed all checks for `.agents/worklog/codex/plan/A051-plan.md`; the external hook exited 0. The session's no-subagent policy required manual reviewer-checklist application.
- `make require-crit-review`: unavailable because the repository has no such target. Independent `codex review --uncommitted` completed; its two findings were rejected because each reverses an explicit A051 acceptance condition. See `.orchestration/reviews/A051-codex-review.md`.

## Environment boundary

- The canonical local `mise run ci` reached the Web build and then failed because macOS Seatbelt denied Turbopack process creation/port binding, including on an approved escalated retry. The same production build passed with Next.js webpack, and all remaining canonical lint, format, typecheck, traceability, full coverage, and real-PostgreSQL gates passed independently.
- GitHub `build-test`/`gitleaks` results: pending publication.
