// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-002 / TMP-003
// Plane sync の封筒・receipt 束縛検証 matrix（純粋判定側）。

import { describe, expect, it } from "vitest";

import {
  assertPlaneSyncRequest,
  parsePlanePromotionDraftReceipt,
  parsePlanePromotionEligibility,
  parsePlaneRevisionReceipt,
  parsePlaneSyncLedgerStatus,
  parsePlaneSyncWriteReceipt,
  type PlaneSyncIdentity,
} from "../src/lib/planeSyncState.js";

const IDENTITY: PlaneSyncIdentity = {
  externalSource: "github",
  externalId: "issue-42",
  projectId: "proj-1",
  mappingVersion: 3,
};
const KEY = "plane-sync/github:issue-42:proj-1:3:projection#planeSyncWrite#0";

const withIdentity = (extra: Record<string, unknown>) => ({
  schemaVersion: 1,
  payload: { ...IDENTITY, ...extra },
});

describe("FinalArch:CON-002 plane sync 要求の封筒検証", () => {
  const VALID = withIdentity({ executionMode: "active", operations: ["projection", "event", "promotion"] });

  it("正しい要求は通る", () => {
    expect(() => assertPlaneSyncRequest(VALID)).not.toThrow();
  });

  it("dedupe 恒等・executionMode・operations（空/重複/不正）の不正は RangeError", () => {
    const p = VALID.payload;
    const cases: unknown[] = [
      null,
      [],
      { ...VALID, schemaVersion: 2 },
      { schemaVersion: 1, payload: { ...p, externalSource: "GitHub" } },
      { schemaVersion: 1, payload: { ...p, externalId: "" } },
      { schemaVersion: 1, payload: { ...p, projectId: "a b" } },
      { schemaVersion: 1, payload: { ...p, mappingVersion: 0 } },
      { schemaVersion: 1, payload: { ...p, mappingVersion: 1.5 } },
      { schemaVersion: 1, payload: { ...p, executionMode: "dry" } },
      { schemaVersion: 1, payload: { ...p, operations: [] } },
      { schemaVersion: 1, payload: { ...p, operations: ["projection", "projection"] } },
      { schemaVersion: 1, payload: { ...p, operations: ["merge"] } },
    ];
    for (const invalid of cases) {
      expect(() => assertPlaneSyncRequest(invalid), JSON.stringify(invalid) ?? "undefined").toThrow(RangeError);
    }
  });
});

describe("TMP-003 write receipt / 三値 ledger の束縛", () => {
  it("write receipt: dedupe 恒等 + key の完全一致のみ受理", () => {
    expect(parsePlaneSyncWriteReceipt(withIdentity({ idempotencyKey: KEY }), IDENTITY, KEY)).toEqual({
      ...IDENTITY,
      idempotencyKey: KEY,
    });
    for (const bad of [
      null,
      withIdentity({ idempotencyKey: "forged#key#0" }),
      { schemaVersion: 1, payload: { ...IDENTITY, externalId: "issue-43", idempotencyKey: KEY } },
      { schemaVersion: 1, payload: { ...IDENTITY, mappingVersion: 4, idempotencyKey: KEY } },
    ]) {
      expect(() => parsePlaneSyncWriteReceipt(bad, IDENTITY, KEY), JSON.stringify(bad)).toThrow(RangeError);
    }
  });

  it("ledger: absent|pending|written の三値で written のみ receipt 束縛", () => {
    expect(parsePlaneSyncLedgerStatus(null, IDENTITY, KEY)).toEqual({ status: "absent" });
    expect(parsePlaneSyncLedgerStatus(withIdentity({ status: "pending" }), IDENTITY, KEY)).toEqual({
      status: "pending",
    });
    expect(parsePlaneSyncLedgerStatus(withIdentity({ status: "written", idempotencyKey: KEY }), IDENTITY, KEY)).toEqual(
      { status: "written", receipt: { ...IDENTITY, idempotencyKey: KEY } },
    );
    for (const bad of [
      withIdentity({ status: "done" }),
      withIdentity({ status: "written", idempotencyKey: "forged#key#0" }),
      { schemaVersion: 1, payload: { ...IDENTITY, projectId: "proj-2", status: "pending" } },
    ]) {
      expect(() => parsePlaneSyncLedgerStatus(bad, IDENTITY, KEY), JSON.stringify(bad)).toThrow(RangeError);
    }
  });
});

describe("promotion の eligibility / revision / draft receipt", () => {
  it("eligibility は恒等 + boolean 2 種 + baseline を束縛", () => {
    expect(
      parsePlanePromotionEligibility(
        withIdentity({ engineeringReady: true, approved: true, baselineRevision: "rev-7" }),
        IDENTITY,
      ),
    ).toEqual({ ...IDENTITY, engineeringReady: true, approved: true, baselineRevision: "rev-7" });
    for (const bad of [
      withIdentity({ engineeringReady: "yes", approved: true, baselineRevision: "rev-7" }),
      withIdentity({ engineeringReady: true, approved: true, baselineRevision: " " }),
      {
        schemaVersion: 1,
        payload: {
          ...IDENTITY,
          externalSource: "plane",
          engineeringReady: true,
          approved: true,
          baselineRevision: "rev-7",
        },
      },
    ]) {
      expect(() => parsePlanePromotionEligibility(bad, IDENTITY), JSON.stringify(bad)).toThrow(RangeError);
    }
  });

  it("revision receipt は恒等 + 形式を検証", () => {
    expect(parsePlaneRevisionReceipt(withIdentity({ revision: "rev-8" }), IDENTITY)).toBe("rev-8");
    expect(() => parsePlaneRevisionReceipt(withIdentity({ revision: "" }), IDENTITY)).toThrow(RangeError);
  });

  it("draft receipt: baseline echo + draft:true の欠如・偽装は拒否（draft 境界の機械的束縛）", () => {
    const DKEY = "plane-sync/github:issue-42:proj-1:3:promotion#createPromotionDraft#0";
    expect(
      parsePlanePromotionDraftReceipt(
        withIdentity({ idempotencyKey: DKEY, baselineRevision: "rev-7", draft: true }),
        IDENTITY,
        DKEY,
        "rev-7",
      ),
    ).toEqual({ ...IDENTITY, idempotencyKey: DKEY, baselineRevision: "rev-7", draft: true });
    for (const bad of [
      withIdentity({ idempotencyKey: DKEY, baselineRevision: "rev-8", draft: true }), // baseline 不一致
      withIdentity({ idempotencyKey: DKEY, baselineRevision: "rev-7", draft: false }), // formal publish 偽装
      withIdentity({ idempotencyKey: DKEY, baselineRevision: "rev-7" }), // draft 欠如
      withIdentity({ idempotencyKey: "forged#key#0", baselineRevision: "rev-7", draft: true }),
    ]) {
      expect(() => parsePlanePromotionDraftReceipt(bad, IDENTITY, DKEY, "rev-7"), JSON.stringify(bad)).toThrow(
        RangeError,
      );
    }
  });
});
