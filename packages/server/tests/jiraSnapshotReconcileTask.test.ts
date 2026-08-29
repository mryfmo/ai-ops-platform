import { describe, expect, it } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { createJiraSnapshotReconcileTask } from "../src/scheduler/tasks/jiraSnapshotReconcileTask.js";

const project = { projectId: "PJ-1001", jiraProjectId: "10000", jql: "project = AICOE", mappingVersion: 1 };
const issue = {
  issueKey: "AICOE-1",
  jiraProjectId: "10000",
  statusId: "10021",
  assigneeAccountId: null,
  sprintId: null,
  updated: "2026-08-28T02:00:00Z",
  fieldHash: "a".repeat(64),
};

describe("Jira snapshot reconcile", () => {
  it("commits only a complete snapshot", async () => {
    const committed: unknown[] = [];
    const task = createJiraSnapshotReconcileTask({
      projects: [project],
      captureSnapshot: async () => ({
        capturedAt: "2026-08-28T03:00:00Z",
        captureComplete: true,
        issues: [issue],
        pageCount: 1,
      }),
      commitCompleteSnapshot: async (_project, snapshot) => void committed.push(snapshot),
      auditLog: new InMemoryAuditLog(),
      traceIdProvider: () => "trace-1",
    });
    await task.run(new Date("2026-08-28T03:00:00Z"));
    expect(committed).toHaveLength(1);
  });

  it("rejects incomplete or duplicate snapshots without committing", async () => {
    for (const snapshot of [
      { capturedAt: "2026-08-28T03:00:00Z", captureComplete: false, issues: [issue], pageCount: 1 },
      { capturedAt: "2026-08-28T03:00:00Z", captureComplete: true, issues: [issue, issue], pageCount: 2 },
    ]) {
      const committed: unknown[] = [];
      const task = createJiraSnapshotReconcileTask({
        projects: [project],
        captureSnapshot: async () => snapshot,
        commitCompleteSnapshot: async (_project, value) => void committed.push(value),
        auditLog: new InMemoryAuditLog(),
        traceIdProvider: () => "trace-1",
      });
      await task.run(new Date("2026-08-28T03:00:00Z"));
      expect(committed).toHaveLength(0);
    }
  });
});
