# P2-T09 validation

Validated at `2026-08-12T15:37:37Z` on base `5975b06e9ad39712de7b7b93d164f2e469c41823`.

## Standalone suite

Command: `./verification/model-gateway/run.sh`

- Pinned image: `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a42798776da20d252f75e7672855c51de97dbc5d3e03fad47eff1fce97c4`
- PostgreSQL: `postgres:16-alpine`
- Memory: 4 GiB gateway default
- Result: exit 0; 13 tests passed, 0 failed, 0 skipped
- Dimensions: tool use, streaming, thinking, cache usage, error mapping all passed for the synthetic Bedrock and Anthropic paths

## Repository CI

Command: fresh disposable databases on `127.0.0.1:55432` with the required `db:require` variables, then `mise run ci`.

- First sandboxed attempt stopped only at `pnpm audit` because DNS was unavailable.
- Network-enabled rerun used newly recreated `p2t09_ci`, `p2t09_load`, and `p2t09_p001` databases.
- Result: exit 0.

## Independent review

`codex --profile review exec` reviewed only `verification/model-gateway/**`. Findings covering real-tenant response validation, error-body parsing, SSE structure/terminality, and external URL credential boundaries were resolved and regression-tested. Final outcome: `APPROVED`.

## GitHub

- PR: `https://github.com/mryfmo/ai-ops-platform/pull/195`
- Head: `43701e9ba1f66a4cc211a9158ac5713ecfce5df9`
- Author: `app/aiops-pr-bot`
- Label: `ai-generated`
- Checks: `build-test` passed (5m34s), `gitleaks` passed (11s)

Additional checks: Prettier check passed, `bash -n` passed, ShellCheck passed, and the sensitive-marker scan found no provider credentials or literal bearer header.

## Revision P2-T09-001

- Removed `verification/model-gateway/route-allowlist.json`; `rg` confirmed no remaining local allowlist reference.
- Pinned gateway suite after deletion: 13 passed, 0 failed, 0 skipped.
- Fresh disposable DBs on port 55432 + `mise run ci`: exit 0.
- Prettier, `bash -n`, and `git diff --check`: green.
- Revision head: `e5342c0723724cf4e06ed81278f73b9ccfb9c493`.
- Refreshed GitHub checks: `build-test` passed (5m51s), `gitleaks` passed (10s).
