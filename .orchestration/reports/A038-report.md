# A038 Result Report

- Status: ready for review
- Branch: `agent/a038-dead-letter-recovery`
- Commits: `a3e7b7f`, `f8f62bf`, `837c2ef`, `f403fb0`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/142
- Base: `main` at `0bdeccdb19ec0ca983a9fd2d7de8e08c46d91f52`

## Delivered

- Added `AiOpsDeadLetterQueueNotEmpty` for any dead event sustained for five minutes. Comments state the zero threshold and five-minute `for` rationale.
- Included `dead` in `EventsRepo.getQueueMetrics()` so the existing dead gauge reports database state instead of remaining zero.
- Added `EventsRepo.requeueDead()` with a `status = 'dead'` predicate, required actor/reason, and an atomic `dead -> queued` update plus append-only `status_override` audit record in one PostgreSQL transaction.
- Preserved `attempts` as cumulative audit history. A manual requeue grants one controlled processing opportunity; if it fails, the existing `markFailed()` path immediately returns the event to `dead`.
- Added detection, cause analysis, controlled requeue, attempts semantics, and recovery monitoring to `runbooks/manual-ops.md`.
- Added no HTTP route and no dependency.

## Revision Delivered

- Sanitized the operator-supplied reason before writing the append-only audit record.
- Added strict actor validation in the pure `auditActor` helper and reused it at both repository and CLI trust boundaries.
- Added the compiled `events:requeue-dead` CLI with database-only configuration and documented its exact invocation.
- Kept the intentionally fake historical secret fixture covered by a Gitleaks allowlist that requires the rule, exact path, and exact line together. An unrelated credential on the same path remains detectable.

## Review

- Final `codex review --uncommitted` completed with no findings after the revision and narrow allowlist fix.
- GitHub Actions run `31173132673` passed: `build-test`, `gitleaks`, and `CodeRabbit`.
