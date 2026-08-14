// 根拠: FinalArch:FR-CP-001 / TMP-001 / TMP-003 / TMP-004 / WBS P3-T11
// 全 durable workflow の決定的 chaos matrix と committed evidence の一致を検証する。

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { runChaosSuite } from "../../../verification/chaos/run.js";

describe("WBS P3-T11 durable execution chaos suite", () => {
  it("TMP-001/TMP-004: 全 workflow が restart/timeout/duplicate/approval chaos 下で recover または explicit fail する", async () => {
    const evidence = await runChaosSuite();
    const committed = JSON.parse(
      await readFile(new URL("../../../verification/chaos/chaos-evidence.json", import.meta.url), "utf8"),
    );
    expect(evidence).toEqual(committed);
    expect(evidence.summary.runningWedges).toBe(0);
    expect(evidence.summary.silentSuccesses).toBe(0);
    expect(evidence.summary.duplicateSideEffects).toBe(0);
  }, 600_000);
});
