/**
 * packages/server/src/scheduler/tasks/sevenKeysMonthlySnapshotTask.ts
 *
 * 根拠: ADR-0010 / REQ-038 / SPEC-INT-065 / AC-038-1。
 * Seven Keys月次PDCA snapshotを第1営業日に保存する。
 */
import { buildSevenKeysMonthlySnapshot, type ExecutiveProjectInput, type SevenKeyId } from "@aiops/prjops";
import { isNthBusinessDayOfMonth, todayJstDateString, type AuditLogWriter, type HolidayCalendar } from "@aiops/shared";
import {
  toExecutiveSevenKeys,
  type SevenKeysSnapshotRecord,
  type SevenKeysSnapshotsRepo,
} from "../../db/sevenKeysSnapshotsRepo.js";
import type { ScheduledTask } from "../scheduler.js";

export interface SevenKeysMonthlySnapshotProvider {
  listExecutiveProjects(): Promise<ExecutiveProjectInput[]>;
}

export interface SevenKeysMonthlySnapshotTaskDeps {
  repo: Pick<SevenKeysSnapshotsRepo, "findByProjectMonth" | "findLatestBefore" | "insert">;
  provider: SevenKeysMonthlySnapshotProvider;
  auditLog: AuditLogWriter;
  calendar: HolidayCalendar;
  traceIdProvider(): string;
  intervalMs?: number;
}

function nextActions(worsenedKeys: SevenKeyId[]): string[] {
  return worsenedKeys.map((key) => `${key}の悪化要因を確認し、次回PDCAまでの是正アクションを設定する`);
}

export function createSevenKeysMonthlySnapshotTask(deps: SevenKeysMonthlySnapshotTaskDeps): ScheduledTask {
  return {
    name: "seven-keys-monthly-snapshot",
    intervalMs: deps.intervalMs ?? 24 * 60 * 60 * 1000,
    async run(now: Date): Promise<void> {
      const today = todayJstDateString(now);
      if (!isNthBusinessDayOfMonth(deps.calendar, today, 1)) return;

      const month = today.slice(0, 7);
      const generatedAt = now.toISOString();
      const traceId = deps.traceIdProvider();
      let created = 0;
      let skipped = 0;

      for (const project of await deps.provider.listExecutiveProjects()) {
        if (await deps.repo.findByProjectMonth(project.projectId, month)) {
          skipped += 1;
          continue;
        }

        const previous: SevenKeysSnapshotRecord | null = await deps.repo.findLatestBefore(project.projectId, month);
        const snapshot = buildSevenKeysMonthlySnapshot(
          project,
          month,
          previous ? toExecutiveSevenKeys(previous) : undefined,
        );
        if (await deps.repo.insert(snapshot, generatedAt, nextActions(snapshot.worsenedKeys))) created += 1;
      }

      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-RPT",
        action: skipped > 0 ? "seven_keys_monthly_snapshot_skipped" : "seven_keys_monthly_snapshot_created",
        basis: "AC-038-1",
        detail: { month, created, skipped },
        at: generatedAt,
      });
    },
  };
}
