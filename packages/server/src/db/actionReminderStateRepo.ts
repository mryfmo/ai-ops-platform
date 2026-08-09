/**
 * packages/server/src/db/actionReminderStateRepo.ts
 *
 * 根拠: PrjOps:REQ-009 / PrjOps:SPEC-INT-025。pinned YAML masterはread-onlyのまま、
 * resident runtimeが成功済み通知を再送しないためのoperational stateをPostgreSQLに保持する。
 */
import type { PgQueryable } from "@aiops/shared";

export interface ActionReminderState {
  actionId: string;
  remindersSentCount: number;
  lastNotifiedAt: string | null;
  escalatedAt: string | null;
}

export type ReminderOutcome = "pre_due" | "reminded" | "escalated";

const iso = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : typeof value === "string" ? new Date(value).toISOString() : null;

export class ActionReminderStateRepo {
  constructor(private readonly db: PgQueryable) {}

  async findMany(actionIds: string[]): Promise<Map<string, ActionReminderState>> {
    if (actionIds.length === 0) return new Map();
    const result = await this.db.query(
      `SELECT action_id, reminders_sent_count, last_notified_at, escalated_at
         FROM action_reminder_state
        WHERE action_id = ANY($1::text[])`,
      [actionIds],
    );
    return new Map(
      result.rows.map((row) => [
        String(row.action_id),
        {
          actionId: String(row.action_id),
          remindersSentCount: Number(row.reminders_sent_count),
          lastNotifiedAt: iso(row.last_notified_at),
          escalatedAt: iso(row.escalated_at),
        },
      ]),
    );
  }

  async recordOutcome(
    actionId: string,
    outcome: ReminderOutcome,
    notifiedAt: string,
    baselineCount = 0,
  ): Promise<void> {
    const reminderIncrement = outcome === "reminded" ? 1 : 0;
    const escalatedAt = outcome === "escalated" ? notifiedAt : null;
    await this.db.query(
      `INSERT INTO action_reminder_state (
         action_id, reminders_sent_count, last_notified_at, escalated_at
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (action_id) DO UPDATE SET
         reminders_sent_count = LEAST(GREATEST(action_reminder_state.reminders_sent_count, $6) + $5, 3),
         last_notified_at = EXCLUDED.last_notified_at,
         escalated_at = COALESCE(action_reminder_state.escalated_at, EXCLUDED.escalated_at)`,
      [
        actionId,
        Math.min(baselineCount + reminderIncrement, 3),
        notifiedAt,
        escalatedAt,
        reminderIncrement,
        baselineCount,
      ],
    );
  }
}
