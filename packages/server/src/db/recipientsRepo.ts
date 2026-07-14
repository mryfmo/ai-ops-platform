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
  language: "ja" | "en";
  active: boolean;
  teamsTeamId: string | null;
  teamsChannelId: string | null;
}

function toRecipient(row: Record<string, unknown>): DeliveryRecipient {
  return {
    userId: String(row.user_id),
    profile: String(row.profile),
    persona: row.persona ? String(row.persona) : null,
    email: String(row.email),
    projects: Array.isArray(row.projects) ? (row.projects as string[]) : [],
    language: row.language === "en" ? "en" : "ja",
    active: row.active === true,
    teamsTeamId: row.teams_team_id ? String(row.teams_team_id) : null,
    teamsChannelId: row.teams_channel_id ? String(row.teams_channel_id) : null,
  };
}

export class RecipientsRepo {
  constructor(private readonly db: PgQueryable) {}

  async listForDelivery(): Promise<DeliveryRecipient[]> {
    const res = await this.db.query(
      `SELECT user_id, profile, persona, email, projects, language, active, teams_team_id, teams_channel_id
       FROM recipients
       ORDER BY user_id`,
    );
    return res.rows.map(toRecipient);
  }
}
