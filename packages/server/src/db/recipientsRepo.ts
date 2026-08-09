/**
 * packages/server/src/db/recipientsRepo.ts
 *
 * 根拠: ADR-0014 / PrjOps:REQ-042 / SPEC-INT-069 / PrjOps:AC-042-1。
 * 配信名簿はDBを正本とし、配信リクエストごとにactive状態を読み直す。
 */
import type { PgQueryable } from "@aiops/shared";

export interface DeliveryRecipient {
  userId: string;
  profile: string;
  persona: string | null;
  email: string;
  projects: string[];
  scopeMode: "project" | "global";
  language: "ja" | "en";
  active: boolean;
  teamsTeamId: string | null;
  teamsChannelId: string | null;
}

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function toRecipient(row: Record<string, unknown>): DeliveryRecipient | null {
  const projects = Array.isArray(row.projects) ? (row.projects as string[]) : [];
  const scopeMode = row.scope_mode;
  if (
    (scopeMode !== "project" && scopeMode !== "global") ||
    (scopeMode === "project" && projects.length === 0) ||
    (scopeMode === "global" && projects.length !== 0)
  ) {
    return null;
  }
  return {
    userId: String(row.user_id),
    profile: String(row.profile),
    persona: row.persona ? String(row.persona) : null,
    email: String(row.email),
    projects,
    scopeMode,
    language: row.language === "en" ? "en" : "ja",
    active: row.active === true,
    teamsTeamId: row.teams_team_id ? String(row.teams_team_id) : null,
    teamsChannelId: row.teams_channel_id ? String(row.teams_channel_id) : null,
  };
}

export class RecipientsRepo {
  constructor(
    private readonly db: PgQueryable,
    private readonly configuredTenantId?: string,
  ) {}

  async findActiveBySubject(tenantId: string, objectId: string): Promise<DeliveryRecipient | null> {
    if (
      !this.configuredTenantId ||
      tenantId !== this.configuredTenantId ||
      !canonicalUuid.test(this.configuredTenantId) ||
      !canonicalUuid.test(objectId)
    ) {
      return null;
    }
    return this.findActiveByTrustedSubject(tenantId, objectId);
  }

  /** DevOps:REQ-010: HMAC envelope検証後のsubjectをrequest-time active assignmentへ解決する。 */
  async findActiveByTrustedSubject(tenantId: string, objectId: string): Promise<DeliveryRecipient | null> {
    if (!canonicalUuid.test(tenantId) || !canonicalUuid.test(objectId)) return null;
    const res = await this.db.query(
      `SELECT user_id, profile, persona, email, projects, scope_mode, language, active, teams_team_id, teams_channel_id
       FROM recipients
       WHERE entra_tenant_id = $1::uuid
         AND entra_object_id = $2::uuid
         AND active = true
         AND backfill_state = 'applied'
       LIMIT 1`,
      [tenantId, objectId],
    );
    return res.rows[0] ? toRecipient(res.rows[0]) : null;
  }

  /** DevOps:REQ-010 / DEC-SPEC-002: change承認scopeをstable subjectからrequest-timeにDB判定する。 */
  async canDecideChangeByTrustedSubject(
    tenantId: string,
    objectId: string,
    projectId: string | null,
  ): Promise<boolean> {
    if (!canonicalUuid.test(tenantId) || !canonicalUuid.test(objectId)) return false;
    const res = await this.db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM recipients
         WHERE entra_tenant_id = $1::uuid
           AND entra_object_id = $2::uuid
           AND active = true
           AND backfill_state = 'applied'
           AND (
             profile = 'PRF-G'
             OR (
               profile = 'PRF-L'
               AND scope_mode = 'project'
               AND $3::text IS NOT NULL
               AND $3::text = ANY(projects)
             )
           )
       ) AS allowed`,
      [tenantId, objectId, projectId],
    );
    return res.rows[0]?.allowed === true;
  }

  async listForDelivery(): Promise<DeliveryRecipient[]> {
    const res = await this.db.query(
      `SELECT user_id, profile, persona, email, projects, scope_mode, language, active, teams_team_id, teams_channel_id
       FROM recipients
       WHERE active = true
         AND backfill_state = 'applied'
       ORDER BY user_id`,
    );
    return res.rows.map((row) => {
      const recipient = toRecipient(row);
      if (!recipient) throw new Error("E-DLV03: invalid recipient authorization scope");
      return recipient;
    });
  }
}
