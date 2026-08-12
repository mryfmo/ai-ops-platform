# P2-T08 Validation

- task_id: `P2-T08`
- validated_at: `2026-08-12T12:35:09Z`

## Test-first static check

Before implementation, the acceptance checks failed because both allowed files still contained `ANTHROPIC_API_KEY` / `anthropic_api_key`, and the LiteLLM variable/secret references and runner gateway env were absent.

After implementation, static checks confirmed:

- zero `ANTHROPIC_API_KEY` or `anthropic_api_key` matches in the two allowed files;
- workflow reference `vars.LITELLM_BASE_URL`;
- workflow reference `secrets.LITELLM_CODING_VIRTUAL_KEY`;
- action maps its inputs to `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`;
- `ANTHROPIC_MODEL` and `ANTHROPIC_SMALL_FAST_MODEL` are both `claude-code`;
- model-only, budget-ceiling, and expiry requirements are documented.

## YAML and repository gates

- `mise run actionlint`: exit 0 (`actionlint 1.7.12`).
- `git diff --check`: exit 0.
- `mise run ci`: exit 0 with task-specific fresh databases `p2t08_ci`, `p2t08_load`, and `p2t08_p001` on `127.0.0.1:55432`.

## Gateway smoke

- Runtime: Apple `container`.
- Gateway image: `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a42798776da20d252f75e7672855c51de97dbc5d3e03fad47eff1fce97c4`.
- Gateway memory: 4096 MiB (`SMOKE_MEMORY=4g` equivalent).
- Database image: `postgres:16-alpine`.
- A disposable LiteLLM virtual key was generated with `models=[claude-code]`, `max_budget=1`, and a one-hour expiry. No key value is retained in this evidence.
- Using the runner-equivalent `ANTHROPIC_BASE_URL` + dummy `ANTHROPIC_AUTH_TOKEN` shape, an Anthropic Messages request for `claude-code` reached LiteLLM model-group resolution. The expected dummy-upstream result was HTTP 404 identifying `Received Model Group=claude-code` and the configured smoke model; no real provider credential was used.
- The same key requesting `claude-standard` was rejected with HTTP 403 `key_model_access_denied`, proving the single-alias scope.
- Runtime environment assertion confirmed no `ANTHROPIC_API_KEY`, `AWS_ACCESS_KEY_ID`, or `AWS_SECRET_ACCESS_KEY`.
- Both disposable containers and all three CI databases were removed after validation.

