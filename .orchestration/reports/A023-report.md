# A023 Report

## Outcome

- Task: `P014-FA-T02 / Plane mapping contract`
- Branch: `agent/p014-fa-plane-sandbox`
- Commit: `e19b1cda95fb699cc3eec72b881714fba5db7c60` —
  `feat(contracts): add Plane environment mapping`
- Draft PR: https://github.com/mryfmo/ai-ops-platform/pull/116
- Base: `main` at `5c441d06a60f920f27f0a8ac0c9dca9509e4f561`
- Label: `ai-generated`
- PR state: open, draft, clean, mergeable, checks green
- PR was not merged.

## Packet

The commit contains exactly the five FA-T02 allowed files plus the
orchestrator-requested Plan 014 `Planned at` line:

```text
docs/contracts/fixtures/plane-environment-mapping.dev.json
docs/contracts/schema/plane-environment-mapping.schema.json
package.json
plans/014-plane-integration.md
scripts/validate-plane-environment-mapping.mjs
tests/validate-plane-environment-mapping.test.mjs
```

No dependency, lockfile, runtime, database, Plane resource, audit document, or
worklog was changed.

## Contract

- Maps `PJ-001`, `PJ-002`, and `PJ-404` to immutable workspace UUID, routing
  slug, project UUID, and authorized HTTPS URL fields.
- Uses the A020 provenance shape.
- The tracked development fixture is explicitly unsigned,
  `replace_before_go_live=true`, and uses the non-routable `plane.invalid`
  host.
- Production shape requires a non-placeholder owner signature, disables the
  replacement flag, and rejects `.invalid` URLs.
- The stdlib-only validator rejects unknown/missing fields, malformed JSON,
  stale contract versions, noncanonical project keys, malformed/duplicate
  UUIDs, inconsistent workspace UUID-to-slug mappings, HTTP/userinfo URLs, and
  incomplete go-live replacement.
- `plane-mapping:validate` is wired into the existing governance gate.

## Gates

- Test-first RED: missing validator module
- Focused tests: 6 pass
- Development fixture CLI: PASS with visible DEV-DEFAULT warning
- `git diff --check`: PASS
- `mise run ci`: PASS
- Crit data self-review: resolved 1 / unresolved 0
- Hosted checks: PASS (`build-test`, `gitleaks`, `CodeRabbit`)
- Worktree: clean and synchronized with remote branch

`make require-crit-review` is unavailable because the repository has no such
Make target.
