# A019 Report

## Outcome

- Task: `P010-F02-T10`
- Status: `ready_for_review`
- Branch: `agent/p010-f02-t10-picker`
- Base: `origin/main` at `ee613b403952f7f0912ffd5ba659dbb43359e8e7`
- Commits:
  - `f3eb6a549562a69d23828c10e96d1bbfbc5674e5` —
    `feat(web): add scoped project picker`
  - `a0f147135125b0ce41a5be82f7ad590c0839affe` —
    `test(web): cover portfolio picker roles`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/114
- PR state: open, ready, and mergeable
- Label: `ai-generated`
- The PR was not merged; merge remains gated on orchestrator acceptance.

GitHub CLI was used first for PR creation and readback. Browser Crit and a user
review request were not used.

## Selected Packet

The implementation is limited to the plan-enumerated eight files:

```text
packages/web/src/app/dashboard/page.tsx
packages/web/src/components/ProjectPicker.tsx
packages/web/src/server/projectSelection.ts
packages/web/src/server/reportData/projectsHandler.ts
packages/web/src/app/api/data/projects/route.ts
packages/web/tests/ProjectPicker.test.tsx
packages/web/tests/projectSelection.test.ts
packages/web/tests/reportData/projectsHandler.test.ts
```

Diff summary: 8 files changed, 728 insertions, 30 deletions.

No dependency, worklog, docs/audit, domain endpoint, or persistence file was
changed.

## Selection Control

- The A020 DEV-DEFAULT fixture satisfies the DEC-SPEC-008 mapping precondition.
- URL input accepts only exact canonical `PJ-*`, explicit `all`, or missing.
- Scoped options are canonicalized and sorted by project ID, then display name.
- One option auto-selects with URL replacement; multiple missing options stop
  before detail data with `E-AUTH04`.
- `all` is synthesized only for active global PRF-04 or PRF-G.
- Malformed values stop before scoped/detail data queries. Unknown, inactive,
  stale, cross-tenant, cross-persona, and out-of-scope exact IDs stop after the
  scoped lookup and before detail data.
- The native select provides a label, focus, status/error announcements, URL
  push/replace behavior, and rejects DOM-injected options.
- `/api/data/projects` rejects every present `project` parameter with 400
  `E-AUTH05` before production DI or domain queries.
- Selection application to domain endpoints remains deferred to T13.

## Gates

- Acceptance-manifest preflight through P010-F01-T11: PASS, 15 records
- Test-first RED: missing modules and 10 contract failures observed
- Focused picker/selection/API/composition tests: PASS, 60
- Web suite: PASS, 303 passed / 1 skipped
- Web lint and typecheck: PASS
- `mise run format`: PASS
- Final `mise run ci`: PASS
- Authorization `localStorage|project.*cookie` source matches: 0
- Crit data Codex self-review: resolved 1 / unresolved 0
- Hosted checks: PASS, `build-test`, `gitleaks`, and `CodeRabbit`
- Worktree: clean and synchronized with the pushed branch

`make require-crit-review` is unavailable because this repository has no such
Make target; the receipt-qualified retry produced the same result.
