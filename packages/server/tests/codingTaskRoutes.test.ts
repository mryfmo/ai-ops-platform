/**
 * packages/server/tests/codingTaskRoutes.test.ts
 *
 * 根拠: ADR-0006（コーディングタスク確認・callbackのHTTP面）。
 *   - GET  /coding-tasks/:taskId/confirm: トークン検証→確認画面 or 403/404/状態表示
 *   - POST /coding-tasks/:taskId/confirm: 人間の明示クリックでdispatchWorkflowを呼ぶ（ここでのみ）
 *   - POST /internal/coding-tasks/:taskId/callback: Bearer認証、状態遷移
 *   テストはapp.request()でポートを開かずに全経路を検証する（既存app.test.ts踏襲）。
 */
import { describe, it, expect } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { InMemoryAuditLog } from "@aiops/shared";
import { Hono } from "hono";
import { registerCodingTaskRoutes, type CodingTaskRoutesDeps } from "../src/http/routes/codingTasks.js";
import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import { generateConfirmToken, hashConfirmToken } from "../src/lib/confirmToken.js";

const CONFIRM_SECRET = "test-confirm-token-secret-16+";
const CALLBACK_SECRET = "test-callback-secret-16chars";
const TASK_ID = "11111111-1111-4111-8111-111111111111";

function makeRowFor(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    task_id: TASK_ID,
    project_id: "PJ-001",
    requested_by: "USER:PRF-02",
    source: "teams",
    instruction: "テストを直して",
    agent: "claude-code",
    status: "queued",
    workflow_run_id: null,
    pr_url: null,
    branch: null,
    trace_id: "trace-1",
    confirmed_at: null,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

function makeHarness(opts: { row?: Record<string, unknown> | null } = {}) {
  const row = opts.row === undefined ? makeRowFor() : opts.row;
  const updateCalls: Array<{ text: string; params: unknown[] | undefined }> = [];
  const mockDb: PgQueryable = {
    query: async (text, params) => {
      if (text.trim().startsWith("SELECT")) {
        return { rows: row ? [row] : [] };
      }
      updateCalls.push({ text, params });
      // security-reviewer指摘対応: updateFromCallbackはWHERE status='running'ガード付きのため、
      // 現在のフィクスチャrowがrunningの場合のみ更新1件とみなす（実PostgreSQLのrowCountを模倣）。
      const isCallbackUpdate = text.includes("WHERE task_id = $1 AND status = 'running'");
      const rowCount = isCallbackUpdate ? (row?.status === "running" ? 1 : 0) : 1;
      return { rows: [], rowCount };
    },
  };
  const codingTasksRepo = new CodingTasksRepo(mockDb);
  const auditLog = new InMemoryAuditLog();
  const dispatchCalls: Array<{
    owner: string;
    repo: string;
    workflowIdOrFileName: string;
    ref: string;
    inputs: Record<string, string>;
  }> = [];

  const deps: CodingTaskRoutesDeps = {
    codingTasksRepo,
    githubClient: {
      dispatchWorkflow: async (input) => {
        dispatchCalls.push(input);
      },
    },
    auditLog,
    confirmTokenSecret: CONFIRM_SECRET,
    callbackSecret: CALLBACK_SECRET,
    resolveRepoForProject: async () => ({ githubOwner: "acme", githubRepo: "widget" }),
    traceIdProvider: () => "req-trace-1",
  };

  const app = new Hono();
  registerCodingTaskRoutes(app, deps);

  return { app, auditLog, dispatchCalls, updateCalls };
}

describe("GET /coding-tasks/:taskId/confirm (ADR-0006)", () => {
  it("正当なトークンかつqueued/未確認なら確認フォームを表示する", async () => {
    const { app } = makeHarness();
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm?token=${token}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("実行する");
    expect(html).toContain("PJ-001");
    expect(html).toContain("テストを直して");
  });

  it("不正なトークンは403", async () => {
    const { app } = makeHarness();
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm?token=deadbeef`);
    expect(res.status).toBe(403);
  });

  it("存在しないtaskIdは404", async () => {
    const { app } = makeHarness({ row: null });
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm?token=${token}`);
    expect(res.status).toBe(404);
  });

  it("確認済み(confirmed_at設定済み)は状態表示のみ", async () => {
    const { app } = makeHarness({ row: makeRowFor({ status: "running", confirmed_at: "2026-07-07T00:05:00.000Z" }) });
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm?token=${token}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("実行する");
    expect(html).toContain("running");
  });

  it("HTML出力はinstructionをエスケープする（XSS対策）", async () => {
    const { app } = makeHarness({ row: makeRowFor({ instruction: "<script>alert(1)</script>" }) });
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm?token=${token}`);
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("POST /coding-tasks/:taskId/confirm (ADR-0006: 人間の明示クリック必須)", () => {
  it("正当なトークンでの確認POSTはdispatchWorkflowを呼び、statusをrunningへ更新する", async () => {
    const { app, dispatchCalls, updateCalls, auditLog } = makeHarness();
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, taskId: TASK_ID }).toString(),
    });
    expect(res.status).toBe(200);
    expect(dispatchCalls).toHaveLength(1);
    expect(dispatchCalls[0]!.workflowIdOrFileName).toBe("coding-task.yml");
    expect(dispatchCalls[0]!.inputs.task_id).toBe(TASK_ID);
    expect(dispatchCalls[0]!.inputs.project_id).toBe("PJ-001");
    expect(dispatchCalls[0]!.inputs.instruction).toBe("テストを直して");
    expect(dispatchCalls[0]!.inputs.agent).toBe("claude-code");
    expect(updateCalls.some((c) => c.text.includes("SET status = 'running'"))).toBe(true);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "coding_task_confirmed_dispatched")).toBe(true);
  });

  it("不正トークンはdispatchWorkflowを呼ばず403", async () => {
    const { app, dispatchCalls } = makeHarness();
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: "wrong-token" }).toString(),
    });
    expect(res.status).toBe(403);
    expect(dispatchCalls).toHaveLength(0);
  });

  it("既に確認済みのタスクは再dispatchせず状態表示のみ", async () => {
    const { app, dispatchCalls } = makeHarness({
      row: makeRowFor({ status: "running", confirmed_at: "2026-07-07T00:05:00.000Z" }),
    });
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    expect(res.status).toBe(200);
    expect(dispatchCalls).toHaveLength(0);
  });
});

describe("POST /internal/coding-tasks/:taskId/callback (ADR-0006)", () => {
  it("正しいBearerトークンでpr_createdへ更新する", async () => {
    // security-reviewer指摘対応: callbackはstatus='running'のタスクのみ遷移を許可するため、
    // 確認済み(running)状態のフィクスチャを使う（queuedのままでは409拒否が正しい挙動になった）。
    const { app, updateCalls, auditLog } = makeHarness({
      row: makeRowFor({ status: "running", confirmed_at: "2026-07-07T00:05:00.000Z" }),
    });
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CALLBACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "pr_created",
        prUrl: "https://github.com/acme/widget/pull/1",
        branch: `agent/${TASK_ID}`,
        workflowRunId: 42,
      }),
    });
    expect(res.status).toBe(200);
    expect(updateCalls.some((c) => c.text.includes("SET status = $2"))).toBe(true);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "coding_task_callback_received")).toBe(true);
  });

  it("queued状態（未確認）のタスクへのcallbackは409で拒否される（誤発火防止の状態遷移ガード）", async () => {
    const { app, updateCalls, auditLog } = makeHarness(); // 既定はstatus:'queued'
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CALLBACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pr_created", prUrl: "https://github.com/acme/widget/pull/1" }),
    });
    expect(res.status).toBe(409);
    expect(updateCalls).toHaveLength(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "coding_task_callback_rejected_invalid_transition")).toBe(true);
  });

  it("既にpr_created確定済みのタスクへの再callback（多重送信）も409で拒否される", async () => {
    const { app, updateCalls } = makeHarness({
      row: makeRowFor({ status: "pr_created", confirmed_at: "2026-07-07T00:05:00.000Z" }),
    });
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CALLBACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    expect(res.status).toBe(409);
    expect(updateCalls).toHaveLength(0);
  });

  it("Bearerトークン不一致は401、更新されない", async () => {
    const { app, updateCalls } = makeHarness();
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    expect(res.status).toBe(401);
    expect(updateCalls).toHaveLength(0);
  });

  it("Authorizationヘッダなしは401", async () => {
    const { app } = makeHarness();
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    expect(res.status).toBe(401);
  });

  it("不正なstatus値は400", async () => {
    const { app } = makeHarness();
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CALLBACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "bogus" }),
    });
    expect(res.status).toBe(400);
  });

  it("存在しないtaskIdは404", async () => {
    const { app } = makeHarness({ row: null });
    const res = await app.request(`/internal/coding-tasks/${TASK_ID}/callback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CALLBACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("hashConfirmToken使用の確認 (ADR-0006: 平文トークン非保存)", () => {
  it("insert時に渡すconfirmTokenHashはgenerateConfirmTokenの出力そのものではない", () => {
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    expect(hashConfirmToken(token)).not.toBe(token);
  });
});
