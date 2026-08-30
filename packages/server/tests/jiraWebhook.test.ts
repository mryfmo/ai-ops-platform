// 根拠: 添付TEXT「Jira・GitHub・ai-ops-platform構成」
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { InMemoryAuditLog } from "@aiops/shared";
import { createBearerJiraWebhookAuthenticator, registerJiraWebhookRoutes } from "../src/http/routes/jiraWebhook.js";

const TOKEN = "jira-webhook-test-token-32-characters";
const payload = {
  webhookEvent: "jira:issue_updated",
  issue: {
    key: "AICOE-123",
    fields: {
      project: { id: "10000" },
      status: { id: "10021" },
      assignee: { accountId: "opaque-account-id" },
      updated: "2026-08-28T02:00:00.000Z",
      customfield_10020: [{ id: 88 }],
      summary: "must not be persisted",
      description: "must not be persisted",
      comment: { comments: [{ body: "must not be persisted" }] },
    },
  },
};

function makeApp(configured = true) {
  const app = new Hono();
  const queued: unknown[] = [];
  const auditLog = new InMemoryAuditLog();
  registerJiraWebhookRoutes(
    app,
    configured
      ? {
          authenticator: createBearerJiraWebhookAuthenticator(TOKEN),
          auditLog,
          resolveProjectMapping: async (id) =>
            id === "10000"
              ? {
                  projectId: "PJ-1001",
                  jiraProjectId: "10000",
                  mappingVersion: 2,
                  allowedStatusIds: ["10021"],
                  sprintFieldId: "customfield_10020",
                }
              : null,
          enqueueJiraEvent: async (event) => {
            queued.push(event);
            return true;
          },
          traceIdProvider: () => "trace-jira-1",
        }
      : undefined,
  );
  return { app, queued, auditLog };
}

describe("Jira webhook", () => {
  it("is fail-closed when authenticator is not configured", async () => {
    const { app } = makeApp(false);
    expect((await app.request("/webhooks/jira", { method: "POST", body: "{}" })).status).toBe(503);
  });

  it("rejects missing/invalid bearer authentication", async () => {
    const { app, queued } = makeApp();
    const res = await app.request("/webhooks/jira", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(401);
    expect(queued).toHaveLength(0);
  });

  it("queues only normalized metadata and omits Jira body text", async () => {
    const { app, queued } = makeApp();
    const res = await app.request("/webhooks/jira", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(202);
    expect(queued).toHaveLength(1);
    const serialized = JSON.stringify(queued[0]);
    expect(serialized).toContain("AICOE-123");
    expect(serialized).toContain("PJ-1001");
    expect(serialized).not.toContain("must not be persisted");
    expect(queued[0]).toMatchObject({
      kind: "jira_work_item_event",
      origin: "jira-webhook",
      statusId: "10021",
      sprintId: "88",
      revision: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
  });

  it("rejects unknown Jira project mappings", async () => {
    const { app, queued } = makeApp();
    const changed = structuredClone(payload);
    changed.issue.fields.project.id = "99999";
    const res = await app.request("/webhooks/jira", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(changed),
    });
    expect(res.status).toBe(403);
    expect(queued).toHaveLength(0);
  });
});
