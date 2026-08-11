# A016 Report

## Outcome

- Tasks: `P010-F02-T05` and `P010-F02-T06` (atomic scope)
- Branch: `agent/p010-f02-t05-entra-claims`
- Commits:
  - `385e5083b6306d6ca9b0b56245f09d041ffcc669` — `feat(web): propagate Entra stable subject`
  - `bdd99139878d57b801bf1d8647bcad3893d9fef2` — `feat(web): resolve personas by stable subject`
  - `65df4b57a282000b253f19c8ad689fd27a669265` — `fix(prjops): honor global executive scope`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/110
- PR base: `main` at `8dc77976ce279fd65fda7447d9e311fb55c7709a`
- PR state: open, ready, mergeable
- Label: `ai-generated`
- The PR was not merged; merge remains gated on orchestrator acceptance.

GitHub CLI was used first for PR readback, update, review-thread inspection, and
hosted checks. No web fallback was used. The PR description was refreshed after
the second commit and now describes the full T05+T06 diff.

## T05 Stable Claim Boundary

- Auth.js remains the OIDC signature, issuer, audience, and expiry validator.
- Validated `tid`/`oid` are canonicalized to lowercase UUIDs.
- `roles` remain opaque signed values: trim, stable-order exact dedupe,
  malformed rejection, and case-collision rejection only.
- JWT/session retain stable subject and roles only. Email, name, image, and
  provider subject are not retained or used for authorization.

## T06 Persona and Scope Resolution

- Production persona interfaces expose `resolveBySubject` only.
- DevOps recipients are reread per request using exact tenant/object ID plus
  `active = true` and `backfill_state = 'applied'`.
- PrjOps YAML records require exact stable subject, active stakeholder, and
  active assignment.
- Multiple active personas without an exact selector return `409 E-AUTH03`.
- Persona selector order is deterministic by profile, domain, project ID, then
  global.
- Project/global scope is threaded into data-side permission filters.
- Dashboard, data APIs, and chat project-board tools use stable subject and the
  same scope-aware predicates.
- Production source contains no `resolveByEmail`, `findByEmail`,
  `session.user.email`, or `user.email` authorization caller.

## Codex Review Fixes and Explicit Scope Rationale

The following were found by Codex review after the atomic T05+T06 expansion.
Each item is enumerated because the orchestrator required no silent scope
growth.

1. `packages/devops/src/lib/reportPermissionFilter.ts:22` — project-scoped
   PRF-M and PRF-G previously inherited profile-wide access. The filter now
   requires the exact assignment allowlist; explicit global is PRF-G-only and
   invalid explicit scope fails closed. In scope because the orchestrator
   explicitly added this file for the T06 cross-project DENY matrix.
2. `packages/prjops/src/lib/reportPermissionFilter.ts:36` — project-scoped
   PRF-04 previously retained portfolio-wide access. It now uses the assignment
   managed-project allowlist; explicit global is PRF-04-only. In scope under the
   same explicit filter expansion.
3. `packages/prjops/src/data/yamlStakeholderMasterProvider.ts:227` — investor
   authorization now requires the intersection of an active project assignment
   and canonical `invested_project_ids`. In scope because the T06 contract
   requires PRF-05/investor cross-project DENY and explicitly allowed the
   PrjOps YAML provider/model.
4. `packages/web/src/server/authGuard.ts:94` — total persona ambiguity is
   checked before endpoint-domain filtering, preventing silent defaulting to a
   domain-specific persona. In scope because T06 requires multi-persona 409 and
   explicitly allowed `authGuard.ts`.
5. `packages/prjops/src/data/yamlStakeholderMasterProvider.ts:254` — Teams
   lookup now returns a profile only for exactly one active project assignment;
   ambiguous same-project profiles return null. In scope because the expanded
   assignment model permits multiple profiles and the existing provider method
   had to remain fail-closed.
6. `packages/prjops/src/data/yamlStakeholderMasterProvider.ts:175` — duplicate
   detection canonicalizes `investor` to `PRF-05`, rejecting simultaneous alias
   assignments. In scope because the T06 contract defines them as one
   authorization audience.
7. `packages/web/src/server/chat/tools.ts:121` — the inline DevOps PRF-G bypass
   was replaced with `@aiops/devops` `isProjectInScope`; project-scoped PRF-G
   now denies foreign projects. The orchestrator explicitly added this file and
   its test after independently confirming the bypass.
8. `packages/prjops/src/data/yamlStakeholderMasterProvider.ts:262` — active
   global PRF-04 assignments now authorize Teams lookup for every requested
   PrjOps project, while a concurrent exact project assignment still produces
   an ambiguous `null`. In scope because the provider/model is explicitly
   allowed and the T06 scope matrix requires global PRF-04 to cover all PrjOps
   projects without weakening fail-closed ambiguity behavior.

No further caller bypass was found by the final source search.

## Gates

- Phase 1 acceptance validator through P010-F01-T11: PASS, 15 records
- Focused DevOps permission filter: PASS, 10 tests
- Focused PrjOps permission/provider: PASS, 53 tests
- Focused Web resolver/auth/chat tool: PASS, 47 tests
- DevOps suite: PASS, 206 passed / 6 skipped
- PrjOps suite: PASS, 387 passed
- Web suite: PASS, 241 passed / 1 skipped
- DevOps, PrjOps, and Web typecheck: PASS
- Final `MISE_LOCKED=1 mise run ci`: PASS
- Crit data Codex self-review: resolved 11 / unresolved 0
- Hosted checks: PASS (`build-test`, `gitleaks`, `CodeRabbit`)
- Linked worktree: clean and synchronized with the pushed branch

`make require-crit-review` is unavailable because the repository has no such
Make target. Browser Crit and a user review request were not used.

The initial GitHub Codex P1 thread correctly identified the broken intermediate
T05-only state. The T06 commit addresses every caller named in that thread.
GitHub still reports the thread as unresolved/non-outdated; per instruction,
the worker did not reply to or resolve that external thread without explicit
authorization.

## QUESTION for Plan Owner

Neither `docs/contracts/entra-subject-mapping.md` nor
`docs/contracts/persona-scope-matrix.md` defines canonical Entra app-role values
or semantic conflict pairs. A016 therefore does not invent role-to-persona
authorization. DEC-SPEC-003 ownership must define those semantics before a
later task enforces them.
