# OPS-PR231 Report

## Outcome

PR #231 was diagnosed, approved at the exact expected head, and squash-merged:

- PR: <https://github.com/mryfmo/ai-ops-platform/pull/231>
- Expected and approved head: `11613a94c84431aff7de4251c0ff2241f20eaa48`
- Squash merge commit: `a29f13c5c30f1a8e703b6ab8b7d70a54f4af68c6`
- Remote `main` after merge: `a29f13c5c30f1a8e703b6ab8b7d70a54f4af68c6`

No PR content, branch history, or source file was changed.

## Diagnosis

The only blocker was the missing approval on the current head:

- PR author was `aiops-pr-bot[bot]`; authenticated official `gh` user was Owner
  and CODEOWNER `mryfmo`, so this was not a self-review restriction.
- Head exactly matched the task-pinned SHA and the PR was mergeable.
- `build-test`, `gitleaks`, and CodeRabbit were successful.
- GraphQL reported zero review threads; there was nothing to resolve.
- Ruleset `20678089` required one code-owner approval, dismissed stale reviews on
  push, required thread resolution, and did not require last-push approval.
- The only review was Owner approval on old head `fadb8f8...`; GitHub had marked
  it `DISMISSED` after conflict-resolution head `11613a9...` was pushed.
- Consequently, GitHub reported `reviewDecision=REVIEW_REQUIRED` and
  `mergeStateStatus=BLOCKED` despite green checks and a mergeable diff.

## Resolution

1. Ran `gh pr review 231 --approve` with Owner-authenticated official `gh`.
2. Re-read PR and review APIs. The approval was bound to the exact expected
   head; state became `reviewDecision=APPROVED` and `mergeStateStatus=CLEAN`.
3. Ran the Owner-authorized protected merge:
   `gh pr merge 231 --squash --match-head-commit 11613a94c84431aff7de4251c0ff2241f20eaa48`.
4. Verified PR state `MERGED` and remote `main` at the returned squash commit.

## Root cause and permanent practice

The conflict-resolution push correctly invalidated the earlier approval because
`dismiss_stale_reviews_on_push=true`. After any conflict-resolution or other
head-changing push, approval must be repeated against the new immutable head.
The operational sequence should remain: capture head → verify checks, rules,
threads, and authorship → approve → re-read approval/head → merge with
`--match-head-commit`.
