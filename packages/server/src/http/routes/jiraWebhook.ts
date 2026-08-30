// 根拠: ADR-0030 / 添付TEXT「Jira・GitHub・ai-ops-platform構成」
// Jira webhookは認証器未設定を含めfail-closed。認証後、本文を最小metadataへ正規化してqueueへ渡す。
import { createHash, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import type { AuditLogWriter } from "@aiops/shared";
import {
  jiraProjectIdFromWebhook,
  normalizeJiraWebhookEvent,
  type JiraProjectMapping,
  type QueuedJiraWebhookEvent,
} from "../../lib/jiraEventRouter.js";

export interface JiraWebhookAuthenticationInput {
  readonly rawBody: string;
  readonly authorization: string | null;
  readonly headers: Readonly<Record<string, string | null>>;
}

export interface JiraWebhookAuthenticator {
  readonly configured: boolean;
  verify(input: JiraWebhookAuthenticationInput): boolean | Promise<boolean>;
}

export interface JiraWebhookDeps {
  authenticator: JiraWebhookAuthenticator;
  auditLog: AuditLogWriter;
  resolveProjectMapping(jiraProjectId: string): Promise<JiraProjectMapping | null>;
  enqueueJiraEvent(
    event: QueuedJiraWebhookEvent,
    traceId: string,
    options?: { dedupeKey?: string | null },
  ): Promise<boolean>;
  traceIdProvider(): string;
}

export function createBearerJiraWebhookAuthenticator(expectedToken: string): JiraWebhookAuthenticator {
  const token = expectedToken.trim();
  return {
    configured: token.length >= 16,
    verify(input): boolean {
      if (token.length < 16) return false;
      const prefix = "Bearer ";
      if (!input.authorization?.startsWith(prefix)) return false;
      const actual = Buffer.from(input.authorization.slice(prefix.length), "utf8");
      const expected = Buffer.from(token, "utf8");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}

export function registerJiraWebhookRoutes(app: Hono, deps?: JiraWebhookDeps): void {
  app.post("/webhooks/jira", async (c) => {
    if (!deps?.authenticator.configured) {
      return c.json({ error: "Jira webhook authentication is not configured" }, 503);
    }

    const rawBody = await c.req.text();
    const traceId = deps.traceIdProvider();
    const authenticated = await deps.authenticator.verify({
      rawBody,
      authorization: c.req.header("authorization") ?? null,
      headers: {
        contentType: c.req.header("content-type") ?? null,
        userAgent: c.req.header("user-agent") ?? null,
      },
    });
    if (!authenticated) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "jira_webhook_rejected",
        basis: "JIRA-GH-GOV-001",
        detail: { reason: "authentication verification failed" },
        at: new Date().toISOString(),
      });
      return c.json({ error: "unauthorized" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      return c.json({ error: "invalid JSON" }, 400);
    }
    const jiraProjectId = jiraProjectIdFromWebhook(payload);
    if (!jiraProjectId) return c.json({ error: "missing Jira project id" }, 422);
    const mapping = await deps.resolveProjectMapping(jiraProjectId);
    if (!mapping) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "jira_webhook_unmapped_project",
        basis: "JIRA-GH-GOV-001",
        detail: { jiraProjectId },
        at: new Date().toISOString(),
      });
      return c.json({ error: "unmapped Jira project" }, 403);
    }

    const payloadDigest = createHash("sha256").update(rawBody, "utf8").digest("hex");
    let event: QueuedJiraWebhookEvent;
    try {
      event = await normalizeJiraWebhookEvent(payload, mapping, payloadDigest);
    } catch (error) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "jira_webhook_contract_rejected",
        basis: "JIRA-GH-GOV-001",
        detail: { reason: error instanceof Error ? error.message : "invalid event", jiraProjectId },
        at: new Date().toISOString(),
      });
      return c.json({ error: "unsupported or invalid Jira event" }, 422);
    }

    // Only normalized metadata is enqueued. The raw body, Description, Summary and comment body are not persisted.
    const inserted = await deps.enqueueJiraEvent(event, traceId, { dedupeKey: `jira:${payloadDigest}` });
    if (!inserted) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "jira_webhook_duplicate",
        basis: "JIRA-GH-GOV-001",
        detail: { issueKey: event.issueKey, payloadDigest },
        at: new Date().toISOString(),
      });
    }
    return c.body(null, 202);
  });
}
