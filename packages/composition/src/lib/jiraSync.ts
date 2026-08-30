// 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
// 認証済み Jira metadata を internal jira-sync Workflow request へ変換する純粋層。
import {
  assertJiraSyncRequest,
  buildJiraSyncWorkflowId,
  jiraSyncWorkflow,
  type JiraSyncExecutionMode,
  type JiraSyncRequest,
  type VersionedPayload,
} from "@aiops/control-plane";
import type { JiraSnapshot } from "@aiops/integrations";
import {
  deriveJiraRevision,
  type JiraReconcileProject,
  type JiraRuntimeCompositionDeps,
  type QueuedJiraWebhookEvent,
} from "@aiops/server";

export interface JiraSyncWorkflowStartOptions {
  readonly args: [VersionedPayload<JiraSyncRequest>];
  readonly taskQueue: "jira-sync";
  readonly workflowId: string;
  readonly workflowIdReusePolicy: "REJECT_DUPLICATE";
  readonly workflowIdConflictPolicy: "USE_EXISTING";
}

export interface WorkflowStarter {
  start(workflow: typeof jiraSyncWorkflow, options: JiraSyncWorkflowStartOptions): Promise<unknown>;
}

type JiraRuntimeSeams = Required<Pick<JiraRuntimeCompositionDeps, "dispatchJiraEvent" | "commitCompleteSnapshot">>;

function request(payload: JiraSyncRequest): VersionedPayload<JiraSyncRequest> {
  const value = { schemaVersion: 1 as const, payload };
  assertJiraSyncRequest(value);
  return value;
}

export function webhookRequest(
  event: QueuedJiraWebhookEvent,
  executionMode: JiraSyncExecutionMode,
): VersionedPayload<JiraSyncRequest> {
  return request({
    issueKey: event.issueKey,
    projectId: event.projectId,
    mappingVersion: event.mappingVersion,
    revision: event.revision,
    executionMode,
    origin: "jira-webhook",
    operations: ["event"],
  });
}

export function snapshotRequests(
  project: JiraReconcileProject,
  snapshot: JiraSnapshot,
  executionMode: JiraSyncExecutionMode,
): readonly VersionedPayload<JiraSyncRequest>[] {
  if (!snapshot.captureComplete) {
    throw new Error("E-JIRA-COMP-SNAPSHOT: captureComplete=true is required");
  }
  return snapshot.issues.map((issue) => {
    if (issue.jiraProjectId !== project.jiraProjectId) {
      throw new Error(`E-JIRA-COMP-SNAPSHOT: issue ${issue.issueKey} does not match the reconcile project`);
    }
    return request({
      issueKey: issue.issueKey,
      projectId: project.projectId,
      mappingVersion: project.mappingVersion,
      revision: deriveJiraRevision(issue.updated, issue.fieldHash),
      executionMode,
      origin: "reconcile",
      operations: ["event"],
    });
  });
}

async function startRequest(starter: WorkflowStarter, input: VersionedPayload<JiraSyncRequest>): Promise<void> {
  await starter.start(jiraSyncWorkflow, {
    args: [input],
    taskQueue: "jira-sync",
    workflowId: buildJiraSyncWorkflowId(input.payload),
    workflowIdReusePolicy: "REJECT_DUPLICATE",
    workflowIdConflictPolicy: "USE_EXISTING",
  });
}

export function createJiraRuntimeSeams(
  starter: WorkflowStarter,
  executionMode: JiraSyncExecutionMode,
): JiraRuntimeSeams {
  return {
    async dispatchJiraEvent(event): Promise<void> {
      await startRequest(starter, webhookRequest(event, executionMode));
    },
    async commitCompleteSnapshot(project, snapshot): Promise<void> {
      for (const input of snapshotRequests(project, snapshot, executionMode)) {
        await startRequest(starter, input);
      }
    },
  };
}
