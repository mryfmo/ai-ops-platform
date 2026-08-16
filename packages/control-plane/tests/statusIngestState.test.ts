/** 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001 / ADR-0020 */
import { describe, expect, it } from "vitest";

import { checkCompleteness, decideClarificationAction } from "@aiops/shared/reporting/statusIngestContract.js";
import type { NormalizedStatusIngestEvent } from "@aiops/shared/reporting/statusIngestChannels.js";
import {
  assertStatusIngestRequest,
  buildStatusIngestSourceKey,
  buildStatusIngestThreadKey,
  buildStatusIngestWorkflowId,
  deriveStatusIngestDecision,
  parseStatusIngestClaimReceipt,
} from "../src/lib/statusIngestState.js";

const complete = {
  progress_pct: 62,
  self_status: "yellow" as const,
  achievements: "設計完了",
  plans: "実装着手",
  issues: "なし",
  risks: "なし",
};

const event: NormalizedStatusIngestEvent = {
  channel: "teams",
  sourceMessageId: "message-001",
  threadId: "thread-001",
  receivedAt: "2026-08-16T06:00:00Z",
  reporterId: "ST-010",
  projectId: "PJ-101",
  subject: null,
  body: "PJ-101 weekly",
  update: complete,
};

describe("FinalArch:ING-001 status ingest workflow contract parity", () => {
  it("derives exactly the preserved accept/clarify/escalate decisions", () => {
    for (const [candidate, count] of [
      [complete, 0],
      [{ ...complete, risks: "" }, 0],
      [{ ...complete, risks: "" }, 3],
    ] as const) {
      const completeness = checkCompleteness(candidate);
      expect(deriveStatusIngestDecision(candidate, count).action).toBe(
        decideClarificationAction(completeness, { clarifyCount: count }).action,
      );
    }
  });

  it("builds deterministic source/thread/workflow identities", () => {
    expect(buildStatusIngestSourceKey(event)).toBe("status-ingest:teams:message-001");
    expect(buildStatusIngestThreadKey(event)).toBe("status-ingest:teams:thread-001");
    expect(buildStatusIngestWorkflowId(event)).toBe("report/status-ingest:teams:message-001");
  });

  it("validates the whole Temporal envelope before field access", () => {
    expect(() =>
      assertStatusIngestRequest({ schemaVersion: 1, payload: { executionMode: "active", event } }),
    ).not.toThrow();
    for (const input of [
      null,
      { schemaVersion: 2, payload: { executionMode: "active", event } },
      { schemaVersion: 1, payload: { executionMode: "live", event } },
      { schemaVersion: 1, payload: { executionMode: "active", event: { ...event, channel: "slack" } } },
      { schemaVersion: 1, payload: { executionMode: "active", event: { ...event, extra: true } } },
      { schemaVersion: 1, payload: { executionMode: "active", event: { ...event, projectId: null } } },
      {
        schemaVersion: 1,
        payload: { executionMode: "active", event: { ...event, body: "api_key=super-secret-value-1234567890" } },
      },
    ]) {
      expect(() => assertStatusIngestRequest(input)).toThrow(RangeError);
    }
  });

  it("rejects claim receipts that drift from the preserved count/action contract", () => {
    const identity = { sourceKey: buildStatusIngestSourceKey(event), threadKey: buildStatusIngestThreadKey(event) };
    expect(
      parseStatusIngestClaimReceipt(
        {
          schemaVersion: 1,
          payload: {
            ...identity,
            duplicate: false,
            priorClarifyCount: 2,
            clarifyCount: 3,
            action: "clarify",
            state: "pending",
            revision: 1,
          },
        },
        event,
        checkCompleteness({ ...complete, risks: "" }),
      ),
    ).toMatchObject({ action: "clarify", clarifyCount: 3 });
    expect(() =>
      parseStatusIngestClaimReceipt(
        {
          schemaVersion: 1,
          payload: {
            ...identity,
            duplicate: false,
            priorClarifyCount: 3,
            clarifyCount: 3,
            action: "accept",
            state: "pending",
            revision: 1,
          },
        },
        event,
        checkCompleteness({ ...complete, risks: "" }),
      ),
    ).toThrow(RangeError);
  });
});
