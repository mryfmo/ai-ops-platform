# PR43-single-flight-test

## Objective

Make PR #43 evidence truthful by adding the smallest regression test that proves concurrent callers share one in-flight GitHub App token acquisition.

## Workspace

- Isolated clone: `/tmp/aiops-pr43-fix`
- Branch: `agent/T-P0-04`

## Allowed files

- Existing GitHub token provider test file only

## Requirements

- Exercise two genuinely concurrent token requests.
- Prove the underlying installation-token request is invoked once and both callers receive the result.
- Preserve current public API and production implementation unless the test reveals a real defect.

## Forbidden actions

- Do not merge, push, change dependencies, or edit PR metadata.
- Do not weaken private-key, JWT, token-expiry, or disabled-mode validation.

## Validation

- Run the focused test file.
- Run `git diff --check`.
- Return a review-ready uncommitted diff and exact results.
