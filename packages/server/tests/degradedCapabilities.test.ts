/**
 * packages/server/tests/degradedCapabilities.test.ts
 *
 * 根拠: ADR-0014 / ADR-0005 / DevOps:REQ-028。縮退が積み重なった状態を機械可読にする判定を検証する。
 *   所見 ADV-INT-052 / ADV-INT-007 / ADV-INT-050。
 */
import { describe, expect, it } from "vitest";
import { CAPABILITIES, reportDegradation, type CapabilityState } from "../src/lib/degradedCapabilities.js";

const allEnabled = Object.fromEntries(CAPABILITIES.map((c) => [c, true])) as CapabilityState;
const allDisabled = Object.fromEntries(CAPABILITIES.map((c) => [c, false])) as CapabilityState;

describe("reportDegradation [ADR-0014 / DevOps:REQ-028]", () => {
  it("全機能が有効なら縮退なし [DevOps:REQ-028]", () => {
    expect(reportDegradation(allEnabled)).toEqual({ disabled: [], degraded: false });
  });

  it("必須envのみの最小構成に相当する全無効を列挙する [DevOps:REQ-028]", () => {
    // 06章D7cで実観測した状態。従来これは /healthz /readyz とも 200 で、外からは健全に見えた。
    const report = reportDegradation(allDisabled);

    expect(report.degraded).toBe(true);
    expect(report.disabled).toEqual([...CAPABILITIES]);
  });

  it.each([...CAPABILITIES])("%s だけが無効でも検出する [DevOps:REQ-028]", (capability) => {
    const report = reportDegradation({ ...allEnabled, [capability]: false });

    expect(report.degraded).toBe(true);
    expect(report.disabled).toEqual([capability]);
  });

  it("購読ゼロを縮退として扱う（台帳行の消失が監査すら残さず止まる問題） [DevOps:REQ-028]", () => {
    const report = reportDegradation({ ...allEnabled, graph_subscriptions: false });

    expect(report.disabled).toContain("graph_subscriptions");
  });
});
