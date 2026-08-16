// 根拠: PrjOps:REQ-004/005/020 / PrjOps:SPEC-INT-030 / FinalArch:ING-001
import { describe, expect, it } from "vitest";

import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import { createStatusIngestActivities, type StatusIngestStore } from "../src/agents/statusIngestActivities.js";

describe("FinalArch:ING-001 status ingest activity wiring", () => {
  it("uses append-only AuditLogWriter records that can be reconciled by idempotency key", async () => {
    const effects = new Map<string, unknown>();
    const store: StatusIngestStore = {
      async readThread() {
        return { schemaVersion: 1, payload: { threadKey: "status-ingest:email:t-1", clarifyCount: 0 } };
      },
      async claim() {
        throw new Error("unused");
      },
      async findSideEffect(key) {
        return effects.get(key) ?? null;
      },
      async recordSideEffect(key, receipt) {
        effects.set(key, receipt);
      },
      async complete() {
        throw new Error("unused");
      },
    };
    const audit = new InMemoryAuditLog();
    const activities = createStatusIngestActivities({
      store,
      audit,
      canonical: async () => "SU-1",
      notify: async () => "notification-1",
      now: () => "2026-08-16T15:00:00+09:00",
    });
    const input = {
      schemaVersion: 1 as const,
      payload: {
        sourceKey: "status-ingest:email:m-1",
        threadKey: "status-ingest:email:t-1",
        code: "E-ING-RECEIVED",
        action: "accept" as const,
        duplicate: false,
        clarifyCount: 0,
      },
    };
    const key = "report/status-ingest:email:m-1#appendStatusIngestAudit#0";
    const receipt = await activities.appendStatusIngestAudit(input, key);
    await expect(
      activities.findStatusIngestSideEffect({ schemaVersion: 1, payload: { sourceKey: input.payload.sourceKey } }, key),
    ).resolves.toEqual(receipt);
    await expect(audit.readAll()).resolves.toMatchObject([
      {
        trace_id: input.payload.sourceKey,
        actor: "AGT-02",
        action: "E-ING-RECEIVED",
        basis: "FinalArch:ING-001",
        detail: { idempotencyKey: key, threadKey: input.payload.threadKey, action: "accept" },
      },
    ]);
  });
});
