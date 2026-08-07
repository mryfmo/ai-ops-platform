/**
 * packages/server/src/http/routes/codingTasks.ts
 *
 * 根拠: ADR-0006（コーディングタスク指示フロー）。
 *   1. GET  /coding-tasks/:taskId/confirm  — 確認画面表示（トークン検証のみ、副作用なし）
 *   2. POST /coding-tasks/:taskId/confirm  — 人間の明示クリックによりworkflow_dispatchを起動する
 *      （「誤発火防止のため人間の明示クリック必須」ADR-0006決定3の核心。ここでのみdispatchWorkflowを呼ぶ）
 *   3. POST /internal/coding-tasks/:taskId/callback — GitHub Actions（coding-task.yml）からの
 *      完了通知受信（Bearer CODING_TASK_CALLBACK_SECRET保護）。runbooks/coding-task-failure.md の
 *      状態機械（queued → running → pr_created | failed | cancelled）に整合させる。
 *
 * セキュリティ: 確認トークンはconfirmToken.ts（HMAC-SHA256 + timingSafeEqual）で検証する。
 *   instructionは外部（Teams/WebUI）由来の未検証文字列のため、HTML出力前に必ずescapeHtmlを通す
 *   （CLAUDE.md多層防御(c): ログ・PRコメント出力前のサニタイズに相当する出力エスケープ）。
 */
import type { Hono } from "hono";
import type { AuditLogWriter } from "@aiops/shared";
import { sanitizeSecrets } from "@aiops/shared";
import { verifyConfirmToken, verifyBearerToken } from "../../lib/confirmToken.js";
import type { CodingTasksRepo, CodingTaskStatus } from "../../db/codingTasksRepo.js";

export interface CodingTaskGithubClient {
  dispatchWorkflow(input: {
    owner: string;
    repo: string;
    workflowIdOrFileName: string;
    ref: string;
    inputs: Record<string, string>;
  }): Promise<void>;
}

export interface CodingTaskRepoScope {
  githubOwner: string;
  githubRepo: string;
}

export interface CodingTaskRoutesDeps {
  codingTasksRepo: CodingTasksRepo;
  githubClient: CodingTaskGithubClient;
  auditLog: AuditLogWriter;
  confirmTokenSecret: string;
  callbackSecret: string;
  /** taskIdのprojectIdから対象GitHubリポジトリを解決する（未登録ならnull） */
  resolveRepoForProject(projectId: string): Promise<CodingTaskRepoScope | null>;
  traceIdProvider(): string;
  isFailsafeActive?: () => boolean;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>コーディングタスク確認</title></head>
<body><h1>エラー</h1><p>${escapeHtml(message)}</p></body></html>`;
}

function statusPage(title: string, message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body></html>`;
}

function confirmFormPage(taskId: string, token: string, projectId: string, instruction: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>コーディングタスク確認</title></head>
<body>
<h1>コーディングタスクの確認</h1>
<p>対象プロジェクト: ${escapeHtml(projectId)}</p>
<p>指示内容:</p>
<pre>${escapeHtml(instruction)}</pre>
<p>この内容でGitHub Actionsを起動し、AIコーディングエージェントによる修正PR作成を開始します。
マージには人間レビュアーの承認が別途必要です（CODEOWNERS）。</p>
<form method="POST" action="/coding-tasks/${encodeURIComponent(taskId)}/confirm">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <input type="hidden" name="taskId" value="${escapeHtml(taskId)}" />
  <button type="submit">実行する</button>
</form>
</body></html>`;
}

/** application/x-www-form-urlencoded 本文を最小限パースする（Hono標準のc.req.parseBody相当を明示実装） */
async function parseFormBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v)]));
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function registerCodingTaskRoutes(app: Hono, deps: CodingTaskRoutesDeps): void {
  app.get("/coding-tasks/:taskId/confirm", async (c) => {
    const taskId = c.req.param("taskId");
    const token = c.req.query("token") ?? "";

    // 期限導入前に発行された旧形式トークンは発行時刻を持たないため、タスクの作成時刻を
    // 代替の発行時刻として渡す。移行期間中も旧リンクが無期限に有効にならないようにする。
    // 応答順序は変えない（トークン不正は行の存在有無より先に 403 を返す）。
    const task = await deps.codingTasksRepo.findById(taskId);
    const issuedAtFallbackMs = task ? Date.parse(task.createdAt) : undefined;
    if (!verifyConfirmToken(taskId, token, deps.confirmTokenSecret, { issuedAtFallbackMs })) {
      return c.html(errorPage("確認リンクが無効です。トークンが一致しません。"), 403);
    }

    if (!task) {
      return c.html(errorPage("指定されたコーディングタスクが見つかりません。"), 404);
    }

    if (task.confirmedAt !== null || task.status !== "queued") {
      return c.html(
        statusPage(
          "確認済みまたは処理中です",
          `現在のステータス: ${task.status}${task.confirmedAt ? "（確認済み）" : ""}`,
        ),
        200,
      );
    }

    return c.html(confirmFormPage(taskId, token, task.projectId, task.instruction), 200);
  });

  app.post("/coding-tasks/:taskId/confirm", async (c) => {
    const taskId = c.req.param("taskId");
    const body = await parseFormBody(c.req.raw);
    const token = body.token ?? "";

    // 期限導入前に発行された旧形式トークンは発行時刻を持たないため、タスクの作成時刻を
    // 代替の発行時刻として渡す。移行期間中も旧リンクが無期限に有効にならないようにする。
    // 応答順序は変えない（トークン不正は行の存在有無より先に 403 を返す）。
    const task = await deps.codingTasksRepo.findById(taskId);
    const issuedAtFallbackMs = task ? Date.parse(task.createdAt) : undefined;
    if (!verifyConfirmToken(taskId, token, deps.confirmTokenSecret, { issuedAtFallbackMs })) {
      return c.html(errorPage("確認リンクが無効です。トークンが一致しません。"), 403);
    }

    if (!task) {
      return c.html(errorPage("指定されたコーディングタスクが見つかりません。"), 404);
    }

    if (task.confirmedAt !== null || task.status !== "queued") {
      return c.html(
        statusPage(
          "確認済みまたは処理中です",
          `現在のステータス: ${task.status}${task.confirmedAt ? "（確認済み）" : ""}`,
        ),
        200,
      );
    }

    const repoScope = await deps.resolveRepoForProject(task.projectId);
    if (!repoScope) {
      return c.html(errorPage("このプロジェクトにはGitHubリポジトリが未登録です。"), 409);
    }

    const traceId = deps.traceIdProvider();

    if (deps.isFailsafeActive?.()) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "coding_task_blocked_by_failsafe",
        basis: "REQ-029",
        detail: { taskId, projectId: task.projectId },
        at: new Date().toISOString(),
      });
      return c.html(errorPage("フェイルセーフ中のためコーディングタスク実行を停止しています。"), 503);
    }

    // dispatch より前にDB側で原子的に確保する。上の status 判定と dispatch の間には
    // 隙があり、同一トークンの並行 confirm が両方通過して二重 dispatch し得るため
    // （coding-task.yml の concurrency はキャンセルせずキューするので2本目も走る）。
    const claimed = await deps.codingTasksRepo.claimForDispatch(taskId);
    if (!claimed) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "coding_task_confirm_already_claimed",
        basis: "ADR-0006",
        detail: { taskId, projectId: task.projectId },
        at: new Date().toISOString(),
      });
      return c.html(statusPage("確認済みまたは処理中です", "このタスクは既に実行を開始しています。"), 200);
    }

    // 人間の明示クリックが成立した瞬間にのみworkflow_dispatchを呼ぶ（ADR-0006「誤発火防止」の核心）
    try {
      await deps.githubClient.dispatchWorkflow({
        owner: repoScope.githubOwner,
        repo: repoScope.githubRepo,
        workflowIdOrFileName: "coding-task.yml",
        ref: "main",
        inputs: {
          task_id: taskId,
          project_id: task.projectId,
          instruction: task.instruction,
          base_ref: "main",
          agent: task.agent,
        },
      });
    } catch (error) {
      // 状態を動かさず running のまま残す。失敗応答からは dispatch が GitHub に届いたか
      // 判別できず、queued へ戻せば二重起動を許し、failed で終端させれば実際に走って PR を
      // 作ったジョブの callback が `WHERE status = 'running'` に弾かれて台帳が現実と食い違う。
      // running なら confirm の再確保（status='queued' が条件）は依然として通らないので
      // 二重起動は防げるうえ、実際に run が出たかどうかは reaper が観測して安全に終端できる。
      // 訂正できない追記専用ログ（原則5）へ「失敗した」と断定する記録も残さない。
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "coding_task_dispatch_outcome_unknown",
        basis: "ADR-0006",
        // 例外文字列は注入されたGitHubクライアント/TokenProvider由来で、資格情報を含み得る。
        // 監査ログは追記専用で訂正できないため、書く前にサニタイズする（CLAUDE.md原則4(c)）。
        detail: {
          taskId,
          projectId: task.projectId,
          error: sanitizeSecrets(String(error)).sanitized,
          resolution: "left running for the coding-task reaper to resolve from observed workflow runs",
        },
        at: new Date().toISOString(),
      });
      return c.html(
        errorPage("コーディングタスクの起動に失敗しました。再実行が必要な場合は新しいタスクを作成してください。"),
        502,
      );
    }

    await deps.auditLog.append({
      trace_id: task.traceId,
      actor: "SERVER",
      action: "coding_task_confirmed_dispatched",
      basis: "ADR-0006",
      detail: { taskId, projectId: task.projectId, requestId: traceId },
      at: new Date().toISOString(),
    });

    return c.html(
      statusPage("実行を開始しました", "コーディングタスクの実行を開始しました。完了するとPRリンクが返信されます。"),
      200,
    );
  });

  app.post("/internal/coding-tasks/:taskId/callback", async (c) => {
    const authHeader = c.req.header("authorization") ?? "";
    // security-reviewer指摘(高): 平文の`!==`比較はタイミング攻撃に非耐性。他の認証比較
    // （verifyConfirmToken/verifyGithubWebhookSignature）と同様にtimingSafeEqualへ統一する。
    if (!verifyBearerToken(authHeader, deps.callbackSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const taskId = c.req.param("taskId");
    let payload: {
      status?: string;
      prUrl?: string;
      branch?: string;
      workflowRunId?: number;
    };
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    if (payload.status !== "pr_created" && payload.status !== "failed" && payload.status !== "cancelled") {
      return c.json({ error: "invalid status" }, 400);
    }

    const task = await deps.codingTasksRepo.findById(taskId);
    if (!task) {
      return c.json({ error: "task not found" }, 404);
    }

    const traceId = deps.traceIdProvider();

    // security-reviewer指摘(高): callbackはtaskId+Bearerシークレットのみで認可され、発行元
    // （実際にdispatchされたworkflow run）との相関確認・状態遷移ガードが無く、シークレット漏洩時や
    // 多重送信時に任意のタスク状態を何度でも上書きできた。'running'からの遷移のみ許可することで、
    // 未確認(queued)タスクへの偽装完了報告・確定後タスクへの多重上書きを拒否する。
    if (task.status !== "running") {
      await deps.auditLog.append({
        trace_id: task.traceId,
        actor: "SERVER",
        action: "coding_task_callback_rejected_invalid_transition",
        basis: "ADR-0006",
        detail: { taskId, currentStatus: task.status, attemptedStatus: payload.status, requestId: traceId },
        at: new Date().toISOString(),
      });
      return c.json({ error: "invalid state transition", currentStatus: task.status }, 409);
    }

    const status = payload.status as Extract<CodingTaskStatus, "pr_created" | "failed" | "cancelled">;
    const { updated } = await deps.codingTasksRepo.updateFromCallback(taskId, {
      status,
      prUrl: payload.prUrl ?? null,
      branch: payload.branch ?? null,
      workflowRunId: payload.workflowRunId ?? null,
    });

    if (!updated) {
      // 事前チェック後の競合（多重callback等）でDB側ガードが弾いた場合。上のfindByIdチェックと
      // あわせた多層防御が実際に機能した証跡として監査ログに残す。
      await deps.auditLog.append({
        trace_id: task.traceId,
        actor: "SERVER",
        action: "coding_task_callback_rejected_invalid_transition",
        basis: "ADR-0006",
        detail: { taskId, currentStatus: task.status, attemptedStatus: status, requestId: traceId, race: true },
        at: new Date().toISOString(),
      });
      return c.json({ error: "invalid state transition" }, 409);
    }

    await deps.auditLog.append({
      trace_id: task.traceId,
      actor: "SERVER",
      action: "coding_task_callback_received",
      basis: "ADR-0006",
      detail: { taskId, status, prUrl: payload.prUrl ?? null, requestId: traceId },
      at: new Date().toISOString(),
    });

    return c.json({ ok: true }, 200);
  });
}
