/**
 * packages/server/tests/githubEventRouter.test.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-010（GitHub webhookイベントのDevOpsエージェント振り分け）
 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import {
  dispatchGithubWebhookEvent,
  isQueuedGithubWebhookEvent,
  normalizePmWebhookEvent,
  selectDevopsAgentForGithubEvent,
  type DevopsAgentId,
} from "../src/lib/githubEventRouter.js";

describe("githubEventRouter (ADR-0005 / DevOps:SPEC-INT-010)", () => {
  it("DevOps:SPEC-INT-010: workflow_run failureはAGT_BLDへ振り分ける", () => {
    expect(
      selectDevopsAgentForGithubEvent({
        eventName: "workflow_run",
        payload: { workflow_run: { conclusion: "failure", name: "ci" } },
      }),
    ).toBe("AGT_BLD");
  });

  it("DevOps:SPEC-INT-010: deploy workflowとdeployment eventはAGT_DEPへ振り分ける", () => {
    expect(
      selectDevopsAgentForGithubEvent({
        eventName: "workflow_run",
        payload: { workflow_run: { conclusion: "success", name: "deploy-prod" } },
      }),
    ).toBe("AGT_DEP");
    expect(selectDevopsAgentForGithubEvent({ eventName: "deployment_status", payload: {} })).toBe("AGT_DEP");
  });

  it("DevOps:SPEC-INT-010: issues eventはAGT_INCへ振り分ける", () => {
    expect(selectDevopsAgentForGithubEvent({ eventName: "issues", payload: { action: "opened" } })).toBe("AGT_INC");
  });

  it("DevOps:SPEC-INT-010: handlerへ渡し、dispatch監査ログを残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const called: DevopsAgentId[] = [];
    await dispatchGithubWebhookEvent({ eventName: "pull_request", payload: { action: "opened" } }, "trace-1", {
      auditLog,
      handlers: {
        AGT_BLD: async (event) => {
          called.push(event.targetAgent);
        },
        AGT_DEP: async () => {},
        AGT_INC: async () => {},
      },
    });
    expect(called).toEqual(["AGT_BLD"]);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "github_event_dispatched")).toBe(true);
  });

  it("DevOps:SPEC-INT-010: 未対応eventはhandlerを呼ばずignored監査ログを残す", async () => {
    const auditLog = new InMemoryAuditLog();
    let called = false;
    await dispatchGithubWebhookEvent({ eventName: "star", payload: {} }, "trace-2", {
      auditLog,
      handlers: {
        AGT_BLD: async () => {
          called = true;
        },
        AGT_DEP: async () => {
          called = true;
        },
        AGT_INC: async () => {
          called = true;
        },
      },
    });
    expect(called).toBe(false);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "github_event_ignored")).toBe(true);
  });

  it("DevOps:SPEC-INT-010: queued payload型を判定する", () => {
    expect(isQueuedGithubWebhookEvent({ eventName: "push", payload: {} })).toBe(true);
    expect(isQueuedGithubWebhookEvent({ eventName: "push" })).toBe(false);
  });

  it("REQ-036 / PrjOps:SPEC-INT-062: GitHub PM webhookをpm_events向けに正規化する", () => {
    const record = normalizePmWebhookEvent(
      {
        eventName: "projects_v2_item",
        payload: {
          action: "edited",
          repository: { full_name: "octo/repo" },
          projects_v2_item: { node_id: "PVTI_1", project_node_id: "PVT_1", updated_at: "2026-07-09T00:00:00Z" },
          changes: { field_value: { from: { name: "Todo" }, to: { name: "Done" } } },
        },
      },
      "trace-pm",
      new Date("2026-07-09T01:00:00Z"),
    );
    expect(record).toMatchObject({
      eventName: "projects_v2_item",
      action: "edited",
      projectId: "PVT_1",
      repository: "octo/repo",
      subjectType: "project_item",
      subjectId: "PVTI_1",
      fromStatus: "Todo",
      toStatus: "Done",
    });
  });

  it("REQ-036 / PrjOps:SPEC-INT-062: projects_v2_status_updateをpm_events向けに正規化する", () => {
    const record = normalizePmWebhookEvent(
      {
        eventName: "projects_v2_status_update",
        payload: {
          action: "edited",
          projects_v2_status_update: {
            node_id: "PVTSU_1",
            project_node_id: "PVT_1",
            updated_at: "2026-07-09T00:00:00Z",
          },
          changes: { status: { from: "On track", to: "At risk" } },
        },
      },
      "trace-pm",
      new Date("2026-07-09T01:00:00Z"),
    );
    expect(record).toMatchObject({
      eventName: "projects_v2_status_update",
      action: "edited",
      projectId: "PVT_1",
      subjectType: "project_status",
      subjectId: "PVTSU_1",
      fromStatus: "On track",
      toStatus: "At risk",
    });
  });

  it("AC-036-1: dispatch時にpmRepoへ正規化イベントを保存する", async () => {
    const auditLog = new InMemoryAuditLog();
    const saved: unknown[] = [];
    await dispatchGithubWebhookEvent(
      { eventName: "issues", payload: { action: "opened", issue: { number: 1 } } },
      "trace-pm",
      {
        auditLog,
        pmRepo: { recordEvent: async (event: unknown) => saved.push(event) } as never,
        handlers: {
          AGT_BLD: async () => {},
          AGT_DEP: async () => {},
          AGT_INC: async () => {},
        },
        now: () => new Date("2026-07-09T00:00:00Z"),
      },
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ eventName: "issues", subjectType: "issue" });
  });

  it("pull_request webhookはmergedフラグをnormalizedへ保存する", () => {
    const record = normalizePmWebhookEvent(
      {
        eventName: "pull_request",
        payload: {
          action: "closed",
          repository: { full_name: "octo/repo" },
          pull_request: { number: 42, state: "closed", merged: true, updated_at: "2026-07-09T00:00:00Z" },
        },
      },
      "trace-pr",
      new Date("2026-07-09T01:00:00Z"),
    );

    expect(record?.normalized).toMatchObject({ merged: true, state: "closed", repository: "octo/repo" });
  });

  it("L1b-2: deployment_status webhookをpm_eventsへ正規化しDeploy集計に使える形で保存する", async () => {
    const auditLog = new InMemoryAuditLog();
    const saved: unknown[] = [];
    await dispatchGithubWebhookEvent(
      {
        eventName: "deployment_status",
        payload: {
          action: "created",
          repository: { full_name: "octo/repo" },
          deployment: { id: 123, created_at: "2026-07-09T00:00:00Z" },
          deployment_status: { id: 456, state: "success", created_at: "2026-07-09T00:01:00Z" },
        },
      },
      "trace-deploy",
      {
        auditLog,
        pmRepo: { recordEvent: async (event: unknown) => saved.push(event) } as never,
        handlers: { AGT_BLD: async () => {}, AGT_DEP: async () => {}, AGT_INC: async () => {} },
      },
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      eventName: "deployment_status",
      subjectType: "deployment",
      subjectId: "456",
      normalized: { deploymentState: "success" },
    });
  });

  it("deployment_status webhookはterminal stateだけpm_eventsへ保存する", () => {
    expect(
      normalizePmWebhookEvent(
        {
          eventName: "deployment_status",
          payload: {
            action: "created",
            deployment: { id: 123, created_at: "2026-07-09T00:00:00Z" },
            deployment_status: { id: 456, state: "in_progress", created_at: "2026-07-09T00:01:00Z" },
          },
        },
        "trace-deploy",
      ),
    ).toBeNull();
  });
});
