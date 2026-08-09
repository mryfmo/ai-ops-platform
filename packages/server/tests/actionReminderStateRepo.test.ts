/** 根拠: PrjOps:REQ-009 / PrjOps:SPEC-INT-025 */
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionReminderStateRepo } from "../src/db/actionReminderStateRepo.js";

describe("ActionReminderStateRepo [PrjOps:REQ-009 / PrjOps:SPEC-INT-025]", () => {
  it("actionごとの通知状態を読み、未登録actionは返さない", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          action_id: "ACT-001",
          reminders_sent_count: 2,
          last_notified_at: new Date("2026-07-10T00:00:00Z"),
          escalated_at: null,
        },
      ],
    });
    const repo = new ActionReminderStateRepo({ query });
    await expect(repo.findMany(["ACT-001", "ACT-002"])).resolves.toEqual(
      new Map([
        [
          "ACT-001",
          {
            actionId: "ACT-001",
            remindersSentCount: 2,
            lastNotifiedAt: "2026-07-10T00:00:00.000Z",
            escalatedAt: null,
          },
        ],
      ]),
    );
  });

  it("reminder成功を最大3回までatomic upsertする", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new ActionReminderStateRepo({ query });
    await repo.recordOutcome("ACT-001", "reminded", "2026-07-10T00:00:00Z");
    expect(query.mock.calls[0]![0]).toContain(
      "LEAST(GREATEST(action_reminder_state.reminders_sent_count, $6) + $5, 3)",
    );
    expect(query.mock.calls[0]![1]).toEqual(["ACT-001", 1, "2026-07-10T00:00:00Z", null, 1, 0]);
  });

  it("escalation成功時だけescalated_atを永続化する", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new ActionReminderStateRepo({ query });
    await repo.recordOutcome("ACT-001", "escalated", "2026-07-20T00:00:00Z");
    expect(query.mock.calls[0]![0]).toContain("escalated_at");
  });
});

const databaseUrl = process.env.TEST_DATABASE_URL;
const realPool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : undefined;

describe.skipIf(!databaseUrl)("ActionReminderStateRepo real PostgreSQL [PrjOps:REQ-009]", () => {
  beforeAll(async () => {
    const migration = await readFile(
      new URL("../../devops/src/db/migrations/202608090000_action_reminder_state.sql", import.meta.url),
      "utf8",
    );
    await realPool!.query(migration);
  });

  beforeEach(async () => {
    await realPool!.query("TRUNCATE action_reminder_state");
  });

  afterAll(async () => {
    await realPool?.end();
  });

  it("snapshot baselineを取り込み並行成功をatomicに3回でcapする", async () => {
    const repo = new ActionReminderStateRepo(realPool!);
    await repo.recordOutcome("ACT-001", "reminded", "2026-08-09T00:00:00Z", 2);
    await Promise.all([
      repo.recordOutcome("ACT-002", "reminded", "2026-08-09T00:00:00Z"),
      repo.recordOutcome("ACT-002", "reminded", "2026-08-09T00:01:00Z"),
      repo.recordOutcome("ACT-002", "reminded", "2026-08-09T00:02:00Z"),
      repo.recordOutcome("ACT-002", "reminded", "2026-08-09T00:03:00Z"),
    ]);

    await expect(repo.findMany(["ACT-001", "ACT-002"])).resolves.toEqual(
      new Map([
        [
          "ACT-001",
          {
            actionId: "ACT-001",
            remindersSentCount: 3,
            lastNotifiedAt: "2026-08-09T00:00:00.000Z",
            escalatedAt: null,
          },
        ],
        [
          "ACT-002",
          {
            actionId: "ACT-002",
            remindersSentCount: 3,
            lastNotifiedAt: expect.any(String),
            escalatedAt: null,
          },
        ],
      ]),
    );
  });
});
