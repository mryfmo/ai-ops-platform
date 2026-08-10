/**
 * packages/shared/tests/featureFlags.test.ts
 *
 * 根拠: FinalArch:FR-CP-008 / FinalArch:GOV-004 / FinalArch:GOV-005 / FinalArch:INV-013 / ADR-0020
 */
import { describe, expect, it } from "vitest";
import {
  MIGRATION_FLAGS,
  MIGRATION_STAGES,
  migrationFlagEnvName,
  resolveMigrationFlags,
} from "../src/migration/featureFlags.js";

describe("FinalArch:FR-CP-008 migration flag registry", () => {
  it("registers exactly the flags of the canonical YAML (20 flags, unique names)", () => {
    expect(MIGRATION_FLAGS).toHaveLength(20);
    expect(new Set(MIGRATION_FLAGS.map((f) => f.name)).size).toBe(20);
  });

  it("derives env names from dotted names", () => {
    expect(migrationFlagEnvName("control.temporal.enabled")).toBe("AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED");
  });

  it("FinalArch:GOV-005 defaults every flag to disabled with no env (fail closed)", () => {
    const { states, errors } = resolveMigrationFlags({});
    expect(errors).toEqual([]);
    for (const flag of MIGRATION_FLAGS) expect(states.get(flag.name)).toBe("disabled");
  });

  it("accepts a staged rollout value on a staged flag", () => {
    const { states, errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "shadow" });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("shadow");
  });

  it("E-FLAG01 rejects unknown stage values instead of coercing", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "on" });
    expect(errors.some((e) => e.startsWith("E-FLAG01"))).toBe(true);
  });

  it("E-FLAG01 rejects intermediate stages on a binary flag", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_MEETINGS_WISPR_ENABLED: "shadow" });
    expect(errors.some((e) => e.startsWith("E-FLAG01"))).toBe(true);
  });

  it("FinalArch:INV-013 E-FLAG02 keeps immutable-off flags off and reports the attempt", () => {
    const { states, errors } = resolveMigrationFlags({ AIOPS_FLAG_CLOUDFLARE_ARTIFACTS_ENABLED: "primary" });
    expect(errors.some((e) => e.startsWith("E-FLAG02"))).toBe(true);
    expect(states.get("cloudflare.artifacts.enabled")).toBe("disabled");
  });

  it("FinalArch:GOV-004 kill switch overrides an enabled stage", () => {
    const { states, errors } = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary",
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL: "1",
    });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("disabled");
  });

  it("E-FLAG03 rejects both sides of a mutual exclusion at primary", () => {
    const { errors } = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary",
      AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED: "primary",
    });
    expect(errors.some((e) => e.startsWith("E-FLAG03"))).toBe(true);
  });

  it("allows temporal primary while the legacy scheduler is disabled", () => {
    const { states, errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary" });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("primary");
    expect(states.get("control.legacy_scheduler.enabled")).toBe("disabled");
  });

  it("E-FLAG04 rejects unknown AIOPS_FLAG_* variables (typos are not silently inert)", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLE: "primary" });
    expect(errors.some((e) => e.startsWith("E-FLAG04"))).toBe(true);
  });

  it("ignores a kill-switch variable on a flag without killSwitch as unknown", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_MEETINGS_WISPR_ENABLED_KILL: "1" });
    expect(errors.some((e) => e.startsWith("E-FLAG04"))).toBe(true);
  });

  it("treats empty-string env values as unset", () => {
    const { states, errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "" });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("disabled");
  });

  it("every declared stages list is a subset of MIGRATION_STAGES and includes disabled", () => {
    for (const flag of MIGRATION_FLAGS) {
      for (const s of flag.stages ?? []) expect(MIGRATION_STAGES).toContain(s);
      if (flag.stages) expect(flag.stages).toContain("disabled");
    }
  });
});
