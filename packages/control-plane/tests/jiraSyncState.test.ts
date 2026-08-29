// 根拠: 添付TEXT「Jira・GitHub・ai-ops-platform構成」
import { describe, expect, it } from "vitest";

import {
  assertJiraIssueBaseline,
  assertJiraSyncRequest,
  parseJiraBaselineReceipt,
  parseJiraPromotionDraftReceipt,
  parseJiraPromotionEligibility,
  parseJiraPromotionLedgerStatus,
  parseJiraPromotionWriteResult,
  parseJiraSyncLedgerStatus,
  parseJiraSyncWriteReceipt,
  parseJiraTransitionAuthorization,
  parseJiraTransitionLedgerStatus,
  parseJiraTransitionReceipt,
  parseJiraTransitionWriteResult,
  sameJiraIssueBaseline,
  type JiraIssueBaseline,
  type JiraSyncIdentity,
} from "../src/index.js";

const APPROVAL_ID = "9c6d3a1f-18cb-4b40-8ccd-66224aa2ab52";
const IDENTITY: JiraSyncIdentity = { issueKey: "AICOE-123", projectId: "PJ-1001", mappingVersion: 3 };
const BASELINE: JiraIssueBaseline = {
  updated: "2026-08-28T12:00:00.000+09:00",
  statusId: "10021",
  fieldHash: "a".repeat(64),
};

function request(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    payload: {
      ...IDENTITY,
      executionMode: "active",
      origin: "jira-webhook",
      operations: ["event"],
      ...overrides,
    },
  };
}

describe("Jira sync contract", () => {
  it("accepts allowlisted origins and requires approval UUID for protected writes", () => {
    expect(() => assertJiraSyncRequest(request())).not.toThrow();
    expect(() =>
      assertJiraSyncRequest(request({ origin: "operator", operations: ["promotion"], approvalId: APPROVAL_ID })),
    ).not.toThrow();
    expect(() => assertJiraSyncRequest(request({ origin: "untrusted" }))).toThrow(/origin/);
    expect(() => assertJiraSyncRequest(request({ operations: ["promotion"] }))).toThrow(/UUID/);
    expect(() =>
      assertJiraSyncRequest(request({ operations: ["transition"], approvalId: APPROVAL_ID, targetStatusId: "10042" })),
    ).not.toThrow();
    expect(() => assertJiraSyncRequest(request({ operations: ["transition"], approvalId: APPROVAL_ID }))).toThrow(
      /targetStatusId/,
    );
  });

  it("requires a PJ-* project identity and unique operations", () => {
    expect(() => assertJiraSyncRequest(request({ projectId: "team-a" }))).toThrow(/PJ-/);
    expect(() => assertJiraSyncRequest(request({ operations: ["event", "event"] }))).toThrow(/unique/);
    expect(() => assertJiraSyncRequest(request({ operations: ["merge"] }))).toThrow(/unknown/);
  });

  it("uses updated + statusId + fieldHash as the complete stale baseline", () => {
    expect(() => assertJiraIssueBaseline(BASELINE)).not.toThrow();
    expect(sameJiraIssueBaseline(BASELINE, { ...BASELINE })).toBe(true);
    expect(sameJiraIssueBaseline(BASELINE, { ...BASELINE, statusId: "10022" })).toBe(false);
    expect(() => assertJiraIssueBaseline({ ...BASELINE, fieldHash: "not-a-hash" })).toThrow(/SHA-256/);
    expect(() => assertJiraIssueBaseline({ ...BASELINE, updated: "2026-08-28" })).toThrow(/timezone/);
  });

  it("accepts only draft:true promotion receipts pinned to approval and baseline", () => {
    const receipt = {
      schemaVersion: 1,
      payload: {
        ...IDENTITY,
        operation: "promotion",
        result: "created",
        idempotencyKey: "jira-sync/AICOE-123:PJ-1001:3:promotion#activity#0",
        approvalId: APPROVAL_ID,
        baseline: BASELINE,
        draft: true,
      },
    };
    expect(
      parseJiraPromotionDraftReceipt(receipt, IDENTITY, receipt.payload.idempotencyKey, APPROVAL_ID, BASELINE).draft,
    ).toBe(true);
    expect(() =>
      parseJiraPromotionDraftReceipt(
        { ...receipt, payload: { ...receipt.payload, draft: false } },
        IDENTITY,
        receipt.payload.idempotencyKey,
        APPROVAL_ID,
        BASELINE,
      ),
    ).toThrow(/draft-only/);
  });

  it("parses projection and promotion authoritative reads and ledger states", () => {
    const projectionKey = "jira-sync/AICOE-123:PJ-1001:3:projection#jiraSyncWrite#0";
    const projectionReceipt = {
      schemaVersion: 1,
      payload: { ...IDENTITY, operation: "projection", idempotencyKey: projectionKey, status: "written" },
    };
    expect(parseJiraSyncWriteReceipt(projectionReceipt, IDENTITY, "projection", projectionKey)).toEqual({
      ...IDENTITY,
      operation: "projection",
      idempotencyKey: projectionKey,
    });
    expect(parseJiraSyncLedgerStatus(null, IDENTITY, "projection", projectionKey)).toEqual({ status: "absent" });
    expect(
      parseJiraSyncLedgerStatus(
        { ...projectionReceipt, payload: { ...projectionReceipt.payload, status: "pending" } },
        IDENTITY,
        "projection",
        projectionKey,
      ),
    ).toEqual({ status: "pending" });
    expect(parseJiraSyncLedgerStatus(projectionReceipt, IDENTITY, "projection", projectionKey).status).toBe("written");

    const eligibility = {
      schemaVersion: 1,
      payload: { ...IDENTITY, engineeringReady: true, approved: true, approvalId: APPROVAL_ID, baseline: BASELINE },
    };
    expect(parseJiraPromotionEligibility(eligibility, IDENTITY, APPROVAL_ID).baseline).toEqual(BASELINE);
    expect(
      parseJiraBaselineReceipt({ schemaVersion: 1, payload: { ...IDENTITY, baseline: BASELINE } }, IDENTITY),
    ).toEqual(BASELINE);

    const promotionKey = "jira-sync/AICOE-123:PJ-1001:3:promotion#activity#0";
    const promotionReceipt = {
      schemaVersion: 1,
      payload: {
        ...IDENTITY,
        operation: "promotion",
        status: "written",
        result: "created",
        idempotencyKey: promotionKey,
        approvalId: APPROVAL_ID,
        baseline: BASELINE,
        draft: true,
      },
    };
    expect(parseJiraPromotionLedgerStatus(null, IDENTITY, promotionKey, APPROVAL_ID, BASELINE)).toEqual({
      status: "absent",
    });
    expect(
      parseJiraPromotionLedgerStatus(
        { ...promotionReceipt, payload: { ...promotionReceipt.payload, status: "pending" } },
        IDENTITY,
        promotionKey,
        APPROVAL_ID,
        BASELINE,
      ),
    ).toEqual({ status: "pending" });
    expect(parseJiraPromotionLedgerStatus(promotionReceipt, IDENTITY, promotionKey, APPROVAL_ID, BASELINE).status).toBe(
      "written",
    );
    expect(parseJiraPromotionWriteResult(promotionReceipt, IDENTITY, promotionKey, APPROVAL_ID, BASELINE).kind).toBe(
      "created",
    );
  });

  it("parses transition authorization, receipts, and ledger states", () => {
    const targetStatusId = "10042";
    const key = "jira-sync/AICOE-123:PJ-1001:3:transition#transitionJiraStatus#0";
    const authorization = {
      schemaVersion: 1,
      payload: { ...IDENTITY, approved: true, approvalId: APPROVAL_ID, targetStatusId, baseline: BASELINE },
    };
    expect(parseJiraTransitionAuthorization(authorization, IDENTITY, APPROVAL_ID, targetStatusId).approved).toBe(true);

    const receipt = {
      schemaVersion: 1,
      payload: {
        ...IDENTITY,
        operation: "transition",
        status: "written",
        result: "transitioned",
        idempotencyKey: key,
        approvalId: APPROVAL_ID,
        targetStatusId,
        baseline: BASELINE,
        transitioned: true,
      },
    };
    expect(parseJiraTransitionReceipt(receipt, IDENTITY, key, APPROVAL_ID, targetStatusId, BASELINE).transitioned).toBe(
      true,
    );
    expect(parseJiraTransitionLedgerStatus(null, IDENTITY, key, APPROVAL_ID, targetStatusId, BASELINE)).toEqual({
      status: "absent",
    });
    expect(
      parseJiraTransitionLedgerStatus(
        { ...receipt, payload: { ...receipt.payload, status: "pending" } },
        IDENTITY,
        key,
        APPROVAL_ID,
        targetStatusId,
        BASELINE,
      ),
    ).toEqual({ status: "pending" });
    expect(parseJiraTransitionLedgerStatus(receipt, IDENTITY, key, APPROVAL_ID, targetStatusId, BASELINE).status).toBe(
      "written",
    );
    expect(parseJiraTransitionWriteResult(receipt, IDENTITY, key, APPROVAL_ID, targetStatusId, BASELINE).kind).toBe(
      "transitioned",
    );
  });

  it("requires a genuinely different observed baseline for stale CAS results", () => {
    const key = "jira-sync/AICOE-123:PJ-1001:3:promotion#activity#0";
    expect(() =>
      parseJiraPromotionWriteResult(
        { schemaVersion: 1, payload: { ...IDENTITY, result: "stale", observedBaseline: BASELINE } },
        IDENTITY,
        key,
        APPROVAL_ID,
        BASELINE,
      ),
    ).toThrow(/different baseline/);

    const observed = { ...BASELINE, fieldHash: "b".repeat(64) };
    expect(
      parseJiraTransitionWriteResult(
        { schemaVersion: 1, payload: { ...IDENTITY, result: "stale", observedBaseline: observed } },
        IDENTITY,
        "jira-sync/key#transitionJiraStatus#0",
        APPROVAL_ID,
        "10042",
        BASELINE,
      ),
    ).toEqual({ kind: "stale", observedBaseline: observed });
  });
});
