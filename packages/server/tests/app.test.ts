/**
 * packages/server/tests/app.test.ts
 *
 * 根拠: ADR-0005（webhook全経路の結合テスト。app.request()でポートを開かず検証）
 *   / SPEC-INT-001（validationTokenハンドシェイク）/ SPEC-INT-061（GitHub署名検証）
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import type { PgQueryable } from "@aiops/shared";
import { InMemoryAuditLog } from "@aiops/shared";
import { buildApp, type AppDependencies } from "../src/http/app.js";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";

const CLIENT_STATE = "expected-client-state-16chars";
const WEBHOOK_SECRET = "test-webhook-secret";
const CONFIRM_TOKEN_SECRET = "test-confirm-token-secret-16+";
const CALLBACK_SECRET = "test-callback-secret-16chars";

function makeDeps() {
  const auditLog = new InMemoryAuditLog();
  const inboundEvents: Array<{ payload: unknown; traceId: string; dedupeKey: string | null }> = [];
  const githubEvents: Array<{ eventName: string; payload: unknown; dedupeKey: string | null }> = [];
  const graphLifecycleCalls: string[] = [];
  let traceSeq = 0;
  const seenDedupeKeys = new Set<string>();

  const mockDb: PgQueryable = { query: async () => ({ rows: [] }) };
  const codingTasksRepo = new CodingTasksRepo(mockDb);

  const deps: AppDependencies = {
    auditLog,
    readiness: { isReady: async () => true },
    graph: {
      clientState: CLIENT_STATE,
      auditLog,
      enqueueInboundEvent: async (payload, traceId, options) => {
        const dedupeKey = options?.dedupeKey ?? null;
        if (dedupeKey && seenDedupeKeys.has(dedupeKey)) return false;
        if (dedupeKey) seenDedupeKeys.add(dedupeKey);
        inboundEvents.push({ payload, traceId, dedupeKey });
        return true;
      },
      handleLifecycleEvent: async (event) => {
        graphLifecycleCalls.push(event.lifecycleEvent);
      },
      traceIdProvider: () => `trace-${++traceSeq}`,
    },
    github: {
      webhookSecret: WEBHOOK_SECRET,
      auditLog,
      enqueueGithubEvent: async (eventName, payload, traceId, options) => {
        const dedupeKey = options?.dedupeKey ?? null;
        if (dedupeKey && seenDedupeKeys.has(dedupeKey)) return false;
        if (dedupeKey) seenDedupeKeys.add(dedupeKey);
        githubEvents.push({ eventName, payload, dedupeKey });
        void traceId;
        return true;
      },
      traceIdProvider: () => `trace-${++traceSeq}`,
    },
    codingTasks: {
      codingTasksRepo,
      githubClient: { dispatchWorkflow: async () => {} },
      auditLog,
      confirmTokenSecret: CONFIRM_TOKEN_SECRET,
      callbackSecret: CALLBACK_SECRET,
      resolveRepoForProject: async () => ({ githubOwner: "acme", githubRepo: "widget" }),
      traceIdProvider: () => `trace-${++traceSeq}`,
    },
    xlsxImport: {
      ledger: {
        findBySourceKey: async () => null,
        insert: async () => {},
      },
      githubClient: {
        createIssue: async () => ({ number: 1, htmlUrl: "https://example.invalid/issues/1" }),
        createMilestone: async () => ({ number: 1, htmlUrl: "https://example.invalid/milestones/1" }),
        addProjectV2ItemById: async () => ({ itemNodeId: "PVTI_1" }),
        updateProjectV2ItemFieldValue: async () => {},
        getGraphqlRateLimit: async () => ({ remaining: 100, resetAt: "2026-07-09T00:00:00Z" }),
      },
      auditLog,
      traceIdProvider: () => `trace-${++traceSeq}`,
      importSecret: "xlsx-import-secret-32-bytes-minimum",
      allowedRepos: ["acme/widget"],
    },
  };
  return { deps, auditLog, inboundEvents, githubEvents, graphLifecycleCalls };
}

describe("health endpoints (ADR-0005)", () => {
  it("GET /healthz は常に200", async () => {
    const { deps } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
  });

  it("GET /readyz はDB不通で503", async () => {
    const { deps } = makeDeps();
    deps.readiness = {
      isReady: async () => {
        throw new Error("db down");
      },
    };
    const app = buildApp(deps);
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
  });

  it("GET /readyz はreadinessがfalseなら503、回復後200", async () => {
    const { deps } = makeDeps();
    let ready = false;
    deps.readiness = { isReady: async () => ready };
    const app = buildApp(deps);
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ ready: false });
    ready = true;
    const recovered = await app.request("/readyz");
    expect(recovered.status).toBe(200);
  });
});

describe("POST /webhooks/graph (SPEC-INT-001 / ADR-0005)", () => {
  it("validationTokenハンドシェイクはtext/plainでトークンをそのまま返す", async () => {
    const { deps } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph?validationToken=tok-123", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("tok-123");
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("clientState一致の通知はエンキューされ202", async () => {
    const { deps, inboundEvents } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [
          {
            id: "graph-notification-main",
            clientState: CLIENT_STATE,
            changeType: "created",
            resource: "teams('t-1')/channels('c-1')/messages('m-1')",
            subscriptionId: "sub-1",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);
    expect(inboundEvents).toHaveLength(1);
    const payload = inboundEvents[0]!.payload as { ids: { messageId: string } };
    expect(payload.ids.messageId).toBe("m-1");
  });

  it("Graph通常通知のid欠落は監査ログを残してskipし、バッチ全体は止めない", async () => {
    const { deps, auditLog, inboundEvents } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [
          {
            clientState: CLIENT_STATE,
            changeType: "created",
            resource: "teams('t-1')/channels('c-1')/messages('m-1')",
            subscriptionId: "sub-1",
          },
          {
            id: "graph-notification-valid",
            clientState: CLIENT_STATE,
            changeType: "created",
            resource: "teams('t-1')/channels('c-1')/messages('m-2')",
            subscriptionId: "sub-1",
          },
        ],
      }),
    });

    expect(res.status).toBe(202);
    expect(inboundEvents).toHaveLength(1);
    const payload = inboundEvents[0]!.payload as { ids: { messageId: string } };
    expect(payload.ids.messageId).toBe("m-2");
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "graph_notification_missing_dedupe_key")).toBe(true);
  });

  it("同一Graph通知idの再送は1件だけエンキューする", async () => {
    const { deps, inboundEvents } = makeDeps();
    const app = buildApp(deps);
    const body = JSON.stringify({
      value: [
        {
          id: "graph-notification-1",
          clientState: CLIENT_STATE,
          changeType: "created",
          resource: "teams('t-1')/channels('c-1')/messages('m-1')",
          subscriptionId: "sub-1",
        },
      ],
    });

    const first = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const second = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(inboundEvents).toHaveLength(1);
    expect(inboundEvents[0]!.dedupeKey).toBe("graph:graph-notification-1");
  });

  it("idなしのGraph lifecycle通知を分類してhandlerへ渡す", async () => {
    const { deps, graphLifecycleCalls } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [
          { clientState: CLIENT_STATE, lifecycleEvent: "reauthorizationRequired", subscriptionId: "sub-1" },
          { clientState: CLIENT_STATE, lifecycleEvent: "subscriptionRemoved", subscriptionId: "sub-2" },
          { clientState: CLIENT_STATE, lifecycleEvent: "missed", subscriptionId: "sub-3" },
        ],
      }),
    });

    expect(res.status).toBe(202);
    expect(graphLifecycleCalls).toEqual(["reauthorizationRequired", "subscriptionRemoved", "missed"]);
  });

  it("clientState不一致は破棄+監査ログ、それでも202（検証結果を漏らさない）", async () => {
    const { deps, auditLog, inboundEvents } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [{ clientState: "attacker-value", resource: "teams('t')/channels('c')/messages('m')" }],
      }),
    });
    expect(res.status).toBe(202);
    expect(inboundEvents).toHaveLength(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "graph_notification_rejected")).toBe(true);
  });
});

describe("POST /webhooks/github (SPEC-INT-061)", () => {
  it("正しい署名でエンキューされ202", async () => {
    const { deps, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const payload = JSON.stringify({ action: "completed", workflow_run: { id: 99 } });
    const sig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(payload, "utf8").digest("hex");
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: { "x-hub-signature-256": sig, "x-github-event": "workflow_run", "x-github-delivery": "delivery-1" },
      body: payload,
    });
    expect(res.status).toBe(202);
    expect(githubEvents[0]!.eventName).toBe("workflow_run");
    expect(githubEvents[0]!.dedupeKey).toBe("github:delivery-1");
  });

  it("署名済みGitHub webhookのdelivery id欠落は400+監査ログでfail-closedし、エンキューしない", async () => {
    const { deps, auditLog, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const payload = JSON.stringify({ ref: "refs/heads/main" });
    const sig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(payload, "utf8").digest("hex");
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: { "x-hub-signature-256": sig, "x-github-event": "push" },
      body: payload,
    });

    expect(res.status).toBe(400);
    expect(githubEvents).toHaveLength(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "github_webhook_missing_delivery_id")).toBe(true);
  });

  it("同一X-GitHub-Deliveryの再送は1件だけエンキューする", async () => {
    const { deps, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const payload = JSON.stringify({ ref: "refs/heads/main" });
    const sig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(payload, "utf8").digest("hex");
    const request = {
      method: "POST",
      headers: { "x-hub-signature-256": sig, "x-github-event": "push", "x-github-delivery": "delivery-dup" },
      body: payload,
    };

    expect((await app.request("/webhooks/github", request)).status).toBe(202);
    expect((await app.request("/webhooks/github", request)).status).toBe(202);
    expect(githubEvents).toHaveLength(1);
  });

  it("署名不正は401+監査ログ、エンキューされない", async () => {
    const { deps, auditLog, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=deadbeef", "x-github-event": "push" },
      body: JSON.stringify({ ref: "refs/heads/main" }),
    });
    expect(res.status).toBe(401);
    expect(githubEvents).toHaveLength(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "github_webhook_rejected")).toBe(true);
  });
});

describe("/app/* WebUIプロキシ (ADR-0005)", () => {
  it("webui未設定時は503（縮退運転）", async () => {
    const { deps } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/app/dashboard");
    expect(res.status).toBe(503);
  });

  it("設定時は転送先のレスポンスを返す", async () => {
    const { deps } = makeDeps();
    deps.webui = {
      targetBaseUrl: "http://127.0.0.1:3100",
      fetchImpl: async (url) => {
        expect(url).toBe("http://127.0.0.1:3100/app/dashboard?tab=1");
        return new Response("<html>dashboard</html>", { status: 200 });
      },
    };
    const app = buildApp(deps);
    const res = await app.request("/app/dashboard?tab=1");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("dashboard");
  });
});
