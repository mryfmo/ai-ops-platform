# A019 Validation

## Scope and Commit

```text
f3eb6a549562a69d23828c10e96d1bbfbc5674e5 feat(web): add scoped project picker
a0f147135125b0ce41a5be82f7ad590c0839affe test(web): cover portfolio picker roles
```

The commits contain the exact eight-file packet listed in
`.orchestration/reports/A019-report.md`.

## Preflight and Prerequisite

```text
node scripts/validate-acceptance-manifest.mjs --through P010-F01-T11 verification/acceptance-manifest.json
WARNING: DEV-TRUST: 13 placeholder trust assignments are development-only; production acceptance is blocked.
OK: validated 15 acceptance records through P010-F01-T11.
```

The validator exited 0. P010-F02-T10 and DEC-SPEC-008 were reread in full. The
accepted A020 fixture provides canonical `PJ-*` to fake DEV ProjectV2 node/URL
mapping with explicit go-live replacement provenance.

## Test-First Evidence

The initial focused run failed because `ProjectPicker.tsx` and
`projectSelection.ts` did not exist and because the projects API lacked
`portfolioAllowed` and E-AUTH05 parameter rejection. The run recorded 2 failed
suites and 10 failed handler tests.

Final focused result:

```text
Test Files  4 passed
Tests       60 passed
```

The focused set covers:

- exact/missing/all parser classification;
- case, Unicode, traversal, short, whitespace, and repeated malformed input;
- one-project auto-selection and multiple-project E-AUTH04;
- canonical ordering and same-name/different-ID selection;
- stale/unknown/inactive/cross-tenant/cross-persona/out-of-scope denial;
- PRF-04/PRF-G `all` authorization boundary;
- legacy noncanonical option fail-closed;
- malformed query: scoped/detail query 0;
- unknown/cross-persona query: scoped lookup 1, detail query 0;
- exact scoped project: scoped lookup 1, detail query 1;
- projects API empty/valid/malformed/all/repeated parameter rejection before
  production DI;
- accessible label, focus, announcements, URL push/replace, `all` synthesis,
  and DOM-injected option rejection.

## Package and Repository Validation

```text
@aiops/web test:
  Test Files 36 passed / 1 skipped
  Tests      303 passed / 1 skipped

@aiops/web lint:      PASS
@aiops/web typecheck: PASS
mise run format:      PASS
git diff --check:     PASS
```

Final `mise run ci` exited 0. Governance, lint, traceability, format, build,
typecheck, and coverage tests passed. The traceability generator output was
restored so the commit remains inside the selected packet.

Coverage-run totals:

```text
shared:       335 passed
traceability: 56 passed
devops:       206 passed / 6 skipped
prjops:       387 passed
web:          303 passed / 1 skipped
server:       477 passed
```

The authorization-state source search returned zero matches:

```text
rg -n 'localStorage|project.*cookie' packages/web/src
```

## Crit CLI Self-Review

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A019-crit-comments.json
review_outcome: approved-after-fix
resolved: 1
unresolved: 0
```

The review found that legacy `PRJ-*` scoped options could otherwise
auto-select and fail the next canonical request. The implementation now
filters options to `PJ-*`, with a regression test.

Receipt: `.orchestration/validation/A019-review-receipt.md`.

`make require-crit-review` and its receipt-qualified retry exited 2 because
this repository has no such Make target. No browser or user review request was
used.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/114
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/p010-f02-t10-picker`
- Head SHA: `a0f147135125b0ce41a5be82f7ad590c0839affe`
- Base SHA: `ee613b403952f7f0912ffd5ba659dbb43359e8e7`
- Label: `ai-generated`
- Mergeable: `MERGEABLE`

Hosted checks:

```text
build-test  pass
gitleaks    pass
CodeRabbit  pass
```

## Final Repository State

The linked worktree is clean and synchronized with its remote branch. PR #114
was not merged.
