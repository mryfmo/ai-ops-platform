// 根拠: FinalArch:FR-CP-008 / TMP-005 / WBS P3-T10
// per-workflow cutover selector の matrix と、P3-T09 shadow inventory との
// 完全一致（TMP-005: due-set の母集合が同一であることの fail-closed 保証）。

import { describe, expect, it } from "vitest";

import { resolveMigrationFlags } from "@aiops/shared";

import {
  LEGACY_SCHEDULER_FLAG_NAME,
  TEMPORAL_CUTOVER_TASK_NAMES,
  TEMPORAL_FLAG_NAME,
  resolveTemporalCutover,
} from "../src/config.js";
import { EXPECTED_SCHEDULER_REGISTRATIONS } from "../../../verification/temporal-shadow/shadow.js";

describe("WBS P3-T10 resolveTemporalCutover", () => {
  it("TMP-005: cutover の task 名母集合は P3-T09 shadow inventory と完全一致する", () => {
    expect([...TEMPORAL_CUTOVER_TASK_NAMES]).toEqual([...EXPECTED_SCHEDULER_REGISTRATIONS]);
  });

  it("false / shadow では抑止なし。list は不活性として無視される（kill switch の単一 env 復帰）", () => {
    for (const stage of ["false", "shadow"]) {
      expect(resolveTemporalCutover(stage, undefined).size).toBe(0);
      expect(resolveTemporalCutover(stage, "createHealthcheckTask").size).toBe(0);
    }
  });

  it("limited は list 記載 task のみ抑止し、残りは legacy 継続（soak の old path 可用性）", () => {
    const suppressed = resolveTemporalCutover("limited", "createHealthcheckTask, createReportDeliveryTask");
    expect([...suppressed].sort()).toEqual(["createHealthcheckTask", "createReportDeliveryTask"]);
    expect(suppressed.has("createProdMonitorTask" as never)).toBe(false);
  });

  it("limited の空 list・未知名・重複は E-CFG07 で fail-closed", () => {
    expect(() => resolveTemporalCutover("limited", undefined)).toThrow(/E-CFG07/u);
    expect(() => resolveTemporalCutover("limited", "  ")).toThrow(/E-CFG07/u);
    expect(() => resolveTemporalCutover("limited", "createFutureTask")).toThrow(/E-CFG07.*createFutureTask/u);
    expect(() => resolveTemporalCutover("limited", "createHealthcheckTask,createHealthcheckTask")).toThrow(
      /E-CFG07.*duplicate/u,
    );
  });

  it("primary は全 15 task を抑止し、list の残存は E-CFG07", () => {
    expect(resolveTemporalCutover("primary", undefined).size).toBe(15);
    expect(() => resolveTemporalCutover("primary", "createHealthcheckTask")).toThrow(/E-CFG07/u);
  });

  it("未知 stage は E-CFG07", () => {
    expect(() => resolveTemporalCutover("canary", "createHealthcheckTask")).toThrow(/E-CFG07/u);
  });

  it("kill switch: AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL=1 は limited+list 構成でも旧経路へ全復帰する", () => {
    const flags = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "limited",
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL: "1",
    });
    expect(flags.errors).toEqual([]);
    const stage = flags.states.get(TEMPORAL_FLAG_NAME) ?? "false";
    expect(stage).toBe("false");
    // kill 後も cutover env が残ったままで boot が成立し、抑止ゼロ = legacy 全稼働。
    expect(resolveTemporalCutover(stage, "createHealthcheckTask").size).toBe(0);
    // legacy scheduler flag は正本 default true のまま。
    expect(flags.states.get(LEGACY_SCHEDULER_FLAG_NAME) ?? "true").toBe("true");
  });
});
