/**
 * 根拠: PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
import { describe, expect, it } from "vitest";
import {
  METRIC_DISPLAY_NAMES_VERSION,
  metricDisplayDefinition,
  metricKeyForPublicId,
  undefinedMetricDisplayKeys,
} from "../src/reporting/metricDisplayNames.js";

describe("metric display names [PrjOps:REQ-019 PrjOps:SPEC-INT-051]", () => {
  it("versioned辞書で内部keyを公開IDと表示名へ写像する", () => {
    expect(METRIC_DISPLAY_NAMES_VERSION).toMatch(/^metric-display-names\.v\d+$/);
    expect(metricDisplayDefinition("completed")).toEqual({
      publicId: "MTR-COMPLETED",
      displayName: { ja: "完了件数", en: "Completed" },
    });
    expect(metricKeyForPublicId("MTR-COMPLETED")).toBe("completed");
  });

  it("未知keyをfail-closedで未定義として列挙する", () => {
    expect(metricDisplayDefinition("secret_internal_key")).toBeUndefined();
    expect(undefinedMetricDisplayKeys(["completed", "secret_internal_key", "another_unknown"])).toEqual([
      "another_unknown",
      "secret_internal_key",
    ]);
  });
});
