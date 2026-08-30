// 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
import { describe, expect, it, vi } from "vitest";

import type { JiraSnapshot } from "@aiops/integrations";
import type { JiraReconcileProject, QueuedJiraWebhookEvent } from "@aiops/server";

import { loadCompositionConfig } from "../src/lib/config.js";
import { createJiraRuntimeSeams, snapshotRequests, webhookRequest, type WorkflowStarter } from "../src/lib/jiraSync.js";
import { startComposition } from "../src/main.js";

const REVISION = "a".repeat(64);
const FIELD_HASH = "b".repeat(64);
const event: QueuedJiraWebhookEvent = {
  kind: "jira_work_item_event",
  origin: "jira-webhook",
  eventName: "jira:issue_updated",
  issueKey: "AIOPS-42",
  projectId: "PJ-1001",
  jiraProjectId: "10001",
  statusId: "10021",
  assigneeAccountId: "opaque-account",
  sprintId: "17",
  updated: "2026-08-30T03:00:00.000Z",
  fieldHash: FIELD_HASH,
  revision: REVISION,
  mappingVersion: 4,
  payloadDigest: "c".repeat(64),
};
const project: JiraReconcileProject = {
  projectId: "PJ-1001",
  jiraProjectId: "10001",
  jql: "project = AIOPS",
  mappingVersion: 4,
};
const snapshot: JiraSnapshot = {
  capturedAt: "2026-08-30T03:15:00.000Z",
  captureComplete: true,
  pageCount: 1,
  issues: [
    {
      issueKey: "AIOPS-42",
      jiraProjectId: "10001",
      statusId: "10021",
      assigneeAccountId: "opaque-account",
      sprintId: "17",
      updated: "2026-08-30T03:00:00.000Z",
      fieldHash: FIELD_HASH,
    },
    {
      issueKey: "AIOPS-43",
      jiraProjectId: "10001",
      statusId: "10022",
      assigneeAccountId: null,
      sprintId: null,
      updated: "2026-08-30T03:01:00.000Z",
      fieldHash: "d".repeat(64),
    },
  ],
};

const requiredEnv = {
  JIRA_SYNC_TEMPORAL_ADDRESS: "temporal.internal:7233",
  JIRA_SYNC_TEMPORAL_ENVIRONMENT: "staging",
  JIRA_SYNC_TEMPORAL_CLIENT_CERT_PATH: "/secure/jira-sync.crt",
  JIRA_SYNC_TEMPORAL_CLIENT_KEY_PATH: "/secure/jira-sync.key",
  JIRA_SYNC_TEMPORAL_SERVER_ROOT_CA_PATH: "/secure/temporal-ca.crt",
  JIRA_SYNC_TEMPORAL_AUTHORIZATION_TOKEN_PATH: "/secure/jira-sync.jwt",
};

describe("Jira deployment composition [ADR-0030] [ADR-0005] [FinalArch:FR-CP-001]", () => {
  it("converts a queued webhook into the allowlisted Jira event request and workflow identity", () => {
    const request = webhookRequest(event, "active");
    expect(request).toEqual({
      schemaVersion: 1,
      payload: {
        issueKey: "AIOPS-42",
        projectId: "PJ-1001",
        mappingVersion: 4,
        revision: REVISION,
        executionMode: "active",
        origin: "jira-webhook",
        operations: ["event"],
      },
    });
  });

  it("starts the workflow with the canonical id and duplicate-safe policies", async () => {
    const start = vi.fn<WorkflowStarter["start"]>(async () => {});
    const seams = createJiraRuntimeSeams({ start }, "shadow");
    await seams.dispatchJiraEvent(event, "trace-webhook");

    expect(start).toHaveBeenCalledOnce();
    expect(start.mock.calls[0]?.[1]).toMatchObject({
      args: [webhookRequest(event, "shadow")],
      taskQueue: "jira-sync",
      workflowId: `jira-sync/AIOPS-42:PJ-1001:4:${REVISION}`,
      workflowIdReusePolicy: "REJECT_DUPLICATE",
      workflowIdConflictPolicy: "USE_EXISTING",
    });
  });

  it("fans out a complete snapshot through reconcile requests with derived revisions", async () => {
    const requests = snapshotRequests(project, snapshot, "active");
    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.payload)).toEqual([
      expect.objectContaining({
        issueKey: "AIOPS-42",
        projectId: "PJ-1001",
        mappingVersion: 4,
        origin: "reconcile",
        operations: ["event"],
        executionMode: "active",
      }),
      expect.objectContaining({ issueKey: "AIOPS-43", origin: "reconcile" }),
    ]);
    expect(requests.map((request) => request.payload.revision)).toEqual([
      "83feb50e7a6409a75fb1e60ec9954cb14f0fabd5194fb3024c3611e417a88b97",
      "2188133618c57ab2fd8a6e829ec67a6fd19c5683c197f679d349384b6816e3d5",
    ]);

    const start = vi.fn<WorkflowStarter["start"]>(async () => {});
    await createJiraRuntimeSeams({ start }, "active").commitCompleteSnapshot(project, snapshot);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls.map((call) => call[1].workflowId)).toEqual(
      requests.map(
        (request) =>
          `jira-sync/${request.payload.issueKey}:${request.payload.projectId}:${request.payload.mappingVersion}:${request.payload.revision}`,
      ),
    );
  });

  it("rejects partial snapshots and cross-project issues before dispatch", () => {
    expect(() => snapshotRequests(project, { ...snapshot, captureComplete: false }, "shadow")).toThrow(
      /captureComplete=true/,
    );
    expect(() =>
      snapshotRequests(
        project,
        { ...snapshot, issues: [{ ...snapshot.issues[0]!, jiraProjectId: "other-project" }] },
        "shadow",
      ),
    ).toThrow(/project/);
  });

  it("defaults to shadow and maps the deployment live setting to the active workflow contract", () => {
    expect(loadCompositionConfig(requiredEnv).executionMode).toBe("shadow");
    expect(loadCompositionConfig({ ...requiredEnv, JIRA_SYNC_EXECUTION_MODE: "live" }).executionMode).toBe("active");
    expect(() => loadCompositionConfig({ ...requiredEnv, JIRA_SYNC_EXECUTION_MODE: "active" })).toThrow(
      /JIRA_SYNC_EXECUTION_MODE/,
    );
  });

  it.each(Object.keys(requiredEnv))("fails closed when %s is missing", (name) => {
    expect(() => loadCompositionConfig({ ...requiredEnv, [name]: undefined })).toThrow(new RegExp(name));
  });

  it("loads path-based credentials and injects both Jira seams into server main without network access", async () => {
    const calls: unknown[] = [];
    const start = vi.fn<WorkflowStarter["start"]>(async () => {});
    const readFile = vi.fn((path: string) => (path.endsWith(".jwt") ? "header.payload.signature\n" : `pem:${path}`));
    const buildConnectionProfile = vi.fn((environment, address, options) => ({
      environment,
      address,
      namespace: `aiops-${environment}`,
      workerName: options.workerName,
      workerIdentity: `worker.${environment}`,
      taskQueue: options.taskQueue,
    }));
    const createTemporalConnection = vi.fn(async (profile, credentials) => {
      calls.push(profile, credentials);
      expect(credentials.authorizationTokenProvider()).toBe("header.payload.signature");
      return { connection: true };
    });
    const createWorkflowStarter = vi.fn(() => ({ start }));
    const serverMain = vi.fn(async (bootstrap) => {
      expect(Object.keys(bootstrap.jira).sort()).toEqual(["commitCompleteSnapshot", "dispatchJiraEvent"]);
      await bootstrap.jira.dispatchJiraEvent(event, "trace-main");
    });

    await startComposition(
      { ...requiredEnv, JIRA_SYNC_EXECUTION_MODE: "live" },
      { readFile, buildConnectionProfile, createTemporalConnection, createWorkflowStarter, serverMain },
    );

    expect(buildConnectionProfile).toHaveBeenCalledWith("staging", "temporal.internal:7233", {
      workerName: "jira-composition",
      taskQueue: "jira-sync",
    });
    expect(createWorkflowStarter).toHaveBeenCalledWith({ connection: true }, "aiops-staging");
    expect(serverMain).toHaveBeenCalledOnce();
    expect(start.mock.calls[0]?.[0]).toEqual(expect.any(Function));
    expect(start.mock.calls[0]?.[1].args[0].payload.executionMode).toBe("active");
    expect(calls).toHaveLength(2);
    expect(readFile).toHaveBeenCalledTimes(4);
  });

  it("rejects blank credential files before connecting", async () => {
    const createTemporalConnection = vi.fn(async () => ({}));
    await expect(
      startComposition(requiredEnv, {
        readFile: (path) => (path.endsWith(".key") ? "  " : "present"),
        buildConnectionProfile: vi.fn(() => ({ namespace: "aiops-staging" })),
        createTemporalConnection,
        createWorkflowStarter: vi.fn(() => ({ start: async () => {} })),
        serverMain: vi.fn(async () => {}),
      }),
    ).rejects.toThrow(/CLIENT_KEY/);
    expect(createTemporalConnection).not.toHaveBeenCalled();
  });

  it("identifies an unreadable credential path before connecting", async () => {
    const createTemporalConnection = vi.fn(async () => ({}));
    await expect(
      startComposition(requiredEnv, {
        readFile: (path) => {
          throw new Error(`ENOENT: ${path}`);
        },
        buildConnectionProfile: vi.fn(() => ({ namespace: "aiops-staging" })),
        createTemporalConnection,
        createWorkflowStarter: vi.fn(() => ({ start: async () => {} })),
        serverMain: vi.fn(async () => {}),
      }),
    ).rejects.toThrow(/JIRA_SYNC_TEMPORAL_CLIENT_CERT_PATH file could not be read/);
    expect(createTemporalConnection).not.toHaveBeenCalled();
  });
});
