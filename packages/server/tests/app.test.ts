/**
 * packages/server/tests/app.test.ts
 *
 * 根拠: ADR-0005（webhook全経路の結合テスト。app.request()でポートを開かず検証）
 *   / PrjOps:SPEC-INT-001（validationTokenハンドシェイク）/ DevOps:SPEC-INT-061（GitHub署名検証）
 */
import { describe, it, expect, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import type { PgQueryable } from "@aiops/shared";
import { GraphSubscriptionError, InMemoryAuditLog } from "@aiops/shared";
import { buildApp, type AppDependencies } from "../src/http/app.js";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import { createReadinessCheck } from "../src/http/routes/health.js";
import { MetricsRegistry } from "../src/observability/metrics.js";
import { loadConfig } from "../src/config.js";
import { XLSX_IMPORT_MAX_BYTES } from "../src/http/routes/xlsxImport.js";

const CLIENT_STATE = "expected-client-state-16chars";
const WEBHOOK_SECRET = "test-webhook-secret";
const CONFIRM_TOKEN_SECRET = "test-confirm-token-secret-16+";
const CALLBACK_SECRET = "test-callback-secret-16chars";
const METRICS_TOKEN = "test-metrics-token-of-at-least-32-chars";

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
    await expect(res.json()).resolves.toEqual({ ready: false, degraded: [] });
    ready = true;
    const recovered = await app.request("/readyz");
    expect(recovered.status).toBe(200);
  });

  it("GET /readyz は縮退中の機能を本文に列挙する [DevOps:REQ-028]", async () => {
    // 従来は必須envのみの最小構成でも 200 だけが返り、無効化の積み重なりは監査ログにしか
    // 現れなかった（06章D7cで実観測。所見 ADV-INT-052 / ADV-INT-007）。
    const { deps } = makeDeps();
    deps.readiness = {
      isReady: async () => true,
      degradedCapabilities: () => ["report_delivery", "graph_subscriptions"],
    };
    const app = buildApp(deps);

    const res = await app.request("/readyz");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ready: true,
      degraded: ["report_delivery", "graph_subscriptions"],
    });
  });

  it("GET /readyz はshutdown中なら503", async () => {
    const { deps } = makeDeps();
    let shuttingDown = true;
    deps.readiness = createReadinessCheck({
      checkDependencies: async () => {},
      isFailsafeActive: () => false,
      isShuttingDown: () => shuttingDown,
    });
    const app = buildApp(deps);
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    shuttingDown = false;
    const recovered = await app.request("/readyz");
    expect(recovered.status).toBe(200);
  });

  it("GET /metrics はPrometheus textを返す（トークン設定時）", async () => {
    const { deps } = makeDeps();
    const metrics = new MetricsRegistry();
    metrics.recordDelivery("sent", 2);
    deps.metrics = metrics;
    deps.metricsToken = METRICS_TOKEN;
    const app = buildApp(deps);
    const res = await app.request("/metrics", { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toContain('aiops_report_delivery_total{result="sent"} 2');
  });

  it("METRICS_TOKEN未設定なら /metrics を無効化する（匿名公開しない） [DevOps:SPEC-INT-010]", async () => {
    // 従来は認証ミドルウェア自体が登録されず、設定漏れ1つで内部運用情報が匿名公開されていた
    // （所見 ADV-OPS-006 / ADV-SEC-011。06章 D7c で 200 を実観測）。
    const { deps } = makeDeps();
    deps.metricsToken = undefined;
    const app = buildApp(deps);

    const res = await app.request("/metrics");

    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("# HELP");
  });

  it("GET /metrics はMETRICS_TOKEN設定時に完全一致するBearerだけを許可する", async () => {
    const { deps } = makeDeps();
    deps.metricsToken = loadConfig({
      DATABASE_URL: "postgres://test:test@localhost/test",
      GRAPH_CLIENT_STATE: "test-client-state-of-at-least-32-chars",
      GITHUB_WEBHOOK_SECRET: "test-webhook-secret-of-at-least-32-chars",
      GRAPH_CLIENT_ID: "test-client",
      GRAPH_CLIENT_SECRET: "test-client-secret",
      GRAPH_TENANT_ID: "test-tenant",
      GRAPH_ALLOWED_TEAM_IDS: "team-1",
      GRAPH_ALLOWED_FROM_MAILBOXES: "from@example.com",
      PUBLIC_BASE_URL: "https://example.invalid",
      CODING_TASK_CONFIRM_SECRET: "confirm-secret-of-at-least-32-characters",
      CODING_TASK_CALLBACK_SECRET: "test-callback-secret-of-at-least-32-chars",
      METRICS_TOKEN,
    }).METRICS_TOKEN;
    const app = buildApp(deps);

    for (const authorization of [
      undefined,
      `Bearer ${"x".repeat(METRICS_TOKEN.length)}`,
      `bearer ${METRICS_TOKEN}`,
      `Bearer  ${METRICS_TOKEN}`,
      `Bearer ${METRICS_TOKEN}x`,
    ]) {
      const res = await app.request("/metrics", {
        headers: authorization ? { Authorization: authorization } : undefined,
      });
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toBe("Bearer");
      expect(await res.text()).toBe("Unauthorized");
    }

    const res = await app.request("/metrics", {
      headers: { Authorization: `Bearer ${METRICS_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("# HELP aiops_report_delivery_total");
  });
});

describe("browser security headers (AUD-SEC-002)", () => {
  it("Honoの確認ページにもCSP、HSTS、nosniff、frame denialを設定する", async () => {
    const { deps } = makeDeps();
    const res = await buildApp(deps).request("/coding-tasks/missing/confirm");

    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("POST /webhooks/graph (PrjOps:SPEC-INT-001 / ADR-0005)", () => {
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

  it("Graph通常通知は不正resourceを拒否し、id/versionなしの同一更新は両方エンキューする", async () => {
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
            resource: "users('u-1')",
            subscriptionId: "sub-1",
          },
          {
            clientState: CLIENT_STATE,
            changeType: "updated",
            resource: "teams('t-1')/channels('c-1')/messages('m-2')",
            subscriptionId: "sub-1",
          },
          {
            clientState: CLIENT_STATE,
            changeType: "updated",
            resource: "teams('t-1')/channels('c-1')/messages('m-2')",
            subscriptionId: "sub-1",
          },
        ],
      }),
    });

    expect(res.status).toBe(202);
    expect(inboundEvents).toHaveLength(2);
    const payload = inboundEvents[0]!.payload as { ids: { messageId: string } };
    expect(payload.ids.messageId).toBe("m-2");
    expect(inboundEvents.map((event) => event.dedupeKey)).toEqual([null, null]);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "graph_notification_missing_dedupe_key")).toBe(true);
  });

  it("created/updated/deletedは別notification idなら同じmessageでもすべてエンキューする", async () => {
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
        {
          id: "graph-notification-2",
          clientState: CLIENT_STATE,
          changeType: "updated",
          resource: "teams('t-1')/channels('c-1')/messages('m-1')",
          subscriptionId: "sub-1",
        },
        {
          id: "graph-notification-3",
          clientState: CLIENT_STATE,
          changeType: "deleted",
          resource: "teams('t-1')/channels('c-1')/messages('m-1')",
          subscriptionId: "sub-1",
        },
      ],
    });

    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(res.status).toBe(202);
    expect(inboundEvents).toHaveLength(3);
    expect(inboundEvents.map((event) => event.dedupeKey)).toEqual([
      "graph:notification:graph-notification-1",
      "graph:notification:graph-notification-2",
      "graph:notification:graph-notification-3",
    ]);
  });

  it("同一notification idのexact redeliveryは1件だけエンキューし、監査にclientStateを含めない", async () => {
    const { deps, auditLog, inboundEvents } = makeDeps();
    const app = buildApp(deps);
    const notification = {
      id: "graph-notification-redelivery",
      clientState: CLIENT_STATE,
      changeType: "updated",
      resource: "teams('t-1')/channels('c-1')/messages('m-1')",
      subscriptionId: "sub-1",
    };
    for (let i = 0; i < 2; i += 1) {
      const res = await app.request("/webhooks/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: [notification] }),
      });
      expect(res.status).toBe(202);
    }
    expect(inboundEvents).toHaveLength(1);
    expect(JSON.stringify(await auditLog.readAll())).not.toContain(CLIENT_STATE);
  });

  it("同じmessage/etagでもteam/channel/subscriptionが異なれば衝突しない", async () => {
    const { deps, inboundEvents } = makeDeps();
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [
          {
            clientState: CLIENT_STATE,
            changeType: "updated",
            resource: "teams('t-1')/channels('c-1')/messages('m-1')",
            subscriptionId: "sub-1",
            resourceData: { "@odata.etag": "version-1" },
          },
          {
            clientState: CLIENT_STATE,
            changeType: "updated",
            resource: "teams('t-2')/channels('c-2')/messages('m-1')",
            subscriptionId: "sub-2",
            resourceData: { "@odata.etag": "version-1" },
          },
        ],
      }),
    });
    expect(res.status).toBe(202);
    expect(inboundEvents).toHaveLength(2);
    expect(inboundEvents[0]!.dedupeKey).not.toBe(inboundEvents[1]!.dedupeKey);
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

  it("Graph lifecycle通知はhandler完了を待たず202を返す", async () => {
    const { deps, graphLifecycleCalls } = makeDeps();
    let releaseHandler!: () => void;
    deps.graph.handleLifecycleEvent = async (event) => {
      await new Promise<void>((resolve) => {
        releaseHandler = resolve;
      });
      graphLifecycleCalls.push(event.lifecycleEvent);
    };
    const app = buildApp(deps);

    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [{ clientState: CLIENT_STATE, lifecycleEvent: "reauthorizationRequired", subscriptionId: "sub-1" }],
      }),
    });

    expect(res.status).toBe(202);
    expect(graphLifecycleCalls).toEqual([]);
    releaseHandler();
    await Promise.resolve();
    expect(graphLifecycleCalls).toEqual(["reauthorizationRequired"]);
  });

  it("Graph lifecycle失敗後の監査記録も失敗しても202応答後に未処理rejectを出さない", async () => {
    const { deps } = makeDeps();
    deps.graph.handleLifecycleEvent = async () => {
      throw new Error("lifecycle failed");
    };
    deps.graph.auditLog = {
      append: async () => {
        throw new Error("audit down");
      },
    };
    const app = buildApp(deps);

    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [{ clientState: CLIENT_STATE, lifecycleEvent: "reauthorizationRequired", subscriptionId: "sub-1" }],
      }),
    });

    expect(res.status).toBe(202);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  it("Graph lifecycle background失敗はbounded code/status/recoveryだけを監査する", async () => {
    const { deps, auditLog } = makeDeps();
    deps.graph.handleLifecycleEvent = async () => {
      throw new GraphSubscriptionError("E-SUB02", 503, "secret response body");
    };
    const app = buildApp(deps);
    const res = await app.request("/webhooks/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: [{ clientState: CLIENT_STATE, lifecycleEvent: "reauthorizationRequired", subscriptionId: "sub-1" }],
      }),
    });
    expect(res.status).toBe(202);
    await Promise.resolve();
    const serialized = JSON.stringify(await auditLog.readAll());
    expect(serialized).toContain('"code":"E-SUB02"');
    expect(serialized).toContain('"status":503');
    expect(serialized).not.toContain("secret response body");
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

describe("POST /webhooks/github (DevOps:SPEC-INT-061)", () => {
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
    // 重複判定は署名対象のボディから導く。delivery id はヘッダで署名の外にあるため使わない。
    const digest = createHash("sha256").update(payload, "utf8").digest("hex");
    expect(githubEvents[0]!.dedupeKey).toBe(`github:${digest}`);
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

  it("delivery idを差し替えた再送も重複として弾く（署名対象外のヘッダに依存しない）", async () => {
    // 署名済みペイロードを観測できた攻撃者は delivery id を差し替えるだけで
    // dedupe を通過し、同一イベントを何度でも再エンキューできた（所見 ADV-INT-006）。
    const { deps, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const payload = JSON.stringify({ ref: "refs/heads/main" });
    const sig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(payload, "utf8").digest("hex");
    const send = (deliveryId: string) =>
      app.request("/webhooks/github", {
        method: "POST",
        headers: { "x-hub-signature-256": sig, "x-github-event": "push", "x-github-delivery": deliveryId },
        body: payload,
      });

    expect((await send("delivery-a")).status).toBe(202);
    expect((await send("delivery-b")).status).toBe(202);

    expect(githubEvents).toHaveLength(1);
  });

  it("event名を差し替えた再送も重複として弾く（イベント名も署名対象外）", async () => {
    // delivery id と同様に X-GitHub-Event も署名の外にある。鍵に混ぜると攻撃者が
    // イベント名を変えるだけで無制限に挿入できる（所見 ADV-INT-006）。
    const { deps, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const payload = JSON.stringify({ ref: "refs/heads/main" });
    const sig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(payload, "utf8").digest("hex");
    const send = (eventName: string) =>
      app.request("/webhooks/github", {
        method: "POST",
        headers: { "x-hub-signature-256": sig, "x-github-event": eventName, "x-github-delivery": "d" },
        body: payload,
      });

    expect((await send("push")).status).toBe(202);
    expect((await send("anything_else")).status).toBe(202);

    expect(githubEvents).toHaveLength(1);
  });

  it("ボディが異なれば別イベントとしてエンキューする", async () => {
    const { deps, githubEvents } = makeDeps();
    const app = buildApp(deps);
    const send = (body: string) => {
      const sig = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body, "utf8").digest("hex");
      return app.request("/webhooks/github", {
        method: "POST",
        headers: { "x-hub-signature-256": sig, "x-github-event": "push", "x-github-delivery": "d" },
        body,
      });
    };

    await send(JSON.stringify({ ref: "refs/heads/main" }));
    await send(JSON.stringify({ ref: "refs/heads/other" }));

    expect(githubEvents).toHaveLength(2);
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

  it("xlsx importはContent-Length超過をbody読取前に413で拒否する [REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1]", async () => {
    const { deps } = makeDeps();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    deps.webui = { targetBaseUrl: "http://127.0.0.1:3100", fetchImpl: async () => new Response() };
    const request = new Request("http://localhost/app/api/xlsx-import?operation=dry-run", {
      method: "POST",
      headers: { "content-length": String(XLSX_IMPORT_MAX_BYTES + 1) },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const res = await buildApp(deps).request(request);

    expect(res.status).toBe(413);
    expect(request.body?.locked).toBe(false);
  });

  it("xlsx importはchunked超過をcancelして413にする [REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1]", async () => {
    const { deps } = makeDeps();
    let cancelled = false;
    const chunks = [new Uint8Array(6 * 1024 * 1024), new Uint8Array(5 * 1024 * 1024)];
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk) controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl = vi.fn(async () => new Response());
    deps.webui = { targetBaseUrl: "http://127.0.0.1:3100", fetchImpl };
    const request = new Request("http://localhost/app/api/xlsx-import?operation=dry-run", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const res = await buildApp(deps).request(request);

    expect(res.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("xlsx importはexactly 10MiBをNextへ転送する [REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1]", async () => {
    const { deps } = makeDeps();
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.body as Uint8Array).byteLength).toBe(XLSX_IMPORT_MAX_BYTES);
      return Response.json({ ok: true });
    });
    deps.webui = { targetBaseUrl: "http://127.0.0.1:3100", fetchImpl };

    const res = await buildApp(deps).request("/app/api/xlsx-import?operation=dry-run", {
      method: "POST",
      body: new Uint8Array(XLSX_IMPORT_MAX_BYTES),
    });

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
