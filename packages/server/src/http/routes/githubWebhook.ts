/**
 * packages/server/src/http/routes/githubWebhook.ts
 *
 * 根拠:
 *   - DevOps SPEC-INT-061 / REQ-025: GitHub webhook（push, pull_request, workflow_run, issues）受信。
 *     署名検証（X-Hub-Signature-256, HMAC-SHA256）はGitHub公式が必須とするセキュリティ対策であり、
 *     既存 verifyGithubWebhookSignature（タイミング攻撃対策済み）を再利用する。
 *   - ADR-0005: 検証済みイベントは events テーブルへ source='github' でエンキューして即202。
 *   - ADR-0006: workflow_run イベントは coding_tasks の status 追跡にも使われる（後段ディスパッチャ）。
 *
 * 重要: 署名検証は「生のリクエストボディ」に対して行う（JSON.parse→再stringifyでは署名不一致になる）。
 */
import type { Hono } from "hono";
import { verifyGithubWebhookSignature, type AuditLogWriter } from "@aiops/shared";

export interface GithubWebhookDeps {
  webhookSecret: string;
  auditLog: AuditLogWriter;
  enqueueGithubEvent(eventName: string, payload: unknown, traceId: string): Promise<void>;
  traceIdProvider(): string;
}

export function registerGithubWebhookRoutes(app: Hono, deps: GithubWebhookDeps): void {
  app.post("/webhooks/github", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256") ?? null;

    if (!verifyGithubWebhookSignature(rawBody, signature, deps.webhookSecret)) {
      const traceId = deps.traceIdProvider();
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "github_webhook_rejected",
        basis: "SPEC-INT-061",
        detail: { reason: "signature verification failed", event: c.req.header("x-github-event") ?? null },
        at: new Date().toISOString(),
      });
      return c.json({ error: "invalid signature" }, 401);
    }

    const eventName = c.req.header("x-github-event") ?? "unknown";
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    const traceId = deps.traceIdProvider();
    await deps.enqueueGithubEvent(eventName, payload, traceId);
    return c.body(null, 202);
  });
}
