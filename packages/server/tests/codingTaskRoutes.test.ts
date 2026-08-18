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
import { issueCodingTaskManifest } from "../src/lib/codingTaskManifest.js";

const CONFIRM_SECRET = "test-confirm-token-secret-16+";
const CALLBACK_SECRET = "test-callback-secret-16chars";
const TASK_ID = "11111111-1111-4111-8111-111111111111";

function makeRowFor(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const authority = issueCodingTaskManifest({ taskId: TASK_ID, agent: "claude-code" });
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
    manifest: authority.manifest,
    manifest_sha256: authority.manifestSha256,
    confirmed_at: null,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

function makeHarness(opts: { row?: Record<string, unknown> | null; failsafe?: boolean; dispatchError?: Error } = {}) {
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
      // claimForDispatch は queued かつ未確認の行だけを確保し RETURNING で返す。
      // 実PostgreSQLの挙動を模して、条件を満たす場合のみ行を返す。
      const isClaim = text.includes("status = 'queued' AND confirmed_at IS NULL");
      if (isClaim) {
        const claimable = row?.status === "queued" && !row?.confirmed_at;
        // 確保が成立したら実DBと同様に行を running へ遷移させる。後続の
        // markDispatchFailed が `WHERE status = 'running'` で何行更新するかは
        // この遷移に依存するため、模倣しないと影響行数が実際とずれる。
        if (claimable && row) {
          row["status"] = "running";
          row["confirmed_at"] = "2026-08-05T00:00:00.000Z";
        }
        return { rows: claimable ? [{ task_id: row?.["task_id"] }] : [], rowCount: claimable ? 1 : 0 };
      }
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

  let dispatchOrder = -1;
  const deps: CodingTaskRoutesDeps = {
    codingTasksRepo,
    githubClient: {
      dispatchWorkflow: async (input) => {
        // dispatch 時点で何件のUPDATEが済んでいたかを記録し、claim との順序を検証する
        dispatchOrder = updateCalls.length;
        if (opts.dispatchError) throw opts.dispatchError;
        dispatchCalls.push(input);
      },
    },
    auditLog,
    confirmTokenSecret: CONFIRM_SECRET,
    callbackSecret: CALLBACK_SECRET,
    resolveRepoForProject: async () => ({ githubOwner: "acme", githubRepo: "widget" }),
    traceIdProvider: () => "req-trace-1",
    isFailsafeActive: () => opts.failsafe ?? false,
  };

  const app = new Hono();
  registerCodingTaskRoutes(app, deps);

  return {
    app,
    auditLog,
    dispatchCalls,
    updateCalls,
    token: generateConfirmToken(TASK_ID, CONFIRM_SECRET),
    get dispatchOrder() {
      return dispatchOrder;
    },
  };
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
    expect(dispatchCalls[0]!.inputs.manifest_base64).toBe(
      Buffer.from(makeRowFor().manifest as string, "utf8").toString("base64"),
    );
    expect(dispatchCalls[0]!.inputs.manifest_sha256).toBe(makeRowFor().manifest_sha256);
    expect(updateCalls.some((c) => c.text.includes("SET status = 'running'"))).toBe(true);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "coding_task_confirmed_dispatched")).toBe(true);
  });

  it.each([
    ["missing manifest", { manifest: "" }],
    ["missing digest", { manifest_sha256: "" }],
    ["digest mismatch", { manifest_sha256: "0".repeat(64) }],
  ])("%s は claim/dispatch 前に fail closed", async (_label, override) => {
    const { app, dispatchCalls, updateCalls, token } = makeHarness({ row: makeRowFor(override) });
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, taskId: TASK_ID }).toString(),
    });
    expect(res.status).toBe(409);
    expect(dispatchCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
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

  it("REQ-029: フェイルセーフ中はworkflow_dispatchを起動しない", async () => {
    const { app, dispatchCalls, updateCalls, auditLog } = makeHarness({ failsafe: true });
    const token = generateConfirmToken(TASK_ID, CONFIRM_SECRET);
    const res = await app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    expect(res.status).toBe(503);
    expect(dispatchCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "coding_task_blocked_by_failsafe" && l.basis === "REQ-029")).toBe(true);
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

describe("confirm の二重dispatch防止 [DevOps:REQ-028 / ADR-0006]", () => {
  it("既にrunningのタスクはclaimに失敗しdispatchしない [DevOps:REQ-028]", async () => {
    const h = makeHarness({ row: makeRowFor({ status: "running", confirmed_at: "2026-07-07T00:00:10.000Z" }) });

    const res = await h.app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${h.token}`,
    });

    expect(res.status).toBe(200);
    expect(h.dispatchCalls).toHaveLength(0);
  });

  it("claim は dispatch より前に実行される（順序が逆だと二重起動を防げない） [DevOps:REQ-028]", async () => {
    const h = makeHarness();

    await h.app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${h.token}`,
    });

    const claimIndex = h.updateCalls.findIndex((c) => c.text.includes("status = 'queued' AND confirmed_at IS NULL"));
    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(h.dispatchCalls).toHaveLength(1);
    // claim が記録された後に dispatch が起きていること
    expect(h.dispatchOrder).toBeGreaterThan(claimIndex);
  });

  it("dispatch失敗時は状態を動かさずrunningのまま残す（二重起動もfalse failedも作らない） [DevOps:REQ-028]", async () => {
    const h = makeHarness({ dispatchError: new Error("boom") });

    const res = await h.app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${h.token}`,
    });

    expect(res.status).toBe(502);
    // queued へ戻さない（戻すと再confirmで二重起動する）
    expect(h.updateCalls.every((c) => !c.text.includes("SET status = 'queued'"))).toBe(true);
    // failed でも終端させない（実際に走ったジョブのcallbackが弾かれるため）
    expect(h.updateCalls.every((c) => !c.text.includes("SET status = 'failed'"))).toBe(true);
    const logs = await h.auditLog.readAll();
    expect(logs.some((l) => l.action === "coding_task_dispatch_outcome_unknown")).toBe(true);
    expect(logs.some((l) => l.action === "coding_task_dispatch_failed")).toBe(false);
  });

  it("dispatch失敗後もclaim条件を満たさないため再confirmでdispatchされない [DevOps:REQ-028]", async () => {
    const row = makeRowFor();
    const h = makeHarness({ row, dispatchError: new Error("boom") });

    await h.app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${h.token}`,
    });
    const dispatchesAfterFirst = h.dispatchCalls.length;
    await h.app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${h.token}`,
    });

    expect(row["status"]).toBe("running");
    expect(h.dispatchCalls.length).toBe(dispatchesAfterFirst);
  });

  it("dispatch例外の文字列は監査へ書く前にサニタイズする [DevOps:REQ-028]", async () => {
    const h = makeHarness({
      dispatchError: new Error("auth failed for ghp_0123456789abcdefghijklmnopqrstuvwxyzAB"),
    });

    await h.app.request(`/coding-tasks/${TASK_ID}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${h.token}`,
    });

    const logs = await h.auditLog.readAll();
    const entry = logs.find((l) => l.action === "coding_task_dispatch_outcome_unknown")!;
    const detail = entry.detail as { error: string };
    expect(detail.error).not.toContain("ghp_0123456789abcdefghijklmnopqrstuvwxyzAB");
    expect(detail.error).toContain("REDACTED");
  });
});
