/**
 * packages/server/src/scheduler/tasks/pmSnapshotReconcileTask.ts
 *
 * 根拠: ADR-0007 / DevOps REQ-031 / SPEC-INT-081 / AC-031a.
 * Projects v2 webhookの取りこぼしを前提に、GraphQL current snapshotを定期保存する。
 */
import type { AuditLogWriter } from "@aiops/shared";
import type { PmSnapshotRecordInput, PmTimeseriesRepo } from "../../db/pmTimeseriesRepo.js";
import type { ScheduledTask } from "../scheduler.js";

export interface GithubProjectSnapshotPage {
  rateLimit: { remaining: number; cost?: number; resetAt?: string };
  snapshots: Omit<PmSnapshotRecordInput, "traceId" | "capturedAt">[];
  hasMore?: boolean;
}

export interface GithubProjectSnapshotClient {
  listCurrentSnapshots(cursor?: string | null): Promise<GithubProjectSnapshotPage & { nextCursor?: string | null }>;
}

export interface PmSnapshotReconcileTaskDeps {
  repo: PmTimeseriesRepo;
  client: GithubProjectSnapshotClient;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
  intervalMs?: number;
  minRateLimitRemaining?: number;
}

export function createPmSnapshotReconcileTask(deps: PmSnapshotReconcileTaskDeps): ScheduledTask {
  const intervalMs = deps.intervalMs ?? 6 * 60 * 60 * 1000;
  const minRemaining = deps.minRateLimitRemaining ?? 100;

  return {
    name: "pm-snapshot-reconcile",
    intervalMs,
    async run(now: Date): Promise<void> {
      const traceId = deps.traceIdProvider();
      let cursor: string | null | undefined = null;
      let stored = 0;

      do {
        const page = await deps.client.listCurrentSnapshots(cursor);
        if (page.rateLimit.remaining < minRemaining) {
          await deps.auditLog.append({
            trace_id: traceId,
            actor: "SERVER",
            action: "pm_snapshot_reconcile_skipped",
            basis: "SPEC-INT-081",
            detail: { remaining: page.rateLimit.remaining, resetAt: page.rateLimit.resetAt ?? null, stored },
            at: now.toISOString(),
          });
          return;
        }

        for (const snapshot of page.snapshots) {
          await deps.repo.recordSnapshot({ ...snapshot, traceId, capturedAt: now.toISOString() });
          stored += 1;
        }
        cursor = page.hasMore ? (page.nextCursor ?? null) : null;
      } while (cursor);

      await deps.auditLog.append({
        trace_id: traceId,
        actor: "SERVER",
        action: "pm_snapshot_reconciled",
        basis: "SPEC-INT-081",
        detail: { stored },
        at: now.toISOString(),
      });
    },
  };
}
