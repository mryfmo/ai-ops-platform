/**
 * 根拠: PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
import { describe, expect, it } from "vitest";
import {
  SPEC_INTERNAL_TERMS,
  SPEC_INTERNAL_TERMS_PROVIDER,
  SPEC_INTERNAL_TERMS_VERSION,
} from "../src/reporting/internalTerms.js";

describe("internalTerms [PrjOps:SPEC-INT-051 PrjOps:AC-019-1]", () => {
  it("仕様に明記された語がない初版をversion付きempty providerとして公開する", () => {
    expect(SPEC_INTERNAL_TERMS_VERSION).toBe("PrjOps:SPEC-INT-051@2026-08-08");
    expect(SPEC_INTERNAL_TERMS).toEqual([]);
    expect(SPEC_INTERNAL_TERMS_PROVIDER.version).toBe(SPEC_INTERNAL_TERMS_VERSION);
    expect(SPEC_INTERNAL_TERMS_PROVIDER.listInternalTerms()).toBe(SPEC_INTERNAL_TERMS);
  });
});
