// 根拠: FinalArch:FR-CP-001 / PrjOps:SPEC-INT-052 / TMP-003
// report delivery の封筒・receipt 束縛検証 matrix（純粋判定側）。

import { describe, expect, it } from "vitest";

import {
  assertReportDeliveryRequest,
  parseReportDeliveryLedgerStatus,
  parseReportDeliveryReceipt,
  parseReportGenerationReceipt,
  parseReportProfileReceipt,
  parseReportValidationReceipt,
  profileRequiresApproval,
} from "../src/lib/reportDeliveryState.js";

const APPROVAL_ID = "0f6f2f6a-9f2e-4e6d-8a4b-2b8f6f2f6a9f";
const VALID = {
  schemaVersion: 1,
  payload: {
    reportId: "weekly-2026-08",
    approval: { approvalId: APPROVAL_ID, approvalVersion: 1, approvalExpiryMs: 1 },
    executionMode: "active",
    recipients: [{ recipientId: "user-1" }, { recipientId: "user-2" }],
    requestedBy: "scheduler",
  },
};

describe("PrjOps:SPEC-INT-052 report delivery 要求の封筒検証", () => {
  it("正しい要求は通る（approval あり / null 両方）", () => {
    expect(() => assertReportDeliveryRequest(VALID)).not.toThrow();
    expect(() =>
      assertReportDeliveryRequest({ schemaVersion: 1, payload: { ...VALID.payload, approval: null } }),
    ).not.toThrow();
  });

  it("封筒・ID・recipients（空/重複/不正 ID）・requestedBy の不正は RangeError", () => {
    const p = VALID.payload;
    const cases: unknown[] = [
      null,
      [],
      "request",
      { ...VALID, schemaVersion: 2 },
      { schemaVersion: 1, payload: null },
      { schemaVersion: 1, payload: { ...p, reportId: "" } },
      { schemaVersion: 1, payload: { ...p, reportId: "a#b" } },
      { schemaVersion: 1, payload: { ...p, approval: { ...p.approval, approvalId: "not-a-uuid" } } },
      { schemaVersion: 1, payload: { ...p, approval: { ...p.approval, approvalVersion: 0 } } },
      { schemaVersion: 1, payload: { ...p, approval: { ...p.approval, approvalExpiryMs: 0 } } },
      { schemaVersion: 1, payload: { ...p, approval: undefined } },
      { schemaVersion: 1, payload: { ...p, approval: "auto" } },
      { schemaVersion: 1, payload: { ...p, executionMode: "dry-run" } },
      { schemaVersion: 1, payload: { ...p, recipients: [] } },
      { schemaVersion: 1, payload: { ...p, recipients: [{ recipientId: "user-1" }, { recipientId: "user-1" }] } },
      { schemaVersion: 1, payload: { ...p, recipients: [{ recipientId: "  " }] } },
      { schemaVersion: 1, payload: { ...p, recipients: ["user-1"] } },
      { schemaVersion: 1, payload: { ...p, requestedBy: "" } },
    ];
    for (const invalid of cases) {
      expect(() => assertReportDeliveryRequest(invalid), JSON.stringify(invalid) ?? "undefined").toThrow(RangeError);
    }
  });
});

describe("PrjOps:SPEC-INT-052 receipt は要求へ束縛される", () => {
  const KEY = "report/delivery:weekly-2026-08:user-1#deliverReport#0";

  it("generation receipt: reportId 一致 + 非空 checksum のみ受理", () => {
    expect(
      parseReportGenerationReceipt(
        { schemaVersion: 1, payload: { reportId: "weekly-2026-08", contentChecksum: "abc" } },
        "weekly-2026-08",
      ),
    ).toEqual({ reportId: "weekly-2026-08", contentChecksum: "abc" });
    for (const bad of [
      null,
      {},
      { schemaVersion: 1, payload: { reportId: "other", contentChecksum: "abc" } },
      { schemaVersion: 1, payload: { reportId: "weekly-2026-08", contentChecksum: " " } },
    ]) {
      expect(() => parseReportGenerationReceipt(bad, "weekly-2026-08"), JSON.stringify(bad)).toThrow(RangeError);
    }
  });

  it("validation receipt: invalid には非空 reason 必須。valid の reason は null 化", () => {
    expect(
      parseReportValidationReceipt(
        { schemaVersion: 1, payload: { reportId: "weekly-2026-08", valid: true, reason: "ignored" } },
        "weekly-2026-08",
      ),
    ).toEqual({ reportId: "weekly-2026-08", valid: true, reason: null });
    expect(
      parseReportValidationReceipt(
        { schemaVersion: 1, payload: { reportId: "weekly-2026-08", valid: false, reason: "missing numbers" } },
        "weekly-2026-08",
      ),
    ).toEqual({ reportId: "weekly-2026-08", valid: false, reason: "missing numbers" });
    expect(() =>
      parseReportValidationReceipt(
        { schemaVersion: 1, payload: { reportId: "weekly-2026-08", valid: false, reason: " " } },
        "weekly-2026-08",
      ),
    ).toThrow(RangeError);
  });

  it("delivery receipt: reportId・recipientId・idempotencyKey の三点一致のみ受理", () => {
    const ok = {
      schemaVersion: 1,
      payload: { reportId: "weekly-2026-08", recipientId: "user-1", idempotencyKey: KEY },
    };
    expect(parseReportDeliveryReceipt(ok, "weekly-2026-08", "user-1", KEY)).toEqual({
      reportId: "weekly-2026-08",
      recipientId: "user-1",
      idempotencyKey: KEY,
    });
    for (const [r, u, k] of [
      ["other", "user-1", KEY],
      ["weekly-2026-08", "user-2", KEY],
      ["weekly-2026-08", "user-1", "forged#key#0"],
    ] as const) {
      expect(() => parseReportDeliveryReceipt(ok, r, u, k), `${r}/${u}/${k}`).toThrow(RangeError);
    }
  });

  it("P3-T07-001: profile receipt は正典対応（PRF-04/05 のみ承認必須）と矛盾すると拒否", () => {
    for (const [profile, requiresApproval] of [
      ["PRF-01", false],
      ["PRF-02", false],
      ["PRF-03", false],
      ["PRF-04", true],
      ["PRF-05", true],
    ] as const) {
      expect(profileRequiresApproval(profile)).toBe(requiresApproval);
      expect(
        parseReportProfileReceipt(
          { schemaVersion: 1, payload: { reportId: "weekly-2026-08", profile, requiresApproval } },
          "weekly-2026-08",
        ),
      ).toEqual({ reportId: "weekly-2026-08", profile, requiresApproval });
      // bypass（承認必須を false と偽る）/ 捏造（承認不要に true）を両方向で拒否。
      expect(() =>
        parseReportProfileReceipt(
          {
            schemaVersion: 1,
            payload: { reportId: "weekly-2026-08", profile, requiresApproval: !requiresApproval },
          },
          "weekly-2026-08",
        ),
      ).toThrow(RangeError);
    }
    for (const bad of [
      null,
      { schemaVersion: 1, payload: { reportId: "other", profile: "PRF-04", requiresApproval: true } },
      { schemaVersion: 1, payload: { reportId: "weekly-2026-08", profile: "PRF-09", requiresApproval: true } },
    ]) {
      expect(() => parseReportProfileReceipt(bad, "weekly-2026-08"), JSON.stringify(bad)).toThrow(RangeError);
    }
  });

  it("P3-T07-002: ledger status は absent|pending|sent の三値で、sent のみ receipt 束縛", () => {
    expect(parseReportDeliveryLedgerStatus(null, "weekly-2026-08", "user-1", KEY)).toEqual({ status: "absent" });
    expect(
      parseReportDeliveryLedgerStatus(
        { schemaVersion: 1, payload: { reportId: "weekly-2026-08", recipientId: "user-1", status: "pending" } },
        "weekly-2026-08",
        "user-1",
        KEY,
      ),
    ).toEqual({ status: "pending" });
    expect(
      parseReportDeliveryLedgerStatus(
        {
          schemaVersion: 1,
          payload: {
            reportId: "weekly-2026-08",
            recipientId: "user-1",
            status: "sent",
            idempotencyKey: KEY,
          },
        },
        "weekly-2026-08",
        "user-1",
        KEY,
      ),
    ).toEqual({ status: "sent", receipt: { reportId: "weekly-2026-08", recipientId: "user-1", idempotencyKey: KEY } });
    for (const bad of [
      { schemaVersion: 1, payload: { reportId: "other", recipientId: "user-1", status: "pending" } },
      { schemaVersion: 1, payload: { reportId: "weekly-2026-08", recipientId: "user-2", status: "pending" } },
      { schemaVersion: 1, payload: { reportId: "weekly-2026-08", recipientId: "user-1", status: "queued" } },
      {
        schemaVersion: 1,
        payload: {
          reportId: "weekly-2026-08",
          recipientId: "user-1",
          status: "sent",
          idempotencyKey: "forged#key#0",
        },
      },
    ]) {
      expect(() => parseReportDeliveryLedgerStatus(bad, "weekly-2026-08", "user-1", KEY), JSON.stringify(bad)).toThrow(
        RangeError,
      );
    }
  });
});
