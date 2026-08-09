<!-- 根拠: DevOps:REQ-003 / DevOps:REQ-010 / DevOps:REQ-012 / TH-001 / TH-003 / AC-010a -->

# A052 report

## Status

Ready for review. AGT_DEP now has runtime entry points for commit-bound staging eligibility, approved production dispatch, and scheduled production monitoring while D-04 and D-16 remain explicit fail-closed boundaries.

## Outcome

- CI publishes one deterministic `agt-dep-th001-evidence` JSON artifact with the immutable commit SHA and aggregated unit-test line coverage. `GitHubClient` reads exactly one bounded ZIP entry and rejects malformed, ambiguous, oversized, encrypted, multi-entry, or mismatched archives.
- Successful canonical CI workflow runs are routed to AGT_DEP and build TH-001 input only from matching coverage evidence and injected critical-count evidence. D-16 currently returns unavailable, so production never infers `critical=0`; it audits and skips staging promotion.
- AGT_CHG persists the approved deployment `target_sha`. The 30-second recovery scheduler claims only approved change approvals and atomically writes the `dispatched_at` marker, claim audit, and durable `approved` deployment work item. A later tick recovers that work item after worker loss.
- Repository mapping is strict: zero or multiple active `project_channels` rows fail closed and are audited. The approved target contract is `(owner, repo, commit_sha)`.
- Production dispatch CAS-transitions the work item to `prod_deploying` before calling `executeProdDeploy`. Missing or unobservable `deploy-prod.yml` records `dispatch_failed` with zero dispatch attempts; dispatch exceptions and unsuccessful workflow completions transition the same row to `dispatch_failed`.
- A successful `deploy-prod.yml` workflow run CAS-transitions the matching repo/commit row to `monitoring`, making the scheduled monitoring path reachable once D-04 resources exist.
- The 60-second monitor reads at most 100 monitoring rows. Missing RED windows are not zero-filled. Missing stable history or workflow availability evaluates with an empty rollback-candidate list, so TH-003 remains observable without a rollback dispatch. Eligible rollback work is claimed `monitoring -> rolling_back` before the remote side effect and ends `rolled_back`, preventing repeat dispatches.
- `staging_promotion`, `prod_deploy`, and `prod_monitor` are exposed as degraded capabilities until their outstanding authoritative sources/resources exist.

## Review

`make require-crit-review` is not defined in this repository. Review-profile investigation identified an unreachable monitoring state because successful production workflows did not advance `prod_deploying`; the first implementation added that CAS writer. GitHub review then identified four runtime gaps: unsuccessful deploy completion, claim crash recovery, CI-success routing, and repeat rollback dispatch. All four now have state/routing fixes and RED-first regression tests.

## Delivery

- Branch: `agent/a052-agt-dep-wiring`
- Implementation commit: `b94b266` (`feat(devops): wire AGT_DEP runtime paths`)
- PR: https://github.com/mryfmo/ai-ops-platform/pull/149
- State: review findings fixed locally; final GitHub checks and zero-thread gate are required before AGMSG-RESULT
- No merge performed

## Successor boundaries

- D-16 owns authoritative static-analysis Critical-count evidence. Until then, staging promotion remains disabled even when coverage evidence is complete.
- D-04 owns `deploy-prod.yml`, complete TH-003 RED windows/baseline, and durable stable-version history. A052 supplies the consumers, persistence, guards, and evaluation-only behavior without claiming those resources exist.
