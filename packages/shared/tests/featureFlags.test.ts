/**
 * packages/shared/tests/featureFlags.test.ts
 *
 * 根拠: FinalArch:FR-CP-008 / FinalArch:GOV-004 / FinalArch:GOV-005 / FinalArch:INV-013 / ADR-0020
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  MIGRATION_FLAGS,
  migrationFlagAllowedValues,
  migrationFlagEnvName,
  resolveMigrationFlags,
} from "../src/migration/featureFlags.js";

interface CanonicalFlag {
  name: string;
  default: boolean;
  owner: string;
  stages?: string[];
  modes?: string[];
  kill_switch?: boolean;
  immutable_false?: boolean;
  mutually_exclusive_primary_with?: string;
  requires?: string[];
  scope?: string;
  note?: string;
}

const canonicalPath = join(
  __dirname,
  "../../../docs/plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml",
);
const canonical = (parse(readFileSync(canonicalPath, "utf8")) as { flags: CanonicalFlag[] }).flags;

describe("FinalArch:FR-CP-008 registry mirrors the canonical YAML", () => {
  it("matches every canonical record field-for-field (independent YAML parse)", () => {
    const runtime = MIGRATION_FLAGS.map((f) => ({
      name: f.name,
      default: f.default === "true",
      owner: f.owner,
      ...(f.stages ? { stages: [...f.stages] } : {}),
      ...(f.modes ? { modes: [...f.modes] } : {}),
      ...(f.killSwitch ? { kill_switch: true } : {}),
      ...(f.immutableFalse ? { immutable_false: true } : {}),
      ...(f.mutuallyExclusivePrimaryWith ? { mutually_exclusive_primary_with: f.mutuallyExclusivePrimaryWith } : {}),
      ...(f.requires ? { requires: [...f.requires] } : {}),
      ...(f.scope ? { scope: f.scope } : {}),
      ...(f.note ? { note: f.note } : {}),
    }));
    expect(runtime).toEqual(canonical);
  });

  it("derives env names from dotted names", () => {
    expect(migrationFlagEnvName("control.temporal.enabled")).toBe("AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED");
  });
});

describe("FinalArch:GOV-005 fail-closed resolution", () => {
  it("with no env, every flag sits at its canonical default (legacy scheduler stays true)", () => {
    const { states, errors } = resolveMigrationFlags({});
    expect(errors).toEqual([]);
    for (const flag of canonical) {
      expect(states.get(flag.name)).toBe(String(flag.default));
    }
    expect(states.get("control.legacy_scheduler.enabled")).toBe("true");
  });

  it("accepts each flag's own canonical vocabulary (read-only / log-only / suggestion)", () => {
    const { states, errors } = resolveMigrationFlags({
      AIOPS_FLAG_ACCESS_AGENTGATEWAY_ENABLED: "read-only",
      AIOPS_FLAG_POLICY_OPA_ENFORCE: "log-only",
      AIOPS_FLAG_AIOPS_INCIDENT_RCA_ENABLED: "suggestion",
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "shadow",
    });
    expect(errors).toEqual([]);
    expect(states.get("access.agentgateway.enabled")).toBe("read-only");
    expect(states.get("policy.opa.enforce")).toBe("log-only");
    expect(states.get("aiops.incident_rca.enabled")).toBe("suggestion");
    expect(states.get("control.temporal.enabled")).toBe("shadow");
  });

  it("E-FLAG01 rejects another flag's vocabulary and invented values", () => {
    for (const [envName, value] of [
      ["AIOPS_FLAG_ACCESS_AGENTGATEWAY_ENABLED", "shadow"],
      ["AIOPS_FLAG_POLICY_OPA_ENFORCE", "primary"],
      ["AIOPS_FLAG_AIOPS_INCIDENT_RCA_ENABLED", "limited"],
      ["AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED", "on"],
      ["AIOPS_FLAG_MEETINGS_WISPR_ENABLED", "shadow"],
    ] as const) {
      const { errors } = resolveMigrationFlags({ [envName]: value });
      expect(
        errors.some((e) => e.startsWith(`E-FLAG01: ${envName}`)),
        `${envName}=${value}`,
      ).toBe(true);
    }
  });

  it("boolean flags accept only false/true", () => {
    const ok = resolveMigrationFlags({ AIOPS_FLAG_MEETINGS_WISPR_ENABLED: "true" });
    expect(ok.errors).toEqual([]);
    expect(ok.states.get("meetings.wispr.enabled")).toBe("true");
  });

  it("FinalArch:INV-013 E-FLAG02 keeps immutable-off flags off and reports the attempt", () => {
    for (const envName of [
      "AIOPS_FLAG_CLOUDFLARE_ARTIFACTS_ENABLED",
      "AIOPS_FLAG_NOTION_BASELINE_ENABLED",
      "AIOPS_FLAG_AIOPS_AUTO_PRODUCTION_REMEDIATION_ENABLED",
    ]) {
      const { states, errors } = resolveMigrationFlags({ [envName]: "true" });
      expect(errors.some((e) => e.startsWith(`E-FLAG02: ${envName}`))).toBe(true);
      for (const [, state] of states) expect(state).not.toBe(undefined);
    }
    const { states } = resolveMigrationFlags({ AIOPS_FLAG_CLOUDFLARE_ARTIFACTS_ENABLED: "true" });
    expect(states.get("cloudflare.artifacts.enabled")).toBe("false");
  });

  it("treats empty-string env values as unset (canonical default applies)", () => {
    const { states, errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "" });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("false");
  });

  it("E-FLAG04 rejects unknown AIOPS_FLAG_* variables (typos are not silently inert)", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLE: "primary" });
    expect(errors.some((e) => e.startsWith("E-FLAG04"))).toBe(true);
  });

  it("rejects a kill-switch variable on a flag without killSwitch as unknown", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_MEETINGS_WISPR_ENABLED_KILL: "1" });
    expect(errors.some((e) => e.startsWith("E-FLAG04"))).toBe(true);
  });
});

describe("FinalArch:GOV-004 kill-switch grammar", () => {
  it("KILL=1 overrides an enabled stage to false", () => {
    const { states, errors } = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary",
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL: "1",
      AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED: "false",
    });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("false");
  });

  it("KILL=0 and empty are inactive", () => {
    const { states, errors } = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "shadow",
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL: "0",
    });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("shadow");
  });

  it("E-FLAG05: malformed kill values (true, typo) are configuration errors, not silent no-ops", () => {
    for (const bad of ["true", "yes", "kill", "01"]) {
      const { errors } = resolveMigrationFlags({
        AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary",
        AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED_KILL: bad,
        AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED: "false",
      });
      expect(
        errors.some((e) => e.startsWith("E-FLAG05")),
        `KILL=${bad}`,
      ).toBe(true);
    }
  });
});

describe("FinalArch:FR-CP-008 one-writer mutual exclusion (canonical direction)", () => {
  it("E-FLAG03: temporal primary with the default-on legacy scheduler is rejected", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary" });
    expect(errors.some((e) => e.startsWith("E-FLAG03"))).toBe(true);
  });

  it("E-FLAG03: explicitly enabling both writers is rejected", () => {
    const { errors } = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary",
      AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED: "true",
    });
    expect(errors.some((e) => e.startsWith("E-FLAG03"))).toBe(true);
  });

  it("temporal primary requires the legacy scheduler to be explicitly false", () => {
    const { states, errors } = resolveMigrationFlags({
      AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "primary",
      AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED: "false",
    });
    expect(errors).toEqual([]);
    expect(states.get("control.temporal.enabled")).toBe("primary");
    expect(states.get("control.legacy_scheduler.enabled")).toBe("false");
  });

  it("non-primary temporal stages coexist with the running legacy scheduler (shadow migration)", () => {
    const { errors } = resolveMigrationFlags({ AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED: "shadow" });
    expect(errors).toEqual([]);
  });
});

describe("allowed-value derivation", () => {
  it("immutable-off flags admit only false; staged/moded flags admit false + their own ladder", () => {
    const byName = new Map(MIGRATION_FLAGS.map((f) => [f.name, f]));
    expect(migrationFlagAllowedValues(byName.get("cloudflare.artifacts.enabled")!)).toEqual(["false"]);
    expect(migrationFlagAllowedValues(byName.get("access.agentgateway.enabled")!)).toEqual([
      "false",
      "read-only",
      "draft",
      "limited-write",
    ]);
    expect(migrationFlagAllowedValues(byName.get("policy.opa.enforce")!)).toEqual(["false", "log-only", "enforce"]);
    expect(migrationFlagAllowedValues(byName.get("meetings.wispr.enabled")!)).toEqual(["false", "true"]);
  });
});
