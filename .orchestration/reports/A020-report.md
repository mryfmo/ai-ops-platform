# A020 Report

## Outcome

- Task: `A020 / DEC-SPEC-008 DEV-DEFAULT mapping fixture`
- Branch: `agent/A020-dec-spec-008-dev-fixture`
- Commit: `5e63a04a74495aea2e9bff5f35f18c92d37140c6` —
  `docs(contracts): add dev ProjectV2 mapping fixture`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/113
- PR base: `main` at `fc2aeeb6a24683e87e2b478b8c0c40234da6bbd2`
- PR state: open, ready, and mergeable
- Label: `ai-generated`
- The PR was not merged; merge remains gated on orchestrator acceptance.

GitHub CLI was used first for PR creation and readback. Browser Crit and a user
review request were not used.

## Selected Packet

The change is limited to two contract files:

```text
docs/contracts/fixtures/projectv2-environment-mapping.dev.json
docs/contracts/schema/projectv2-environment-mapping.schema.json
```

Diff summary: 2 files changed, 84 insertions.

No runtime source, dependency, worklog, audit document, or production
environment value was changed.

## DEV-DEFAULT Mapping

- The fixture maps every canonical-form `PJ-*` identifier found under the
  existing fixture directories: `PJ-001`, `PJ-002`, and `PJ-404`.
- Every ProjectV2 node value is clearly fake and deterministic:
  `DEV-NODE-<PJ-ID>`.
- Every authorized URL is the required placeholder:
  `https://github.com/mryfmo/ai-ops-platform-dev-sandbox`.
- Embedded provenance records `mryfmo`, the
  `dev-phase instruction 2026-07-18`, and `DEV-DEFAULT-unsigned`.
- The fixture declares that it is development-only and must be replaced with
  owner-signed real environment values before go-live.
- A draft-2020-12 JSON Schema fixes the required shape, constants, and
  additional-property rejection without adding a runtime dependency.

## Gates

- Existing-fixture ID re-derivation and exact key equality: PASS, 3 mappings
- Node ID and authorized URL semantic validation: PASS
- JSON parse and `git diff --check`: PASS
- `mise run format`: PASS
- `mise run ci`: PASS
- Crit data Codex self-review: resolved 1 / unresolved 0
- Hosted checks: PASS (`build-test`, `gitleaks`, `CodeRabbit`)
- Worktree: clean and synchronized with the pushed branch

`make require-crit-review` is unavailable because this repository has no such
Make target.
