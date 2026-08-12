# P2-T08 Implementation Report

- task_id: `P2-T08`
- worker: `codex-deep-dot`
- base_sha: `25c01248ba91df419217a995add9aac1ae04617d`
- completed_at: `2026-08-12T12:35:09Z`

## Result

- `.github/actions/run-coding-agent/action.yml` now accepts the LiteLLM gateway URL and the coding-agent virtual key as separate inputs.
- Claude Code receives `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` only in credential validation and execution steps; the CLI installation step receives neither.
- Both the primary and small/fast Claude Code model selectors are fixed to the `claude-code` alias, and the CLI invocation explicitly selects that alias.
- `.github/workflows/coding-task.yml` references `vars.LITELLM_BASE_URL` and `secrets.LITELLM_CODING_VIRTUAL_KEY` and no longer references or passes `ANTHROPIC_API_KEY`.

## Virtual-key operational requirements

The Owner-issued coding-agent virtual key must allow only the `claude-code` alias and must have an explicit budget ceiling and expiry. Provider credentials must never be registered in or exposed to the GitHub-hosted runner.

## Deferred Owner operation

The repository does not contain or register real GitHub values. The Owner must register `LITELLM_BASE_URL` as a GitHub Actions variable and `LITELLM_CODING_VIRTUAL_KEY` as a GitHub Actions secret, then trigger `coding-task.yml` once with a staging task to complete the real-credential dry run before go-live.

## Validation summary

- Static credential assembly checks: passed.
- `mise run actionlint`: passed.
- Apple container pinned oss.3 gateway smoke with PostgreSQL 16: passed at the gateway boundary using a disposable scoped key and no real provider credentials.
- Fresh disposable PostgreSQL databases on port 55432, same-shell environment: `mise run ci` exit 0.

