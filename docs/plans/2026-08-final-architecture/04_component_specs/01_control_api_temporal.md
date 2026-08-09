# Component Spec: AI Control API + Temporal

## Responsibilities

- Request authentication/validation and stable identity envelope。
- Workflow start/signal/query/cancel。
- Webhook ingestion and Temporal signaling。
- Read models for UI。
- Durable workflows、activities、schedules、child workflows。

## Non-responsibilities

- LLM provider routing、MCP tool routing、SoRの直接authoring UI、長期document storage。

## Proposed package layout

```text
packages/control-plane/
  src/contracts/
  src/workflows/
    meetingWorkflow.ts
    codingTaskWorkflow.ts
    incidentWorkflow.ts
    reportWorkflow.ts
    planeSyncWorkflow.ts
    graphSubscriptionWorkflow.ts
    knowledgePublicationWorkflow.ts
  src/activities/
    modelActivities.ts
    toolActivities.ts
    graphActivities.ts
    githubActivities.ts
    planeActivities.ts
    confluenceActivities.ts
    sharepointActivities.ts
    runnerActivities.ts
  src/policies/
  tests/
```

## Workflow rules

- Workflow codeは決定的。現在時刻、random、network、DBを直接呼ばない。
- 外部I/OはActivity。
- activity input/outputはversioned schema。
- Workflow IDはbusiness keyから構築。
- retry policyはoperation classごとに固定。
- approvalはSignal/Update + version/CAS。
- long-running workflowのcode changeはTemporal versioning/pinned worker deploymentを使う。

## Key workflows

### CodingTaskWorkflow

`requested → approval_pending → queued → running → pr_created|no_change|failed → review_pending → complete`

### MeetingWorkflow

`meeting_detected → note_waiting → extracted → review_pending → publishing → complete|partial|failed`

### IncidentWorkflow

`detected → context_collecting → rca_ready → repair_pending → pr_created → deployment_pending → recovering → closed`

### PlaneSyncWorkflow

Git→Plane projection、Plane→platform event、Plane→Git promotionを別child workflowに分ける。

## Acceptance

- Workerをapproval wait中に3回再起動しても再開。
- Activity timeout後に同一外部objectを二重作成しない。
- Workflow cancellationで未開始の副作用を停止。
- Temporal historyとbusiness ledgerの不一致をreconcile可能。
