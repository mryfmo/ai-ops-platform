/**
 * packages/server/tests/githubEventRouter.test.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-010（GitHub webhookイベントのDevOpsエージェント振り分け）
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

describe("githubEventRouter (ADR-0005 / SPEC-INT-010)", () => {
  it("workflow_run failureはAGT_BLDへ振り分ける", () => {
    expect(
      selectDevopsAgentForGithubEvent({
        eventName: "workflow_run",
        payload: { workflow_run: { conclusion: "failure", name: "ci" } },
      }),
    ).toBe("AGT_BLD");
  });

  it("deploy workflowとdeployment eventはAGT_DEPへ振り分ける", () => {
    expect(
      selectDevopsAgentForGithubEvent({
        eventName: "workflow_run",
        payload: { workflow_run: { conclusion: "success", name: "deploy-prod" } },
      }),
    ).toBe("AGT_DEP");
    expect(selectDevopsAgentForGithubEvent({ eventName: "deployment_status", payload: {} })).toBe("AGT_DEP");
  });

  it("issues eventはAGT_INCへ振り分ける", () => {
    expect(selectDevopsAgentForGithubEvent({ eventName: "issues", payload: { action: "opened" } })).toBe("AGT_INC");
  });

  it("handlerへ渡し、dispatch監査ログを残す", async () => {
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

  it("未対応eventはhandlerを呼ばずignored監査ログを残す", async () => {
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

  it("queued payload型を判定する", () => {
    expect(isQueuedGithubWebhookEvent({ eventName: "push", payload: {} })).toBe(true);
    expect(isQueuedGithubWebhookEvent({ eventName: "push" })).toBe(false);
  });

  it("REQ-036 / SPEC-INT-062: GitHub PM webhookをpm_events向けに正規化する", () => {
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
});
