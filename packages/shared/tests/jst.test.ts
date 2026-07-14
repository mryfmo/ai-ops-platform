/**
 * packages/shared/tests/jst.test.ts
 *
 * 根拠: ADR-0005 / PrjOps:SPEC-INT-060 / AUD-REL-007（JST計算の単一化）。
 */
import { describe, expect, it } from "vitest";
import { fromJstClock, jstDayRange, toJstClock } from "../src/jst.js";

describe("JST utilities (PrjOps:SPEC-INT-060 / AUD-REL-007)", () => {
  it.each(["2026-03-08T06:30:00Z", "2026-11-01T06:30:00Z"])("米国DST切替日でもJSTは固定UTC+9 (%s)", (iso) => {
    const instant = new Date(iso);
    expect(toJstClock(instant).getTime() - instant.getTime()).toBe(9 * 60 * 60 * 1000);
  });

  it("JST暦日の往復と日境界をホストTZに依存せずUTCで返す", () => {
    expect(fromJstClock(2026, 6, 7).toISOString()).toBe("2026-07-06T15:00:00.000Z");
    expect(jstDayRange(new Date("2026-07-06T14:59:59.999Z"))).toEqual({
      startIso: "2026-07-05T15:00:00.000Z",
      endIso: "2026-07-06T15:00:00.000Z",
    });
    expect(jstDayRange(new Date("2026-07-06T15:00:00.000Z"))).toEqual({
      startIso: "2026-07-06T15:00:00.000Z",
      endIso: "2026-07-07T15:00:00.000Z",
    });
  });
});
