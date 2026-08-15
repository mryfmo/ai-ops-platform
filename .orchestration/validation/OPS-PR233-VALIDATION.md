# OPS-PR233 Validation

## Investigation (`gh` first)

Inspected URL: <https://github.com/mryfmo/ai-ops-platform/pull/233>

### Identity and PR state

`gh api user`:

```json
{"login":"mryfmo"}
```

`gh pr view 233` before mutation:

```json
{
  "author": "app/aiops-pr-bot",
  "state": "OPEN",
  "isDraft": false,
  "headRefOid": "cc3c4b56b9c01476101a96dd19c78c9d2e30be0e",
  "mergeable": "MERGEABLE",
  "mergeStateStatus": "BLOCKED",
  "reviewDecision": "REVIEW_REQUIRED"
}
```

The head matched the task-pinned SHA before any mutation.

### Checks, reviews, and threads

Status rollup:

```text
build-test  SUCCESS
gitleaks    SUCCESS
CodeRabbit  SUCCESS
```

`gh api repos/mryfmo/ai-ops-platform/pulls/233/reviews` returned `[]`.

GraphQL `reviewThreads(first:100)` returned:

```json
{"totalCount":0,"nodes":[]}
```

The legacy branch-protection endpoint returned HTTP 404 (`Branch not protected`); no conclusion about repository rulesets was inferred from that endpoint. The PR state itself showed that the required current-head approval was the only remaining blocker.

## Authorized operations and verification

`gh pr review 233 --approve` completed successfully.

Immediate PR re-read:

```json
{
  "headRefOid": "cc3c4b56b9c01476101a96dd19c78c9d2e30be0e",
  "reviewDecision": "APPROVED",
  "mergeStateStatus": "CLEAN",
  "mergeable": "MERGEABLE",
  "currentReview": {
    "author": "mryfmo",
    "state": "APPROVED",
    "commit": "cc3c4b56b9c01476101a96dd19c78c9d2e30be0e"
  }
}
```

With the head still matching, executed:

```text
gh pr merge 233 --squash --match-head-commit cc3c4b56b9c01476101a96dd19c78c9d2e30be0e
```

Final PR and remote main-ref results:

```json
{
  "state": "MERGED",
  "mergedAt": "2026-08-14T23:12:24Z",
  "mergedBy": "mryfmo",
  "headRefOid": "cc3c4b56b9c01476101a96dd19c78c9d2e30be0e",
  "mergeCommit": "d98e5d553224a26d9f14de3d84d5b08f1c8d29b7",
  "remoteMain": "d98e5d553224a26d9f14de3d84d5b08f1c8d29b7"
}
```

No web fallback was needed; `gh` supplied all required operational evidence.
