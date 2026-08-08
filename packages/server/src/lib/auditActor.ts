/**
 * packages/server/src/lib/auditActor.ts
 *
 * 根拠: DevOps:SPEC-INT-010。監査ログへ平文保存するactor識別子をtrust boundaryで検証する。
 */
const AUDIT_ACTOR_RE = /^[A-Za-z0-9._@-]{1,64}$/;

export function normalizeAuditActor(actor: string): string {
  const normalized = actor.trim();
  if (!AUDIT_ACTOR_RE.test(normalized)) throw new Error("requires a valid actor identifier");
  return normalized;
}
