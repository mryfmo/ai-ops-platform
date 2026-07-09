# Production Gates Runbook

## CODEOWNERS

`.github/CODEOWNERS` must use real GitHub users or teams. For this repository, `@mryfmo` was verified with `gh repo view` and `gh api users/mryfmo`.

Before go-live:

1. Confirm each CODEOWNERS user/team is still the intended reviewer.
2. Enable branch protection for `main`.
3. Enable "Require review from Code Owners".

CI fails while `@OWNER` or common CODEOWNERS placeholder tokens remain. It does not prove branch protection is enabled; repository settings must still require CODEOWNERS review before go-live.

## AI PR Token

`coding-task.yml` requires `AIOPS_PR_TOKEN`.

Configure it as a GitHub App installation token or a dedicated PAT with:

- `contents:write`
- `pull-requests:write`
- `issues:write`

The workflow fails before checkout when the secret is missing. This is intentional: PRs created with the default `GITHUB_TOKEN` do not reliably trigger `ci.yml`.

## Secret Scanning

`ci.yml` runs gitleaks CLI directly. The workflow pins:

- gitleaks version: `8.30.1`
- linux x64 tarball SHA-256: `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`

Update both values together after checking the upstream release checksum.
