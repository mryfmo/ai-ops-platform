# Data / Event / Identity Architecture

## Correlation context

全request/event/activityに次を可能な範囲で付与する。

```text
trace_id
correlation_id
workflow_id
workflow_run_id
activity_id
project_id (PJ-*)
plane_workspace_id / plane_project_id / plane_item_id
github_repository_id / issue / pr / workflow_run / deployment
m365_tenant_id / user_object_id / meeting_id / message_id
wispr_meeting_id
confluence_content_id
sharepoint_item_id
model_invocation_id
tool_invocation_id
approval_id
agent_task_id
```

## Event envelope

- event ID、type、version、occurred/received、source、actor、subject、correlation、classification、payload reference、dedupe keyを持つ。
- raw external payloadは署名検証中だけ保持し、allowlist normalized payloadを保存。
- schema version未対応はdead-letterし、自動破棄しない。

## Ledger separation

| Ledger | 用途 |
|---|---|
| workflow_runs | business workflow index/read model。Temporal historyの代替ではない |
| action_ledger | pending/approved/applied/rejected/compensated side effects |
| policy_decisions | decision receiptとpolicy version |
| model_invocations | alias/provider/model/usage/cost/route reason |
| tool_invocations | MCP/A2A server/tool/resource scope/result metadata |
| id_mappings | SoR間canonical ID mappingとprovenance |
| meeting_artifacts | meeting correlation/review/publication |
| agent_runs | writer/reviewer/branch/PR/test evidence |

## Idempotency

- Workflow IDはbusiness keyから決定的に構築。
- External writeは`operation_id`を持ち、DB unique constraintとprovider-side identifierを併用。
- unknown-result non-idempotent writeはretryせずreconcileへ移行。
- approvalはversion/CASを持ち、基準dataが変わったらstale。
