# File-by-File Change Plan

## 1. 既存pathの扱い

| Current path | Action | Target state |
|---|---|---|
| `AGENTS.md` | preserve + add final architecture addendum | 本パックの`AGENTS_ADDENDUM.md`を統合 |
| `CLAUDE.md` | preserve | `@AGENTS.md`のみを維持 |
| `packages/shared/src/clients/anthropicClient.ts` | wrap then deprecate direct provider | logical model aliasを呼ぶInferenceClientへ移行 |
| `packages/shared/src/clients/claudeAgentClient.ts` | runner contractへ分離 | provider keyを持たずLiteLLM virtual keyを利用 |
| `packages/shared/src/clients/graphClient.ts` | preserve/split | Graph deterministic adapter、Work IQと統合しない |
| `packages/server/src/index.ts` | thin ingressへ縮小 | Temporal start/signal/query + webhook ingress |
| `packages/server/src/config.ts` | typed migration | LiteLLM/Temporal/agentgateway/OPA/Work IQ flags追加、direct key廃止段階化 |
| `packages/server/src/db/eventsRepo.ts` | adapt | event ledger/outboxとTemporal linkage |
| `packages/server/src/db/approvalsRepo.ts` | adapt | Temporal signal + expectedVersion contract |
| `packages/web/src/app/api/chat/route.ts` | migrate | Control API/Workbench client、direct provider依存除去 |
| `.github/actions/run-coding-agent/action.yml` | replace credentials/enable Droid after gate | scoped gateway keys、exact CLI、one-writer manifest |
| `.github/workflows/coding-task.yml` | harden | runner isolation、task manifest、Codex review job、evidence callback |
| `packages/devops/src/db/schema.sql` | expand only | fresh DB latest shape。ALTERはmigrationへ |
| `docs/adr/0002` | superseded in part | ADR-0022がprovider accessを更新。deterministic/structured principleは維持 |
| `docs/adr/0003` | superseded in scheduling part | ADR-0021。resident ingress requirementは維持 |
| `docs/adr/0005` | superseded in Teams UX part | ADR-0025。Graph ingestion/RSC decisionは維持 |
| `docs/adr/0006` | superseded/extended | ADR-0027。PR-only/human merge principleは維持 |
| `docs/adr/0013/0018` | preserve and extend | Workbench capability/generative UIへ拡張 |
| `docs/adr/0016` | preserve | Azure baseline不変 |
| `docs/adr/0019` | preserve | Plane/GitHub authority boundary不変 |

## 2. 新規package構成

WBSのpath ownershipを正本とし、packageを増やし過ぎない。

```text
packages/
  control-plane/
    src/workflows/
    src/activities/
    src/clients/
    src/contracts/
    tests/
  integrations/
    src/litellm/
    src/mcp/
    src/workiq/
    src/graph/
    src/wispr/
    src/plane/
    src/github/
    src/confluence/
    src/sharepoint/
    tests/
  policy/
    src/policyClient.ts
    src/types.ts
    policies/
    tests/
  channel-teams/
    src/channel.tsx
    src/components/
    src/interrupts/
    tests/
```

- LiteLLM/MCP/Work IQ等のvendor adapterは`packages/integrations`へ集約し、domain packageへSDK型を漏らさない。
- Web Workbenchは新packageを増やさず既存`packages/web`を拡張する。
- 会議・publicationの決定的ロジックは既存`prjops/devops/shared`の責務に応じて置き、外部I/Oだけ`integrations`へ置く。

## 3. 新規deploy/config構成

```text
deploy/
  aws/
    main.tf
    modules/
    envs/
  temporal/
  litellm/
  agentgateway/
  opa/
policies/
  rego/
    tool_access.rego
    model_egress.rego
    approval.rego
    project_scope.rego
contracts/
  control-api.openapi.yaml
  events.asyncapi.yaml
  model-routing.yaml
  mcp-registry.yaml
  tool-risk.yaml
```

## 4. 変更禁止またはOwner専用path

- `docs/PrjOps.zip`, `docs/DevOps.zip`: 原本として上書き禁止。
- `audit_log` mutation protection: 弱体化禁止。
- `.github/CODEOWNERS`, branch protection: AIだけで解除・緩和禁止。
- `packages/shared/src/secretSanitizer.ts`: security reviewなしに緩和禁止。
- formal retention/permissions: MCP経由実装禁止。

## 5. Deletion sequence

旧pathを削除できるのは次を満たした後。

1. new path primaryで2 release以上green。
2. rollback window完了。
3. direct egress fitness check導入。
4. provider keysから旧consumerを失効。
5. docs/ADR/runbook更新。
6. Ownerによるold path removal承認。
