/**
 * packages/server/src/http/routes/githubWebhook.ts
 *
 * 根拠:
 *   - DevOps:SPEC-INT-061 / REQ-025: GitHub webhook（push, pull_request, workflow_run, issues）受信。
 *     署名検証（X-Hub-Signature-256, HMAC-SHA256）はGitHub公式が必須とするセキュリティ対策であり、
 *     既存 verifyGithubWebhookSignature（タイミング攻撃対策済み）を再利用する。
 *   - ADR-0005: 検証済みイベントは events テーブルへ source='github' でエンキューして即202。
 *   - ADR-0006: workflow_run イベントは coding_tasks の status 追跡にも使われる（後段ディスパッチャ）。
 *
 * 重要: 署名検証は「生のリクエストボディ」に対して行う（JSON.parse→再stringifyでは署名不一致になる）。
 */
import { createHash } from "node:crypto";
import type { Hono } from "hono";
import { sanitizeSecrets, verifyGithubWebhookSignature, type AuditLogWriter } from "@aiops/shared";

export interface GithubWebhookDeps {
  webhookSecret: string;
  auditLog: AuditLogWriter;
  enqueueGithubEvent(
    eventName: string,
    payload: unknown,
    traceId: string,
    options?: { dedupeKey?: string | null },
  ): Promise<boolean>;
  traceIdProvider(): string;
}

export function registerGithubWebhookRoutes(app: Hono, deps: GithubWebhookDeps): void {
  app.post("/webhooks/github", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256") ?? null;

    if (!verifyGithubWebhookSignature(rawBody, signature, deps.webhookSecret)) {
      const traceId = deps.traceIdProvider();
      const event = c.req.header("x-github-event");
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "github_webhook_rejected",
        basis: "DevOps:SPEC-INT-061",
        detail: {
          reason: "signature verification failed",
          event: event === undefined ? null : sanitizeSecrets(event).sanitized,
        },
        at: new Date().toISOString(),
      });
      return c.json({ error: "invalid signature" }, 401);
    }

    const eventName = c.req.header("x-github-event") ?? "unknown";
    const safeEventName = sanitizeSecrets(eventName).sanitized;
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }

    const traceId = deps.traceIdProvider();
    const deliveryId = c.req.header("x-github-delivery")?.trim() ?? "";
    if (!deliveryId) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "github_webhook_missing_delivery_id",
        basis: "DevOps:SPEC-INT-061",
        detail: { event: safeEventName },
        at: new Date().toISOString(),
      });
      return c.json({ error: "missing delivery id" }, 400);
    }
    // 重複判定は**署名対象であるボディ**から導く。HMAC はボディだけを署名し、
    // `X-GitHub-Delivery` は署名の外にあるヘッダなので、署名済みペイロードを観測できた
    // 攻撃者は delivery id を差し替えるだけで dedupe を通過し、同一イベントを何度でも
    // 再エンキューできた（所見 ADV-INT-006）。攻撃者が変更できない値で判定する。
    //
    // delivery id は監査のために引き続き記録する（GitHub 側との突合に要る）が、
    // 一意性の根拠には使わない。GitHub 自身による正当な再送も同じボディなので、
    // 意図どおり重複として弾かれる。
    // キーは**署名対象であるボディだけ**から導く。`X-GitHub-Event` も `X-GitHub-Delivery` と
    // 同じく署名の外にあるヘッダなので、鍵に混ぜると攻撃者がイベント名を変えるだけでキーを
    // 変えられ、同じ署名済みボディを何度でも挿入できてしまう（`dispatchGithubWebhookEvent`
    // が未知のイベント名を捨てるのはキュー投入の後である）。
    const payloadDigest = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const inserted = await deps.enqueueGithubEvent(eventName, payload, traceId, {
      dedupeKey: `github:${payloadDigest}`,
    });
    if (!inserted) {
      const safeDeliveryId = sanitizeSecrets(deliveryId).sanitized;
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "github_webhook_duplicate",
        basis: "DevOps:SPEC-INT-061",
        // deliveryId は突合用に残す。一意性の根拠は payloadDigest 側にある。
        detail: { event: safeEventName, deliveryId: safeDeliveryId, payloadDigest },
        at: new Date().toISOString(),
      });
    }
    return c.body(null, 202);
  });
}
