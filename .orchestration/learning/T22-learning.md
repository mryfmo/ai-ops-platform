# T22 Learning

## Reusable Learnings

- GitHub Action tag refs can be annotated tags. For `pnpm/action-setup@v4`, the tag object must be dereferenced before pinning the workflow to a commit SHA.
- `GITHUB_TOKEN` write permissions should be removed once a dedicated PR token is used; otherwise the workflow still exposes an unnecessary write-capable default token.
- A fail-safe state is easiest to enforce at scheduler task boundaries. A wrapper around `ScheduledTask` stops broad side effects without changing each task implementation.
- Unknown real CODEOWNERS should remain explicit TODOs with CI warning/runbook coverage, not invented values.

## Plan Updates

- Future production-gate plans should include tag dereference checks for annotated tags.
- Future failsafe work should decide which operations remain safe-side operations before adding broad guards.
