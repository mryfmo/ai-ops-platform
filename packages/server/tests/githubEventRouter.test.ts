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
});
