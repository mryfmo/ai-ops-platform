import { describe, it, expect } from "vitest";
import { validateLogicalDeleteRequest, applyLogicalDelete } from "../src/lib/logicalDelete.js";

describe("validateLogicalDeleteRequest [SPEC-INT-027, PrjOps:REQ-021 AC-021-1]", () => {
  it("PRF-03かつ理由ありなら許可される", () => {
    const r = validateLogicalDeleteRequest({ requesterProfile: "PRF-03", deleteReason: "重複登録のため" });
    expect(r.allowed).toBe(true);
  });
  it("PRF-02は拒否される", () => {
    const r = validateLogicalDeleteRequest({ requesterProfile: "PRF-02", deleteReason: "重複登録のため" });
    expect(r.allowed).toBe(false);
  });
  it("理由が空なら拒否される（UIレベルで完了できない, AC-021-1）", () => {
    const r = validateLogicalDeleteRequest({ requesterProfile: "PRF-03", deleteReason: "" });
    expect(r.allowed).toBe(false);
  });
  it("理由がundefinedなら拒否される", () => {
    const r = validateLogicalDeleteRequest({ requesterProfile: "PRF-03", deleteReason: undefined });
    expect(r.allowed).toBe(false);
  });
});

describe("applyLogicalDelete [SPEC-INT-027: 物理削除禁止]", () => {
  it("deletedフラグと理由・操作者・日時を付与する（元のフィールドは保持される）", () => {
    const record = { id: "PJ-001", name: "サンプル" };
    const result = applyLogicalDelete(record, "重複のため", "ST-020");
    expect(result.id).toBe("PJ-001");
    expect(result.deleted).toBe(true);
    expect(result.delete_reason).toBe("重複のため");
    expect(result.deleted_by).toBe("ST-020");
  });
});
