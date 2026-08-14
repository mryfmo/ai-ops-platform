# OPS-PR231 Validation

## Investigation (`gh` first)

Inspected URL: <https://github.com/mryfmo/ai-ops-platform/pull/231>

### Identity and PR state

`gh api user`:

```json
{"id":11512262,"login":"mryfmo","type":"User"}
```

`gh api repos/mryfmo/ai-ops-platform/pulls/231` and `gh pr view 231`:

```json
{
  "author": "aiops-pr-bot[bot]",
  "head_sha": "11613a94c84431aff7de4251c0ff2241f20eaa48",
  "mergeable": true,
  "mergeable_state": "blocked",
  "reviewDecision": "REVIEW_REQUIRED",
  "mergeStateStatus": "BLOCKED"
}
```

The head matched the task-pinned SHA before any mutation.

### Rules, checks, reviews, and threads

`gh api repos/mryfmo/ai-ops-platform/rulesets/20678089`:

```json
{
  "enforcement": "active",
  "required_approving_review_count": 1,
  "dismiss_stale_reviews_on_push": true,
  "require_code_owner_review": true,
  "require_last_push_approval": false,
  "required_review_thread_resolution": true,
  "required_status_checks": ["build-test", "gitleaks"]
}
```

`gh pr checks 231`:

```text
CodeRabbit  pass
build-test  pass
gitleaks    pass
```

Reviews before repair:

```json
[
  {
    "user": "mryfmo",
    "state": "DISMISSED",
    "commit_id": "fadb8f82fa064b04f1692e0034cac07524a01637"
  }
]
```

GraphQL `reviewThreads(first:100)` returned an empty node list with
`hasNextPage=false`. Requested reviewers and teams were also empty.

## Authorized operations and verification

`gh pr review 231 --approve` completed successfully.

Immediate API re-read:

```json
{
  "headRefOid": "11613a94c84431aff7de4251c0ff2241f20eaa48",
  "reviewDecision": "APPROVED",
  "mergeStateStatus": "CLEAN",
  "mergeable": "MERGEABLE",
  "current_review": {
    "user": "mryfmo",
    "state": "APPROVED",
    "commit_id": "11613a94c84431aff7de4251c0ff2241f20eaa48"
  }
}
```

With the head still matching, executed:

```text
gh pr merge 231 --squash --match-head-commit 11613a94c84431aff7de4251c0ff2241f20eaa48
```

Final `gh pr view` and remote main-ref API result:

```json
{
  "state": "MERGED",
  "mergedAt": "2026-08-14T21:26:20Z",
  "mergedBy": "mryfmo",
  "headRefOid": "11613a94c84431aff7de4251c0ff2241f20eaa48",
  "mergeCommit": "a29f13c5c30f1a8e703b6ab8b7d70a54f4af68c6",
  "remoteMain": "a29f13c5c30f1a8e703b6ab8b7d70a54f4af68c6"
}
```

No web fallback was needed; `gh` supplied all required evidence.
