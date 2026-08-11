# A020 Validation

## Scope and Commit

```text
5e63a04a74495aea2e9bff5f35f18c92d37140c6 docs(contracts): add dev ProjectV2 mapping fixture
```

The commit contains the exact two-file packet listed in
`.orchestration/reports/A020-report.md`.

## Policy Readback

The A019 revise instruction authorized A020 under the operator development
default recorded by:

```text
.orchestration/acceptance/ADR-0018-owner-approval.md
docs/decisions/acceptance-trust-bootstrap.md
```

The records identify `mryfmo` as the 2026-07-18 dev-phase decision maker and
require all DEV-DEFAULT placeholders to be replaced before go-live.

DEC-SPEC-008 requires a mapping from each canonical `PJ-*` identity to one
ProjectV2 node ID and authorized URL. A020 supplies only that mapping
prerequisite; it does not claim the separate owner-signed Status inventory or
production ENV acceptance.

## Fixture Inventory Re-Derivation

The only repository fixture roots are:

```text
docs/contracts/fixtures
packages/prjops/tests/fixtures
```

Re-extracting `PJ-*` tokens from both roots produced:

```text
PJ-001
PJ-002
PJ-404
```

The validation compared this sorted set with the mapping object keys and
verified each row:

```text
project_v2_node_id = DEV-NODE-<PJ-ID>
authorized_url     = https://github.com/mryfmo/ai-ops-platform-dev-sandbox
```

Result:

```text
validated 3 mappings: PJ-001, PJ-002, PJ-404
```

Both contract files also parsed as JSON.

## Repository Definition of Done

```text
mise run format
mise run ci
```

Both exited 0. The full CI covered governance, lint, traceability, format,
build, typecheck, and coverage tests. The traceability generator output was
restored after validation so the committed diff remains inside the selected
packet.

Coverage-run test totals included:

```text
shared:       335 passed
traceability: 56 passed
devops:       206 passed / 6 skipped
prjops:       387 passed
web:          268 passed / 1 skipped
server:       477 passed
```

## Crit CLI Self-Review

```yaml
review_surface: crit-data
reviewer: codex
review_source: .orchestration/validation/A020-crit-comments.json
review_outcome: approved
resolved: 1
unresolved: 0
```

Receipt: `.orchestration/validation/A020-review-receipt.md`.

`make require-crit-review` exited 2 because this repository has no such Make
target. The A020-required Crit self-review was completed with local Crit data;
no browser or user review request was used.

## GitHub Validation

- PR: https://github.com/mryfmo/ai-ops-platform/pull/113
- State: `OPEN`
- Draft: `false`
- Base: `main`
- Head: `agent/A020-dec-spec-008-dev-fixture`
- Head SHA: `5e63a04a74495aea2e9bff5f35f18c92d37140c6`
- Base SHA: `fc2aeeb6a24683e87e2b478b8c0c40234da6bbd2`
- Label: `ai-generated`
- Mergeable: `MERGEABLE`

Final hosted checks:

```text
build-test  pass (3m19s)
gitleaks    pass (6s)
CodeRabbit  pass
```

## Final Repository State

The linked worktree is clean and synchronized with its remote branch. PR #113
was not merged.
