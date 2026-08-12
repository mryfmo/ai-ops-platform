# P2-T07 validation

Executed by `codex-deep-dot` on 2026-08-12.

- Validated commit: `abed4c8`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/191

## Web tests

- `pnpm --filter @aiops/web run test` -> 40 files passed, 325 tests passed.
- `pnpm --filter @aiops/web run typecheck` -> exit 0.
- Focused gateway/config/fitness tests -> 3 files passed, 20 tests passed.
- The existing chat suite continues to cover streaming, reasoning, forced ViewSpec tool calls, persona selection, and fail-closed 503 behavior.

## Real gateway smoke

- Runtime: Apple `container` CLI 1.2.2.
- Images: pinned `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.3@sha256:2518a42798776da20d252f75e7672855c51de97dbc5d3e03fad47eff1fce97c4` at 4 GiB plus `postgres:16-alpine` sidecar.
- `createWebGatewayFetch()` -> authenticated `GET /v1/models`: exactly 8 aliases observed (`claude-code`, `claude-code-fallback`, `claude-fast`, `claude-fast-fallback`, `claude-governed`, `claude-native`, `claude-standard`, `claude-standard-fallback`).
- `createWebChatModel()` + `streamText()` for `claude-standard` reached `/v1/messages` and returned an AI SDK `AI_APICallError` with HTTP 404 from the dummy Bedrock model configuration. This proves gateway/API error handling rather than a transport failure.
- No real provider credentials were supplied. A provider-success E2E is intentionally deferred to P2-T03/P2-T04.

## Full CI

- Created uniquely named fresh disposable PostgreSQL databases on required port 55432 and ran all `db:require` environment values in the same shell.
- Final `mise run ci` -> exit 0.
- Representative counts: Web 325/325, Server 856/856, Shared 495/495; `P001 PostgreSQL integration passed`.
- Traceability/config inventory, lint, format, build, typecheck, contracts, policy, audit, actionlint, coverage, and DB integration all passed.
- Generated `packages/traceability/output/traceability_matrix.md` was restored and is not part of the change.

## Diff and supply-chain checks

- `git diff --cached --check` -> exit 0.
- Staged paths are limited to the task's allowed Web/configuration paths.
- No `package.json` or lockfile changes.
- `gitleaks` executable was unavailable locally; no secret values or literal curl Bearer fixtures were added, and the full CI audit plus staged-diff inspection passed.
- Disposable containers and all task-specific databases were removed after validation.
