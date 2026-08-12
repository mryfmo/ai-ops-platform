# リポジトリ変更マップ

## 追加するトップレベル領域

```text
packages/
  control-plane/       # Temporal workflows, activities, workflow contracts
  integrations/        # Work IQ, agentgateway, Wispr, Confluence, Plane adapters
  policy/              # OPA policy bundle, tests, decision client
  channel-teams/       # OpenTag/CopilotKit Channels由来のTeams surface

deploy/
  aws/                 # Terraform modules and environment variables
  litellm/             # inference-only config and validation
  agentgateway/        # MCP/A2A-only config and registry generation
  temporal/            # namespace/worker/deployment profile
  otel/                # collector config
  opa/                 # bundle distribution config

contracts/
  control-api/
  events/
  policy/
  tools/
  identity/
```

## 既存領域の主な変更

| Path | 変更 |
|---|---|
| `AGENTS.md` | 最終構成、不変条件、2-model handoff、1 Writer ruleを追記 |
| `CLAUDE.md` | `@AGENTS.md`を維持 |
| `.env.example` | direct Anthropic設定をmigration扱いにし、LiteLLM/Temporal/agentgateway/OPA/Work IQを追加 |
| `packages/shared/src/clients/anthropicClient.ts` | public interfaceを維持し、LiteLLM Anthropic-compatible transportへ差し替え可能にする |
| `packages/shared/src/clients/claudeAgentClient.ts` | server embedded実行を縮小し、runner dispatch contractへ移行 |
| `packages/shared/src/clients/graphClient.ts` | system/app-only pathとして維持。Work IQ clientと混在させない |
| `packages/server/src/index.ts` | in-process loopを段階廃止し、Control API + Temporal client + webhook signalへ変更 |
| `packages/server/src/config.ts` | Gateway/Temporal/OPA/Work IQ設定、feature flags、all-or-none検証を追加 |
| `packages/server/src/http/routes/*` | workflow start/signal/query API、Work IQ delegated path、callback idempotencyを追加 |
| `packages/server/src/db/*Repo.ts` | workflow/tool/model/policy/identity mapping repositoriesを追加 |
| `packages/devops/src/db/schema.sql` | fresh DBの最新形を更新。既存DBはmigrationだけで変更 |
| `packages/devops/src/db/migrations/` | 新ledger tablesとconstraintsを追加 |
| `packages/web/src/app/api/chat/route.ts` | direct Anthropic providerからControl API/LiteLLM pathへ変更 |
| `packages/web/src/app/approvals/` | Temporal approval signalと一貫させる |
| `packages/web/src/` | Workspace/Capability/Artifact reference UIを追加。Cloudflare runtimeは使わない |
| `.github/actions/run-coding-agent/action.yml` | LiteLLM virtual key、Claude/Droid pinned CLI、role別権限を実装 |
| `.github/workflows/coding-task.yml` | 1 Writer、task manifest、path scope、review handoff、callback署名を追加 |
| `.github/workflows/ci.yml` | architecture fitness、OPA、contract、config、MCP compatibility gateを追加 |
| `docs/adr/` | ADR-0020〜0028を追加し、既存ADRのsupersessionを明示 |
| `packages/traceability/` | 新spec IDと本パック契約の参照検証を追加 |

## 削除・廃止は最後に行う

- direct Anthropic endpointへの本番経路
- server内のTemporal移行済みscheduler loop
- duplicate approval state
- provider-specific model selection in UI/agent code
- unsupported Droid disabled stub

削除PRは、shadow/canary/rollback期間後の専用Phaseで行い、移行PRへ混在させない。
