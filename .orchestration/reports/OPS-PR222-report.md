# OPS-PR222 merge-unblock report

## Outcome

- PR: https://github.com/mryfmo/ai-ops-platform/pull/222
- Result: **MERGED** by `mryfmo` via squash merge
- Approved head: `ea575194f77288ebae7dfa5d555dd123d9662f88`
- Current-head approval: `2026-08-14T07:43:17Z` by `mryfmo`
- Merged at: `2026-08-14T07:43:46Z` by `mryfmo`
- Merge commit: `5e5b2318b03beedf156de48486a26f8254a73f3c`
- Post-merge default branch head: `5e5b2318b03beedf156de48486a26f8254a73f3c`
- Remaining open PRs after merge: 0

## Investigation

### Ruleset and repository merge settings

- Active ruleset: `main-protection` (`20678089`), targeting `refs/heads/main`.
- Required reviews: 1 approving review, code-owner review required, stale reviews dismissed on push, last-push approval not required, review-thread resolution required.
- Required checks: `build-test` and `gitleaks`, with strict status-check policy.
- Allowed ruleset merge methods: merge, squash, and rebase.
- Bypass actors: none; `current_user_can_bypass=never`.
- Repository settings allow squash, merge-commit, and rebase merges. Auto-merge is disabled, which does not block a manual squash merge.
- The classic branch-protection endpoint returned 404 because protection is implemented by the repository ruleset; this is not a missing-protection condition.
- No repository misconfiguration was found or changed.

### CODEOWNERS and actor feasibility

- `.github/CODEOWNERS` is identical on `main` and the PR head.
- The default `* @mryfmo` rule covers all five changed files:
  - `packages/web/package.json`
  - `packages/web/src/server/chat/chatHandler.ts`
  - `packages/web/tests/chat/chatRoute.test.ts`
  - `packages/web/tests/chat/tools.test.ts`
  - `pnpm-lock.yaml`
- Authenticated `gh` actor: `mryfmo`, repository role `admin`, and not the PR author (`app/aiops-pr-bot`).
- GitHub has no approval dry-run endpoint. Feasibility was established read-only from actor identity/permission, CODEOWNERS resolution, PR authorship, and ruleset requirements; the authorized approval then succeeded normally without bypass.

### GraphQL PR state before remediation

- State: OPEN; draft: false.
- Head: `ea575194f77288ebae7dfa5d555dd123d9662f88`.
- `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED`, `reviewDecision=REVIEW_REQUIRED`.
- Current-head status rollup: SUCCESS.
- Required checks `build-test` and `gitleaks`: SUCCESS; CodeRabbit: SUCCESS.
- Review threads: 0 total; review requests: 0.
- Only review: Owner approval on old head `03bd7b4672409cfacbb426a8a8396f2f1762dca8`, submitted `2026-08-14T07:09:37Z`, state `DISMISSED`.
- Timeline: `mryfmo` force-pushed at `2026-08-14T07:11:08Z`, replacing `03bd7b4...` with `ea57519...`; the active ruleset's stale-review policy invalidated the old approval.

These facts establish that the sole merge blocker was the missing code-owner approval on the current head.

## Authorized remediation

1. Submitted an Owner approval for exact head `ea575194f77288ebae7dfa5d555dd123d9662f88` at `2026-08-14T07:43:17Z`.
2. Re-read the PR: `reviewDecision=APPROVED`, `mergeStateStatus=CLEAN`, head unchanged, and status rollup SUCCESS.
3. Squash-merged with `--match-head-commit ea575194f77288ebae7dfa5d555dd123d9662f88` to prevent a head-change race.
4. Re-read GraphQL state: PR MERGED at `2026-08-14T07:43:46Z`; merge commit and default-branch head both `5e5b2318b03beedf156de48486a26f8254a73f3c`.

No PR content or PR branch was changed or pushed by this operation.

## Recurrence prevention

Add one orchestrator pre-push guard for protected PR branches: before any rebase/force-push, query reviews and warn when an APPROVED review exists; after the push, block merge progression until a code-owner approval exists on the new `headRefOid`. This preserves the intentional `dismiss_stale_reviews_on_push` policy while making approval invalidation and re-approval explicit.
